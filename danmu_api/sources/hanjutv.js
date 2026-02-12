import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum, md5 } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { normalizeSpaces, titleMatches } from "../utils/common-util.js";
import { SegmentListResponse } from '../models/dandan-model.js';

export default class HanjutvSource extends BaseSource {
  constructor() {
    super();

    this.apiHost = "https://hxqapi.hiyun.tv";
    this.currentUserAgent = "HanjuTV/6.8 (23127PN0CC; Android 16; Scale/2.00)";
    this.deviceHeaders = {
      ...(globals?.hanjutvHeaders || {}),
    };

    this.decryptMode1SecKey = "34F9Q53w/HJW8E6Q";
    this.defaultSeriesRefer = "2JGztvGjRVpkxcr0T4ZWG2k+tOlnHmDGUNMwAGSeq548YV2FMbs0h0bXNi6DJ00L";

    this.sidMetaCache = new Map();
    this.seriesDetailCache = new Map();
    this.seriesEpisodesCache = new Map();

    this.indexSearchCache = new Map();
    this.indexCacheTtlMs = 10 * 60 * 1000;
    this.maxIndexOffset = 1200;
  }

  getCurrentHeaders() {
    const headers = {
      "vc": "a_8260",
      "vn": "6.8",
      "ch": "xiaomi",
      "app": "hj",
      "User-Agent": this.currentUserAgent,
      "Accept-Encoding": "gzip",
      ...this.deviceHeaders,
    };

    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined || headers[key] === null || headers[key] === "") {
        delete headers[key];
      }
    });

    return headers;
  }

  buildUrl(path, params = {}) {
    const url = new URL(path, this.apiHost);
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v));
    });
    return url.toString();
  }

  async appGet(path, params = {}, options = {}) {
    return httpGet(this.buildUrl(path, params), {
      headers: this.getCurrentHeaders(),
      timeout: options.timeout || 12000,
      retries: typeof options.retries === 'number' ? options.retries : 1,
    });
  }

  getConfiguredDidmd5Candidates() {
    const candidates = new Set();

    const pushCandidate = (value) => {
      if (!value) return;
      const val = String(value).trim();
      if (!val) return;
      candidates.add(val);
      if (/^[a-fA-F0-9]{32}$/.test(val)) {
        candidates.add(val.toLowerCase());
        candidates.add(val.toUpperCase());
      }
    };

    pushCandidate(this.deviceHeaders.didmd5);

    if (typeof process !== 'undefined' && process?.env) {
      const raw = process.env.HANJUTV_DIDMD5 || process.env.HXQ_DIDMD5 || "";
      raw.split(',').forEach((item) => pushCandidate(item));
    }

    if (globals?.hanjutvDidmd5) {
      if (Array.isArray(globals.hanjutvDidmd5)) {
        globals.hanjutvDidmd5.forEach((item) => pushCandidate(item));
      } else {
        pushCandidate(globals.hanjutvDidmd5);
      }
    }

    return Array.from(candidates);
  }

  async aesCbcDecryptBase64(cipherTextBase64, didmd5) {
    const kv = md5(`${didmd5}${this.decryptMode1SecKey}`);
    const key = kv.slice(0, 16);
    const iv = kv.slice(16, 32);

    try {
      const crypto = await import('node:crypto');
      const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(iv, 'utf8'));
      decipher.setAutoPadding(true);
      const output = Buffer.concat([
        decipher.update(Buffer.from(cipherTextBase64, 'base64')),
        decipher.final(),
      ]);
      return output.toString('utf8');
    } catch (error) {
      if (typeof globalThis?.crypto?.subtle === 'undefined') {
        throw error;
      }

      const keyData = new TextEncoder().encode(key);
      const ivData = new TextEncoder().encode(iv);
      const cipherData = Uint8Array.from(atob(cipherTextBase64), c => c.charCodeAt(0));

      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-CBC', length: 128 },
        false,
        ['decrypt']
      );

      const plainBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: ivData },
        cryptoKey,
        cipherData
      );

      return new TextDecoder().decode(plainBuffer);
    }
  }

  tryParseJson(raw) {
    if (!raw || typeof raw !== 'string') return null;

    const text = raw.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return null;

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async decryptResponseDataIfNeeded(respData, scene) {
    if (!respData || typeof respData !== 'object') return null;
    if (respData.rescode !== 0) return null;

    if (respData.data && typeof respData.data === 'object') {
      return respData.data;
    }

    if (typeof respData.data !== 'string' || !respData.data) {
      return respData;
    }

    const didmd5Candidates = this.getConfiguredDidmd5Candidates();
    if (didmd5Candidates.length === 0) {
      log("info", `[Hanjutv] ${scene} 响应为密文，未配置 didmd5，暂不解密`);
      return null;
    }

    for (const didmd5 of didmd5Candidates) {
      try {
        const plainText = await this.aesCbcDecryptBase64(respData.data, didmd5);
        const parsed = this.tryParseJson(plainText);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {
      }
    }

    log("info", `[Hanjutv] ${scene} 密文解密失败，didmd5 候选数量: ${didmd5Candidates.length}`);
    return null;
  }

  normalizeSearchItems(items = []) {
    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;

        const sid = item.sid || item.seriesId || item.id || item.series_id;
        const name = item.name || item.title || item.seriesName || item.showName;
        if (!sid || !name) return null;

        const image = typeof item.image === 'object' && item.image !== null ? item.image : {};
        const thumb = image.thumb || image.poster || image.url || item.thumb || item.poster || "";

        return {
          ...item,
          sid: String(sid),
          name: String(name),
          refer: item.refer || item.srefer || item.searchRefer || "",
          updateTime: item.updateTime || item.publishTime || item.updatedAt || item.releaseTime || Date.now(),
          publishTime: item.publishTime || item.updateTime || Date.now(),
          image: {
            ...image,
            thumb,
            url: image.url || image.poster || thumb,
            poster: image.poster || item.poster || thumb,
          },
        };
      })
      .filter(Boolean);
  }

  normalizeEpisodes(items = []) {
    return items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;

        const pid = item.pid || item.id || item.programId || item.episodeId;
        if (!pid) return null;

        const serialCandidate = item.serialNo ?? item.serial_no ?? item.sort ?? item.sortNo ?? item.num ?? item.episodeNo ?? (index + 1);
        const serialNo = Number(serialCandidate);
        const safeSerialNo = Number.isFinite(serialNo) && serialNo > 0 ? serialNo : (index + 1);

        return {
          ...item,
          pid: String(pid),
          serialNo: safeSerialNo,
          title: item.title || item.name || item.programName || item.episodeTitle || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.serialNo - b.serialNo);
  }

  normalizeDetail(detailObj) {
    if (!detailObj || typeof detailObj !== 'object') return null;

    const image = typeof detailObj.image === 'object' && detailObj.image !== null ? detailObj.image : {};
    const thumb = image.thumb || image.poster || detailObj.poster || "";

    return {
      ...detailObj,
      sid: String(detailObj.sid || detailObj.seriesId || detailObj.id || ""),
      name: String(detailObj.name || detailObj.title || detailObj.seriesName || ""),
      rank: Number(detailObj.rank || detailObj.score || 0),
      category: Number(detailObj.category || detailObj.cate || detailObj.cateId || 0),
      publishTime: Number(detailObj.publishTime || detailObj.updateTime || 0),
      updateTime: Number(detailObj.updateTime || detailObj.publishTime || 0),
      image: {
        ...image,
        thumb,
        url: image.url || image.poster || thumb,
        poster: image.poster || thumb,
      },
    };
  }

  extractSeriesItemsDeep(data) {
    const results = [];
    const seen = new Set();

    const walk = (node, depth = 0) => {
      if (!node || depth > 8) return;

      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, depth + 1));
        return;
      }

      if (typeof node !== 'object') return;

      const sid = node.sid || node.seriesId || node.id || node.series_id;
      const name = node.name || node.title || node.seriesName || node.showName;
      if (sid && name) {
        const key = String(sid);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(node);
        }
      }

      Object.values(node).forEach((value) => walk(value, depth + 1));
    };

    walk(data, 0);
    return this.normalizeSearchItems(results);
  }

  extractEpisodesDeep(data) {
    const results = [];

    const walk = (node, depth = 0) => {
      if (!node || depth > 8) return;

      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, depth + 1));
        return;
      }

      if (typeof node !== 'object') return;

      const pid = node.pid || node.id || node.programId || node.episodeId;
      if (pid) {
        results.push(node);
      }

      Object.values(node).forEach((value) => walk(value, depth + 1));
    };

    walk(data, 0);
    return this.normalizeEpisodes(results);
  }

  resolveAnimeYear(anime, detail) {
    const candidates = [
      anime?.updateTime,
      anime?.publishTime,
      detail?.updateTime,
      detail?.publishTime,
    ];

    for (const value of candidates) {
      if (!value) continue;
      const dt = new Date(value);
      if (!Number.isNaN(dt.getTime())) {
        return dt.getFullYear();
      }
    }

    return new Date().getFullYear();
  }

  async searchByS2(keyword) {
    const merged = [];
    const sidSet = new Set();
    let stalePages = 0;

    for (let page = 1; page <= 5; page++) {
      const resp = await this.appGet('/api/search/s2', {
        k: keyword,
        page,
      }, {
        timeout: 10000,
        retries: 1,
      });

      if (!resp?.data || resp.data.rescode !== 0 || !Array.isArray(resp.data.seriesList)) {
        stalePages += 1;
        if (stalePages >= 1) break;
        continue;
      }

      const items = this.normalizeSearchItems(resp.data.seriesList);
      if (items.length === 0) {
        stalePages += 1;
        if (stalePages >= 1) break;
        continue;
      }

      stalePages = 0;
      for (const item of items) {
        if (!item.sid || sidSet.has(item.sid)) continue;
        sidSet.add(item.sid);
        merged.push(item);
      }

      if (items.length < 20) {
        break;
      }
    }

    return merged;
  }

  collectSearchMatchTexts(item) {
    if (!item || typeof item !== 'object') return [];

    const texts = [];
    const seen = new Set();
    const pushText = (value) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        value.forEach((entry) => pushText(entry));
        return;
      }

      if (typeof value === 'object') {
        Object.values(value).forEach((entry) => pushText(entry));
        return;
      }

      const text = String(value).trim();
      if (!text) return;
      if (seen.has(text)) return;
      seen.add(text);
      texts.push(text);
    };

    const keys = [
      'name', 'title', 'seriesName', 'showName',
      'nameCn', 'cnName', 'zhName', 'subName', 'subTitle',
      'originName', 'originalName', 'keyword', 'keywords',
      'alias', 'aliases', 'aka', 'tags', 'tagNames',
    ];

    keys.forEach((key) => pushText(item[key]));
    pushText(item.image);

    return texts;
  }

  isSearchItemMatched(item, keyword) {
    const key = String(keyword || '').trim();
    if (!key) return false;

    const normalizedKey = normalizeSpaces(key).toLowerCase();
    const texts = this.collectSearchMatchTexts(item);

    return texts.some((text) => {
      if (titleMatches(text, key)) return true;
      return normalizeSpaces(text).toLowerCase().includes(normalizedKey);
    });
  }

  filterSearchItems(items, keyword) {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => this.isSearchItemMatched(item, keyword));
  }

  buildFallbackSearchItems(items, currentItems, keyword, limit = 10) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const currentSidSet = new Set((currentItems || []).map((item) => String(item?.sid || '')));

    return items
      .filter((item) => {
        if (!item?.sid) return false;
        if (currentSidSet.has(String(item.sid))) return false;

        const category = Number(item.category || 0);
        const episodeCount = Number(item.count ?? item.episodeCount ?? item.totalCount ?? 0);

        return category === 1 || episodeCount >= 6;
      })
      .sort((a, b) => this.scoreSearchItem(b, keyword) - this.scoreSearchItem(a, keyword))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        keywordFallback: true,
      }));
  }

  async searchByIndexKeyword(keyword, withKeywordParam = true) {
    const now = Date.now();
    const cacheKey = `${withKeywordParam ? 'k' : 'all'}:${keyword}`;
    const cacheEntry = this.indexSearchCache.get(cacheKey);

    if (cacheEntry
      && Array.isArray(cacheEntry.list)
      && cacheEntry.list.length > 0
      && (now - cacheEntry.fetchedAt) < this.indexCacheTtlMs) {
      return cacheEntry.list;
    }

    const merged = [];
    const sidSet = new Set();
    let stalePages = 0;

    for (let offset = 0; offset <= this.maxIndexOffset; offset += 20) {
      let items = [];

      try {
        const params = {
          offset,
        };
        if (withKeywordParam) {
          params.k = keyword;
        }

        const resp = await this.appGet('/api/series/indexV2', {
          ...params,
        }, { timeout: 10000, retries: 1 });

        if (resp?.data?.rescode === 0 && Array.isArray(resp.data.seriesList)) {
          items = this.normalizeSearchItems(resp.data.seriesList);
        }
      } catch (error) {
        log("warn", `[Hanjutv] indexV2 搜索失败 offset=${offset}: ${error.message}`);
        stalePages += 1;
        if (stalePages >= 2) break;
        continue;
      }

      if (!items.length) {
        stalePages += 1;
        if (stalePages >= 2) break;
        continue;
      }

      stalePages = 0;
      for (const item of items) {
        if (!item.sid || sidSet.has(item.sid)) continue;
        sidSet.add(item.sid);
        merged.push(item);
      }
    }

    this.indexSearchCache.set(cacheKey, {
      fetchedAt: Date.now(),
      list: merged,
    });

    return merged;
  }

  scoreSearchItem(item, keyword) {
    if (!item || typeof item !== 'object') return Number.NEGATIVE_INFINITY;

    const title = String(item.name || '');
    const key = String(keyword || '').trim();
    const category = Number(item.category || 0);
    const episodeCount = Number(item.count ?? item.episodeCount ?? item.totalCount ?? 0);
    const updateTime = Number(item.updateTime || item.publishTime || 0);

    let score = 0;

    if (key && title === key) {
      score += 150;
    } else if (key && title.includes(key)) {
      score += 90;
    } else if (key && titleMatches(title, key)) {
      score += 70;
    }

    if (category === 1) {
      score += 30;
    }

    if (Number.isFinite(episodeCount)) {
      if (episodeCount > 1) {
        score += 20;
      }
      score += Math.min(episodeCount, 40) / 2;
    }

    if (item.refer) {
      score += 8;
    }

    if (item?.image?.thumb || item?.image?.url) {
      score += 2;
    }

    if (Number.isFinite(updateTime) && updateTime > 0) {
      score += Math.min(updateTime / 1000000000000, 20);
    }

    return score;
  }

  mergeSeriesList(keyword, ...lists) {
    const mergedMap = new Map();

    for (const list of lists) {
      if (!Array.isArray(list)) continue;

      for (const item of list) {
        if (!item?.sid) continue;

        const sid = String(item.sid);
        const current = mergedMap.get(sid);

        if (!current) {
          mergedMap.set(sid, item);
          continue;
        }

        const currentScore = this.scoreSearchItem(current, keyword);
        const nextScore = this.scoreSearchItem(item, keyword);
        const preferred = nextScore >= currentScore ? item : current;
        const backup = preferred === item ? current : item;

        mergedMap.set(sid, {
          ...backup,
          ...preferred,
          refer: preferred.refer || backup.refer || '',
          image: {
            ...(backup.image || {}),
            ...(preferred.image || {}),
          },
        });
      }
    }

    return Array.from(mergedMap.values()).sort((a, b) => {
      const scoreDiff = this.scoreSearchItem(b, keyword) - this.scoreSearchItem(a, keyword);
      if (scoreDiff !== 0) return scoreDiff;

      const at = Number(a.updateTime || a.publishTime || 0);
      const bt = Number(b.updateTime || b.publishTime || 0);
      return bt - at;
    });
  }

  buildReferCandidates(sid, inputRefer = "") {
    const candidates = new Set();

    if (inputRefer) candidates.add(String(inputRefer));

    const meta = this.sidMetaCache.get(String(sid));
    if (meta?.refer) candidates.add(String(meta.refer));

    candidates.add(this.defaultSeriesRefer);

    return Array.from(candidates).filter(Boolean);
  }

  async getDetailBySeries2(sid, refer) {
    const resp = await this.appGet('/api/series2/detail/normal', {
      sid,
      refer,
    });

    const data = await this.decryptResponseDataIfNeeded(resp?.data, 'series2/detail/normal');
    if (!data) return null;

    const detailCandidates = this.extractSeriesItemsDeep(data);
    if (detailCandidates.length > 0) {
      const exact = detailCandidates.find((item) => item.sid === String(sid));
      return this.normalizeDetail(exact || detailCandidates[0]);
    }

    return this.normalizeDetail(data);
  }

  async getEpisodesBySeries2(sid, refer) {
    const resp = await this.appGet('/api/series2/episodes', {
      sid,
      refer,
    });

    const data = await this.decryptResponseDataIfNeeded(resp?.data, 'series2/episodes');
    if (!data) return [];

    const episodes = this.extractEpisodesDeep(data);
    return episodes;
  }

  async getEpisodesByProgramsV2(sid) {
    const resp = await this.appGet('/api/series/programs_v2', { sid }, { timeout: 10000, retries: 1 });
    if (!resp?.data || resp.data.rescode !== 0) return [];

    const programs = [];
    if (Array.isArray(resp.data.programs)) programs.push(...resp.data.programs);
    if (Array.isArray(resp.data.qxkPrograms)) programs.push(...resp.data.qxkPrograms);

    return this.normalizeEpisodes(programs);
  }

  async getDetailAndEpisodesBySeries(sid) {
    const resp = await this.appGet('/api/series/detail', { sid }, { timeout: 10000, retries: 1 });
    if (!resp?.data || resp.data.rescode !== 0) return null;

    const detail = this.normalizeDetail(resp.data.series || {});
    const rawPlayItems = Array.isArray(resp.data.playItems) ? resp.data.playItems : [];
    const episodes = this.normalizeEpisodes(rawPlayItems.map((item, index) => ({
      ...item,
      pid: item.pid || item.id || item.programId || item.episodeId,
      serialNo: item.serialNo ?? item.serial_no ?? item.sort ?? item.sortNo ?? item.num ?? item.episodeNo ?? (index + 1),
      title: item.name || item.title || item.programName || item.episodeTitle || "",
    })));

    return { detail, episodes };
  }

  async searchCurrent(keyword) {
    const key = String(keyword || "").trim();
    if (!key) return [];

    let s2List = [];
    let indexKeywordList = [];
    let indexAllList = [];

    try {
      s2List = await this.searchByS2(key);
    } catch (error) {
      log("info", `[Hanjutv] s2 搜索失败: ${error.message}`);
    }

    try {
      indexKeywordList = await this.searchByIndexKeyword(key, true);
    } catch (error) {
      log("info", `[Hanjutv] indexV2(k) 搜索失败: ${error.message}`);
    }

    const primarySeriesList = this.mergeSeriesList(key, s2List, indexKeywordList);
    let filtered = this.filterSearchItems(primarySeriesList, key);

    const shouldFetchAllIndex = filtered.length <= 1;
    if (shouldFetchAllIndex) {
      try {
        indexAllList = await this.searchByIndexKeyword(key, false);
      } catch (error) {
        log("info", `[Hanjutv] indexV2(all) 搜索失败: ${error.message}`);
      }
    }

    const seriesList = this.mergeSeriesList(key, primarySeriesList, indexAllList);
    filtered = this.filterSearchItems(seriesList, key);

    const fallbackItems = filtered.length <= 1
      ? this.buildFallbackSearchItems(seriesList, filtered, key, 10)
      : [];

    const mergedFiltered = this.mergeSeriesList(key, filtered, fallbackItems);
    mergedFiltered.forEach((item) => {
      item.keywordMatched = this.isSearchItemMatched(item, key);
      item.keywordFallback = Boolean(item.keywordFallback && !item.keywordMatched);
    });

    const fallbackCount = mergedFiltered.filter((item) => item.keywordFallback).length;
    log("info", `[Hanjutv] 搜索候选统计 s2=${s2List.length}, indexK=${indexKeywordList.length}, indexAll=${indexAllList.length}, filtered=${mergedFiltered.length}, fallback=${fallbackCount}`);
    if (mergedFiltered.length <= 3) {
      const preview = mergedFiltered.map((item) => `${item.name || '未知'}|sid=${item.sid}|c=${item.category || 0}|cnt=${item.count || 0}|m=${item.keywordMatched ? 1 : 0}|f=${item.keywordFallback ? 1 : 0}`).join(' ; ');
      log("info", `[Hanjutv] 搜索候选预览 ${preview}`);
    }

    mergedFiltered.forEach((item) => {
      this.sidMetaCache.set(item.sid, {
        refer: item.refer || "",
        name: item.name || "",
      });
    });

    return mergedFiltered;
  }

  async search(keyword) {
    try {
      const resList = await this.searchCurrent(keyword);

      log("info", `[Hanjutv] 搜索找到 ${resList.length} 个有效结果`);

      return resList.map((anime) => ({
        ...anime,
        animeId: convertToAsciiSum(anime.sid),
      }));
    } catch (error) {
      log("error", "getHanjutvAnimes error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getDetailCurrent(id, refer = "") {
    const sid = String(id || '').trim();
    if (!sid) return null;

    if (this.seriesDetailCache.has(sid)) {
      return this.seriesDetailCache.get(sid);
    }

    try {
      const detailBundle = await this.getDetailAndEpisodesBySeries(sid);
      if (detailBundle?.detail?.sid) {
        this.seriesDetailCache.set(sid, detailBundle.detail);
        if (Array.isArray(detailBundle.episodes) && detailBundle.episodes.length > 0) {
          this.seriesEpisodesCache.set(sid, detailBundle.episodes);
        }
        return detailBundle.detail;
      }
    } catch {
    }

    const referCandidates = this.buildReferCandidates(sid, refer);
    for (const currentRefer of referCandidates) {
      try {
        const detail = await this.getDetailBySeries2(sid, currentRefer);
        if (detail?.sid) {
          this.seriesDetailCache.set(sid, detail);
          return detail;
        }
      } catch {
      }
    }

    return null;
  }

  async getDetail(id) {
    try {
      const detail = await this.getDetailCurrent(id);
      return detail || [];
    } catch (error) {
      log("error", "getHanjutvDetail error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getEpisodesCurrent(id, refer = "") {
    const sid = String(id || '').trim();
    if (!sid) return [];

    if (this.seriesEpisodesCache.has(sid)) {
      return this.seriesEpisodesCache.get(sid);
    }

    try {
      const detailBundle = await this.getDetailAndEpisodesBySeries(sid);
      if (detailBundle?.detail?.sid && !this.seriesDetailCache.has(sid)) {
        this.seriesDetailCache.set(sid, detailBundle.detail);
      }
      if (Array.isArray(detailBundle?.episodes) && detailBundle.episodes.length > 0) {
        this.seriesEpisodesCache.set(sid, detailBundle.episodes);
        return detailBundle.episodes;
      }
    } catch {
    }

    const referCandidates = this.buildReferCandidates(sid, refer);

    for (const currentRefer of referCandidates) {
      try {
        const episodes = await this.getEpisodesBySeries2(sid, currentRefer);
        if (Array.isArray(episodes) && episodes.length > 0) {
          this.seriesEpisodesCache.set(sid, episodes);
          return episodes;
        }
      } catch {
      }
    }

    const fallbackEpisodes = await this.getEpisodesByProgramsV2(sid);
    if (fallbackEpisodes.length > 0) {
      this.seriesEpisodesCache.set(sid, fallbackEpisodes);
    }

    return fallbackEpisodes;
  }

  async getEpisodes(id) {
    try {
      const episodes = await this.getEpisodesCurrent(id);
      return episodes;
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

    const getCategory = (key) => cateMap[key] || "其他";

    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[Hanjutv] sourceAnimes is not a valid array");
      return [];
    }

    const processHanjutvAnimes = await Promise.all(sourceAnimes
      .filter((anime) => anime?.keywordFallback || this.isSearchItemMatched(anime, queryTitle))
      .map(async (anime) => {
        try {
          const detail = await this.getDetail(anime.sid);
          const eps = await this.getEpisodes(anime.sid);

          if (!Array.isArray(eps) || eps.length === 0) {
            return;
          }

          const links = [];
          for (const ep of eps) {
            const epTitle = ep.title && ep.title.trim() !== "" ? `第${ep.serialNo}集：${ep.title}` : `第${ep.serialNo}集`;
            links.push({
              "name": epTitle,
              "url": ep.pid,
              "title": `【hanjutv】 ${epTitle}`
            });
          }

          if (links.length > 0) {
            const animeYear = this.resolveAnimeYear(anime, detail);
            const category = Number(detail?.category || anime?.category || 0);
            const imageUrl = anime?.image?.thumb || anime?.image?.url || detail?.image?.thumb || detail?.image?.url || "";
            const animeName = anime?.name || detail?.name || "未知剧集";

            const transformedAnime = {
              animeId: anime.animeId,
              bangumiId: String(anime.animeId),
              animeTitle: `${animeName}(${animeYear})【${getCategory(category)}】from hanjutv`,
              type: getCategory(category),
              typeDescription: getCategory(category),
              imageUrl,
              startDate: generateValidStartDate(animeYear),
              episodeCount: links.length,
              rating: Number(detail?.rank || 0),
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

  async getEpisodeDanmu(id) {
    const allDanmus = [];

    try {
      let fromAxis = 0;
      let prevId = 0;
      const seenDid = new Set();

      for (let page = 0; page < 400; page++) {
        const resp = await this.appGet('/api/danmu/playItem/list', {
          pid: id,
          prevId,
          fromAxis,
          toAxis: 100000000,
          offset: 0,
        }, {
          retries: 1,
          timeout: 10000,
        });

        if (!resp || !resp.data || resp.data.rescode !== 0) {
          break;
        }

        const currentDanmus = Array.isArray(resp.data.danmus) ? resp.data.danmus : [];
        for (const danmu of currentDanmus) {
          const did = String(danmu?.did ?? "");
          if (!did || seenDid.has(did)) continue;
          seenDid.add(did);
          allDanmus.push(danmu);
        }

        const more = Number(resp.data.more || 0);
        const nextAxis = Number(resp.data.nextAxis || 0);
        const lastId = Number(resp.data.lastId || 0);

        if (more !== 1 || currentDanmus.length === 0) {
          break;
        }

        if ((nextAxis <= fromAxis) && (lastId <= prevId)) {
          break;
        }

        fromAxis = nextAxis > fromAxis ? nextAxis : fromAxis + 1;
        prevId = lastId > prevId ? lastId : prevId;
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

  async getEpisodeDanmuSegments(id) {
    log("info", "获取韩剧TV弹幕分段列表...", id);

    return new SegmentListResponse({
      "type": "hanjutv",
      "segmentList": [{
        "type": "hanjutv",
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
    return comments.map(c => ({
      cid: Number(c.did || c.id || 0),
      p: `${(Number(c.t || c.time || 0) / 1000).toFixed(2)},${Number(c.tp || c.mode || 1) === 2 ? 5 : Number(c.tp || c.mode || 1)},${Number(c.sc || c.color || 16777215)},[hanjutv]`,
      m: c.con || c.content || "",
      t: Math.round(Number(c.t || c.time || 0) / 1000)
    }));
  }
}
