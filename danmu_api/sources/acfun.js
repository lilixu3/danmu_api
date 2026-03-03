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
    this.segmentDurationMs = 10000; // 10 秒一个窗口
    this.maxConcurrent = 20;
    this.maxProbeDurationMs = 3 * 60 * 60 * 1000; // 未知时长时最多探测 3 小时
    this.emptyProbeThreshold = 6; // 连续空窗口阈值
    this.durationCache = new Map();
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
    if (!safeVideoId || !safeBangumiId) return 0;

    const cacheKey = `${safeBangumiId}:${safeVideoId}`;
    if (this.durationCache.has(cacheKey)) {
      return this.durationCache.get(cacheKey) || 0;
    }

    try {
      const url = `${this.buildApiUrl("/rest/app/play/playInfo/cast")}&videoId=${encodeURIComponent(safeVideoId)}&resourceId=${encodeURIComponent(safeBangumiId)}&resourceType=1&expiredSeconds=0`;
      const response = await this.requestGet(url, {
        headers: {
          "User-Agent": this.getCommonHeaders()["User-Agent"],
          "Accept": "application/json, text/plain, */*"
        }
      });

      if (!response || !response.data) return 0;
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (Number(data.result) !== 0) return 0;

      const durationMs = Number(data.playInfo?.durationMillis || data.playInfo?.duration || 0);
      if (Number.isFinite(durationMs) && durationMs > 0) {
        const safeDuration = Math.floor(durationMs);
        this.durationCache.set(cacheKey, safeDuration);
        return safeDuration;
      }
      return 0;
    } catch (error) {
      log("warn", `[AcFun] 获取时长失败: ${error.message}`);
      return 0;
    }
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes) {
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
          addAnime({ ...transformedAnime, links });
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

    for (let i = 0; i < segmentList.length; i += this.maxConcurrent) {
      const batch = segmentList.slice(i, i + this.maxConcurrent);
      const batchResults = await Promise.allSettled(batch.map(segment => this.getEpisodeSegmentDanmu(segment)));

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status !== "fulfilled") {
          log("warn", `[AcFun] 分段拉取失败: ${result.reason?.message || "unknown error"}`);
          continue;
        }

        const comments = Array.isArray(result.value) ? result.value : [];
        comments.forEach(comment => {
          const key = String(comment?.danmakuId || comment?.id || "");
          if (!key || seenIds.has(key)) return;
          seenIds.add(key);
          allComments.push(comment);
        });
      }
    }

    allComments.sort((a, b) => {
      const pDiff = Number(a.position || 0) - Number(b.position || 0);
      if (pDiff !== 0) return pDiff;
      return Number(a.danmakuId || 0) - Number(b.danmakuId || 0);
    });

    return allComments;
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
          const key = String(comment?.danmakuId || comment?.id || "");
          if (!key || seenIds.has(key)) return;
          seenIds.add(key);
          allComments.push(comment);
        });
      }

      // 至少拉取 1 分钟后才允许提前停止
      if (start >= 60000 && emptyStreak >= this.emptyProbeThreshold) {
        break;
      }
      start = end;
    }

    allComments.sort((a, b) => {
      const pDiff = Number(a.position || 0) - Number(b.position || 0);
      if (pDiff !== 0) return pDiff;
      return Number(a.danmakuId || 0) - Number(b.danmakuId || 0);
    });

    return allComments;
  }

  async getEpisodeDanmu(id) {
    const { videoId, durationMs: parsedDurationMs, bangumiId } = this.parseEpisodeRef(id);
    if (!videoId) {
      log("error", `[AcFun] 无法解析 videoId: ${id}`);
      return [];
    }

    let durationMs = parsedDurationMs;
    if (durationMs <= 0 && bangumiId) {
      durationMs = await this.getVideoDuration(videoId, bangumiId);
    }

    let comments = [];
    if (durationMs > 0) {
      // 已知时长时按完整窗口全量拉取，避免只拉前几分钟
      const segments = this.buildSegmentList(videoId, durationMs);
      comments = await this.fetchBySegmentList(segments);
    } else {
      log("warn", `[AcFun] 未提供时长，进入探测拉取模式: videoId=${videoId}`);
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
    if (durationMs <= 0 && bangumiId) {
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
    try {
      const response = await this.requestPost(segment.url, segment.data || "", {
        headers: this.getCommonHeaders(),
        timeout: 12000,
        retries: 1
      });

      if (!response || !response.data) return [];
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (Number(data.result) !== 0) return [];
      return Array.isArray(data.danmakus) ? data.danmakus : [];
    } catch (error) {
      log("warn", `[AcFun] 拉取分段弹幕失败: ${error.message}`);
      return [];
    }
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
