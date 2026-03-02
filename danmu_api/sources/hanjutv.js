import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches, normalizeSpaces } from "../utils/common-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';
import { createHanjutvUid, createHanjutvSearchHeaders, createHanjutvLiteHeaders, decodeHanjutvEncryptedPayload } from "../utils/hanjutv-util.js";

// =====================
// 获取韩剧TV弹幕
// =====================
export default class HanjutvSource extends BaseSource {
  constructor() {
    super();
    this.appHost = "https://hxqapi.hiyun.tv";
    this.oldDanmuHost = "https://hxqapi.zmdcq.com";
    this.liteHost = "https://api.xiawen.tv";
    this.defaultRefer = "2JGztvGjRVpkxcr0T4ZWG2k+tOlnHmDGUNMwAGSeq548YV2FMbs0h0bXNi6DJ00L";
    this.appUserAgent = "HanjuTV/6.8 (23127PN0CC; Android 16; Scale/2.00)";
    this.searchHedgeDelayMs = 700;
    this.s5StableUid = createHanjutvUid();
  }

  getSourceTimeout() {
    const timeout = Number(globals.vodRequestTimeout || 10000);
    return Number.isFinite(timeout) && timeout > 0 ? timeout : 10000;
  }

  getS5SearchTimeout() {
    const custom = Number(globals.hanjutvS5SearchTimeout || 0);
    if (Number.isFinite(custom) && custom > 0) return custom;
    return Math.min(this.getSourceTimeout(), 6000);
  }

  getDanmuMaxPages() {
    const custom = Number(globals.hanjutvDanmuMaxPages || 0);
    if (Number.isFinite(custom) && custom > 0) {
      return Math.min(Math.floor(custom), 400);
    }
    return 120;
  }

  getDanmuMaxAxis() {
    const custom = Number(globals.hanjutvDanmuMaxAxis || 0);
    if (Number.isFinite(custom) && custom > 0) {
      return Math.floor(custom);
    }
    return 100000000;
  }

  logRequestFailure(stage, error) {
    log("debug", "[Hanjutv] " + stage + " 失败: " + (error?.message || error));
  }

  getAppHeaders() {
    return {
      vc: "a_8260",
      vn: "6.8",
      ch: "xiaomi",
      app: "hj",
      "User-Agent": this.appUserAgent,
      "Accept-Encoding": "gzip",
    };
  }

  normalizeChain(chain) {
    return String(chain || "").toLowerCase() === "xiawen" ? "xiawen" : "hxq";
  }

  parsePlatformId(rawId, defaultChain = "hxq") {
    const idText = String(rawId || "").trim();
    if (!idText) return { id: "", chain: this.normalizeChain(defaultChain) };
    if (idText.startsWith("xw:")) return { id: idText.slice(3), chain: "xiawen" };
    return { id: idText, chain: this.normalizeChain(defaultChain) };
  }

  encodeEpisodeId(pid, chain = "hxq") {
    const value = String(pid || "").trim();
    if (!value) return "";
    return this.normalizeChain(chain) === "xiawen" ? "xw:" + value : value;
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

        const chain = this.normalizeChain(item.chain || item.platformChain || "hxq");
        const imageObj = typeof item.image === "object" && item.image !== null ? item.image : {};
        const thumb = imageObj.thumb || imageObj.poster || imageObj.url || item.thumb || item.poster || "";

        return {
          ...item,
          sid: String(sid),
          name: String(name),
          chain,
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

        const chain = this.normalizeChain(item.chain || item.platformChain || "hxq");
        const serialCandidate = item.serialNo ?? item.serial_no ?? item.sort ?? item.sortNo ?? item.num ?? item.episodeNo ?? (index + 1);
        const serialNo = Number(serialCandidate);

        return {
          ...item,
          pid: String(pid),
          chain,
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
        return items.map((item) => ({ ...item, chain: "hxq" }));
      }

      const plainItems = this.extractSearchItems(payload);
      if (plainItems.length === 0) throw new Error("s5 无有效结果");
      return plainItems.map((item) => ({ ...item, chain: "hxq" }));
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

  async searchWithLiteApi(keyword, options = {}) {
    const session = await this.createLiteSession();
    const decoded = await this.requestLiteApi("/api/v1/aggregate/search", {
      key: keyword,
      scope: 101,
      page: 1,
    }, session, options);

    const items = this.extractSearchItems(decoded).map((item) => ({ ...item, chain: "xiawen" }));
    if (items.length === 0) throw new Error("xiawen 无有效结果");
    return items;
  }

  async search(keyword) {
    try {
      const key = String(keyword || "").trim();
      if (!key) return [];

      let s5List = [];
      let liteList = [];
      let s5Error = null;
      let liteError = null;
      let liteStarted = false;
      let liteFinished = false;
      let liteController = null;
      let litePromise = Promise.resolve([]);

      const startLiteSearch = () => {
        if (liteStarted) return litePromise;
        liteStarted = true;
        liteController = new AbortController();
        litePromise = this.searchWithLiteApi(key, { signal: liteController.signal })
          .then((list) => {
            liteFinished = true;
            liteList = Array.isArray(list) ? list : [];
            return liteList;
          })
          .catch((error) => {
            liteFinished = true;
            if (error?.name === "AbortError") {
              log("debug", "[Hanjutv] xiawen 补偿检索已取消（s5 已命中）");
              return [];
            }
            liteError = error;
            log("info", "[Hanjutv] xiawen 搜索失败: " + error.message);
            return [];
          });
        return litePromise;
      };

      const s5Promise = this.searchWithS5Api(key)
        .then((list) => {
          s5List = Array.isArray(list) ? list : [];
          return s5List;
        })
        .catch((error) => {
          s5Error = error;
          log("info", "[Hanjutv] s5 搜索失败，降级极简版接口: " + error.message);
          return [];
        });

      let hedgeTimer = null;
      const hedgePromise = new Promise((resolve) => {
        hedgeTimer = setTimeout(() => {
          log("debug", "[Hanjutv] s5 超过 " + this.searchHedgeDelayMs + "ms 未完成，启动 xiawen 并行补偿");
          startLiteSearch();
          resolve();
        }, this.searchHedgeDelayMs);
      });

      await Promise.race([s5Promise, hedgePromise]);
      await s5Promise;
      if (hedgeTimer) clearTimeout(hedgeTimer);

      const s5MatchedCount = this.countMatchedItems(s5List, key);
      const needLiteSearch = s5List.length === 0 || s5MatchedCount === 0;
      if (!needLiteSearch) {
        if (liteStarted && !liteFinished) liteController?.abort();
        const s5Only = this.dedupeBySid(s5List);
        log("info", "[Hanjutv] s5 命中标题，使用主链路结果: " + s5Only.length);
        return s5Only.map((anime) => {
          const animeId = convertToAsciiSum(anime.sid);
          return { ...anime, animeId };
        });
      }

      if (!s5Error && s5List.length > 0 && s5MatchedCount === 0) {
        log("info", "[Hanjutv] s5 返回 " + s5List.length + " 条但标题零命中，触发 xiawen 兜底");
      }
      await startLiteSearch();

      if (liteList.length > 0) {
        const liteOnly = this.dedupeBySid(liteList);
        log("info", "[Hanjutv] 使用 xiawen 兜底结果: " + liteOnly.length);
        return liteOnly.map((anime) => {
          const animeId = convertToAsciiSum(anime.sid);
          return { ...anime, animeId };
        });
      }

      if (s5List.length > 0) {
        const s5Fallback = this.dedupeBySid(s5List);
        log("info", "[Hanjutv] xiawen 无有效结果，回退 s5 非命中候选: " + s5Fallback.length);
        return s5Fallback.map((anime) => {
          const animeId = convertToAsciiSum(anime.sid);
          return { ...anime, animeId };
        });
      }

      if (liteError) log("debug", "hanjutvSearchresp: s5 无有效结果，xiawen 失败: " + liteError.message);
      log("debug", "hanjutvSearchresp: s5 与 xiawen 均无有效结果");
      return [];
    } catch (error) {
      log("error", "getHanjutvAnimes error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }
  async getDetail(id, chain = "hxq") {
    try {
      const parsed = this.parsePlatformId(id, chain);
      const sid = parsed.id;
      const finalChain = parsed.chain;
      if (!sid) return [];

      let detail = null;

      if (finalChain === "xiawen") {
        try {
          const session = await this.createLiteSession();
          const detailData = await this.requestLiteApi("/api/v1/series/detail/query", { sid }, session);
          detail = detailData?.series || null;
        } catch (error) {
          log("info", "[Hanjutv] xiawen 详情失败: " + error.message);
        }
      } else {
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

  async getEpisodes(id, chain = "hxq") {
    try {
      const parsed = this.parsePlatformId(id, chain);
      const sid = parsed.id;
      const finalChain = parsed.chain;
      if (!sid) return [];

      let episodes = [];

      if (finalChain === "xiawen") {
        const session = await this.createLiteSession();
        try {
          const detailData = await this.requestLiteApi("/api/v1/series/detail/query", { sid }, session);
          const detailEpisodes = Array.isArray(detailData?.episodes) ? detailData.episodes : [];
          episodes = this.normalizeEpisodes(detailEpisodes.map((item) => ({ ...item, chain: "xiawen" })));
        } catch (error) {
          this.logRequestFailure("xiawen 分集详情", error);
        }

        if (episodes.length === 0) {
          try {
            const programData = await this.requestLiteApi("/api/v1/series/program/query", { sid }, session);
            const programs = Array.isArray(programData?.programs) ? programData.programs : [];
            episodes = this.normalizeEpisodes(programs.map((item) => ({ ...item, chain: "xiawen" })));
          } catch (error) {
            this.logRequestFailure("xiawen 分集列表", error);
          }
        }
      } else {
        try {
          const detailResp = await httpGet(this.appHost + "/api/series/detail?sid=" + sid, {
            headers: this.getAppHeaders(),
            timeout: this.getSourceTimeout(),
            retries: 1,
          });
          const detailData = detailResp?.data;
          const playItems = Array.isArray(detailData?.playItems) ? detailData.playItems : [];
          episodes = this.normalizeEpisodes(playItems.map((item) => ({ ...item, chain: "hxq" })));
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
            episodes = this.normalizeEpisodes(items.map((item) => ({ ...item, chain: "hxq" })));
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
            episodes = this.normalizeEpisodes(programs.map((item) => ({ ...item, chain: "hxq" })));
          } catch (error) {
            this.logRequestFailure("hxq 分集接口 programs_v2", error);
          }
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

  pickBestAnimeByTitle(candidates = [], text = "") {
    const keyword = normalizeSpaces(text).toLowerCase();
    if (!keyword || !Array.isArray(candidates) || candidates.length === 0) return null;

    const exact = candidates.find((item) => normalizeSpaces(item?.name || "").toLowerCase() === keyword);
    if (exact) return exact;

    const matched = candidates.filter((item) => titleMatches(item?.name || "", text));
    if (matched.length === 0) return null;
    if (matched.length === 1) return matched[0];

    const score = (name) => {
      if (!name) return 3;
      if (name.startsWith(keyword)) return 0;
      if (name.includes(keyword)) return 1;
      return 2;
    };

    matched.sort((a, b) => {
      const aName = normalizeSpaces(a?.name || "").toLowerCase();
      const bName = normalizeSpaces(b?.name || "").toLowerCase();

      const scoreDiff = score(aName) - score(bName);
      if (scoreDiff !== 0) return scoreDiff;

      return Math.abs(aName.length - keyword.length) - Math.abs(bName.length - keyword.length);
    });

    return matched[0] || null;
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes) {
    const cateMap = { 1: "韩剧", 2: "综艺", 3: "电影", 4: "日剧", 5: "美剧", 6: "泰剧", 7: "国产剧" };

    function getCategory(key) {
      return cateMap[key] || "其他";
    }

    const tmpAnimes = [];
    let liteFallbackLoaded = false;
    let liteFallbackCandidates = [];
    let liteFallbackPromise = null;

    const ensureLiteFallbackCandidates = async () => {
      if (liteFallbackLoaded) return liteFallbackCandidates;
      if (liteFallbackPromise) return liteFallbackPromise;

      liteFallbackPromise = (async () => {
        try {
          const liteSearchList = await this.searchWithLiteApi(queryTitle);
          liteFallbackCandidates = this.dedupeBySid(liteSearchList);
          log("info", "[Hanjutv] 主链路不可用，加载 xiawen 兜底候选: " + liteFallbackCandidates.length);
        } catch (error) {
          liteFallbackCandidates = [];
          log("info", "[Hanjutv] 加载 xiawen 兜底候选失败: " + error.message);
        } finally {
          liteFallbackLoaded = true;
          liteFallbackPromise = null;
        }

        return liteFallbackCandidates;
      })();

      return liteFallbackPromise;
    };

    const tryFallbackToLite = async (sourceAnime) => {
      const candidates = await ensureLiteFallbackCandidates();
      if (!candidates.length) return null;

      return this.pickBestAnimeByTitle(candidates, sourceAnime?.name || "")
        || this.pickBestAnimeByTitle(candidates, queryTitle)
        || null;
    };

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[Hanjutv] sourceAnimes is not a valid array");
      return [];
    }

    const matchedSourceAnimes = sourceAnimes.filter((s) => titleMatches(s.name, queryTitle));
    const episodePrefetchMap = new Map();
    const getEpisodeCacheKey = (sid, chain) => this.normalizeChain(chain) + ":" + String(sid || "");

    let forceLiteOnly = false;
    let processingSourceAnimes = matchedSourceAnimes;

    for (const anime of matchedSourceAnimes) {
      const chain = this.normalizeChain(anime.chain);
      if (chain !== "hxq") continue;

      const cacheKey = getEpisodeCacheKey(anime.sid, chain);
      const eps = await this.getEpisodes(anime.sid, chain);
      episodePrefetchMap.set(cacheKey, eps);

      const mainUnavailable = !Array.isArray(eps) || eps.length === 0;
      if (!mainUnavailable) continue;

      const candidates = await ensureLiteFallbackCandidates();
      const liteMatched = candidates.filter((item) => titleMatches(item?.name || "", queryTitle));
      if (liteMatched.length > 0) {
        forceLiteOnly = true;
        processingSourceAnimes = liteMatched;
        log("info", "[Hanjutv] s5 命中但主链路无有效分集，触发 xiawen 全量兜底: " + anime.name + "，兜底结果=" + liteMatched.length);
      } else {
        log("info", "[Hanjutv] 主链路无有效分集，且 xiawen 无命中候选，保留主链路候选");
      }
      break;
    }

    const processHanjutvAnimes = await Promise.all(
      processingSourceAnimes.map(async (anime) => {
        try {
          const originalChain = forceLiteOnly ? "xiawen" : this.normalizeChain(anime.chain);
          let selectedAnime = anime;
          let selectedChain = originalChain;

          let eps = [];
          if (!forceLiteOnly && selectedChain === "hxq") {
            const cacheKey = getEpisodeCacheKey(selectedAnime.sid, selectedChain);
            if (episodePrefetchMap.has(cacheKey)) {
              eps = episodePrefetchMap.get(cacheKey);
            } else {
              eps = await this.getEpisodes(selectedAnime.sid, selectedChain);
            }
          } else {
            eps = await this.getEpisodes(selectedAnime.sid, selectedChain);
          }

          const mainUnavailable = !forceLiteOnly
            && selectedChain === "hxq"
            && (!Array.isArray(eps) || eps.length === 0);

          if (mainUnavailable) {
            const liteAnime = await tryFallbackToLite(anime);
            if (liteAnime?.sid) {
              log("info", "[Hanjutv] s5 命中但主链路无有效分集，触发 xiawen 兜底: " + anime.name);
              selectedAnime = { ...liteAnime, animeId: anime.animeId };
              selectedChain = "xiawen";
              eps = await this.getEpisodes(selectedAnime.sid, selectedChain);
            }
          }

          if (!Array.isArray(eps) || eps.length === 0) {
            log("debug", "[Hanjutv] 无可用分集，跳过: " + (selectedAnime?.name || anime.name));
            return;
          }

          let detail = await this.getDetail(selectedAnime.sid, selectedChain);
          if (!detail || typeof detail !== "object") detail = {};

          const links = [];
          for (const ep of eps) {
            const epTitle = ep.title && ep.title.trim() !== "" ? ("第" + ep.serialNo + "集：" + ep.title) : ("第" + ep.serialNo + "集");
            const encodedPid = this.encodeEpisodeId(ep.pid, ep.chain || selectedChain);
            links.push({
              name: epTitle,
              url: encodedPid,
              title: "【hanjutv】 " + epTitle,
            });
          }

          if (links.length > 0) {
            const nowYear = new Date().getFullYear();
            const candidateYears = [
              new Date(selectedAnime.updateTime || anime.updateTime || 0).getFullYear(),
              new Date(selectedAnime.publishTime || anime.publishTime || 0).getFullYear(),
              Number(selectedAnime.year || anime.year),
              new Date(detail?.updateTime || 0).getFullYear(),
              new Date(detail?.publishTime || 0).getFullYear(),
            ].filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2099);
            const year = candidateYears[0] || nowYear;
            const animeId = anime.animeId || convertToAsciiSum(selectedAnime.sid);

            const transformedAnime = {
              animeId,
              bangumiId: String(animeId),
              animeTitle: selectedAnime.name + "(" + year + ")【" + getCategory(detail?.category) + "】from hanjutv",
              type: getCategory(detail?.category),
              typeDescription: getCategory(detail?.category),
              imageUrl: selectedAnime.image?.thumb || anime.image?.thumb || "",
              startDate: generateValidStartDate(year),
              episodeCount: links.length,
              rating: detail?.rank,
              isFavorited: true,
              source: "hanjutv",
            };

            tmpAnimes.push(transformedAnime);
            addAnime({ ...transformedAnime, links });

            if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
          }
        } catch (error) {
          log("error", `[Hanjutv] Error processing anime: ${error.message}`);
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
          log("warn", "[Hanjutv] xiawen nextAxis 未前进，提前退出分页: fromAxis=" + fromAxis + ", nextAxis=" + data?.nextAxis);
          break;
        }

        if (nextAxis >= maxAxis) break;

        fromAxis = nextAxis;
        if (!hasMore) {
          prevId = 0;
        }
      }

      if (pageCount >= maxPages) {
        log("warn", "[Hanjutv] xiawen 分页次数达到上限，提前停止: pid=" + id + ", pageCount=" + pageCount);
      }
      return allDanmus;
    } catch (error) {
      log("error", "fetchHanjutvLiteEpisodeDanmu error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return allDanmus;
    }
  }

  async getEpisodeDanmu(id, chain = "hxq") {
    const parsed = this.parsePlatformId(id, chain);
    if (!parsed.id) return [];
    if (parsed.chain === "xiawen") return this.getEpisodeDanmuByLite(parsed.id);
    return this.getEpisodeDanmuByHxq(parsed.id);
  }
  async getEpisodeDanmuSegments(id) {
    log("debug", "获取韩剧TV弹幕分段列表...", id);

    return new SegmentListResponse({
      type: "hanjutv",
      segmentList: [
        {
          type: "hanjutv",
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
        p: `${(timeMs / 1000).toFixed(2)},${mode},${color},[hanjutv]`,
        m: c.con,
        t: Math.round(timeMs / 1000),
        like: Number(c.lc || 0),
      };
    });
  }
}
