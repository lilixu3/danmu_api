import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches } from "../utils/common-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';
import {
  HANJUTV_APP_PROFILE,
  loadHanjutvSearchContext,
  createHanjutvSearchHeaders,
  decodeHanjutvEncryptedPayload,
  buildLiteHeaders,
} from "../utils/hanjutv-util.js";

const CATE_MAP = { 1: "韩剧", 2: "综艺", 3: "电影", 4: "日剧", 5: "美剧", 6: "泰剧", 7: "国产剧" };
const MAX_AXIS = 100000000;
const DANMU_WINDOW_MS = 60000;

// =====================
// 获取韩剧TV弹幕
// =====================
export default class HanjutvSource extends BaseSource {
  constructor() {
    super();
    this.webHost = "https://hxqapi.hiyun.tv";
    this.appHost = "https://hxqapi.hiyun.tv";
    this.tvHost = "https://api.xiawen.tv";
    this.oldDanmuHost = "https://hxqapi.zmdcq.com";
    this.danmuHosts = Array.from(new Set([this.appHost, this.oldDanmuHost]));
    this.defaultRefer = "2JGztvGjRVpkxcr0T4ZWG2k+tOlnHmDGUNMwAGSeq548YV2FMbs0h0bXNi6DJ00L";
    this.webUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
    this.tvHeaderFactoryPromise = null;
    this.mobileWarmupUid = null;
    this.danmuConfigWarmupUid = null;
  }

  getWebHeaders() {
    return {
      "Content-Type": "application/json",
      "User-Agent": this.webUserAgent,
    };
  }

  getMobileSearchContext(profile = HANJUTV_APP_PROFILE, options = {}) {
    return loadHanjutvSearchContext(profile, { ...options, timestamp: Date.now() });
  }

  getAppHeaders(profile = HANJUTV_APP_PROFILE) {
    const context = this.getMobileSearchContext(profile);
    const pickedProfile = context.profile || profile;
    return {
      vc: pickedProfile.vc,
      vn: pickedProfile.version,
      ch: pickedProfile.ch,
      app: "hj",
      said: context.said,
      "User-Agent": pickedProfile.userAgent,
      "Accept-Encoding": "gzip",
      Connection: "Keep-Alive",
    };
  }

  async buildDanmuLoginHeaders(profile = HANJUTV_APP_PROFILE) {
    const context = this.getMobileSearchContext(profile);
    const headers = await createHanjutvSearchHeaders(context);
    return {
      context,
      headers: {
        ...headers,
        "auth-token": "",
        "auth-uid": "",
      },
    };
  }

  getCategory(key) {
    return CATE_MAP[key] || "其他";
  }

  normalizeEpisodeDanmuId(rawId) {
    const idText = String(rawId || "").trim();
    if (!idText) return { id: "", preferTv: false, isLegacyTvCache: false };

    if (idText.startsWith("xw:")) {
      return {
        id: idText.slice(3),
        preferTv: true,
        isLegacyTvCache: true,
      };
    }

    return { id: idText, preferTv: false, isLegacyTvCache: false };
  }

  /**
   * 构建 TV 端请求头，返回 { headers, uid }
   */
  async buildTvHeaders() {
    if (!this.tvHeaderFactoryPromise) this.tvHeaderFactoryPromise = buildLiteHeaders(Date.now());
    const makeHeaders = await this.tvHeaderFactoryPromise;
    return makeHeaders(Date.now()); // { headers, uid }
  }

  /**
   * 向 TV 端发起 GET 请求并自动解密响应
   */
  async tvGet(path, options = {}) {
    const headerInfo = await this.buildTvHeaders();
    const resp = await httpGet(`${this.tvHost}${path}`, {
      headers: headerInfo.headers,
      timeout: 10000,
      retries: 1,
      ...options,
    });
    return decodeHanjutvEncryptedPayload(resp?.data, headerInfo.uid);
  }

  /**
   * 统一的错误日志格式
   */
  logError(tag, error) {
    log("error", `${tag}:`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
  }

  /**
   * 安全执行异步操作，失败时返回 fallback 值并可选打印警告
   */
  async tryGet(fn, fallback, warnTag) {
    try {
      return await fn();
    } catch (error) {
      if (warnTag) log("warn", `${warnTag}: ${error.message}`);
      return fallback;
    }
  }

  // ── 数据规范化 ──────────────────────────────────────────────

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
          image: { ...imageObj, thumb },
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
          serialNo: Number.isFinite(serialNo) && serialNo > 0 ? serialNo : (index + 1),
          title: item.title || item.name || item.programName || item.episodeTitle || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.serialNo - b.serialNo);
  }

  extractSearchItems(data) {
    const list = data?.seriesData?.seriesList || data?.seriesList || data?.seriesData?.series || [];
    return this.normalizeSearchItems(list);
  }

  // ── 搜索候选合并 ─────────────────────────────────────────────

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

  mergeSearchCandidates(keyword, s5List = [], webList = []) {
    const s5Unique = this.dedupeBySid(s5List);
    const webUnique = this.dedupeBySid(webList);

    const partition = (items) => {
      const matched = [], unmatched = [];
      for (const item of items)
        (titleMatches(item?.name || "", keyword) ? matched : unmatched).push(item);
      return { matched, unmatched };
    };

    const s5 = partition(s5Unique);
    const web = partition(webUnique);

    // s5 优先：命中项中 s5 在前，未命中项中 s5 也在前
    const hasMatched = s5.matched.length + web.matched.length > 0;
    const ordered = hasMatched
      ? [...s5.matched, ...web.matched, ...s5.unmatched, ...web.unmatched]
      : [...s5Unique, ...webUnique];

    // 跨源去重（保留先出现的，即 s5 优先）
    const resultList = [];
    const seen = new Set();
    for (const item of ordered) {
      const sid = String(item.sid);
      if (seen.has(sid)) continue;
      seen.add(sid);
      resultList.push(item);
    }

    const names = (list) => list.map(item => item.name);

    return {
      resultList,
      stats: {
        s5Total: s5Unique.length,
        s5Matched: s5.matched.length,
        webTotal: webUnique.length,
        webMatched: web.matched.length,
        s5MatchedList: names(s5.matched),
        s5UnmatchedList: names(s5.unmatched),
        webMatchedList: names(web.matched),
        webUnmatchedList: names(web.unmatched),
      },
    };
  }

  // ── 搜索接口 ─────────────────────────────────────────────────

  /**
   * 从响应 payload 中提取搜索结果；支持加密与明文两种格式
   */
  async extractFromPayload(payload, uid, tag) {
    if (!payload || typeof payload !== "object") throw new Error(`${tag} 响应为空`);

    if (typeof payload.data === "string" && payload.data.length > 0) {
      let decoded;
      try {
        decoded = await decodeHanjutvEncryptedPayload(payload, uid);
      } catch (error) {
        throw new Error(`${tag} 响应解密失败: ${error.message}`);
      }
      const items = this.extractSearchItems(decoded);
      if (items.length === 0) throw new Error(`${tag} 解密后无有效结果`);
      return items;
    }

    const items = this.extractSearchItems(payload);
    if (items.length === 0) throw new Error(`${tag} 无有效结果`);
    return items;
  }

  async warmupMobileIdentity(context, headers) {
    if (this.mobileWarmupUid === context.uid) return;
    // 串行化：多个并发调用只执行一次暖身请求
    this._warmupLock = (this._warmupLock || Promise.resolve()).then(async () => {
      if (this.mobileWarmupUid === context.uid) return;
      try {
        await httpGet("https://hxqapi.hiyun.tv/api/common/configs", { headers, timeout: 8000, retries: 0 });
        this.mobileWarmupUid = context.uid;
      } catch (_) {
        // 暖身失败不阻断搜索
      }
    });
    return this._warmupLock;
  }

  async warmupDanmuConfig(context, headers) {
    if (this.danmuConfigWarmupUid === context.uid) return;
    this._danmuConfigLock = (this._danmuConfigLock || Promise.resolve()).then(async () => {
      if (this.danmuConfigWarmupUid === context.uid) return;
      try {
        await httpGet(`${this.appHost}/api/danmu/config`, { headers, timeout: 8000, retries: 0 });
        this.danmuConfigWarmupUid = context.uid;
      } catch (_) {
        // 弹幕配置预热失败不阻断主流程
      }
    });
    return this._danmuConfigLock;
  }

  async searchWithS5Api(keyword) {
    const doSearch = async (options = {}) => {
      const context = this.getMobileSearchContext(HANJUTV_APP_PROFILE, options);
      const headers = await createHanjutvSearchHeaders(context);
      await this.warmupMobileIdentity(context, headers);
      const q = encodeURIComponent(keyword);
      const resp = await httpGet(`https://hxqapi.hiyun.tv/api/search/s5?k=${q}&srefer=search_input&type=0&page=1`, {
        headers,
        timeout: 10000,
        retries: 1,
      });
      return this.extractFromPayload(resp?.data, context.uid, "s5");
    };

    try {
      return await doSearch();
    } catch (error) {
      const msg = String(error?.message || "");
      if (!msg.includes("无有效结果") && !msg.includes("解密失败")) throw error;
      log("warn", `[Hanjutv] s5 当前身份失败，刷新重试: ${error.message}`);
      this.mobileWarmupUid = null;
      return doSearch({ refresh: true, forceRandom: true });
    }
  }

  async searchWithLegacyApi(keyword) {
    const q = encodeURIComponent(keyword);
    const resp = await httpGet(`https://hxqapi.hiyun.tv/wapi/search/aggregate/search?keyword=${q}&scope=101&page=1`, {
      headers: this.getWebHeaders(),
      timeout: 10000,
      retries: 1,
    });
    return this.extractSearchItems(resp?.data);
  }

  async searchWithTvApi(keyword) {
    const q = encodeURIComponent(keyword);
    const headerInfo = await this.buildTvHeaders();
    const resp = await httpGet(`https://api.xiawen.tv/api/v1/aggregate/search?key=${q}&scope=101&page=1`, {
      headers: headerInfo.headers,
      timeout: 10000,
      retries: 1,
    });
    return this.extractFromPayload(resp?.data, headerInfo.uid, "tv");
  }

  async search(keyword) {
    try {
      const key = String(keyword || "").trim();
      if (!key) return [];

      // s5 → legacy → tv 三级降级搜索
      let s5List = await this.tryGet(() => this.searchWithS5Api(key), [], `[Hanjutv] s5 搜索失败，降级旧接口`);
      let webList = [];
      let tvList = [];

      const needFallback = (list) => list.length === 0 || this.countMatchedItems(list, key) === 0;

      if (needFallback(s5List)) {
        if (s5List.length > 0) log("warn", `[Hanjutv] s5 返回 ${s5List.length} 条但标题零命中，触发 legacy 补偿检索`);
        webList = await this.tryGet(() => this.searchWithLegacyApi(key), [], `[Hanjutv] 旧搜索接口失败`);

        if (needFallback(webList)) {
          if (webList.length > 0) log("warn", `[Hanjutv] web 返回 ${webList.length} 条但标题零命中，触发 TV 补偿检索`);
          log("info", `[Hanjutv] 尝试TV端搜索接口作为降级方案`);
          tvList = await this.tryGet(() => this.searchWithTvApi(key), [], `[Hanjutv] TV端搜索接口也失败`);
        }
      }

      const { resultList, stats } = this.mergeSearchCandidates(key, s5List, [...webList, ...tvList]);
      const totalMatched = stats.s5Matched + stats.webMatched;

      if (resultList.length > 0 && totalMatched === 0) {
        log("warn", `[Hanjutv] 所有候选均未命中关键词，丢弃疑似推荐流结果: ${key}`);
        return [];
      }

      if (resultList.length === 0) {
        log("info", "hanjutvSearchresp: s5、旧接口和TV端接口均无有效结果");
        return [];
      }

      log("info", `[Hanjutv] 搜索候选统计 s5MatchedList=${JSON.stringify(stats.s5MatchedList)}, s5UnmatchedList=${JSON.stringify(stats.s5UnmatchedList)}, webMatchedList=${JSON.stringify(stats.webMatchedList)}, webUnmatchedList=${JSON.stringify(stats.webUnmatchedList)}`);
      log("info", `[Hanjutv] 搜索候选统计 s5=${stats.s5Total}(命中${stats.s5Matched}), web=${stats.webTotal}(命中${stats.webMatched})`);
      log("info", `[Hanjutv] 搜索找到 ${resultList.length} 个有效结果`);

      return resultList.map((anime) => ({ ...anime, animeId: convertToAsciiSum(anime.sid) }));
    } catch (error) {
      this.logError("getHanjutvAnimes error", error);
      return [];
    }
  }

  // ── 详情 & 剧集 ──────────────────────────────────────────────

  async getDetail(id) {
    try {
      const sid = String(id || "").trim();
      if (!sid) return [];

      // 移动端详情链路依赖完整 login/sign_extra_login 态，当前项目未持有稳定登录态时直接跳过，
      // 避免每次搜索结果处理都先打一轮必败的 bad request params。
      let detail =
        await this.tryGet(async () => {
          const r = await httpGet(`${this.webHost}/wapi/series/series/detail?sid=${sid}`, { headers: this.getWebHeaders(), timeout: 10000, retries: 1 });
          return r?.data?.series ?? null;
        }, null) ??
        await this.tryGet(async () => {
          const decoded = await this.tvGet(`/api/v1/series/detail/query?sid=${sid}`);
          return decoded?.series ?? null;
        }, null, "getHanjutvDetail error");

      if (!detail) {
        log("info", "getHanjutvDetail: series 不存在");
        return [];
      }
      return detail;
    } catch (error) {
      this.logError("getHanjutvDetail error", error);
      return [];
    }
  }

  async getEpisodes(id) {
    try {
      const sid = String(id || "").trim();
      if (!sid) return [];

      // 依次尝试已验证的 Web / TV 接口，避免移动端接口在无登录态下反复空跑
      const attempts = [
        async () => {
          const r = await httpGet(`${this.webHost}/wapi/series/series/detail?sid=${sid}`, { headers: this.getWebHeaders(), timeout: 10000, retries: 1 });
          return this.normalizeEpisodes(r?.data?.episodes || []);
        },
        async () => {
          const decoded = await this.tvGet(`/api/v1/series/detail/query?sid=${sid}`);
          return this.normalizeEpisodes(decoded?.episodes || []);
        },
      ];

      let episodes = [];
      for (const attempt of attempts) {
        if (episodes.length > 0) break;
        episodes = await this.tryGet(attempt, []);
      }

      if (episodes.length === 0) {
        log("info", "getHanjutvEposides: episodes 不存在");
        return [];
      }

      return episodes.sort((a, b) => a.serialNo - b.serialNo);
    } catch (error) {
      this.logError("getHanjutvEposides error", error);
      return [];
    }
  }

  // ── 番剧处理 ─────────────────────────────────────────────────

  async handleAnimes(sourceAnimes, queryTitle, curAnimes, detailStore = null) {
    if (!Array.isArray(sourceAnimes)) {
      log("error", "[Hanjutv] sourceAnimes is not a valid array");
      return [];
    }

    const tmpAnimes = [];

    await Promise.all(
      sourceAnimes
        .filter(s => titleMatches(s.name, queryTitle))
        .map(async (anime) => {
          try {
            const [detail, eps] = await Promise.all([
              this.getDetail(anime.sid),
              this.getEpisodes(anime.sid),
            ]);

            const links = eps.map((ep) => {
              const epTitle = ep.title?.trim()
                ? `第${ep.serialNo}集：${ep.title}`
                : `第${ep.serialNo}集`;
              return { name: epTitle, url: ep.pid, title: `【hanjutv】 ${epTitle}` };
            });

            if (links.length === 0) return;

            const category = this.getCategory(detail.category);
            const year = new Date(anime.updateTime).getFullYear();
            const transformedAnime = {
              animeId: anime.animeId,
              bangumiId: String(anime.animeId),
              animeTitle: `${anime.name}(${year})【${category}】from hanjutv`,
              type: category,
              typeDescription: category,
              imageUrl: anime.image.thumb,
              startDate: generateValidStartDate(year),
              episodeCount: links.length,
              rating: detail.rank,
              isFavorited: true,
              source: "hanjutv",
            };

            tmpAnimes.push(transformedAnime);
            addAnime({ ...transformedAnime, links }, detailStore);
            if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
          } catch (error) {
            log("error", `[Hanjutv] Error processing anime: ${error.message}`);
          }
        })
    );

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return tmpAnimes;
  }

  // ── 弹幕 ─────────────────────────────────────────────────────

  async getEpisodeDanmu(id) {
    const episodeRef = this.normalizeEpisodeDanmuId(id);
    if (!episodeRef.id) return [];

    const episodeId = episodeRef.id;
    let allDanmus = [];

    // 尝试旧弹幕接口（分页轮询）
    if (!episodeRef.preferTv) {
      const { context, headers } = await this.buildDanmuLoginHeaders();
      await this.warmupDanmuConfig(context, headers);

      for (const danmuHost of this.danmuHosts) {
        try {
          const hostDanmus = [];
          let prevId = 0;
          let fromAxis = 0;
          let pageCount = 0;
          const maxPages = 120;

          while (fromAxis < MAX_AXIS && pageCount < maxPages) {
            const toAxis = fromAxis + DANMU_WINDOW_MS;
            const resp = await httpGet(`${danmuHost}/api/danmu/playItem/list?pid=${episodeId}&prevId=${prevId}&fromAxis=${fromAxis}&toAxis=${toAxis}&offset=0`, {
              headers,
              timeout: 10000,
              retries: 1,
            });

            pageCount++;
            if (Array.isArray(resp?.data?.danmus)) hostDanmus.push(...resp.data.danmus);

            const hasMore = Number(resp?.data?.more ?? 0) === 1 || resp?.data?.more === true || resp?.data?.more === "1";
            const nextAxis = Number(resp?.data?.nextAxis ?? MAX_AXIS);
            const lastId = Number(resp?.data?.lastId ?? prevId);

            if (Number.isFinite(lastId) && lastId > prevId) prevId = lastId;
            if (!hasMore) break;
            if (!Number.isFinite(nextAxis) || nextAxis <= fromAxis || nextAxis >= MAX_AXIS) break;
            fromAxis = nextAxis;
          }

          if (hostDanmus.length > 0) {
            allDanmus = hostDanmus;
            break;
          }
        } catch (error) {
          this.logError(`fetchHanjutvEpisodeDanmu(App弹幕:${danmuHost})`, error);
        }
      }
    } else {
      log("info", `[Hanjutv] 命中旧缓存 xw: 前缀，直接走 TV 弹幕接口: ${episodeId}`);
    }

    // 若旧接口无数据（含请求失败），降级到 TV 端弹幕接口
    if (allDanmus.length === 0) {
      let prevId = 0;
      let fromAxis = 0;
      let pageCount = 0;
      const maxPages = 120;

      while (fromAxis < DANMU_WINDOW_MS && pageCount < maxPages) {
        try {
          const data = await this.tvGet(`/api/v1/bulletchat/episode/get?eid=${episodeId}&prevId=${prevId}&fromAxis=${fromAxis}&toAxis=${DANMU_WINDOW_MS}&offset=0`);

          pageCount++;
          if (Array.isArray(data?.bulletchats)) allDanmus.push(...data.bulletchats);

          const hasMore = Number(data.more ?? 0) === 1 || data.more === true || data.more === "1";
          const nextAxis = Number(data.nextAxis ?? MAX_AXIS);
          const lastId = Number(data.lastId ?? prevId);

          if (Number.isFinite(lastId) && lastId > prevId) prevId = lastId;
          if (!hasMore) break;
          if (!Number.isFinite(nextAxis) || nextAxis <= fromAxis || nextAxis >= DANMU_WINDOW_MS) break;

          fromAxis = nextAxis;
        } catch (error) {
          this.logError("fetchHanjutvEpisodeDanmu(TV端)", error);
          break;
        }
      }
    }

    return allDanmus;
  }

  async getEpisodeDanmuSegments(id) {
    log("info", "获取韩剧TV弹幕分段列表...", id);

    return new SegmentListResponse({
      type: "hanjutv",
      duration: 0,
      segmentList: [],
    });
  }

  async getEpisodeSegmentDanmu(segment) {
    return this.getEpisodeDanmu(segment.url);
  }

  formatComments(comments) {
    return comments.map(c => ({
      cid: Number(c.did),
      p: (c.t / 1000).toFixed(2) + "," + (c.tp === 2 ? 5 : c.tp) + "," + Number(c.sc) + ",[hanjutv]",
      m: c.con,
      t: Math.round(c.t / 1000),
      like: c.lc,
    }));
  }
}
