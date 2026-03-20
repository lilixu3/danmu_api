import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet, httpPost } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { printFirst200Chars, titleMatches } from "../utils/common-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';

// =====================
// 获取 AcFun 弹幕
// =====================
const ACFUN_API_BASE = 'https://api-ipv6.acfunchina.com';
const ACFUN_APP_QUERY = 'market=xiaomi&product=ACFUN_APP&sys_version=16&app_version=6.79.0.1312&boardPlatform=pineapple&sys_name=android&socName=Unknown&appMode=0';

export default class AcfunSource extends BaseSource {
  constructor() {
    super();
    this.segmentDurationMs = 30000; // AcFun 接口单次有效窗口约 30 秒
    this.minSegmentDurationMs = 10000; // 高密度场景拆分到 10 秒兜底
    this.segmentSplitThreshold = 243; // 接近接口单次返回上限时触发细分
    this.maxSegmentSplitDepth = 2;
    this.maxConcurrent = 20;
    this.maxProbeDurationMs = 3 * 60 * 60 * 1000; // 未知时长时最多探测 3 小时
    this.minProbeBreakMs = 60 * 1000; // 至少拉取 1 分钟后才允许提前停止
    this.emptyProbeThreshold = 6; // 连续空窗口阈值
    this.sparseProbeStepMs = 5 * 60 * 1000; // 长空窗时用 5 分钟步进做前探
    this.sparseProbeWindowMs = 2 * 60 * 1000; // 前探窗口扩大到 2 分钟降低漏检概率
    this.durationCache = new Map();
    this.probeNoticeCache = new Set();
  }

  async requestGet(url, options = {}) {
    return await httpGet(url, options);
  }

  async requestPost(url, body, options = {}) {
    return await httpPost(url, body, options);
  }

  buildApiUrl(pathname) {
    return `${ACFUN_API_BASE}${pathname}?${ACFUN_APP_QUERY}`;
  }

  buildFormBody(payload) {
    const form = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        form.append(k, String(v));
      }
    });
    return form.toString();
  }

  getCommonHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/x-www-form-urlencoded"
    };
  }

  stripHtmlTags(text = "") {
    return String(text || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  }

  extractTypeFromDescription(description = "") {
    const text = String(description || "").trim();
    if (!text) return "番剧";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return parts[1];
    return "番剧";
  }

  parseEpisodeRef(id) {
    const raw = String(id || "").trim();
    let videoId = "";
    let durationMs = 0;
    let bangumiId = "";

    const acfunSchemeMatch = raw.match(/^acfun:\/\/video\/(\d+)(?:\?(.*))?$/i);
    if (acfunSchemeMatch) {
      videoId = acfunSchemeMatch[1];
      const query = acfunSchemeMatch[2] || "";
      const params = new URLSearchParams(query);
      durationMs = Number(params.get("durationMs") || params.get("duration") || 0);
      bangumiId = params.get("bangumiId") || "";
      return {
        videoId: String(videoId),
        durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.floor(durationMs) : 0,
        bangumiId: String(bangumiId || "")
      };
    }

    if (/^\d+$/.test(raw)) {
      return { videoId: raw, durationMs: 0, bangumiId: "" };
    }

    const vidMatch = raw.match(/(?:resourceId|videoId|id)=(\d+)/i) || raw.match(/\/video\/(\d+)/i);
    if (vidMatch) {
      videoId = vidMatch[1];
    }

    const durationMatch = raw.match(/duration(?:Ms)?=(\d+)/i);
    if (durationMatch) {
      durationMs = Number(durationMatch[1]);
    }

    const bangumiMatch = raw.match(/bangumiId=(\d+)/i);
    if (bangumiMatch) {
      bangumiId = bangumiMatch[1];
    }

    return {
      videoId: String(videoId || ""),
      durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.floor(durationMs) : 0,
      bangumiId: String(bangumiId || "")
    };
  }

  buildEpisodeId(videoId, durationMs = 0, bangumiId = "") {
    const safeDuration = Number.isFinite(Number(durationMs)) ? Math.max(0, Math.floor(Number(durationMs))) : 0;
    const safeBangumiId = String(bangumiId || "");
    return `acfun://video/${videoId}?durationMs=${safeDuration}&bangumiId=${safeBangumiId}`;
  }

  buildDanmuSegment(videoId, positionFromInclude, positionToExclude) {
    return {
      type: "acfun",
      segment_start: positionFromInclude / 1000,
      segment_end: positionToExclude / 1000,
      url: this.buildApiUrl("/rest/app/new-danmaku/pollByPosition"),
      data: this.buildFormBody({
        resourceId: videoId,
        resourceType: 9,
        lastFetchTime: 0,
        positionFromInclude,
        positionToExclude,
        enableAdvanced: false
      })
    };
  }

  buildSegmentList(videoId, durationMs) {
    const safeDuration = Math.max(Number(durationMs) || 0, this.segmentDurationMs);
    const segments = [];
    for (let start = 0; start < safeDuration; start += this.segmentDurationMs) {
      const end = Math.min(start + this.segmentDurationMs, safeDuration);
      segments.push(this.buildDanmuSegment(videoId, start, end));
    }
    return segments;
  }

  getVideoDurationCacheKey(videoId) {
    return `video:${videoId}`;
  }

  readDurationFromCache(videoId, bangumiId = "") {
    const keys = [];
    if (bangumiId) keys.push(`${bangumiId}:${videoId}`);
    keys.push(this.getVideoDurationCacheKey(videoId));

    for (const key of keys) {
      if (!this.durationCache.has(key)) continue;
      const durationMs = Number(this.durationCache.get(key) || 0);
      if (Number.isFinite(durationMs) && durationMs > 0) {
        return Math.floor(durationMs);
      }
    }
    return 0;
  }

  cacheDuration(videoId, bangumiId, durationMs) {
    const safeDurationMs = Number(durationMs);
    if (!Number.isFinite(safeDurationMs) || safeDurationMs <= 0) return;
    const rounded = Math.floor(safeDurationMs);
    if (bangumiId) this.durationCache.set(`${bangumiId}:${videoId}`, rounded);
    this.durationCache.set(this.getVideoDurationCacheKey(videoId), rounded);
  }

  extractDurationFromCastData(data) {
    const candidates = [
      data?.playInfo?.durationMillis,
      data?.playInfo?.duration,
      data?.playInfo?.streams?.[0]?.durationMillis,
      data?.playInfo?.streams?.[0]?.duration
    ];
    for (const value of candidates) {
      const durationMs = Number(value);
      if (Number.isFinite(durationMs) && durationMs > 0) {
        return Math.floor(durationMs);
      }
    }
    return 0;
  }

  async fetchDurationByCast(videoId, resourceId, resourceType) {
    try {
      const url = `${this.buildApiUrl("/rest/app/play/playInfo/cast")}&videoId=${encodeURIComponent(videoId)}&resourceId=${encodeURIComponent(resourceId)}&resourceType=${resourceType}&expiredSeconds=0`;
      const response = await this.requestGet(url, {
        headers: {
          "User-Agent": this.getCommonHeaders()["User-Agent"],
          "Accept": "application/json, text/plain, */*"
        }
      });

      if (!response || !response.data) {
        return { durationMs: 0, resultCode: -1 };
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      const resultCode = Number(data.result);
      if (resultCode !== 0) {
        return { durationMs: 0, resultCode };
      }

      return {
        durationMs: this.extractDurationFromCastData(data),
        resultCode: 0
      };
    } catch (error) {
      return { durationMs: 0, resultCode: -1, error };
    }
  }

  getCommentUniqueKey(comment) {
    const idKey = String(comment?.danmakuId || comment?.id || "").trim();
    return idKey ? ('id:' + idKey) : "";
  }

  normalizeAndSortComments(comments) {
    return (comments || []).sort((a, b) => {
      const pDiff = Number(a.position || 0) - Number(b.position || 0);
      if (pDiff !== 0) return pDiff;
      return Number(a.danmakuId || a.id || 0) - Number(b.danmakuId || b.id || 0);
    });
  }

  parseSegmentRange(segment) {
    const params = new URLSearchParams(segment?.data || "");
    const videoId = String(params.get("resourceId") || "");

    let startMs = Number(params.get("positionFromInclude"));
    let endMs = Number(params.get("positionToExclude"));

    if (!Number.isFinite(startMs)) {
      startMs = Number(segment?.segment_start || 0) * 1000;
    }
    if (!Number.isFinite(endMs)) {
      endMs = Number(segment?.segment_end || 0) * 1000;
    }

    startMs = Math.max(0, Math.floor(startMs || 0));
    endMs = Math.max(startMs + 1, Math.floor(endMs || startMs + 1));

    return {
      videoId,
      startMs,
      endMs,
      rangeMs: endMs - startMs
    };
  }

  shouldSplitSegment(rangeMs, commentCount, depth) {
    if (depth >= this.maxSegmentSplitDepth) return false;
    if (rangeMs <= this.minSegmentDurationMs) return false;
    return Number(commentCount) >= this.segmentSplitThreshold;
  }

  buildSubSegments(videoId, startMs, endMs, stepMs = this.minSegmentDurationMs) {
    const segments = [];
    const safeStep = Math.max(1000, Math.floor(Number(stepMs) || this.minSegmentDurationMs));
    for (let start = startMs; start < endMs; start += safeStep) {
      const end = Math.min(start + safeStep, endMs);
      segments.push(this.buildDanmuSegment(videoId, start, end));
    }
    return segments;
  }

  async requestSegmentPayload(segment) {
    try {
      const response = await this.requestPost(segment.url, segment.data || "", {
        headers: this.getCommonHeaders(),
        timeout: 12000,
        retries: 1
      });

      if (!response || !response.data) {
        return { comments: [], totalCount: 0 };
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (Number(data.result) !== 0) {
        return { comments: [], totalCount: Number(data?.totalCount || 0) };
      }

      return {
        comments: Array.isArray(data.danmakus) ? data.danmakus : [],
        totalCount: Number(data.totalCount || 0)
      };
    } catch (error) {
      log("warn", '[AcFun] 拉取分段弹幕失败: ' + error.message);
      return { comments: [], totalCount: 0 };
    }
  }

  async fetchSegmentPayloadSmart(segment, depth = 0) {
    const rawPayload = await this.requestSegmentPayload(segment);
    const { videoId, startMs, endMs, rangeMs } = this.parseSegmentRange(segment);

    if (!videoId || !this.shouldSplitSegment(rangeMs, rawPayload.comments.length, depth)) {
      return rawPayload;
    }

    const subSegments = this.buildSubSegments(videoId, startMs, endMs, this.minSegmentDurationMs);
    if (subSegments.length <= 1) {
      return rawPayload;
    }

    const mergedComments = [];
    const seenKeys = new Set();
    let totalCount = Number(rawPayload.totalCount || 0);

    const appendComments = (commentList) => {
      (commentList || []).forEach(comment => {
        const key = this.getCommentUniqueKey(comment);
        if (key) {
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
        }
        mergedComments.push(comment);
      });
    };

    // 先写入父段结果，子段失败时也能保底返回
    appendComments(rawPayload.comments);

    const settled = await Promise.allSettled(
      subSegments.map(subSegment => this.fetchSegmentPayloadSmart(subSegment, depth + 1))
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      const payload = result.value || {};
      totalCount = Math.max(totalCount, Number(payload.totalCount || 0));
      appendComments(Array.isArray(payload.comments) ? payload.comments : []);
    }

    return {
      comments: mergedComments,
      totalCount
    };
  }

  mapMode(mode) {
    const m = Number(mode);
    if (m === 4) return 4;
    if (m === 5) return 5;
    return 1;
  }

  async search(keyword) {
    try {
      log("info", `[AcFun] 开始搜索: ${keyword}`);
      const url = `${this.buildApiUrl("/rest/app/search/complex")}&keyword=${encodeURIComponent(keyword)}&requestId=&pCursor=0&sortType=1`;
      const response = await this.requestGet(url, {
        headers: {
          "User-Agent": this.getCommonHeaders()["User-Agent"],
          "Accept": "application/json, text/plain, */*"
        }
      });

      if (!response || !response.data) {
        log("info", "[AcFun] 搜索响应为空");
        return [];
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (Number(data.result) !== 0) {
        log("warn", `[AcFun] 搜索失败，result=${data.result}`);
        return [];
      }

      const itemList = Array.isArray(data.itemList) ? data.itemList : [];
      const result = [];
      const seen = new Set();

      itemList.forEach(item => {
        if (Number(item.itemType) !== 5) return; // 只保留番剧条目
        const bangumiId = String(item.id || item.bgmId || "");
        const title = this.stripHtmlTags(item.bgmTitle || item.emTitle || item.title || "");
        if (!bangumiId || !title || seen.has(bangumiId)) return;

        seen.add(bangumiId);
        result.push({
          mediaId: bangumiId,
          bangumiId,
          title,
          type: this.extractTypeFromDescription(item.description),
          year: Number(item.year) || null,
          imageUrl: item.coverImageH || item.coverImageV || "",
          episodeCount: Array.isArray(item.videoIdList) ? item.videoIdList.length : 0
        });
      });

      log("info", `[AcFun] 搜索找到 ${result.length} 个有效结果`);
      return result;
    } catch (error) {
      log("error", `[AcFun] 搜索失败: ${error.message}`);
      return [];
    }
  }

  async getDetail(bangumiId) {
    try {
      const response = await this.requestPost(
        this.buildApiUrl("/rest/app/new-bangumi/detail"),
        this.buildFormBody({ bangumiId }),
        { headers: this.getCommonHeaders() }
      );

      if (!response || !response.data) return null;
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (Number(data.result) !== 0) return null;
      return data.data || null;
    } catch (error) {
      log("warn", `[AcFun] 获取详情失败: ${error.message}`);
      return null;
    }
  }

  async getEpisodes(bangumiId) {
    try {
      log("info", `[AcFun] 获取分集列表: bangumiId=${bangumiId}`);
      const response = await this.requestPost(
        this.buildApiUrl("/rest/app/new-bangumi/itemList"),
        this.buildFormBody({ bangumiId, pageSize: 1000, pageNo: 1 }),
        { headers: this.getCommonHeaders() }
      );

      if (!response || !response.data) {
        log("info", "[AcFun] 分集响应为空");
        return [];
      }

      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (Number(data.result) !== 0) {
        log("warn", `[AcFun] 获取分集失败，result=${data.result}`);
        return [];
      }

      const rawItems = Array.isArray(data.items) ? data.items : (Array.isArray(data.itemList) ? data.itemList : []);
      const episodes = rawItems
        .map((item, index) => {
          const videoId = String(item.videoId || item.id || item.currentVideoInfo?.id || "");
          if (!videoId) return null;
          return {
            itemId: Number(item.itemId) || index + 1,
            updateTime: Number(item.updateTime) || 0,
            videoId,
            title: item.title || item.episodeName || `第${index + 1}话`,
            episodeName: item.episodeName || `第${index + 1}话`,
            durationMillis: Number(item.currentVideoInfo?.durationMillis || item.durationMillis || 0)
          };
        })
        .filter(Boolean);

      episodes.sort((a, b) => {
        const itemIdDiff = (a.itemId || 0) - (b.itemId || 0);
        if (itemIdDiff !== 0) return itemIdDiff;
        return (a.updateTime || 0) - (b.updateTime || 0);
      });

      log("info", `[AcFun] 成功获取 ${episodes.length} 个分集`);
      return episodes;
    } catch (error) {
      log("error", `[AcFun] 获取分集失败: ${error.message}`);
      return [];
    }
  }

  async getVideoDuration(videoId, bangumiId) {
    const safeVideoId = String(videoId || "");
    const safeBangumiId = String(bangumiId || "");
    if (!safeVideoId) return 0;

    const cachedDuration = this.readDurationFromCache(safeVideoId, safeBangumiId);
    if (cachedDuration > 0) {
      return cachedDuration;
    }

    const candidates = [];
    if (safeBangumiId) {
      candidates.push({ resourceId: safeBangumiId, resourceType: 1 });
    }
    candidates.push({ resourceId: safeVideoId, resourceType: 9 });

    for (const candidate of candidates) {
      const castResult = await this.fetchDurationByCast(safeVideoId, candidate.resourceId, candidate.resourceType);
      const durationMs = Number(castResult.durationMs || 0);
      if (Number.isFinite(durationMs) && durationMs > 0) {
        this.cacheDuration(safeVideoId, safeBangumiId, durationMs);
        return Math.floor(durationMs);
      }
    }

    return 0;
  }

  async findNextProbeHit(videoId, startMs) {
    const safeStartMs = Math.max(0, Math.floor(Number(startMs) || 0));
    const maxStartMs = Math.max(0, this.maxProbeDurationMs - this.sparseProbeWindowMs);

    for (let probeStart = safeStartMs; probeStart <= maxStartMs; probeStart += this.sparseProbeStepMs) {
      const probeEnd = Math.min(probeStart + this.sparseProbeWindowMs, this.maxProbeDurationMs);
      const comments = await this.pollDanmuWindow(videoId, probeStart, probeEnd);
      if (comments.length > 0) {
        return probeStart;
      }
    }
    return -1;
  }

  logProbeModeOnce(videoId) {
    const key = String(videoId || "");
    if (!key || this.probeNoticeCache.has(key)) return;
    this.probeNoticeCache.add(key);
    log("info", `[AcFun] 上游未返回时长，改用弹幕探测: videoId=${key}`);
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes, detailStore = null) {
    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[AcFun] sourceAnimes is not a valid array");
      return [];
    }

    const processAcfunAnimes = await Promise.all(sourceAnimes
      .filter(anime => titleMatches(anime.title || anime.bgmTitle, queryTitle))
      .map(async (anime) => {
        try {
          const bangumiId = String(anime.bangumiId || anime.mediaId || anime.id || "");
          if (!bangumiId) return;

          const episodes = await this.getEpisodes(bangumiId);
          if (!episodes.length) return;

          const links = episodes.map((ep, index) => {
            const displayName = ep.episodeName || `第${index + 1}话`;
            const title = ep.title || displayName;
            return {
              name: displayName,
              url: this.buildEpisodeId(ep.videoId, ep.durationMillis, bangumiId),
              title: `【acfun】 ${title}`
            };
          });

          const year = Number(anime.year) || new Date().getFullYear();
          const type = anime.type || "番剧";
          const transformedAnime = {
            animeId: convertToAsciiSum(`acfun_${bangumiId}`),
            bangumiId,
            animeTitle: `${anime.title}(${year})【${type}】from acfun`,
            type,
            typeDescription: type,
            imageUrl: anime.imageUrl || "",
            startDate: generateValidStartDate(year),
            episodeCount: links.length,
            rating: 0,
            isFavorited: true,
            source: "acfun",
          };

          tmpAnimes.push(transformedAnime);
          addAnime({ ...transformedAnime, links }, detailStore);
          if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
        } catch (error) {
          log("warn", `[AcFun] 处理动漫失败: ${error.message}`);
        }
      })
    );

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return processAcfunAnimes;
  }

  async pollDanmuWindow(videoId, positionFromInclude, positionToExclude) {
    const segment = this.buildDanmuSegment(videoId, positionFromInclude, positionToExclude);
    return await this.getEpisodeSegmentDanmu(segment);
  }

  async fetchBySegmentList(segmentList) {
    const allComments = [];
    const seenIds = new Set();
    let expectedTotalCount = 0;

    for (let i = 0; i < segmentList.length; i += this.maxConcurrent) {
      const batch = segmentList.slice(i, i + this.maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(segment => this.fetchSegmentPayloadSmart(segment))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status !== "fulfilled") {
          log("warn", '[AcFun] 分段拉取失败: ' + (result.reason?.message || 'unknown error'));
          continue;
        }

        const payload = result.value || {};
        expectedTotalCount = Math.max(expectedTotalCount, Number(payload.totalCount || 0));
        const comments = Array.isArray(payload.comments) ? payload.comments : [];
        comments.forEach(comment => {
          const key = this.getCommentUniqueKey(comment);
          if (key) {
            if (seenIds.has(key)) return;
            seenIds.add(key);
          }
          allComments.push(comment);
        });
      }

      // 接口返回了全量数量且已收齐时提前结束，减少尾段空请求
      if (expectedTotalCount > 0 && allComments.length >= expectedTotalCount) {
        break;
      }
    }

    return this.normalizeAndSortComments(allComments);
  }

  async fetchByProbe(videoId) {
    const allComments = [];
    const seenIds = new Set();
    const maxWindows = Math.ceil(this.maxProbeDurationMs / this.segmentDurationMs);
    let start = 0;
    let emptyStreak = 0;

    for (let i = 0; i < maxWindows; i++) {
      const end = start + this.segmentDurationMs;
      const comments = await this.pollDanmuWindow(videoId, start, end);
      if (!comments.length) {
        emptyStreak += 1;
      } else {
        emptyStreak = 0;
        comments.forEach(comment => {
          const key = this.getCommentUniqueKey(comment);
          if (key) {
            if (seenIds.has(key)) return;
            seenIds.add(key);
          }
          allComments.push(comment);
        });
      }

      // 长空窗前先做稀疏前探，避免跨越长静默段导致漏弹幕
      if (start >= this.minProbeBreakMs && emptyStreak >= this.emptyProbeThreshold) {
        const nextProbeStart = await this.findNextProbeHit(videoId, end);
        if (nextProbeStart > start) {
          start = nextProbeStart;
          emptyStreak = 0;
          continue;
        }
        break;
      }
      start = end;
    }

    return this.normalizeAndSortComments(allComments);
  }

  async getEpisodeDanmu(id) {
    const { videoId, durationMs: parsedDurationMs, bangumiId } = this.parseEpisodeRef(id);
    if (!videoId) {
      log("error", `[AcFun] 无法解析 videoId: ${id}`);
      return [];
    }

    let durationMs = parsedDurationMs;
    if (durationMs <= 0) {
      durationMs = await this.getVideoDuration(videoId, bangumiId);
    }

    let comments = [];
    if (durationMs > 0) {
      // 已知时长时按完整窗口全量拉取，避免只拉前几分钟
      const segments = this.buildSegmentList(videoId, durationMs);
      comments = await this.fetchBySegmentList(segments);
    } else {
      this.logProbeModeOnce(videoId);
      comments = await this.fetchByProbe(videoId);
    }

    if (!comments.length) {
      log("info", `[AcFun] 该视频暂无弹幕: videoId=${videoId}`);
      return [];
    }

    printFirst200Chars(comments);
    return comments;
  }

  async getEpisodeDanmuSegments(id) {
    const { videoId, durationMs: parsedDurationMs, bangumiId } = this.parseEpisodeRef(id);
    let durationMs = parsedDurationMs;
    if (durationMs <= 0) {
      durationMs = await this.getVideoDuration(videoId, bangumiId);
    }

    if (!videoId || durationMs <= 0) {
      return new SegmentListResponse({
        type: "acfun",
        segmentList: []
      });
    }

    const segmentList = this.buildSegmentList(videoId, durationMs);
    return new SegmentListResponse({
      type: "acfun",
      segmentList
    });
  }

  async getEpisodeSegmentDanmu(segment) {
    const payload = await this.fetchSegmentPayloadSmart(segment);
    return Array.isArray(payload.comments) ? payload.comments : [];
  }

  formatComments(comments) {
    return (comments || [])
      .filter(item => item && item.body)
      .map(item => {
        const timepoint = Number(item.position || 0) / 1000;
        const color = Number(item.color) || 16777215;
        const mode = this.mapMode(item.mode);
        const cid = Number(item.danmakuId || item.id || 0);

        return {
          cid,
          p: `${timepoint.toFixed(2)},${mode},${color},[acfun]`,
          m: item.body,
          t: Math.round(timepoint),
          like: Number(item.likeCount) || 0
        };
      });
  }
}
