import BaseSource from "./base.js";
import { globals } from "../configs/globals.js";
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches } from "../utils/common-util.js";
import { SegmentListResponse } from "../models/dandan-model.js";
import { createHanjutvUid, createHanjutvSearchHeaders, decodeHanjutvEncryptedPayload } from "../utils/hanjutv-util.js";

// =====================
// 获取韩剧TV弹幕
// =====================
export default class HanjutvSource extends BaseSource {
  constructor() {
    super();
    this.webHost = "https://hxqapi.hiyun.tv";
    this.appHost = "https://hxqapi.hiyun.tv";
    this.oldDanmuHost = "https://hxqapi.zmdcq.com";
    this.defaultRefer = "2JGztvGjRVpkxcr0T4ZWG2k+tOlnHmDGUNMwAGSeq548YV2FMbs0h0bXNi6DJ00L";
    this.webUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
    this.appUserAgent = "HanjuTV/6.8 (23127PN0CC; Android 16; Scale/2.00)";
  }

  getWebHeaders() {
    return {
      "Content-Type": "application/json",
      "User-Agent": this.webUserAgent,
    };
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
          serialNo: Number.isFinite(serialNo) && serialNo > 0 ? serialNo : (index + 1),
          title: item.title || item.name || item.programName || item.episodeTitle || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.serialNo - b.serialNo);
  }

  extractSearchItems(data) {
    const list = data?.seriesData?.seriesList || data?.seriesList || [];
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

  async searchWithS5Api(keyword) {
    const uid = createHanjutvUid();
    const headers = await createHanjutvSearchHeaders(uid);
    const q = encodeURIComponent(keyword);

    const resp = await httpGet(`${this.appHost}/api/search/s5?k=${q}&srefer=search_input&type=0&page=1`, {
      headers,
      timeout: 10000,
      retries: 1,
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
        throw new Error(`s5 响应解密失败: ${error.message}`);
      }

      const items = this.extractSearchItems(decoded);
      if (items.length === 0) throw new Error("s5 解密后无有效结果");
      return items;
    }

    const plainItems = this.extractSearchItems(payload);
    if (plainItems.length === 0) throw new Error("s5 无有效结果");
    return plainItems;
  }

  async searchWithLegacyApi(keyword) {
    const q = encodeURIComponent(keyword);
    const resp = await httpGet(`${this.webHost}/wapi/search/aggregate/search?keyword=${q}&scope=101&page=1`, {
      headers: this.getWebHeaders(),
      timeout: 10000,
      retries: 1,
    });
    const data = resp?.data;
    return this.extractSearchItems(data);
  }

  async search(keyword) {
    try {
      const key = String(keyword || "").trim();
      if (!key) return [];

      let s5List = [];
      let webList = [];

      try {
        s5List = await this.searchWithS5Api(key);
      } catch (error) {
        log("warn", `[Hanjutv] s5 搜索失败，降级旧接口: ${error.message}`);
      }

      let resultList = this.dedupeBySid(s5List);

      if (resultList.length === 0) {
        try {
          webList = await this.searchWithLegacyApi(key);
        } catch (error) {
          log("warn", `[Hanjutv] 旧搜索接口失败: ${error.message}`);
        }
        resultList = this.dedupeBySid(webList);
      }

      if (resultList.length === 0) {
        log("info", "hanjutvSearchresp: s5 与旧接口均无有效结果");
        return [];
      }

      log("info", `[Hanjutv] 搜索候选统计 s5=${s5List.length}, web=${webList.length}`);
      log("info", `[Hanjutv] 搜索找到 ${resultList.length} 个有效结果`);

      return resultList.map((anime) => {
        const animeId = convertToAsciiSum(anime.sid);
        return { ...anime, animeId };
      });
    } catch (error) {
      log("error", "getHanjutvAnimes error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return [];
    }
  }

  async getDetail(id) {
    try {
      const sid = String(id || "").trim();
      if (!sid) return [];

      let detail = null;

      try {
        const resp = await httpGet(`${this.appHost}/api/series/detail?sid=${sid}`, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });
        const data = resp?.data;
        detail = data?.series || null;
      } catch {
      }

      if (!detail) {
        try {
          const resp = await httpGet(`${this.webHost}/wapi/series/series/detail?sid=${sid}`, {
            headers: this.getWebHeaders(),
            timeout: 10000,
            retries: 1,
          });
          const data = resp?.data;
          detail = data?.series || null;
        } catch {
        }
      }

      if (!detail) {
        log("info", "getHanjutvDetail: series 不存在");
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
      const sid = String(id || "").trim();
      if (!sid) return [];

      let episodes = [];

      try {
        const detailResp = await httpGet(`${this.appHost}/api/series/detail?sid=${sid}`, {
          headers: this.getAppHeaders(),
          timeout: 10000,
          retries: 1,
        });
        const detailData = detailResp?.data;
        const playItems = Array.isArray(detailData?.playItems) ? detailData.playItems : [];
        episodes = this.normalizeEpisodes(playItems);
      } catch {
      }

      if (episodes.length === 0) {
        try {
          const epResp = await httpGet(`${this.appHost}/api/series2/episodes?sid=${sid}&refer=${encodeURIComponent(this.defaultRefer)}`, {
            headers: this.getAppHeaders(),
            timeout: 10000,
            retries: 1,
          });
          const epData = epResp?.data;
          episodes = this.normalizeEpisodes(epData?.programs || epData?.episodes || epData?.qxkPrograms || []);
        } catch {
        }
      }

      if (episodes.length === 0) {
        try {
          const pResp = await httpGet(`${this.appHost}/api/series/programs_v2?sid=${sid}`, {
            headers: this.getAppHeaders(),
            timeout: 10000,
            retries: 1,
          });
          const pData = pResp?.data;
          const programs = [
            ...(Array.isArray(pData?.programs) ? pData.programs : []),
            ...(Array.isArray(pData?.qxkPrograms) ? pData.qxkPrograms : []),
          ];
          episodes = this.normalizeEpisodes(programs);
        } catch {
        }
      }

      if (episodes.length === 0) {
        try {
          const resp = await httpGet(`${this.webHost}/wapi/series/series/detail?sid=${sid}`, {
            headers: this.getWebHeaders(),
            timeout: 10000,
            retries: 1,
          });
          const data = resp?.data;
          episodes = this.normalizeEpisodes(data?.episodes || []);
        } catch {
        }
      }

      if (episodes.length === 0) {
        log("info", "getHanjutvEposides: episodes 不存在");
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
    const getCategory = (key) => cateMap[key] || "其他";

    const tmpAnimes = [];
    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[Hanjutv] sourceAnimes is not a valid array");
      return [];
    }

    const processHanjutvAnimes = await Promise.all(sourceAnimes
      .filter((s) => titleMatches(s?.name || "", queryTitle))
      .map(async (anime) => {
        try {
          const detail = await this.getDetail(anime.sid);
          const detailObj = detail && !Array.isArray(detail) ? detail : {};
          const eps = await this.getEpisodes(anime.sid);
          if (!Array.isArray(eps) || eps.length === 0) return;

          const links = [];
          for (const ep of eps) {
            const epTitle = ep.title && ep.title.trim() !== "" ? `第${ep.serialNo}集：${ep.title}` : `第${ep.serialNo}集`;
            links.push({
              name: epTitle,
              url: ep.pid,
              title: `【hanjutv】 ${epTitle}`,
            });
          }
          if (links.length === 0) return;

          const updateTime = anime.updateTime || detailObj.updateTime || Date.now();
          const year = Number.isFinite(new Date(updateTime).getFullYear()) ? new Date(updateTime).getFullYear() : new Date().getFullYear();
          const category = Number(detailObj.category || anime.category || 0);
          const animeName = anime?.name || detailObj?.name || "未知剧集";
          const imageUrl = anime?.image?.thumb || detailObj?.image?.thumb || detailObj?.image?.url || "";

          const transformedAnime = {
            animeId: anime.animeId,
            bangumiId: String(anime.animeId),
            animeTitle: `${animeName}(${year})【${getCategory(category)}】from hanjutv`,
            type: getCategory(category),
            typeDescription: getCategory(category),
            imageUrl,
            startDate: generateValidStartDate(year),
            episodeCount: links.length,
            rating: Number(detailObj.rank || anime.rank || 0),
            isFavorited: true,
            source: "hanjutv",
          };

          tmpAnimes.push(transformedAnime);
          addAnime({ ...transformedAnime, links });

          if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
        } catch (error) {
          log("error", `[Hanjutv] Error processing anime: ${error.message}`);
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
        const data = resp?.data;
        if (!data || Number(data.rescode) !== 0) break;

        const currentDanmus = Array.isArray(data.danmus) ? data.danmus : [];
        for (const danmu of currentDanmus) {
          const did = String(danmu?.did ?? danmu?.id ?? "");
          if (!did || seenDid.has(did)) continue;
          seenDid.add(did);
          allDanmus.push(danmu);
        }

        const more = Number(data.more || 0);
        const nextAxis = Number(data.nextAxis || 0);
        const lastId = Number(data.lastId || 0);
        if (more !== 1 || currentDanmus.length === 0) break;
        if ((nextAxis <= fromAxis) && (lastId <= prevId)) break;

        fromAxis = nextAxis > fromAxis ? nextAxis : (fromAxis + 1);
        prevId = lastId > prevId ? lastId : prevId;
      }

      if (allDanmus.length > 0) return allDanmus;
    } catch {
    }

    try {
      let fromAxis = 0;
      const maxAxis = 100000000;
      while (fromAxis < maxAxis) {
        const resp = await httpGet(`${this.oldDanmuHost}/api/danmu/playItem/list?fromAxis=${fromAxis}&pid=${id}&toAxis=${maxAxis}`, {
          headers: this.getWebHeaders(),
          timeout: 10000,
          retries: 1,
        });
        const data = resp?.data;
        if (Array.isArray(data?.danmus)) {
          allDanmus = allDanmus.concat(data.danmus);
        }

        const nextAxis = Number(data?.nextAxis || maxAxis);
        if (nextAxis >= maxAxis) break;
        if (nextAxis <= fromAxis) break;
        fromAxis = nextAxis;
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
      type: "hanjutv",
      segmentList: [{
        type: "hanjutv",
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
      m: c.lc ? `${c.con || c.content || ""} 👍${c.lc}` : (c.con || c.content || ""),
      t: Math.round(Number(c.t || c.time || 0) / 1000),
    }));
  }
}
