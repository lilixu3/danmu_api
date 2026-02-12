import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches } from "../utils/common-util.js";
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
  }

  getWebHeaders() {
    return {
      'Content-Type': 'application/json',
      'User-Agent': this.webUserAgent,
    };
  }

  getAppHeaders() {
    return {
      vc: 'a_8260',
      vn: '6.8',
      ch: 'xiaomi',
      app: 'hj',
      'User-Agent': this.appUserAgent,
      'Accept-Encoding': 'gzip',
    };
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

    const normalize = (text) => String(text || '').replace(/\s+/g, '').trim();
    const normalizedKey = normalize(key);
    if (!normalizedKey) return false;

    const values = [
      item?.name,
      item?.title,
      item?.seriesName,
      item?.showName,
      item?.alias,
      item?.subName,
      item?.originName,
      item?.originalName,
    ].filter(Boolean);

    return values.some((text) => normalize(text).includes(normalizedKey));
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
          s2List = await this.searchByS2(key);
        } catch (error) {
          log('info', `[Hanjutv] s2 搜索失败: ${error.message}`);
        }
      }

      if (webList.length + s2List.length <= 2) {
        try {
          indexKList = await this.searchByIndexV2(key, true);
        } catch (error) {
          log('info', `[Hanjutv] indexV2(k) 搜索失败: ${error.message}`);
        }
      }

      let merged = this.dedupeBySid([...webList, ...s2List, ...indexKList]);
      let filtered = merged.filter((item) => this.matchKeyword(item, key));

      if (filtered.length <= 1 && webList.length === 0) {
        try {
          indexAllList = await this.searchByIndexV2(key, false);
        } catch (error) {
          log('info', `[Hanjutv] indexV2(all) 搜索失败: ${error.message}`);
        }

        merged = this.dedupeBySid([...merged, ...indexAllList]);
        filtered = merged.filter((item) => this.matchKeyword(item, key));
      }

      filtered = this.sortSearchItems(filtered, key);

      log('info', `[Hanjutv] 搜索候选统计 web=${webList.length}, s2=${s2List.length}, indexK=${indexKList.length}, indexAll=${indexAllList.length}, filtered=${filtered.length}`);
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
