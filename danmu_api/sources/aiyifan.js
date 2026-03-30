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
    this.PUBLIC_KEY = "CJStD3SqE3GrCouoCpbVIb1VCJOmBZ4sBZ8mE2uoDJHVDpKrP69cEMKtCZ0qD31bP68qDJ9bCJOvDZ4oDM4sOJ1VCJTcCpOuCpHYCpOmDZLcOJTaD3GrDZ5ZP68qOJOpDc6";
    this.SALT = "StD3JStD3SqE3GrCouoC";

    this.USER_AGENT = (
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0 Safari/537.36"
    );

    this.SEARCH_API = "https://rankv21.tripdata.app/v3/list/briefsearch";
    this.PLAYLIST_API = "https://app-m10.tripdata.app/v3/video/languagesplaylist";
    this.VIDEO_API = "https://app-m10.tripdata.app/v3/video/play";
    this.DANMU_API = "https://app-m10.tripdata.app/api/video/getBarrage";
    this.DOMAIN_API = "https://www.yfsp.tv/play";
  }

  computeVv(params) {
    const sortedParams = Object.keys(params)
      .map(k => `${k}=${params[k]}`)
      .join('&');
    const raw = this.PUBLIC_KEY + "&" + sortedParams.toLowerCase() + "&" + this.SALT;
    return md5(raw);
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

    const headers = {
      "User-Agent": this.USER_AGENT,
      "Accept": "application/json"
    };

    log("info", `[搜索] 关键词: ${keyword}, 页码: ${page}`);

    try {
      const urlWithParams = updateQueryString(this.SEARCH_API, params);
      const response = await httpGet(globals.makeProxyUrl(urlWithParams), { headers });

      if (response.status !== 200) {
        const responsePreview = typeof response.data === "string"
          ? response.data.slice(0, 200)
          : response.statusText;
        log("error", `[搜索失败] HTTP ${response.status}: ${responsePreview}`);
        return null;
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (data.ret !== 200) {
        log("error", `[搜索失败] 返回码: ${data.ret}, msg: ${data.msg}`);
        return null;
      }
      return data;
    } catch (error) {
      log("error", `[搜索失败] 错误: ${error.message}`);
      return null;
    }
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

    const vv = this.computeVv(baseParams);

    const params = {
      ...baseParams,
      vv,
      pub: this.PUBLIC_KEY
    };

    const headers = {
      "User-Agent": this.USER_AGENT,
      "Accept": "application/json"
    };

    log("info", `[播放列表] 请求 vid: ${vid}`);

    try {
      const urlWithParams = updateQueryString(this.PLAYLIST_API, params);
      const response = await httpGet(globals.makeProxyUrl(urlWithParams), { headers });

      if (response.status !== 200) {
        const responsePreview = typeof response.data === "string"
          ? response.data.slice(0, 200)
          : response.statusText;
        log("error", `[播放列表失败] HTTP ${response.status}: ${responsePreview}`);
        return [];
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (data.ret !== 200) {
        log("error", `[播放列表失败] 返回码: ${data.ret}, msg: ${data.msg}`);
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
    } catch (error) {
      log("error", `[播放列表失败] 错误: ${error.message}`);
      return [];
    }
  }

  async getVideoInfo(epKey, epId = null) {
    const baseParams = {
      cinema: 1,
      id: epKey,
      a: 0,
      lang: "none",
      usersign: 1,
      region: "GL.",
      device: 0,
      isMasterSupport: 1
    };

    const vv = this.computeVv(baseParams);

    const params = {
      ...baseParams,
      vv,
      pub: this.PUBLIC_KEY
    };

    const headers = {
      "User-Agent": this.USER_AGENT,
      "Accept": "application/json"
    };

    const epInfo = epId ? `(ID:${epId})` : "";
    log("info", `[视频信息] 请求 key: ${epKey} ${epInfo}`);
    log("info", `[视频信息] vv签名: ${vv.substring(0, 16)}...`);

    try {
      const urlWithParams = updateQueryString(this.VIDEO_API, params);
      const response = await httpGet(globals.makeProxyUrl(urlWithParams), { headers });

      if (response.status !== 200) {
        const responsePreview = typeof response.data === "string"
          ? response.data.slice(0, 200)
          : response.statusText;
        log("error", `[视频信息失败] HTTP ${response.status}: ${responsePreview}`);
        return null;
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (data.ret !== 200) {
        log("error", `[视频信息失败] 返回码: ${data.ret}, msg: ${data.msg}`);
        return null;
      }
      return data.data || {};
    } catch (error) {
      log("error", `[视频信息失败] 错误: ${error.message}`);
      return null;
    }
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

  async fetchBarrage(uniqueKey, page = 1, size = 30000) {
    const baseParams = {
      cinema: 1,
      page,
      size,
      uniqueKey,
    };

    const vv = this.computeVv(baseParams);

    const params = {
      ...baseParams,
      vv,
      pub: this.PUBLIC_KEY
    };

    const headers = {
      "User-Agent": this.USER_AGENT,
    };

    log("info", `[弹幕] 请求 uniqueKey: ${uniqueKey}`);
    log("info", `[弹幕] vv签名: ${vv.substring(0, 16)}...`);

    try {
      const urlWithParams = updateQueryString(this.DANMU_API, params);
      const response = await httpGet(globals.makeProxyUrl(urlWithParams), { headers });

      if (response.status !== 200) {
        const responsePreview = typeof response.data === "string"
          ? response.data.slice(0, 400)
          : response.statusText;
        log("error", `[弹幕失败] HTTP ${response.status}: ${responsePreview}`);
        return [];
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (data.ret !== 200) {
        log("error", `[弹幕失败] 返回码: ${data.ret}`);
        return [];
      }

      const danmuList = data && data.data && Array.isArray(data.data.info) ? data.data.info : [];
      log("info", `[弹幕] 获取到 ${danmuList.length} 条弹幕`);
      return danmuList;
    } catch (error) {
      log("error", `[弹幕失败] 错误: ${error.message}`);
      return [];
    }
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

    let episodes = [];
    if (Array.isArray(embeddedPlaylist) && embeddedPlaylist.length > 0) {
      log("info", `[Aiyifan] 使用搜索结果内嵌播放列表: ${embeddedPlaylist.length} 集`);
      episodes = embeddedPlaylist;
    } else {
      episodes = await this.getPlaylist(id);
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
    try {
      const parsedUrl = new URL(id);
      const queryId = parsedUrl.searchParams.get("id");
      if (queryId) {
        videoId = queryId;
      }
    } catch (error) {
      videoId = id;
    }

    const videoInfo = await this.getVideoInfo(videoId);
    if (!videoInfo) {
      log("error", "获取视频信息失败");
      return [];
    }

    const uniqueKey = this.extractUniqueKey(videoInfo);
    if (!uniqueKey) {
      log("error", "未获取到uniqueKey");
      return [];
    }

    const danmuList = await this.fetchBarrage(uniqueKey);
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
