import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches, normalizeSpaces } from "../utils/common-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';
import { createHanjutvUid, createHanjutvSearchHeaders, decodeHanjutvEncryptedPayload, HANJUTV_VERSION, HANJUTV_VC, HANJUTV_UA } from "../utils/hanjutv-util.js";

// =====================
// 获取韩剧TV弹幕（韩小圈链路）
// =====================
export default class HanjutvSource extends BaseSource {
  constructor() {
    super();
    this.appHost = "https://hxqapi.hiyun.tv";
    this.oldDanmuHost = "https://hxqapi.zmdcq.com";
    this.defaultRefer = "2JGztvGjRVpkxcr0T4ZWG2k+tOlnHmDGUNMwAGSeq548YV2FMbs0h0bXNi6DJ00L";
    this.appUserAgent = HANJUTV_UA;
    this.sourceKey = "hanjutv";
    this.s5StableUid = createHanjutvUid();
  }

  getSourceTimeout() {
    const timeout = Number(globals.vodRequestTimeout || 10000);
    return Number.isFinite(timeout) && timeout > 0 ? timeout : 10000;
  }

  getS5SearchTimeout() {
    return Math.min(this.getSourceTimeout(), 6000);
  }

  getDanmuMaxPages() {
    return 120;
  }

  getDanmuMaxAxis() {
    return 100000000;
  }

  logRequestFailure(stage, error) {
    log("debug", "[Hanjutv] " + stage + " 失败: " + (error?.message || error));
  }

  getAppHeaders() {
    return {
      vc: HANJUTV_VC,
      vn: HANJUTV_VERSION,
      ch: "xiaomi",
      app: "hj",
      "User-Agent": this.appUserAgent,
      "Accept-Encoding": "gzip",
    };
  }

  normalizeChain(chain) {
    return String(chain || "").toLowerCase() === "xiawen" ? "xiawen" : "hxq";
  }

  parsePlatformId(rawId) {
    const idText = String(rawId || "").trim();
    if (!idText) return { id: "", chain: "hxq" };
    if (idText.startsWith("xw:")) return { id: "", chain: "xiawen" };
    return { id: idText, chain: "hxq" };
  }

  encodeEpisodeId(pid) {
    const value = String(pid || "").trim();
    if (!value) return "";
    return value;
  }

  normalizeSearchItems(items = []) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const sid = item.sid || item.seriesId || item.id || item.series_id;
        const name = item.name || item.title || item.seriesName || item.showName;
        if (!sid || !name) return null;

        const imageObj = typeof item.image === "object" && item.image !== null ? item.image : {};
        const thumb = imageObj.thumb || imageObj.poster || imageObj.url || item.thumb || item.poster || "";

        return {
          ...item,
          sid: String(sid),
          name: String(name),
          chain: "hxq",
          image: {
            ...imageObj,
            thumb,
          },
        };
      })
      .filter(Boolean);
  }

  normalizeEpisodes(items = []) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const pid = item.pid || item.id || item.programId || item.episodeId;
        if (!pid) return null;

        const serialCandidate = item.serialNo ?? item.serial_no ?? item.sort ?? item.sortNo ?? item.num ?? item.episodeNo ?? (index + 1);
        const serialNo = Number(serialCandidate);

        return {
          ...item,
          pid: String(pid),
          chain: "hxq",
          serialNo: Number.isFinite(serialNo) && serialNo > 0 ? serialNo : (index + 1),
          title: item.title || item.name || item.programName || item.episodeTitle || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.serialNo - b.serialNo);
  }

  extractSearchItems(data) {
    const list = data?.seriesData?.seriesList || data?.seriesData?.series || data?.seriesList || data?.series || [];
    return this.normalizeSearchItems(list);
  }

  dedupeBySid(items = []) {
    const map = new Map();
    for (const item of items) {
      if (!item?.sid) continue;
      const sid = String(item.sid);
      if (!map.has(sid)) map.set(sid, item);
    }
    return Array.from(map.values());
  }

  countMatchedItems(items = [], keyword = "") {
    if (!Array.isArray(items) || !keyword) return 0;
    return items.reduce((count, item) => {
      const name = item?.name ? String(item.name) : "";
      return count + (titleMatches(name, keyword) ? 1 : 0);
    }, 0);
  }

  buildStableAnimeId(name = "", sid = "") {
    const normalizedName = normalizeSpaces(name).toLowerCase();
    if (normalizedName) {
      return convertToAsciiSum(this.sourceKey + ":" + normalizedName);
    }
    return convertToAsciiSum(this.sourceKey + ":sid:" + String(sid || ""));
  }

  decorateSearchAnime(anime = {}) {
    return {
      ...anime,
      animeId: this.buildStableAnimeId(anime?.name, anime?.sid),
    };
  }

  async searchWithS5Api(keyword, options = {}) {
    const q = encodeURIComponent(keyword);

    const requestWithUid = async (uid) => {
      const appHeaders = this.getAppHeaders();
      const headers = await createHanjutvSearchHeaders(uid, Date.now(), {
        app: appHeaders.app,
        ch: appHeaders.ch,
        version: appHeaders.vn,
        vc: appHeaders.vc,
        userAgent: this.appUserAgent,
      });
      const resp = await httpGet(this.appHost + "/api/search/s5?k=" + q + "&srefer=search_input&type=0&page=1", {
        headers,
        timeout: this.getS5SearchTimeout(),
        retries: 0,
        signal: options.signal,
      });

      const payload = resp?.data;
      if (!payload || typeof payload !== "object") {
        throw new Error("s5 响应为空");
      }

      if (typeof payload.data === "string" && payload.data.length > 0) {
        let decoded;
        try {
          decoded = await decodeHanjutvEncryptedPayload(payload, uid);
        } catch (error) {
          throw new Error("s5 响应解密失败: " + error.message);
        }

        const items = this.extractSearchItems(decoded);
        if (items.length === 0) throw new Error("s5 解密后无有效结果");
        return items;
      }

      const plainItems = this.extractSearchItems(payload);
      if (plainItems.length === 0) throw new Error("s5 无有效结果");
      return plainItems;
    };

    const currentUid = this.s5StableUid || createHanjutvUid();

    try {
      const items = await requestWithUid(currentUid);
      this.s5StableUid = currentUid;
      return items;
    } catch (error) {
      if (options.signal?.aborted || error?.name === "AbortError") throw error;

      const message = String(error?.message || "");
      const shouldRotateUid = message.startsWith("s5 响应解密失败:") || message === "s5 解密后无有效结果";
      if (!shouldRotateUid) throw error;

      const rotatedUid = createHanjutvUid();
      log("debug", "[Hanjutv] s5 命中可轮换错误，切换 uid 重试一次: " + message);
      const items = await requestWithUid(rotatedUid);
      this.s5StableUid = rotatedUid;
      return items;
    }
  }

  async search(keyword) {
    try {
      const key = String(keyword || "").trim();
      if (!key) return [];

      const s5List = await this.searchWithS5Api(key);
      const s5MatchedCount = this.countMatchedItems(s5List, key);
      if (s5MatchedCount === 0) {
        log("info", "[Hanjutv] s5 返回 " + s5List.length + " 条但标题零命中，跳过结果");
        return [];
      }

      const s5Only = this.dedupeBySid(s5List);
      log("info", "[Hanjutv] 使用 s5 链路结果: " + s5Only.length);
      return s5Only.map((anime) => this.decorateSearchAnime(anime));
    } catch (error) {
      log("info", "[Hanjutv] s5 搜索失败: " + error.message);
      return [];
    }
  }

  async getDetail(id) {
    try {
      const parsed = this.parsePlatformId(id);
      const sid = parsed.id;
      if (!sid) return [];

      let detail = null;
      try {
        const appResp = await httpGet(this.appHost + "/api/series/detail?sid=" + sid, {
          headers: this.getAppHeaders(),
          timeout: this.getSourceTimeout(),
          retries: 1,
        });
        detail = appResp?.data?.series || null;
      } catch (error) {
        this.logRequestFailure("hxq 详情", error);
      }

      if (!detail) {
        log("debug", "getHanjutvDetail: series 不存在");
        return [];
      }

      return detail;
    } catch (error) {
      log("error", "getHanjutvDetail error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getEpisodes(id) {
    try {
      const parsed = this.parsePlatformId(id);
      const sid = parsed.id;
      if (!sid) return [];

      let episodes = [];

      try {
        const detailResp = await httpGet(this.appHost + "/api/series/detail?sid=" + sid, {
          headers: this.getAppHeaders(),
          timeout: this.getSourceTimeout(),
          retries: 1,
        });
        const detailData = detailResp?.data;
        const playItems = Array.isArray(detailData?.playItems) ? detailData.playItems : [];
        episodes = this.normalizeEpisodes(playItems);
      } catch (error) {
        this.logRequestFailure("hxq 分集详情", error);
      }

      if (episodes.length === 0) {
        try {
          const epResp = await httpGet(this.appHost + "/api/series2/episodes?sid=" + sid + "&refer=" + encodeURIComponent(this.defaultRefer), {
            headers: this.getAppHeaders(),
            timeout: this.getSourceTimeout(),
            retries: 1,
          });
          const epData = epResp?.data;
          const items = epData?.programs || epData?.episodes || epData?.qxkPrograms || [];
          episodes = this.normalizeEpisodes(items);
        } catch (error) {
          this.logRequestFailure("hxq 分集接口 series2", error);
        }
      }

      if (episodes.length === 0) {
        try {
          const pResp = await httpGet(this.appHost + "/api/series/programs_v2?sid=" + sid, {
            headers: this.getAppHeaders(),
            timeout: this.getSourceTimeout(),
            retries: 1,
          });
          const pData = pResp?.data;
          const programs = [
            ...(Array.isArray(pData?.programs) ? pData.programs : []),
            ...(Array.isArray(pData?.qxkPrograms) ? pData.qxkPrograms : []),
          ];
          episodes = this.normalizeEpisodes(programs);
        } catch (error) {
          this.logRequestFailure("hxq 分集接口 programs_v2", error);
        }
      }

      if (episodes.length === 0) {
        log("debug", "getHanjutvEposides: episodes 不存在");
        return [];
      }

      return episodes.sort((a, b) => a.serialNo - b.serialNo);
    } catch (error) {
      log("error", "getHanjutvEposides error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes) {
    const cateMap = { 1: "韩剧", 2: "综艺", 3: "电影", 4: "日剧", 5: "美剧", 6: "泰剧", 7: "国产剧" };

    function getCategory(key) {
      return cateMap[key] || "其他";
    }

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[Hanjutv] sourceAnimes is not a valid array");
      return [];
    }

    const tmpAnimes = [];
    const matchedSourceAnimes = sourceAnimes
      .filter((s) => titleMatches(s.name, queryTitle))
      .filter((s) => this.normalizeChain(s?.chain) === "hxq");

    const processHanjutvAnimes = await Promise.all(
      matchedSourceAnimes.map(async (anime) => {
        try {
          const eps = await this.getEpisodes(anime.sid);
          if (!Array.isArray(eps) || eps.length === 0) {
            log("debug", "[Hanjutv] 无可用分集，跳过: " + anime.name);
            return;
          }

          let detail = await this.getDetail(anime.sid);
          if (!detail || typeof detail !== "object") detail = {};

          const links = [];
          for (const ep of eps) {
            const epTitle = ep.title && ep.title.trim() !== "" ? ("第" + ep.serialNo + "集：" + ep.title) : ("第" + ep.serialNo + "集");
            const encodedPid = this.encodeEpisodeId(ep.pid);
            links.push({
              name: epTitle,
              url: encodedPid,
              title: "【" + this.sourceKey + "】 " + epTitle,
            });
          }

          if (links.length > 0) {
            const nowYear = new Date().getFullYear();
            const candidateYears = [
              new Date(anime.updateTime || 0).getFullYear(),
              new Date(anime.publishTime || 0).getFullYear(),
              Number(anime.year),
              new Date(detail?.updateTime || 0).getFullYear(),
              new Date(detail?.publishTime || 0).getFullYear(),
            ].filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2099);
            const year = candidateYears[0] || nowYear;
            const animeId = Number(anime.animeId) > 0
              ? Number(anime.animeId)
              : this.buildStableAnimeId(anime.name, anime.sid);

            const transformedAnime = {
              animeId,
              bangumiId: String(animeId),
              animeTitle: anime.name + "(" + year + ")【" + getCategory(detail?.category) + "】from " + this.sourceKey,
              type: getCategory(detail?.category),
              typeDescription: getCategory(detail?.category),
              imageUrl: anime.image?.thumb || "",
              startDate: generateValidStartDate(year),
              episodeCount: links.length,
              rating: detail?.rank,
              isFavorited: true,
              source: this.sourceKey,
            };

            tmpAnimes.push(transformedAnime);
            addAnime({ ...transformedAnime, links });

            if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
          }
        } catch (error) {
          log("error", "[Hanjutv] Error processing anime: " + error.message);
        }
      })
    );
    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);

    return processHanjutvAnimes;
  }

  async getEpisodeDanmuByHxq(id) {
    let allDanmus = [];
    let fromAxis = 0;
    const maxAxis = this.getDanmuMaxAxis();
    const maxPages = this.getDanmuMaxPages();
    let pageCount = 0;

    try {
      while (fromAxis < maxAxis && pageCount < maxPages) {
        const resp = await httpGet(this.oldDanmuHost + "/api/danmu/playItem/list?fromAxis=" + fromAxis + "&pid=" + id + "&toAxis=" + maxAxis, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
          timeout: this.getSourceTimeout(),
          retries: 1,
        });
        pageCount += 1;
        const data = resp?.data || {};

        if (Array.isArray(data.danmus) && data.danmus.length > 0) {
          allDanmus.push(...data.danmus);
        }

        const nextAxis = Number(data.nextAxis ?? maxAxis);
        if (!Number.isFinite(nextAxis)) {
          log("warn", "[Hanjutv] nextAxis 非法，提前退出分页: " + data.nextAxis);
          break;
        }
        if (nextAxis >= maxAxis) break;
        if (nextAxis <= fromAxis) {
          log("warn", "[Hanjutv] nextAxis 未前进，提前退出分页: fromAxis=" + fromAxis + ", nextAxis=" + nextAxis);
          break;
        }
        fromAxis = nextAxis;
      }

      if (pageCount >= maxPages) {
        log("warn", "[Hanjutv] 分页次数达到上限，提前停止: pid=" + id + ", pageCount=" + pageCount);
      }
      return allDanmus;
    } catch (error) {
      log("error", "fetchHanjutvEpisodeDanmu error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return allDanmus;
    }
  }

  async getEpisodeDanmu(id) {
    const parsed = this.parsePlatformId(id);
    if (!parsed.id) return [];
    return this.getEpisodeDanmuByHxq(parsed.id);
  }

  async getEpisodeDanmuSegments(id) {
    log("debug", "获取韩剧TV弹幕分段列表...", id);

    return new SegmentListResponse({
      type: this.sourceKey,
      segmentList: [
        {
          type: this.sourceKey,
          segment_start: 0,
          segment_end: 30000,
          url: id,
        },
      ],
    });
  }

  async getEpisodeSegmentDanmu(segment) {
    return this.getEpisodeDanmu(segment.url);
  }

  formatComments(comments) {
    return comments.map((c) => {
      const timeMs = Number(c.t || 0);
      const mode = Number(c.tp === 2 ? 5 : c.tp || 1);
      const color = Number(c.sc ?? 16777215);
      return {
        cid: Number(c.did || c.id || 0),
        p: `${(timeMs / 1000).toFixed(2)},${mode},${color},[${this.sourceKey}]`,
        m: c.con,
        t: Math.round(timeMs / 1000),
        like: Number(c.lc || 0),
      };
    });
  }
}
