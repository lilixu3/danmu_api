import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches, normalizeSpaces } from "../utils/common-util.js";
import { httpGet } from "../utils/http-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';
import { createHanjutvUid, createHanjutvLiteHeaders, decodeHanjutvEncryptedPayload } from "../utils/hanjutv-util.js";

// =====================
// 获取韩剧TV弹幕（极简版链路）
// =====================
export default class Hanjutv2Source extends BaseSource {
  constructor() {
    super();
    this.liteHost = "https://api.xiawen.tv";
    this.sourceKey = "hanjutv2";
  }

  getSourceTimeout() {
    const timeout = Number(globals.vodRequestTimeout || 10000);
    return Number.isFinite(timeout) && timeout > 0 ? timeout : 10000;
  }

  getDanmuMaxPages() {
    return 120;
  }

  getDanmuMaxAxis() {
    return 100000000;
  }

  normalizeChain() {
    return "xiawen";
  }

  parsePlatformId(rawId) {
    const idText = String(rawId || "").trim();
    if (!idText) return { id: "", chain: "xiawen" };
    if (idText.startsWith("xw:")) return { id: idText.slice(3), chain: "xiawen" };
    return { id: idText, chain: "xiawen" };
  }

  encodeEpisodeId(pid) {
    const value = String(pid || "").trim();
    if (!value) return "";
    return "xw:" + value;
  }

  async createLiteSession() {
    const uid = createHanjutvUid();
    const headers = await createHanjutvLiteHeaders(uid);
    return { uid, headers };
  }

  async requestLiteApi(pathname, query = {}, session, options = {}) {
    const url = new URL(pathname, this.liteHost);
    for (const [key, value] of Object.entries(query || {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }

    const resp = await httpGet(url.toString(), {
      headers: session.headers,
      timeout: this.getSourceTimeout(),
      retries: 1,
      signal: options.signal,
    });

    const payload = resp?.data;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("xiawen 响应无效: " + url.pathname);
    }
    if (Number(payload.code) !== 0) {
      throw new Error("xiawen 请求失败: code=" + payload.code + ", msg=" + (payload.msg || ""));
    }

    if (typeof payload.data === "string" && payload.data.length > 0) {
      return decodeHanjutvEncryptedPayload(payload, session.uid);
    }
    if (payload.data && typeof payload.data === "object") return payload.data;
    return payload;
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
          chain: "xiawen",
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
          chain: "xiawen",
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

  async searchWithLiteApi(keyword, options = {}) {
    const session = await this.createLiteSession();
    const decoded = await this.requestLiteApi("/api/v1/aggregate/search", {
      key: keyword,
      scope: 101,
      page: 1,
    }, session, options);

    const items = this.extractSearchItems(decoded);
    if (items.length === 0) throw new Error("xiawen 无有效结果");
    return items;
  }

  async search(keyword) {
    try {
      const key = String(keyword || "").trim();
      if (!key) return [];

      const liteList = await this.searchWithLiteApi(key);
      const liteMatchedCount = this.countMatchedItems(liteList, key);
      if (liteMatchedCount === 0) {
        log("info", "[Hanjutv2] xiawen 返回 " + liteList.length + " 条但标题零命中，跳过结果");
        return [];
      }

      const liteOnly = this.dedupeBySid(liteList);
      log("info", "[Hanjutv2] 使用 xiawen 链路结果: " + liteOnly.length);
      return liteOnly.map((anime) => this.decorateSearchAnime(anime));
    } catch (error) {
      log("info", "[Hanjutv2] xiawen 搜索失败: " + error.message);
      return [];
    }
  }

  async getDetail(id, options = {}) {
    try {
      const parsed = this.parsePlatformId(id);
      const sid = parsed.id;
      if (!sid) return [];

      const session = options?.liteSession || await this.createLiteSession();

      let detail = null;
      try {
        const detailData = await this.requestLiteApi("/api/v1/series/detail/query", { sid }, session);
        detail = detailData?.series || null;
      } catch (error) {
        log("info", "[Hanjutv2] xiawen 详情失败: " + error.message);
      }

      if (!detail) {
        log("debug", "getHanjutv2Detail: series 不存在");
        return [];
      }

      return detail;
    } catch (error) {
      log("error", "getHanjutv2Detail error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getEpisodes(id, options = {}) {
    try {
      const parsed = this.parsePlatformId(id);
      const sid = parsed.id;
      if (!sid) return [];

      const session = options?.liteSession || await this.createLiteSession();
      let episodes = [];

      try {
        const detailData = await this.requestLiteApi("/api/v1/series/detail/query", { sid }, session);
        const detailEpisodes = Array.isArray(detailData?.episodes) ? detailData.episodes : [];
        episodes = this.normalizeEpisodes(detailEpisodes);
      } catch (error) {
        log("debug", "[Hanjutv2] xiawen 分集详情失败: " + (error?.message || error));
      }

      if (episodes.length === 0) {
        try {
          const programData = await this.requestLiteApi("/api/v1/series/program/query", { sid }, session);
          const programs = Array.isArray(programData?.programs) ? programData.programs : [];
          episodes = this.normalizeEpisodes(programs);
        } catch (error) {
          log("debug", "[Hanjutv2] xiawen 分集列表失败: " + (error?.message || error));
        }
      }

      if (episodes.length === 0) {
        log("debug", "getHanjutv2Eposides: episodes 不存在");
        return [];
      }

      return episodes.sort((a, b) => a.serialNo - b.serialNo);
    } catch (error) {
      log("error", "getHanjutv2Eposides error:", {
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
      log("error", "[Hanjutv2] sourceAnimes is not a valid array");
      return [];
    }

    const tmpAnimes = [];
    const matchedSourceAnimes = sourceAnimes
      .filter((s) => titleMatches(s.name, queryTitle))
      .filter((s) => String(s?.chain || "xiawen").toLowerCase() === "xiawen");

    let sharedLiteSession = null;
    let sharedLiteSessionPromise = null;
    const getSharedLiteSession = async () => {
      if (sharedLiteSession) return sharedLiteSession;
      if (sharedLiteSessionPromise) return sharedLiteSessionPromise;

      sharedLiteSessionPromise = this.createLiteSession()
        .then((session) => {
          sharedLiteSession = session;
          return session;
        })
        .finally(() => {
          sharedLiteSessionPromise = null;
        });

      return sharedLiteSessionPromise;
    };

    const processHanjutvAnimes = await Promise.all(
      matchedSourceAnimes.map(async (anime) => {
        try {
          const requestOptions = { liteSession: await getSharedLiteSession() };

          const eps = await this.getEpisodes(anime.sid, requestOptions);
          if (!Array.isArray(eps) || eps.length === 0) {
            log("debug", "[Hanjutv2] 无可用分集，跳过: " + anime.name);
            return;
          }

          let detail = await this.getDetail(anime.sid, requestOptions);
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
          log("error", "[Hanjutv2] Error processing anime: " + error.message);
        }
      })
    );
    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);

    return processHanjutvAnimes;
  }

  async getEpisodeDanmuByLite(id) {
    let allDanmus = [];
    let fromAxis = 0;
    let prevId = 0;
    let pageCount = 0;
    const maxAxis = this.getDanmuMaxAxis();
    const maxPages = this.getDanmuMaxPages();

    try {
      const session = await this.createLiteSession();

      while (fromAxis < maxAxis && pageCount < maxPages) {
        const data = await this.requestLiteApi(
          "/api/v1/bulletchat/episode/get",
          {
            eid: id,
            prevId,
            fromAxis,
            toAxis: maxAxis,
            offset: 0,
          },
          session
        );
        pageCount += 1;

        const currentDanmus = Array.isArray(data?.bulletchats) ? data.bulletchats : [];
        if (currentDanmus.length > 0) {
          allDanmus.push(...currentDanmus);
        }

        const hasMore = Number(data?.more ?? 0) === 1 || data?.more === true || data?.more === "1";
        const nextAxis = Number(data?.nextAxis ?? maxAxis);
        const lastId = Number(data?.lastId ?? prevId);

        if (Number.isFinite(lastId) && lastId > prevId) prevId = lastId;

        if (!Number.isFinite(nextAxis) || nextAxis <= fromAxis) {
          log("warn", "[Hanjutv2] xiawen nextAxis 未前进，提前退出分页: fromAxis=" + fromAxis + ", nextAxis=" + data?.nextAxis);
          break;
        }

        if (nextAxis >= maxAxis) break;

        fromAxis = nextAxis;
        if (!hasMore) {
          prevId = 0;
        }
      }

      if (pageCount >= maxPages) {
        log("warn", "[Hanjutv2] xiawen 分页次数达到上限，提前停止: pid=" + id + ", pageCount=" + pageCount);
      }
      return allDanmus;
    } catch (error) {
      log("error", "fetchHanjutv2LiteEpisodeDanmu error:", {
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
    return this.getEpisodeDanmuByLite(parsed.id);
  }

  async getEpisodeDanmuSegments(id) {
    log("debug", "获取韩剧TV极简版弹幕分段列表...", id);

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
