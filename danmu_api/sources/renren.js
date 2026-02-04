import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet, sortedQueryString } from "../utils/http-util.js";
import { autoDecode, createHmacSha256, generateSign } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches } from "../utils/common-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';

/**
 * 人人视频弹幕源
 * 使用 TV 端 API 接口，支持降级到网页端
 */
export default class RenrenSource extends BaseSource {
  // ==================== 配置 ====================
  API_CONFIG = {
    SECRET_KEY: "cf65GPholnICgyw1xbrpA79XVkizOdMq",
    SEARCH_HOST: "api.gorafie.com",
    DANMU_HOST: "static-dm.qwdjapp.com",
    APP_VERSION: "1.2.2",
    DEVICE_ID: "tWEtIN7JG2DTDkBBigvj6A%3D%3D",
    ALI_ID: "aYHPzBjPT+UDAI1LymQbR5jV",
    UM_ID: "53e0f078fa8474ae7ba412f766989b54od",
  };

  // ==================== 请求头生成 ====================
  generateAppCommonHeaders(timestamp, sign, host) {
    return {
      'clientVersion': this.API_CONFIG.APP_VERSION,
      'p': 'Android',
      'deviceid': this.API_CONFIG.DEVICE_ID,
      'token': '',
      'aliid': this.API_CONFIG.ALI_ID,
      'umid': this.API_CONFIG.UM_ID,
      'clienttype': 'android_qwtv_RRSP',
      'pkt': 'rrmj',
      't': timestamp.toString(),
      'sign': sign,
      'Connection': 'close',
      'isAgree': '1',
      'et': '2',
      'Host': host,
      'Accept-Encoding': 'gzip',
      'User-Agent': 'okhttp/3.12.13',
    };
  }

  // ==================== TV 端 API ====================

  /**
   * TV 端搜索接口
   */
  async searchAppContent(keyword, size = 30) {
    try {
      const timestamp = Date.now();
      const path = "/qwtv/search";
      const queryParams = {
        searchWord: keyword,
        num: size,
        searchNext: "",
        well: "match"
      };

      const sign = generateSign(path, timestamp, queryParams, this.API_CONFIG.SECRET_KEY);
      const queryString = sortedQueryString(queryParams);
      const headers = this.generateAppCommonHeaders(timestamp, sign, this.API_CONFIG.SEARCH_HOST);

      const resp = await httpGet(`https://${this.API_CONFIG.SEARCH_HOST}${path}?${queryString}`, {
        headers: headers,
        retries: 1,
      });

      if (!resp.data) return [];

      // 版本过低时返回空，触发降级
      if (resp.data.code === "0001") return [];

      const list = resp.data.data || [];
      return list.map((item) => ({
        provider: "renren",
        mediaId: String(item.id),
        title: String(item.title || "").replace(/<[^>]+>/g, "").replace(/:/g, "："),
        type: item.classify === "电影" ? "movie" : "tv_series",
        season: null,
        year: item.year,
        imageUrl: item.cover3 || item.cover,
        episodeCount: null,
        currentEpisodeIndex: null,
      }));
    } catch (error) {
      log("error", "[Renren] 搜索失败:", error.message);
      return [];
    }
  }

  /**
   * TV 端剧集详情接口（含分集列表）
   */
  async getTVDramaDetails(seriesId) {
    try {
      const timestamp = Date.now();
      const path = "/qwtv/drama/details";
      const queryParams = {
        seriesId: String(seriesId),
        isAgeLimit: false,
        hevcOpen: 1,
        clarity: "HD",
        caption: 0,
      };

      const sign = generateSign(path, timestamp, queryParams, this.API_CONFIG.SECRET_KEY);
      const queryString = sortedQueryString(queryParams);
      const headers = this.generateAppCommonHeaders(timestamp, sign, this.API_CONFIG.SEARCH_HOST);

      const resp = await httpGet(`https://${this.API_CONFIG.SEARCH_HOST}${path}?${queryString}`, {
        headers: headers,
        retries: 1,
      });

      if (!resp.data || resp.data.code !== "0000") return null;
      return resp.data.data || null;
    } catch (error) {
      log("error", `[Renren] 获取详情失败 (id=${seriesId}):`, error.message);
      return null;
    }
  }

  /**
   * TV 端弹幕接口
   */
  async getAppDanmu(episodeSid) {
    try {
      const timestamp = Date.now();
      const path = `/v1/produce/danmu/EPISODE/${episodeSid}`;

      const sign = generateSign(path, timestamp, {}, this.API_CONFIG.SECRET_KEY);
      const headers = this.generateAppCommonHeaders(timestamp, sign, this.API_CONFIG.DANMU_HOST);

      const resp = await httpGet(`https://${this.API_CONFIG.DANMU_HOST}${path}`, {
        headers: headers,
        retries: 1,
      });

      return resp.data;
    } catch (error) {
      log("error", `[Renren] 获取弹幕失败 (sid=${episodeSid}):`, error.message);
      return null;
    }
  }

  // ==================== 网页端降级 API ====================

  generateWebSignature(method, deviceId, ct, cv, timestamp, path, sortedQuery, secret) {
    const signStr = `${method.toUpperCase()}\naliId:${deviceId}\nct:${ct}\ncv:${cv}\nt:${timestamp}\n${path}?${sortedQuery}`;
    return createHmacSha256(secret, signStr);
  }

  buildWebHeaders({ method, url, params = {}, deviceId }) {
    const pathname = url.split('?')[0].replace(/^https?:\/\/[^\/]+/, '');
    const qs = sortedQueryString(params);
    const nowMs = Date.now();
    const SIGN_SECRET = "ES513W0B1CsdUrR13Qk5EgDAKPeeKZY";

    const xCaSign = this.generateWebSignature(
      method, deviceId, "web_pc", "1.0.0",
      nowMs, pathname, qs, SIGN_SECRET
    );

    return {
      clientVersion: "1.0.0",
      deviceId,
      clientType: "web_pc",
      t: String(nowMs),
      aliId: deviceId,
      umid: deviceId,
      token: "",
      cv: "1.0.0",
      ct: "web_pc",
      uet: "9",
      "x-ca-sign": xCaSign,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      Origin: "https://rrsp.com.cn",
      Referer: "https://rrsp.com.cn/",
    };
  }

  async webRequest(url, params = {}) {
    const deviceId = this.generateDeviceId();
    const headers = this.buildWebHeaders({ method: "GET", url, params, deviceId });
    return await httpGet(url + "?" + sortedQueryString(params), {
      headers: headers,
      retries: 1,
    });
  }

  async webSearch(keyword) {
    try {
      const url = "https://api.rrmj.plus/m-station/search/drama";
      const params = {
        keywords: keyword,
        size: 20,
        order: "match",
        search_after: "",
      };

      const resp = await this.webRequest(url, params);
      if (!resp.data) return [];

      const decoded = autoDecode(resp.data);
      const list = decoded?.data?.searchDramaList || [];

      return list.map((item) => ({
        provider: "renren",
        mediaId: String(item.id),
        title: String(item.title || "").replace(/<[^>]+>/g, "").replace(/:/g, "："),
        type: "tv_series",
        season: null,
        year: item.year,
        imageUrl: item.cover,
        episodeCount: item.episodeTotal,
        currentEpisodeIndex: null,
      }));
    } catch (error) {
      log("error", "[Renren] 网页搜索失败:", error.message);
      return [];
    }
  }

  async webGetDetail(id) {
    try {
      const url = `https://api.rrmj.plus/m-station/drama/page`;
      const params = {
        hsdrOpen: 0,
        isAgeLimit: 0,
        dramaId: String(id),
        hevcOpen: 1
      };

      const resp = await this.webRequest(url, params);
      if (!resp.data) return null;

      const decoded = autoDecode(resp.data);
      return decoded?.data || null;
    } catch (error) {
      log("error", `[Renren] 网页获取详情失败 (id=${id}):`, error.message);
      return null;
    }
  }

  async webGetDanmu(id) {
    try {
      const url = `https://static-dm.rrmj.plus/v1/produce/danmu/EPISODE/${id}`;
      const headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://rrsp.com.cn",
        "Referer": "https://rrsp.com.cn/",
      };

      const resp = await httpGet(url, { headers, retries: 1 });
      if (!resp.data) return null;

      const data = autoDecode(resp.data);
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return null;
    } catch (error) {
      log("error", `[Renren] 网页获取弹幕失败 (id=${id}):`, error.message);
      return null;
    }
  }

  // ==================== 工具方法 ====================

  generateDeviceId() {
    return (Math.random().toString(36).slice(2)).toUpperCase();
  }

  parseRRSPPFields(pField) {
    const parts = String(pField).split(",");
    const num = (i, cast, dft) => {
      try { return cast(parts[i]); }
      catch { return dft; }
    };
    const timestamp = num(0, parseFloat, 0);
    const mode = num(1, x => parseInt(x, 10), 1);
    const size = num(2, x => parseInt(x, 10), 25);
    const color = num(3, x => parseInt(x, 10), 16777215);
    const userId = parts[6] || "";
    const contentId = parts[7] || `${timestamp}:${userId}`;
    return { timestamp, mode, size, color, userId, contentId };
  }

  // ==================== 公共接口 ====================

  async search(keyword) {
    const parsedKeyword = { title: keyword, season: null };
    const searchTitle = parsedKeyword.title;
    const searchSeason = parsedKeyword.season;

    // 优先使用 TV 端搜索
    let allResults = await this.searchAppContent(searchTitle);

    // 失败时降级到网页端
    if (allResults.length === 0) {
      allResults = await this.webSearch(searchTitle);
    }

    if (searchSeason == null) return allResults;
    return allResults.filter(r => r.season === searchSeason);
  }

  async getDetail(id) {
    // 优先使用 TV 端详情接口
    const tvData = await this.getTVDramaDetails(id);
    if (tvData && tvData.episodeList && tvData.episodeList.length > 0) {
      return tvData;
    }

    // 降级到网页端
    return await this.webGetDetail(id);
  }

  async getEpisodes(id) {
    const detail = await this.getDetail(id);
    if (!detail || !detail.episodeList) return [];

    let episodes = [];
    detail.episodeList.forEach((ep, idx) => {
      const sid = String(ep.sid || "").trim();
      if (!sid) return;
      const title = String(ep.title || `第${String(ep.episodeNo || idx + 1).padStart(2, "0")}集`);
      episodes.push({ sid, order: ep.episodeNo || idx + 1, title });
    });

    return episodes.map(e => ({
      provider: "renren",
      episodeId: e.sid,
      title: e.title,
      episodeIndex: e.order,
      url: null
    }));
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes) {
    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      return [];
    }

    await Promise.all(sourceAnimes
      .filter(s => titleMatches(s.title, queryTitle))
      .map(async (anime) => {
        try {
          const eps = await this.getEpisodes(anime.mediaId);
          let links = [];
          for (const ep of eps) {
            links.push({
              "name": ep.episodeIndex.toString(),
              "url": ep.episodeId,
              "title": `【${ep.provider}】 ${ep.title}`
            });
          }

          if (links.length > 0) {
            let transformedAnime = {
              animeId: Number(anime.mediaId),
              bangumiId: String(anime.mediaId),
              animeTitle: `${anime.title}(${anime.year})【${anime.type}】from renren`,
              type: anime.type,
              typeDescription: anime.type,
              imageUrl: anime.imageUrl,
              startDate: generateValidStartDate(anime.year),
              episodeCount: links.length,
              rating: 0,
              isFavorited: true,
              source: "renren",
            };

            tmpAnimes.push(transformedAnime);
            addAnime({ ...transformedAnime, links: links });

            if (globals.animes.length > globals.MAX_ANIMES) {
              removeEarliestAnime();
            }
          }
        } catch (error) {
          log("error", `[Renren] 处理动漫失败: ${error.message}`);
        }
      })
    );

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return tmpAnimes;
  }

  async getEpisodeDanmu(id) {
    // 优先使用 TV 端弹幕接口
    const resp = await this.getAppDanmu(id);
    if (resp && Array.isArray(resp)) {
      return resp;
    }

    // 降级到网页端
    return await this.webGetDanmu(id);
  }

  async getEpisodeDanmuSegments(id) {
    return new SegmentListResponse({
      "type": "renren",
      "segmentList": [{
        "type": "renren",
        "segment_start": 0,
        "segment_end": 30000,
        "url": id
      }]
    });
  }

  async getEpisodeSegmentDanmu(segment) {
    return this.getEpisodeDanmu(segment.url);
  }

  formatComments(comments) {
    return comments.map(item => {
      const text = String(item.d || "");
      const meta = this.parseRRSPPFields(item.p);
      return {
        cid: Number(meta.contentId),
        p: `${meta.timestamp.toFixed(2)},${meta.mode},${meta.color},[renren]`,
        m: text,
        t: meta.timestamp
      };
    });
  }
}
