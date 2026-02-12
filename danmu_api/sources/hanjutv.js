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
    this.webHost = 'https://hxqapi.hiyun.tv';
    this.appHost = 'https://hxqapi.hiyun.tv';
    this.oldDanmuHost = 'https://hxqapi.zmdcq.com';
    this.defaultRefer = '2JGztvGjRVpkxcr0T4ZWG2k+tOlnHmDGUNMwAGSeq548YV2FMbs0h0bXNi6DJ00L';
    this.webUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.appUserAgent = 'HanjuTV/6.8 (23127PN0CC; Android 16; Scale/2.00)';
    this.decryptMode1SecKey = '34F9Q53w/HJW8E6Q';
    this.deviceHeaders = this.resolveDeviceHeaders();
    this.cachedDidmd5 = '';
  }

  getWebHeaders() {
    return {
      'Content-Type': 'application/json',
      'User-Agent': this.webUserAgent,
    };
  }

  getAppHeaders() {
    const headers = {
      vc: 'a_8260',
      vn: '6.8',
      ch: 'xiaomi',
      app: 'hj',
      'User-Agent': this.appUserAgent,
      'Accept-Encoding': 'gzip',
      ...this.deviceHeaders,
    };

    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined || headers[key] === null || headers[key] === '') {
        delete headers[key];
      }
    });

    return headers;
  }

  resolveDeviceHeaders() {
    const fromGlobals = globals?.hanjutvHeaders && typeof globals.hanjutvHeaders === 'object'
      ? globals.hanjutvHeaders
      : {};

    let parsed = {};
    if (typeof process !== 'undefined' && process?.env) {
      const candidates = [
        process.env.HANJUTV_HEADERS_JSON,
        process.env.HANJUTV_HEADERS,
        process.env.HXQ_HEADERS,
      ].filter(Boolean);

      for (const raw of candidates) {
        const text = String(raw || '').trim();
        if (!text) continue;

        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj === 'object') {
            parsed = { ...parsed, ...obj };
            continue;
          }
        } catch {
        }

        const list = text
          .split(/[;,]/)
          .map((item) => item.trim())
          .filter(Boolean);

        for (const line of list) {
          const sep = line.includes(':') ? ':' : (line.includes('=') ? '=' : '');
          if (!sep) continue;
          const idx = line.indexOf(sep);
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          if (!key || !value) continue;
          parsed[key] = value;
        }
      }
    }

    const merged = { ...fromGlobals, ...parsed };
    const normalized = { ...merged };

    const headerAliasMap = {
      vc: 'vc',
      vn: 'vn',
      ch: 'ch',
      app: 'app',
      ua: 'User-Agent',
      useragent: 'User-Agent',
      user_agent: 'User-Agent',
      accept_encoding: 'Accept-Encoding',
      said: 'said',
      uk: 'uk',
      sign: 'sign',
      auth_token: 'auth-token',
      auth_uid: 'auth-uid',
      didmd5: 'didmd5',
      did_md5: 'didmd5',
      did: 'did',
    };

    Object.entries(merged).forEach(([rawKey, rawValue]) => {
      const key = String(rawKey || '').trim();
      const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
      if (!key || !value) return;
      normalized[key] = value;

      const lower = key.toLowerCase().replace(/-/g, '_');
      const mappedKey = headerAliasMap[lower];
      if (mappedKey) {
        normalized[mappedKey] = value;
      }
    });

    return normalized;
  }

  getConfiguredDidmd5Candidates() {
    const result = new Set();

    const pushCandidate = (value) => {
      if (value === undefined || value === null) return;
      const text = String(value).trim();
      if (!text) return;

      result.add(text);

      if (/^[a-fA-F0-9]{32}$/.test(text)) {
        result.add(text.toLowerCase());
        result.add(text.toUpperCase());
      }

      const textMd5 = md5(text);
      result.add(textMd5);
    };

    if (this.cachedDidmd5) {
      pushCandidate(this.cachedDidmd5);
    }

    const didKeys = [
      'didmd5', 'did_md5', 'didMd5',
      'did', 'deviceId', 'device_id',
      'oaid', 'imei', 'androidId', 'android_id',
      'said', 'uk', 'auth-token', 'auth-uid',
      'auth_token', 'auth_uid',
    ];

    didKeys.forEach((key) => {
      pushCandidate(this.deviceHeaders?.[key]);
    });

    if (globals?.hanjutvDidmd5) {
      const didList = Array.isArray(globals.hanjutvDidmd5) ? globals.hanjutvDidmd5 : [globals.hanjutvDidmd5];
      didList.forEach(pushCandidate);
    }

    if (typeof process !== 'undefined' && process?.env) {
      const envRaw = [
        process.env.HANJUTV_DIDMD5,
        process.env.HXQ_DIDMD5,
        process.env.DIDMD5,
        process.env.HANJUTV_DID,
      ].filter(Boolean).join(',');

      envRaw.split(',').forEach((entry) => {
        const value = String(entry || '').trim();
        if (!value) return;
        pushCandidate(value);
      });
    }

    const values = Array.from(result);
    for (const candidate of values) {
      if (/^[A-Za-z0-9+/=]{16,}$/.test(candidate) && candidate.length % 4 === 0) {
        try {
          const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
          if (decoded) {
            pushCandidate(decoded);
          }
        } catch {
        }
      }
    }

    return Array.from(result);
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
      return null;
    }

    const directParsed = this.tryParseJson(respData.data);
    if (directParsed && typeof directParsed === 'object') {
      return directParsed;
    }

    const didmd5Candidates = this.getConfiguredDidmd5Candidates();
    if (didmd5Candidates.length === 0) {
      log('info', `[Hanjutv] ${scene} 响应为密文，未提供 didmd5 候选`);
      return null;
    }

    for (const didmd5 of didmd5Candidates) {
      try {
        const plainText = await this.aesCbcDecryptBase64(respData.data, didmd5);
        const parsed = this.tryParseJson(plainText);
        if (parsed && typeof parsed === 'object') {
          this.cachedDidmd5 = didmd5;
          log('info', `[Hanjutv] ${scene} 解密成功`);
          return parsed;
        }
      } catch {
      }
    }

    log('info', `[Hanjutv] ${scene} 解密失败，didmd5 候选数量: ${didmd5Candidates.length}`);
    return null;
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

  normalizeSearchItems(items = []) {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        if (!item || typeof item !== 'object') return null;

        const sid = item.sid || item.seriesId || item.id || item.series_id;
        const name = item.name || item.title || item.seriesName || item.showName;
        if (!sid || !name) return null;

        const imageObj = typeof item.image === 'object' && item.image !== null ? item.image : {};
        const thumb = imageObj.thumb || imageObj.poster || imageObj.url || item.thumb || item.poster || '';

        return {
          ...item,
          sid: String(sid),
          name: String(name),
          refer: item.refer || item.srefer || item.searchRefer || '',
          updateTime: item.updateTime || item.publishTime || item.updatedAt || item.releaseTime || Date.now(),
          publishTime: item.publishTime || item.updateTime || Date.now(),
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
        if (!item || typeof item !== 'object') return null;

        const pid = item.pid || item.id || item.programId || item.episodeId;
        if (!pid) return null;

        const serialCandidate = item.serialNo ?? item.serial_no ?? item.sort ?? item.sortNo ?? item.num ?? item.episodeNo ?? (index + 1);
        const serialNo = Number(serialCandidate);

        return {
          ...item,
          pid: String(pid),
          serialNo: Number.isFinite(serialNo) && serialNo > 0 ? serialNo : (index + 1),
          title: item.title || item.name || item.programName || item.episodeTitle || '',
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.serialNo - b.serialNo);
  }

  matchKeyword(item, keyword) {
    const key = String(keyword || '').trim();
    if (!key) return false;

    const normalizedKey = normalizeSpaces(key).toLowerCase();
    if (!normalizedKey) return false;

    const textList = this.collectSearchMatchTexts(item);
    return textList.some((text) => {
      if (titleMatches(text, key)) return true;
      return normalizeSpaces(text).toLowerCase().includes(normalizedKey);
    });
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
      if (!text || seen.has(text)) return;
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

  async searchByWeb(keyword) {
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `${this.webHost}/wapi/search/aggregate/search?keyword=${encodedKeyword}&scope=101&page=1`;

    const resp = await httpGet(url, {
      headers: this.getWebHeaders(),
      timeout: 10000,
      retries: 1,
    });

    const list = resp?.data?.seriesData?.seriesList;
    return this.normalizeSearchItems(Array.isArray(list) ? list : []);
  }

  async searchByS2(keyword) {
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `${this.appHost}/api/search/s2?k=${encodedKeyword}&page=1`;

    const resp = await httpGet(url, {
      headers: this.getAppHeaders(),
      timeout: 10000,
      retries: 1,
    });

    const list = resp?.data?.seriesList;
    return this.normalizeSearchItems(Array.isArray(list) ? list : []);
  }

  async searchByS5(keyword) {
    const encodedKeyword = encodeURIComponent(keyword);
    const queryList = [
      `${this.appHost}/api/search/s5?k=${encodedKeyword}&srefer=search_hot&type=0&page=1`,
      `${this.appHost}/api/search/s5?k=${encodedKeyword}&page=1`,
    ];

    for (const query of queryList) {
      try {
        const resp = await httpGet(query, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });

        if (!resp?.data || resp.data.rescode !== 0) {
          continue;
        }

        if (Array.isArray(resp.data?.data?.seriesList)) {
          return this.normalizeSearchItems(resp.data.data.seriesList);
        }

        const decryptedData = await this.decryptResponseDataIfNeeded(resp.data, 'search/s5');
        if (!decryptedData || typeof decryptedData !== 'object') {
          continue;
        }

        if (Array.isArray(decryptedData.seriesList)) {
          return this.normalizeSearchItems(decryptedData.seriesList);
        }

        return this.extractSeriesItemsDeep(decryptedData);
      } catch {
      }
    }

    return [];
  }

  async searchByIndexV2(keyword, withKeywordParam = true) {
    const merged = [];
    const sidSet = new Set();
    let stalePages = 0;

    for (let offset = 0; offset <= 1100; offset += 20) {
      const query = withKeywordParam
        ? `${this.appHost}/api/series/indexV2?offset=${offset}&k=${encodeURIComponent(keyword)}`
        : `${this.appHost}/api/series/indexV2?offset=${offset}`;

      let items = [];
      try {
        const resp = await httpGet(query, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });
        items = this.normalizeSearchItems(resp?.data?.seriesList || []);
      } catch (error) {
        stalePages += 1;
        if (stalePages >= 2) break;
        continue;
      }

      if (items.length === 0) {
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

    return merged;
  }

  dedupeBySid(items = []) {
    const map = new Map();

    for (const item of items) {
      if (!item?.sid) continue;
      const sid = String(item.sid);
      const current = map.get(sid);
      if (!current) {
        map.set(sid, item);
        continue;
      }

      const currentCount = Number(current.count ?? current.episodeCount ?? 0);
      const nextCount = Number(item.count ?? item.episodeCount ?? 0);
      if (nextCount >= currentCount) {
        map.set(sid, { ...current, ...item });
      }
    }

    return Array.from(map.values());
  }

  sortSearchItems(items = [], keyword) {
    const key = String(keyword || '').trim();

    const score = (item) => {
      const name = String(item?.name || '');
      const category = Number(item?.category || 0);
      const episodeCount = Number(item?.count ?? item?.episodeCount ?? 0);

      let value = 0;
      if (name === key) value += 120;
      else if (name.includes(key)) value += 80;
      else if (titleMatches(name, key)) value += 60;

      if (category === 1) value += 20;
      if (episodeCount > 1) value += 20;
      value += Math.min(episodeCount, 40) / 2;

      return value;
    };

    return [...items].sort((a, b) => score(b) - score(a));
  }

  async search(keyword) {
    try {
      const key = String(keyword || '').trim();
      if (!key) return [];

      let webList = [];
      let s5List = [];
      let s2List = [];
      let indexKList = [];
      let indexAllList = [];

      try {
        webList = await this.searchByWeb(key);
      } catch (error) {
        log('info', `[Hanjutv] web 搜索失败: ${error.message}`);
      }

      if (webList.length <= 1) {
        try {
          s5List = await this.searchByS5(key);
        } catch (error) {
          log('info', `[Hanjutv] s5 搜索失败: ${error.message}`);
        }
      }

      if (webList.length + s5List.length <= 1) {
        try {
          s2List = await this.searchByS2(key);
        } catch (error) {
          log('info', `[Hanjutv] s2 搜索失败: ${error.message}`);
        }
      }

      if (webList.length + s5List.length + s2List.length <= 2) {
        try {
          indexKList = await this.searchByIndexV2(key, true);
        } catch (error) {
          log('info', `[Hanjutv] indexV2(k) 搜索失败: ${error.message}`);
        }
      }

      let merged = this.dedupeBySid([...webList, ...s5List, ...s2List, ...indexKList]);
      let filtered = merged.filter((item) => this.matchKeyword(item, key));

      if (filtered.length <= 1 && webList.length === 0 && s5List.length === 0) {
        try {
          indexAllList = await this.searchByIndexV2(key, false);
        } catch (error) {
          log('info', `[Hanjutv] indexV2(all) 搜索失败: ${error.message}`);
        }

        merged = this.dedupeBySid([...merged, ...indexAllList]);
        filtered = merged.filter((item) => this.matchKeyword(item, key));
      }

      filtered = this.sortSearchItems(filtered, key);

      log('info', `[Hanjutv] 搜索候选统计 web=${webList.length}, s5=${s5List.length}, s2=${s2List.length}, indexK=${indexKList.length}, indexAll=${indexAllList.length}, filtered=${filtered.length}`);
      log('info', `[Hanjutv] 搜索找到 ${filtered.length} 个有效结果`);

      return filtered.map((anime) => {
        const animeId = convertToAsciiSum(anime.sid);
        return { ...anime, animeId };
      });
    } catch (error) {
      log('error', 'getHanjutvAnimes error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getSeriesBundleFromWeb(id) {
    const url = `${this.webHost}/wapi/series/series/detail?sid=${id}`;
    const resp = await httpGet(url, {
      headers: this.getWebHeaders(),
      timeout: 10000,
      retries: 1,
    });

    if (!resp?.data) return { detail: null, episodes: [] };

    return {
      detail: resp.data.series || null,
      episodes: this.normalizeEpisodes(resp.data.episodes || []),
    };
  }

  async getSeriesBundleFromApp(id) {
    const detailUrl = `${this.appHost}/api/series/detail?sid=${id}`;
    const detailResp = await httpGet(detailUrl, {
      headers: this.getAppHeaders(),
      timeout: 10000,
      retries: 1,
    });

    const detail = detailResp?.data?.series || null;
    const playItems = Array.isArray(detailResp?.data?.playItems) ? detailResp.data.playItems : [];
    let episodes = this.normalizeEpisodes(playItems);

    if (episodes.length === 0) {
      const epUrl = `${this.appHost}/api/series2/episodes?sid=${id}&refer=${encodeURIComponent(this.defaultRefer)}`;
      try {
        const epResp = await httpGet(epUrl, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });

        episodes = this.normalizeEpisodes(epResp?.data?.programs || epResp?.data?.episodes || epResp?.data?.qxkPrograms || []);
      } catch {
      }
    }

    if (episodes.length === 0) {
      const programUrl = `${this.appHost}/api/series/programs_v2?sid=${id}`;
      try {
        const programResp = await httpGet(programUrl, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });

        const programs = [
          ...(Array.isArray(programResp?.data?.programs) ? programResp.data.programs : []),
          ...(Array.isArray(programResp?.data?.qxkPrograms) ? programResp.data.qxkPrograms : []),
        ];
        episodes = this.normalizeEpisodes(programs);
      } catch {
      }
    }

    return { detail, episodes };
  }

  async getDetail(id) {
    try {
      const sid = String(id || '').trim();
      if (!sid) return [];

      let detail = null;

      try {
        const webBundle = await this.getSeriesBundleFromWeb(sid);
        detail = webBundle.detail;
      } catch {
      }

      if (!detail) {
        try {
          const appBundle = await this.getSeriesBundleFromApp(sid);
          detail = appBundle.detail;
        } catch {
        }
      }

      if (!detail) {
        log('info', 'getHanjutvDetail: series 不存在');
        return [];
      }

      return detail;
    } catch (error) {
      log('error', 'getHanjutvDetail error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getEpisodes(id) {
    try {
      const sid = String(id || '').trim();
      if (!sid) return [];

      let episodes = [];

      try {
        const webBundle = await this.getSeriesBundleFromWeb(sid);
        episodes = webBundle.episodes;
      } catch {
      }

      if (!Array.isArray(episodes) || episodes.length === 0) {
        try {
          const appBundle = await this.getSeriesBundleFromApp(sid);
          episodes = appBundle.episodes;
        } catch {
        }
      }

      if (!Array.isArray(episodes) || episodes.length === 0) {
        log('info', 'getHanjutvEposides: episodes 不存在');
        return [];
      }

      return episodes.sort((a, b) => a.serialNo - b.serialNo);
    } catch (error) {
      log('error', 'getHanjutvEposides error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes) {
    const cateMap = { 1: '韩剧', 2: '综艺', 3: '电影', 4: '日剧', 5: '美剧', 6: '泰剧', 7: '国产剧' };

    function getCategory(key) {
      return cateMap[key] || '其他';
    }

    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log('error', '[Hanjutv] sourceAnimes is not a valid array');
      return [];
    }

    const processHanjutvAnimes = await Promise.all(sourceAnimes
      .filter((s) => this.matchKeyword(s, queryTitle) || titleMatches(s.name, queryTitle) || String(s.name || '').includes(queryTitle))
      .map(async (anime) => {
        try {
          const detail = await this.getDetail(anime.sid);
          const eps = await this.getEpisodes(anime.sid);

          if (!Array.isArray(eps) || eps.length === 0) {
            return;
          }

          const links = [];
          for (const ep of eps) {
            const epTitle = ep.title && ep.title.trim() !== '' ? `第${ep.serialNo}集：${ep.title}` : `第${ep.serialNo}集`;
            links.push({
              name: epTitle,
              url: ep.pid,
              title: `【hanjutv】 ${epTitle}`,
            });
          }

          if (links.length > 0) {
            const updateTime = anime.updateTime || detail?.updateTime || Date.now();
            const year = new Date(updateTime).getFullYear();
            const category = Number(detail?.category || anime?.category || 0);
            const imageUrl = anime?.image?.thumb || anime?.image?.url || detail?.image?.thumb || detail?.image?.url || '';
            const animeName = anime?.name || detail?.name || '未知剧集';

            const transformedAnime = {
              animeId: anime.animeId,
              bangumiId: String(anime.animeId),
              animeTitle: `${animeName}(${year})【${getCategory(category)}】from hanjutv`,
              type: getCategory(category),
              typeDescription: getCategory(category),
              imageUrl,
              startDate: generateValidStartDate(year),
              episodeCount: links.length,
              rating: Number(detail?.rank || 0),
              isFavorited: true,
              source: 'hanjutv',
            };

            tmpAnimes.push(transformedAnime);
            addAnime({ ...transformedAnime, links });

            if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
          }
        } catch (error) {
          log('error', `[Hanjutv] Error processing anime: ${error.message}`);
        }
      }));

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);

    return processHanjutvAnimes;
  }

  async getEpisodeDanmu(id) {
    let allDanmus = [];

    try {
      let fromAxis = 0;
      let prevId = 0;
      const seenDid = new Set();

      for (let page = 0; page < 400; page++) {
        const url = `${this.appHost}/api/danmu/playItem/list?pid=${id}&prevId=${prevId}&fromAxis=${fromAxis}&toAxis=100000000&offset=0`;

        const resp = await httpGet(url, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });

        if (!resp?.data || resp.data.rescode !== 0) {
          break;
        }

        const currentDanmus = Array.isArray(resp.data.danmus) ? resp.data.danmus : [];
        for (const danmu of currentDanmus) {
          const did = String(danmu?.did ?? '');
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

        fromAxis = nextAxis > fromAxis ? nextAxis : (fromAxis + 1);
        prevId = lastId > prevId ? lastId : prevId;
      }

      if (allDanmus.length > 0) {
        return allDanmus;
      }
    } catch {
    }

    try {
      let fromAxis = 0;
      const maxAxis = 100000000;

      while (fromAxis < maxAxis) {
        const url = `${this.oldDanmuHost}/api/danmu/playItem/list?fromAxis=${fromAxis}&pid=${id}&toAxis=${maxAxis}`;

        const resp = await httpGet(url, {
          headers: this.getWebHeaders(),
          timeout: 10000,
          retries: 1,
        });

        if (resp?.data?.danmus) {
          allDanmus = allDanmus.concat(resp.data.danmus);
        }

        const nextAxis = resp?.data?.nextAxis || maxAxis;
        if (nextAxis >= maxAxis) {
          break;
        }
        fromAxis = nextAxis;
      }

      return allDanmus;
    } catch (error) {
      log('error', 'fetchHanjutvEpisodeDanmu error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return allDanmus;
    }
  }

  async getEpisodeDanmuSegments(id) {
    log('info', '获取韩剧TV弹幕分段列表...', id);

    return new SegmentListResponse({
      type: 'hanjutv',
      segmentList: [{
        type: 'hanjutv',
        segment_start: 0,
        segment_end: 30000,
        url: id,
      }],
    });
  }

  async getEpisodeSegmentDanmu(segment) {
    return this.getEpisodeDanmu(segment.url);
  }

  formatComments(comments) {
    return comments.map((c) => ({
      cid: Number(c.did || c.id || 0),
      p: `${(Number(c.t || c.time || 0) / 1000).toFixed(2)},${Number(c.tp || c.mode || 1) === 2 ? 5 : Number(c.tp || c.mode || 1)},${Number(c.sc || c.color || 16777215)},[hanjutv]`,
      m: c.con || c.content || '',
      t: Math.round(Number(c.t || c.time || 0) / 1000),
    }));
  }
}
