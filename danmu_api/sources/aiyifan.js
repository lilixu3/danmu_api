import BaseSource from './base.js';
import { log } from "../utils/log-util.js";
import { httpGet, updateQueryString } from "../utils/http-util.js";
import { convertToAsciiSum, md5 } from "../utils/codec-util.js";
import { hexToInt } from "../utils/danmu-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches } from "../utils/common-util.js";
import { simplized } from "../utils/zh-util.js";
import { globals } from '../configs/globals.js';

// =====================
// 获取爱壹帆弹幕
// =====================
export default class AiyifanSource extends BaseSource {
  constructor() {
    super();
    this.FALLBACK_PUBLIC_KEY = "CJStD3WpEJKqCouuC3TVL5TVCZGmDZfaOJ5ZEZXaEMOwPZ4mC3euEMHYEZGnEMOwDZbcPJetOpWpNpGnP69aOJ8tP30tOpGqCp8uE31YDJGnPJSoP31aCZXcNpOpD64nEMOuOpWrP6CuCpbcD3KnC3DcCcPcC68qE3Ha";
    this.FALLBACK_SALT = "StD3JStD3WpEJKqCouuC";

    this.USER_AGENT = (
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/116.0.0.0 Safari/537.36"
    );

    this.SEARCH_API = "https://rankv21.yfsp.tv/v3/list/briefsearch";
    this.PLAYLIST_API = "https://m10.yfsp.tv/v3/video/languagesplaylist";
    this.VIDEO_API = "https://m10.yfsp.tv/v3/video/play";
    this.DANMU_API = "https://m10.yfsp.tv/api/video/getBarrage";
    this.DOMAIN_API = "https://www.yfsp.tv/play";
    this.CONFIG_PAGE_API = "https://www.yfsp.tv/";
    this.DEFAULT_DN_CONFIG = "dn_config=device=desktop&player=CkPlayer&tech=HLS&region=JP&country=JP&lang=none&v=1&isDark=1&volume=0.8";
    const uidSeed = md5(`${Date.now()}_${Math.random()}_aiyifan`);
    this.DEFAULT_UID = `_uid=${uidSeed.slice(0, 8)}-${uidSeed.slice(8, 12)}-${uidSeed.slice(12, 16)}-${uidSeed.slice(16, 20)}-${uidSeed.slice(20, 32)}`;
    this.signingConfig = null;
    this.signingConfigFetchedAt = 0;
    this.SIGNING_CONFIG_TTL_MS = 60 * 1000;
  }

  computeVv(params, signingConfig) {
    const sortedParams = Object.keys(params)
      .map(k => `${k}=${params[k]}`)
      .join('&');
    const raw = signingConfig.publicKey + "&" + sortedParams.toLowerCase() + "&" + signingConfig.privateKey;
    return md5(raw);
  }

  getFallbackSigningConfig() {
    return {
      publicKey: this.FALLBACK_PUBLIC_KEY,
      privateKey: this.FALLBACK_SALT
    };
  }

  buildCookieHeader() {
    const rawCookie = globals.aiyifanCookie ? globals.aiyifanCookie.trim() : "";
    const cookies = rawCookie ? [rawCookie.replace(/;\s*$/, "")] : [];

    if (!/_uid=/.test(rawCookie)) {
      cookies.push(this.DEFAULT_UID);
    }

    if (!/dn_config=/.test(rawCookie)) {
      cookies.push(this.DEFAULT_DN_CONFIG);
    }

    return cookies.join("; ");
  }

  buildPlayUrl(vid, epKey = "") {
    if (!vid) {
      return "https://www.yfsp.tv/";
    }
    return epKey ? `${this.DOMAIN_API}/${vid}?id=${epKey}` : `${this.DOMAIN_API}/${vid}`;
  }

  extractSigningConfig(html) {
    const match = html.match(/"pConfig":\{"publicKey":"([^"]+)","privateKey":\[(.*?)\]\}/);
    if (!match) {
      return null;
    }

    let privateKeys = [];
    try {
      privateKeys = JSON.parse(`[${match[2]}]`);
    } catch (error) {
      log("error", `[Aiyifan] 解析桌面站 privateKey 失败: ${error.message}`);
      return null;
    }

    if (!match[1] || !privateKeys.length) {
      return null;
    }

    return {
      publicKey: match[1],
      privateKey: privateKeys[0]
    };
  }

  async getSigningConfig(forceRefresh = false, sourceUrl = this.CONFIG_PAGE_API) {
    const now = Date.now();
    const cacheValid = this.signingConfig && now - this.signingConfigFetchedAt < this.SIGNING_CONFIG_TTL_MS;
    if (!forceRefresh && cacheValid) {
      return this.signingConfig;
    }

    const pageUrl = /^https:\/\/www\.yfsp\.tv\//.test(sourceUrl) ? sourceUrl : this.CONFIG_PAGE_API;
    const headers = {
      "User-Agent": this.USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    };

    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    try {
      const response = await httpGet(globals.makeProxyUrl(pageUrl), { headers });
      const html = typeof response.data === "string" ? response.data : String(response.data ?? "");
      const signingConfig = this.extractSigningConfig(html);
      if (!signingConfig) {
        throw new Error("未能从桌面站页面解析到 pConfig");
      }

      this.signingConfig = signingConfig;
      this.signingConfigFetchedAt = now;
      log("info", `[Aiyifan] 已更新桌面站签名配置: ${signingConfig.publicKey.slice(0, 12)}...`);
      return signingConfig;
    } catch (error) {
      if (this.signingConfig && !forceRefresh) {
        log("warn", `[Aiyifan] 获取桌面站签名配置失败，继续使用缓存: ${error.message}`);
        return this.signingConfig;
      }

      const fallbackConfig = this.getFallbackSigningConfig();
      log("warn", `[Aiyifan] 获取桌面站签名配置失败，回退到固定签名: ${error.message}`);
      return fallbackConfig;
    }
  }

  isRequestSuccessful(data) {
    const hasRet = data && Object.prototype.hasOwnProperty.call(data, "ret");
    if (hasRet && data.ret !== 200) {
      return false;
    }

    const businessCode = data && data.data && typeof data.data === "object" ? data.data.code : undefined;
    if (businessCode !== undefined && businessCode !== 0 && businessCode !== 200) {
      return false;
    }

    return true;
  }

  getRequestFailureMessage(data) {
    if (!data) {
      return "空响应";
    }
    return (data.data && data.data.msg) || data.msg || "未知错误";
  }

  async requestApi(apiUrl, baseParams, actionLabel, previewLength = 200, referer = "https://www.yfsp.tv/", forceRefresh = false) {
    const signingConfig = await this.getSigningConfig(forceRefresh, referer);
    const params = {
      ...baseParams,
      vv: this.computeVv(baseParams, signingConfig),
      pub: signingConfig.publicKey
    };

    try {
      const urlWithParams = updateQueryString(apiUrl, params);
      const headers = {
        "User-Agent": this.USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.yfsp.tv",
        "Referer": referer,
        "X-Requested-With": "mark.via"
      };

      const cookieHeader = this.buildCookieHeader();
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }

      const response = await httpGet(globals.makeProxyUrl(urlWithParams), {
        headers
      });

      if (response.status !== undefined && response.status !== 200) {
        const responsePreview = typeof response.data === "string"
          ? response.data.slice(0, previewLength)
          : response.statusText;
        log("error", `[${actionLabel}失败] HTTP ${response.status}: ${responsePreview}`);
        return null;
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (!this.isRequestSuccessful(data)) {
        const message = this.getRequestFailureMessage(data);
        if (!forceRefresh) {
          log("warn", `[${actionLabel}] 当前签名配置请求失败，尝试刷新后重试: ${message}`);
          return await this.requestApi(apiUrl, baseParams, actionLabel, previewLength, referer, true);
        }
        log("error", `[${actionLabel}失败] ${message}`);
        return null;
      }

      return data;
    } catch (error) {
      log("error", `[${actionLabel}失败] 错误: ${error.message}`);
      return null;
    }
  }

  async searchDrama(keyword, page = 1, size = 10) {
    const params = {
      tags: keyword,
      orderby: 4,
      page,
      size,
      desc: 1,
      isserial: -1
    };

    log("info", `[搜索] 关键词: ${keyword}, 页码: ${page}`);
    return await this.requestApi(this.SEARCH_API, params, "搜索");
  }

  extractDramaList(searchResult) {
    const dramas = [];
    const infoList = searchResult && searchResult.data && Array.isArray(searchResult.data.info)
      ? searchResult.data.info
      : [];

    if (!infoList.length) {
      log("warn", "[警告] 搜索结果为空");
      return dramas;
    }

    for (const item of infoList) {
      const result = item.result || [];
      if (!result.length) {
        continue;
      }

      for (const dramaInfo of result) {
        const vid = dramaInfo.contxt;
        const title = dramaInfo.title;
        const embeddedPlaylist = dramaInfo
          && dramaInfo.languagesPlayList
          && Array.isArray(dramaInfo.languagesPlayList.playList)
          ? dramaInfo.languagesPlayList.playList
          : [];

        dramas.push({
          contxt: vid,
          title,
          embeddedPlaylist,
          ...dramaInfo
        });
        log("info", `[发现剧目] ${title}  vid=${vid}`);
      }
    }

    return dramas;
  }

  async getPlaylist(vid) {
    const baseParams = {
      cinema: 1,
      vid,
      lsk: 1,
      taxis: 0,
      cid: "0,1,4,152",
    };

    log("info", `[播放列表] 请求 vid: ${vid}`);
    const data = await this.requestApi(this.PLAYLIST_API, baseParams, "播放列表", 200, this.buildPlayUrl(vid));
    if (!data) {
      return [];
    }

    const episodes = [];
    const infoList = data && data.data && Array.isArray(data.data.info) ? data.data.info : [];
    for (const info of infoList) {
      for (const ep of info.playList || []) {
        episodes.push(ep);
      }
    }

    log("info", `[播放列表] 共获取到 ${episodes.length} 集`);
    return episodes;
  }

  async getVideoInfo(epKey, epId = null, referer = "https://www.yfsp.tv/") {
    const baseParams = {
      cinema: 1,
      id: epKey,
      a: 0,
      lang: "none",
      usersign: 1,
      region: "JP",
      device: 1,
      isMasterSupport: 0
    };

    const epInfo = epId ? `(ID:${epId})` : "";
    log("info", `[视频信息] 请求 key: ${epKey} ${epInfo}`);

    const data = await this.requestApi(this.VIDEO_API, baseParams, "视频信息", 200, referer);
    if (!data) {
      return null;
    }

    if (
      data.data
      && typeof data.data === "object"
      && data.data.code !== undefined
      && data.data.code !== 0
      && data.data.code !== 200
    ) {
      log("error", `[视频信息失败] 返回码: ${data.ret}, msg: ${data.data.msg || data.msg}`);
      return null;
    }

    return data.data || {};
  }

  extractUniqueKey(videoInfo) {
    const info = videoInfo && Array.isArray(videoInfo.info) && videoInfo.info[0]
      ? videoInfo.info[0]
      : {};
    const uniqueKey = info.uniqueKey;
    if (uniqueKey) {
      log("info", `[视频信息] 获取到 uniqueKey: ${uniqueKey}`);
    }
    return uniqueKey;
  }

  async fetchBarrage(uniqueKey, referer = "https://www.yfsp.tv/", page = 1, size = 30000) {
    const baseParams = {
      cinema: 1,
      page,
      size,
      uniqueKey,
    };

    log("info", `[弹幕] 请求 uniqueKey: ${uniqueKey}`);

    const data = await this.requestApi(this.DANMU_API, baseParams, "弹幕", 400, referer);
    if (!data) {
      return [];
    }

    const danmuList = data && data.data && Array.isArray(data.data.info) ? data.data.info : [];
    log("info", `[弹幕] 获取到 ${danmuList.length} 条弹幕`);
    return danmuList;
  }

  async search(keyword) {
    log("info", `[Aiyifan] 开始搜索: ${keyword}`);

    const searchResult = await this.searchDrama(keyword);
    if (!searchResult) {
      log("error", "搜索失败，退出");
      return [];
    }

    const dramas = this.extractDramaList(searchResult);
    if (!dramas.length) {
      log("warn", "未找到剧目信息，退出");
      return [];
    }

    const results = dramas.map(drama => ({
      provider: "aiyifan",
      mediaId: drama.contxt,
      title: drama.title,
      type: drama.atypeName,
      year: new Date(drama.postTime).getFullYear(),
      imageUrl: drama.imgPath || null,
      episodeCount: Array.isArray(drama.embeddedPlaylist) ? drama.embeddedPlaylist.length : 0,
      embeddedPlaylist: Array.isArray(drama.embeddedPlaylist) ? drama.embeddedPlaylist : []
    }));

    log("info", `[Aiyifan] 搜索完成，找到 ${results.length} 个结果`);
    return results;
  }

  buildEpisodesFromPlaylist(id, playlist = []) {
    return playlist.map((ep, index) => ({
      vid: ep.key,
      id: ep.id,
      title: ep.name || `第${index + 1}集`,
      link: `${this.DOMAIN_API}/${id}?id=${ep.key}`
    }));
  }

  async getEpisodes(id, embeddedPlaylist = null) {
    log("info", `[Aiyifan] 获取剧集详情: ${id}`);

    let episodes = await this.getPlaylist(id);
    if (!episodes.length && Array.isArray(embeddedPlaylist) && embeddedPlaylist.length > 0) {
      log("info", `[Aiyifan] 完整播放列表获取失败，回退到搜索结果内嵌播放列表: ${embeddedPlaylist.length} 集`);
      episodes = embeddedPlaylist;
    }

    if (!episodes.length) {
      log("error", "获取播放列表失败");
      return [];
    }

    const result = this.buildEpisodesFromPlaylist(id, episodes);

    log("info", `[Aiyifan] 获取到 ${result.length} 个剧集`);
    return result;
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes, detailStore = null) {
    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[Aiyifan] sourceAnimes is not a valid array");
      return [];
    }

    const processPromises = sourceAnimes
      .filter(anime => titleMatches(anime.title, queryTitle))
      .map(async (anime) => {
        try {
          const eps = await this.getEpisodes(anime.mediaId, anime.embeddedPlaylist);
          if (eps.length === 0) {
            log("info", `[Aiyifan] ${anime.title} 无分集，跳过`);
            return;
          }

          const links = eps.map((ep, index) => ({
            name: ep.title || `${index + 1}`,
            url: ep.link,
            title: `【aiyifan】 ${ep.title}`
          }));

          if (links.length === 0) return;

          const numericAnimeId = convertToAsciiSum(anime.mediaId);

          const transformedAnime = {
            animeId: numericAnimeId,
            bangumiId: anime.mediaId,
            animeTitle: `${anime.title}(${anime.year || 'N/A'})【${anime.type}】from aiyifan`,
            type: anime.type,
            typeDescription: anime.type,
            imageUrl: anime.imageUrl,
            startDate: generateValidStartDate(anime.year),
            episodeCount: links.length,
            rating: 0,
            isFavorited: true,
            source: "aiyifan",
          };

          tmpAnimes.push(transformedAnime);
          addAnime({ ...transformedAnime, links }, detailStore);

          if (globals.animes.length > globals.MAX_ANIMES) {
            removeEarliestAnime();
          }
        } catch (error) {
          log("error", `[Aiyifan] 处理 ${anime.title} 失败:`, error.message);
        }
      });

    await Promise.all(processPromises);

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return tmpAnimes;
  }

  async getEpisodeDanmu(id) {
    log("info", `[Aiyifan] 获取弹幕: ${id}`);

    let videoId = id;
    let bangumiId = "";
    try {
      const parsedUrl = new URL(id);
      const queryId = parsedUrl.searchParams.get("id");
      const pathMatch = parsedUrl.pathname.match(/\/play\/([^/?#]+)/);
      if (queryId) {
        videoId = queryId;
      }
      if (pathMatch && pathMatch[1]) {
        bangumiId = pathMatch[1];
      }
    } catch (error) {
      videoId = id;
    }

    const referer = this.buildPlayUrl(bangumiId, videoId);
    const videoInfo = await this.getVideoInfo(videoId, null, referer);
    if (!videoInfo) {
      log("error", "获取视频信息失败");
      return [];
    }

    const uniqueKey = this.extractUniqueKey(videoInfo);
    if (!uniqueKey) {
      log("error", "未获取到uniqueKey");
      return [];
    }

    const danmuList = await this.fetchBarrage(uniqueKey, referer);
    if (danmuList.length === 0) {
      log("info", "未获取到弹幕");
      return [];
    }

    danmuList.sort((a, b) => (a.second || 0) - (b.second || 0));

    log("info", `[Aiyifan] 获取到 ${danmuList.length} 条弹幕`);
    return danmuList;
  }

  async getEpisodeDanmuSegments(id) {
    const danmaku = await this.getEpisodeDanmu(id);

    const segmentList = [{
      type: "aiyifan",
      segment_start: 0,
      segment_end: Math.max(...danmaku.map(d => d.second || 0), 0),
      url: `${this.DANMU_API}?uniqueKey=${id}`
    }];

    return {
      type: "aiyifan",
      duration: Math.max(...danmaku.map(d => d.second || 0), 0),
      segmentList
    };
  }

  async getEpisodeSegmentDanmu(segment) {
    const uniqueKey = segment && segment.url ? segment.url.split('uniqueKey=')[1] : null;
    if (!uniqueKey) {
      return [];
    }

    return await this.getEpisodeDanmu(uniqueKey);
  }

  formatComments(comments) {
    return comments.map(comment => {
      return {
        p: `${comment.second || 0},${comment.position === 1 ? 5 : 1},25,${hexToInt(comment.color.replace("#", ""))},0,0,0,0`,
        m: comment.contxt || comment.content || '',
        like: comment.good,
        ...comment
      };
    }).map(c => {
      if (globals.danmuSimplifiedTraditional === 'simplified') {
        if (c.m) c.m = simplized(c.m);
      }
      return c;
    });
  }
}
