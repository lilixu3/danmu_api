import { globals } from '../configs/globals.js';
import { getPageTitle, jsonResponse, httpGet } from '../utils/http-util.js';
import { log } from '../utils/log-util.js'
import { simplized } from '../utils/zh-util.js';
import { setRedisKey, updateRedisCaches } from "../utils/redis-util.js";
import {
    setCommentCache, addAnime, findAnimeIdByCommentId, findTitleById, findUrlById, getCommentCache, getPreferAnimeId,
    getSearchCache, removeEarliestAnime, setPreferByAnimeId, setSearchCache, storeAnimeIdsToMap, writeCacheToFile,
    updateLocalCaches
} from "../utils/cache-util.js";
import { formatDanmuResponse, convertToDanmakuJson } from "../utils/danmu-util.js";
import { applyOffsetToFormattedComments, resolveTimelineOffsetSeconds } from "../utils/offset-util.js";
import { extractEpisodeTitle, convertChineseNumber, parseFileName, createDynamicPlatformOrder, normalizeSpaces, extractYear } from "../utils/common-util.js";
import { getTMDBChineseTitle } from "../utils/tmdb-util.js";
import { applyMergeLogic, mergeDanmakuList, MERGE_DELIMITER } from "../utils/merge-util.js";
import AIClient from '../utils/ai-util.js';
import Kan360Source from "../sources/kan360.js";
import VodSource from "../sources/vod.js";
import TmdbSource from "../sources/tmdb.js";
import DoubanSource from "../sources/douban.js";
import RenrenSource from "../sources/renren.js";
import HanjutvSource from "../sources/hanjutv.js";
import BahamutSource from "../sources/bahamut.js";
import DandanSource from "../sources/dandan.js";
import CustomSource from "../sources/custom.js";
import TencentSource from "../sources/tencent.js";
import IqiyiSource from "../sources/iqiyi.js";
import MangoSource from "../sources/mango.js";
import BilibiliSource from "../sources/bilibili.js";
import MiguSource from "../sources/migu.js";
import YoukuSource from "../sources/youku.js";
import SohuSource from "../sources/sohu.js";
import LeshiSource from "../sources/leshi.js";
import XiguaSource from "../sources/xigua.js";
import MaiduiduiSource from "../sources/maiduidui.js";
import AnimekoSource from "../sources/animeko.js";
import OtherSource from "../sources/other.js";
import { Anime, AnimeMatch, Episodes, Bangumi } from "../models/dandan-model.js";

// =====================
// 兼容弹弹play接口
// =====================

const kan360Source = new Kan360Source();
const vodSource = new VodSource();
const renrenSource = new RenrenSource();
const hanjutvSource = new HanjutvSource();
const bahamutSource = new BahamutSource();
const dandanSource = new DandanSource();
const customSource = new CustomSource();
const tencentSource = new TencentSource();
const youkuSource = new YoukuSource();
const iqiyiSource = new IqiyiSource();
const mangoSource = new MangoSource();
const bilibiliSource = new BilibiliSource();
const miguSource = new MiguSource();
const sohuSource = new SohuSource();
const leshiSource = new LeshiSource();
const xiguaSource = new XiguaSource();
const maiduiduiSource = new MaiduiduiSource();
const animekoSource = new AnimekoSource();
const otherSource = new OtherSource();
const doubanSource = new DoubanSource(tencentSource, iqiyiSource, youkuSource, bilibiliSource, miguSource);
const tmdbSource = new TmdbSource(doubanSource);

// 用于聚合请求的去重Map
const PENDING_DANMAKU_REQUESTS = new Map();
// 用于弹幕请求(按集ID/URL)的去重Map
const PENDING_COMMENT_REQUESTS = new Map();
let nodeDnsLookup = null;

function buildUrlValidationError(errorMessage) {
  return jsonResponse(
    { errorCode: 400, success: false, errorMessage, count: 0, comments: [] },
    400
  );
}

function normalizeHost(hostname = '') {
  let host = String(hostname || '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  return host;
}

function parseIPv4(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts;
}

function isPrivateOrReservedIPv4(host) {
  const parts = parseIPv4(host);
  if (!parts) return false;
  const [a, b] = parts;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
    a >= 224 // 多播/保留地址
  );
}

function isPrivateOrReservedIPv6(host) {
  const normalized = normalizeHost(host).split('%')[0];
  if (!normalized) return false;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
  if (/^fe[89ab]/i.test(normalized)) return true; // fe80::/10
  if (/^fe[cdef]/i.test(normalized)) return true; // fec0::/10 (deprecated site-local)
  if (normalized.startsWith('ff')) return true; // ff00::/8

  // 处理 IPv4-mapped IPv6，如 ::ffff:127.0.0.1
  const mappedIndex = normalized.lastIndexOf(':');
  if (mappedIndex !== -1) {
    const tail = normalized.slice(mappedIndex + 1);
    if (parseIPv4(tail)) {
      return isPrivateOrReservedIPv4(tail);
    }
  }
  return false;
}

function isPrivateOrReservedIp(ip) {
  const host = normalizeHost(ip);
  if (!host) return false;
  return isPrivateOrReservedIPv4(host) || (host.includes(':') && isPrivateOrReservedIPv6(host));
}

async function lookupHostAddresses(hostname) {
  const isNodeRuntime = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (!isNodeRuntime) return null;

  try {
    if (!nodeDnsLookup) {
      nodeDnsLookup = import('node:dns/promises')
        .then((m) => m.lookup)
        .catch((error) => {
          log("warn", `[Security] DNS module unavailable: ${error.message}`);
          return null;
        });
    }
    const lookup = await nodeDnsLookup;
    if (!lookup) return null;
    const records = await lookup(hostname, { all: true, verbatim: true });
    return Array.isArray(records) ? records.map((item) => item?.address).filter(Boolean) : [];
  } catch (error) {
    log("warn", `[Security] DNS lookup failed for ${hostname}: ${error.message}`);
    return [];
  }
}

async function validateExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    log("error", "Missing or invalid url parameter");
    return { ok: false, response: buildUrlValidationError("Missing or invalid url parameter") };
  }

  const cleanedUrl = rawUrl.trim();

  let parsed;
  try {
    parsed = new URL(cleanedUrl);
  } catch {
    log("error", "Invalid url format");
    return { ok: false, response: buildUrlValidationError("Invalid url format") };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    log("error", "Invalid url protocol, must be http or https");
    return { ok: false, response: buildUrlValidationError("Invalid url protocol, must be http or https") };
  }

  if (parsed.username || parsed.password) {
    log("error", "Invalid url format: credentials are not allowed");
    return { ok: false, response: buildUrlValidationError("Invalid url format: credentials are not allowed") };
  }

  const host = normalizeHost(parsed.hostname);
  if (!host) {
    log("error", "Invalid url hostname");
    return { ok: false, response: buildUrlValidationError("Invalid url hostname") };
  }

  if (!globals.allowPrivateUrls) {
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
      log("error", `[Security] Blocked local hostname: ${host}`);
      return { ok: false, response: buildUrlValidationError("Private/localhost url is not allowed") };
    }

    if (isPrivateOrReservedIp(host)) {
      log("error", `[Security] Blocked private IP url: ${host}`);
      return { ok: false, response: buildUrlValidationError("Private IP url is not allowed") };
    }

    // Node 环境下额外做 DNS 解析，避免通过公网域名解析到内网地址绕过校验
    const addresses = await lookupHostAddresses(host);
    if (Array.isArray(addresses)) {
      if (addresses.length === 0) {
        return { ok: false, response: buildUrlValidationError("Hostname cannot be resolved") };
      }
      const blockedAddress = addresses.find((address) => isPrivateOrReservedIp(address));
      if (blockedAddress) {
        log("error", `[Security] Blocked DNS resolved private IP: ${blockedAddress}`);
        return { ok: false, response: buildUrlValidationError("Resolved hostname points to private IP") };
      }
    }
  }

  return { ok: true, parsed, normalizedUrl: cleanedUrl };
}

async function withPendingCommentRequest(pendingKey, taskFactory) {
  if (PENDING_COMMENT_REQUESTS.has(pendingKey)) {
    log("debug", `[Comment] 复用正在进行的请求: ${pendingKey}`);
    return await PENDING_COMMENT_REQUESTS.get(pendingKey);
  }

  const task = (async () => taskFactory())();
  PENDING_COMMENT_REQUESTS.set(pendingKey, task);

  try {
    return await task;
  } finally {
    PENDING_COMMENT_REQUESTS.delete(pendingKey);
  }
}

function buildEpisodesFromAnimeLinks(anime) {
  if (!anime || !Array.isArray(anime.links)) return [];

  let episodesList = anime.links.map((link, index) => ({
    seasonId: `season-${anime.animeId}`,
    episodeId: link.id,
    episodeTitle: `${link.title}`,
    episodeNumber: `${index + 1}`,
    airDate: anime.startDate,
  }));

  if (globals.enableAnimeEpisodeFilter) {
    episodesList = episodesList.filter(ep => !globals.episodeTitleFilter.test(ep.episodeTitle));
    episodesList = episodesList.map((ep, index) => ({
      ...ep,
      episodeNumber: `${index + 1}`
    }));
  }

  return filterSameEpisodeTitle(episodesList);
}

function tryFastMatchFromPreferCache({ title, season, episode, year, preferAnimeId, preferSource, preferredPlatform }) {
  if (!preferAnimeId || !globals.rememberLastSelect) return { resAnime: null, resEpisode: null };

  const targetAnime = (globals.animes || []).find((anime) => {
    const idMatched = String(anime.animeId) === String(preferAnimeId) || String(anime.bangumiId) === String(preferAnimeId);
    if (!idMatched) return false;
    if (preferSource && anime.source && anime.source !== preferSource) return false;
    return true;
  });

  if (!targetAnime || !Array.isArray(targetAnime.links) || targetAnime.links.length === 0) {
    return { resAnime: null, resEpisode: null };
  }

  // 保护性校验：标题与年份至少应与请求一致，避免误命中旧缓存
  const normalizedAnimeTitle = normalizeSpaces((targetAnime.animeTitle || '').split("(")[0].trim());
  const normalizedQueryTitle = normalizeSpaces(title);
  if (!normalizedAnimeTitle.includes(normalizedQueryTitle)) {
    return { resAnime: null, resEpisode: null };
  }
  if (year && !matchYear(targetAnime, year)) {
    return { resAnime: null, resEpisode: null };
  }
  if (season && !matchSeason(targetAnime, title, season)) {
    return { resAnime: null, resEpisode: null };
  }

  const episodes = buildEpisodesFromAnimeLinks(targetAnime);
  if (episodes.length === 0) return { resAnime: null, resEpisode: null };

  let matchedEpisode = null;
  if (season && episode) {
    matchedEpisode = findEpisodeByNumber(episodes, episode, preferredPlatform || null);
  } else {
    if (preferredPlatform) {
      matchedEpisode = episodes.find((ep) => {
        const epPlatform = extractEpisodeTitle(ep.episodeTitle);
        return getPlatformMatchScore(epPlatform, preferredPlatform) > 0;
      }) || null;
    }
    if (!matchedEpisode) matchedEpisode = episodes[0];
  }

  if (!matchedEpisode) return { resAnime: null, resEpisode: null };
  return { resAnime: targetAnime, resEpisode: matchedEpisode };
}

// 匹配年份函数，优先于季匹配
function matchYear(anime, queryYear) {
  if (!queryYear) {
    return true; // 如果没有查询年份，则视为匹配
  }
  
  const animeYear = extractYear(anime.animeTitle);
  if (!animeYear) {
    return true; // 如果动漫没有年份信息，则视为匹配（允许匹配）
  }
  
  return animeYear === queryYear;
}

export function matchSeason(anime, queryTitle, season) {
  const normalizedAnimeTitle = normalizeSpaces(anime.animeTitle);
  const normalizedQueryTitle = normalizeSpaces(queryTitle);

  if (normalizedAnimeTitle.includes(normalizedQueryTitle)) {
    const match = normalizedAnimeTitle.match(/^(.*?)\(\d{4}\)/);
    const title = match ? match[1].trim() : normalizedAnimeTitle.split("(")[0].trim();
    if (title.startsWith(normalizedQueryTitle)) {
      const afterTitle = title.substring(normalizedQueryTitle.length).trim();
      if (afterTitle === '' && season === 1) {
        return true;
      }
      // match number from afterTitle
      const seasonIndex = afterTitle.match(/\d+/);
      if (seasonIndex && seasonIndex[0] === season.toString()) {
        return true;
      }
      // match chinese number
      const chineseNumber = afterTitle.match(/[一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+/);
      if (chineseNumber && convertChineseNumber(chineseNumber[0]) === season) {
        return true;
      }
    }
    return false;
  } else {
    return false;
  }
}

// Extracted function for GET /api/v2/search/anime
export async function searchAnime(url, preferAnimeId = null, preferSource = null) {
  let queryTitle = url.searchParams.get("keyword");
  log("info", `Search anime with keyword: ${queryTitle}`);

  // 关键字为空直接返回，不用多余查询
  if (queryTitle === "") {
    return jsonResponse({
      errorCode: 0,
      success: true,
      errorMessage: "",
      animes: [],
    });
  }

  // 如果启用了搜索关键字繁转简，则进行转换
  if (globals.animeTitleSimplified) {
    const simplifiedTitle = simplized(queryTitle);
    log("info", `searchAnime converted traditional to simplified: ${queryTitle} -> ${simplifiedTitle}`);
    queryTitle = simplifiedTitle;
  }

  // 检查搜索缓存
  const cachedResults = getSearchCache(queryTitle);
  if (cachedResults !== null) {
    return jsonResponse({
      errorCode: 0,
      success: true,
      errorMessage: "",
      animes: cachedResults,
    });
  }

  const curAnimes = [];

  // 链接弹幕解析
  const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}(:\d+)?(\/[^\s]*)?$/;
  if (urlRegex.test(queryTitle)) {
    const tmpAnime = Anime.fromJson({
      "animeId": 111,
      "bangumiId": "string",
      "animeTitle": queryTitle,
      "type": "type",
      "typeDescription": "string",
      "imageUrl": "string",
      "startDate": "2025-08-08T13:25:11.189Z",
      "episodeCount": 1,
      "rating": 0,
      "isFavorited": true
    });

    let platform = "unknown";
    if (queryTitle.includes(".qq.com")) {
      platform = "qq";
    } else if (queryTitle.includes(".iqiyi.com")) {
      platform = "qiyi";
    } else if (queryTitle.includes(".mgtv.com")) {
      platform = "imgo";
    } else if (queryTitle.includes(".youku.com")) {
      platform = "youku";
    } else if (queryTitle.includes(".bilibili.com")) {
      platform = "bilibili1";
    } else if (queryTitle.includes(".miguvideo.com")) {
      platform = "migu";
    } else if (queryTitle.includes(".sohu.com")) {
      platform = "sohu";
    } else if (queryTitle.includes(".le.com")) {
      platform = "leshi";
    } else if (queryTitle.includes(".douyin.com") || queryTitle.includes(".ixigua.com")) {
      platform = "xigua";
    } else if (queryTitle.includes('.mddcloud.com.cn')) {
      platform = "maiduidui";
    }

    const pageTitle = await getPageTitle(queryTitle);

    const links = [{
      "name": "手动解析链接弹幕",
      "url": queryTitle,
      "title": `【${platform}】 ${pageTitle}`
    }];
    curAnimes.push(tmpAnime);
    addAnime(Anime.fromJson({...tmpAnime, links: links}));
    if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();

    // 如果有新的anime获取到，则更新本地缓存
    if (globals.localCacheValid && curAnimes.length !== 0) {
      await updateLocalCaches();
    }
    // 如果有新的anime获取到，则更新redis
    if (globals.redisValid && curAnimes.length !== 0) {
      await updateRedisCaches();
    }

    return jsonResponse({
      errorCode: 0,
      success: true,
      errorMessage: "",
      animes: curAnimes,
    });
  }

  try {
    // 根据 sourceOrderArr 动态构建请求数组
    log("info", "Search sourceOrderArr:", globals.sourceOrderArr);
    const requestPromises = globals.sourceOrderArr.map(source => {
      if (source === "360") return kan360Source.search(queryTitle);
      if (source === "vod") return vodSource.search(queryTitle, preferAnimeId, preferSource);
      if (source === "tmdb") return tmdbSource.search(queryTitle);
      if (source === "douban") return doubanSource.search(queryTitle);
      if (source === "renren") return renrenSource.search(queryTitle);
      if (source === "hanjutv") return hanjutvSource.search(queryTitle);
      if (source === "bahamut") return bahamutSource.search(queryTitle);
      if (source === "dandan") return dandanSource.search(queryTitle);
      if (source === "custom") return customSource.search(queryTitle);
      if (source === "tencent") return tencentSource.search(queryTitle);
      if (source === "youku") return youkuSource.search(queryTitle);
      if (source === "iqiyi") return iqiyiSource.search(queryTitle);
      if (source === "imgo") return mangoSource.search(queryTitle);
      if (source === "bilibili") return bilibiliSource.search(queryTitle);
      if (source === "migu") return miguSource.search(queryTitle);
      if (source === "sohu") return sohuSource.search(queryTitle);
      if (source === "leshi") return leshiSource.search(queryTitle);
      if (source === "xigua") return xiguaSource.search(queryTitle);
      if (source === "maiduidui") return maiduiduiSource.search(queryTitle);
      if (source === "animeko") return animekoSource.search(queryTitle);
    });

    // 执行所有请求并等待结果（单源失败不影响其它源）
    const settledResults = await Promise.allSettled(requestPromises);
    const results = settledResults.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      const source = globals.sourceOrderArr[index];
      const reason = result.reason?.message || String(result.reason || "unknown error");
      log("warn", `[searchAnime] 源 ${source} 搜索失败: ${reason}`);
      return [];
    });

    // 创建一个对象来存储返回的结果
    const resultData = {};

    // 动态根据 sourceOrderArr 顺序将结果赋值给对应的来源
    globals.sourceOrderArr.forEach((source, index) => {
      resultData[source] = results[index];  // 根据顺序赋值
    });

    // 解构出返回的结果
    const {
      vod: animesVodResults, 360: animes360, tmdb: animesTmdb, douban: animesDouban, renren: animesRenren,
      hanjutv: animesHanjutv, bahamut: animesBahamut, dandan: animesDandan, custom: animesCustom,
      tencent: animesTencent, youku: animesYouku, iqiyi: animesIqiyi, imgo: animesImgo, bilibili: animesBilibili,
      migu: animesMigu, sohu: animesSohu, leshi: animesLeshi, xigua: animesXigua, maiduidui: animesMaiduidui,
      animeko: animesAnimeko
    } = resultData;

    // 按顺序处理每个来源的结果（单源处理失败不影响其它源）
    for (const key of globals.sourceOrderArr) {
      try {
        if (key === '360') {
          // 等待处理360来源
          await kan360Source.handleAnimes(animes360, queryTitle, curAnimes);
        } else if (key === 'vod') {
          // 等待处理Vod来源（遍历所有VOD服务器的结果）
          if (animesVodResults && Array.isArray(animesVodResults)) {
            for (const vodResult of animesVodResults) {
              if (vodResult && vodResult.list && vodResult.list.length > 0) {
                await vodSource.handleAnimes(vodResult.list, queryTitle, curAnimes, vodResult.serverName);
              }
            }
          }
        } else if (key === 'tmdb') {
          // 等待处理TMDB来源
          await tmdbSource.handleAnimes(animesTmdb, queryTitle, curAnimes);
        } else if (key === 'douban') {
          // 等待处理Douban来源
          await doubanSource.handleAnimes(animesDouban, queryTitle, curAnimes);
        } else if (key === 'renren') {
          // 等待处理Renren来源
          await renrenSource.handleAnimes(animesRenren, queryTitle, curAnimes);
        } else if (key === 'hanjutv') {
          // 等待处理Hanjutv来源
          await hanjutvSource.handleAnimes(animesHanjutv, queryTitle, curAnimes);
        } else if (key === 'bahamut') {
          // 等待处理Bahamut来源
          await bahamutSource.handleAnimes(animesBahamut, queryTitle, curAnimes);
        } else if (key === 'dandan') {
          // 等待处理弹弹play来源
          await dandanSource.handleAnimes(animesDandan, queryTitle, curAnimes);
        } else if (key === 'custom') {
          // 等待处理自定义弹幕源来源
          await customSource.handleAnimes(animesCustom, queryTitle, curAnimes);
        } else if (key === 'tencent') {
          // 等待处理Tencent来源
          await tencentSource.handleAnimes(animesTencent, queryTitle, curAnimes);
        } else if (key === 'youku') {
          // 等待处理Youku来源
          await youkuSource.handleAnimes(animesYouku, queryTitle, curAnimes);
        } else if (key === 'iqiyi') {
          // 等待处理iQiyi来源
          await iqiyiSource.handleAnimes(animesIqiyi, queryTitle, curAnimes);
        } else if (key === 'imgo') {
          // 等待处理Mango来源
          await mangoSource.handleAnimes(animesImgo, queryTitle, curAnimes);
        } else if (key === 'bilibili') {
          // 等待处理Bilibili来源
          await bilibiliSource.handleAnimes(animesBilibili, queryTitle, curAnimes);
        } else if (key === 'migu') {
          // 等待处理Migu来源
          await miguSource.handleAnimes(animesMigu, queryTitle, curAnimes);
        } else if (key === 'sohu') {
          // 等待处理Sohu来源
          await sohuSource.handleAnimes(animesSohu, queryTitle, curAnimes);
        } else if (key === 'leshi') {
          // 等待处理Leshi来源
          await leshiSource.handleAnimes(animesLeshi, queryTitle, curAnimes);
        } else if (key === 'xigua') {
          // 等待处理Xigua来源
          await xiguaSource.handleAnimes(animesXigua, queryTitle, curAnimes);
        } else if (key === 'maiduidui') {
          // 等待处理Maiduidui来源
          await maiduiduiSource.handleAnimes(animesMaiduidui, queryTitle, curAnimes);
        } else if (key === 'animeko') {
          // 等待处理Animeko来源
          await animekoSource.handleAnimes(animesAnimeko, queryTitle, curAnimes);
        }
      } catch (sourceError) {
        const reason = sourceError?.message || String(sourceError || "unknown error");
        log("warn", `[searchAnime] 源 ${key} 结果处理失败: ${reason}`);
      }
    }
  } catch (error) {
    log("error", "发生错误:", error);
  }

  // 执行源合并逻辑
  if (globals.mergeSourcePairs.length > 0) {
    await applyMergeLogic(curAnimes);
  }

  storeAnimeIdsToMap(curAnimes, queryTitle);

  // 如果启用了集标题过滤，则为每个动漫添加过滤后的 episodes
  if (globals.enableAnimeEpisodeFilter) {
    const validAnimes = [];
    for (const anime of curAnimes) {
      // 首先检查剧名是否包含过滤关键词
      const animeTitle = anime.animeTitle || '';
      if (globals.animeTitleFilter && globals.animeTitleFilter.test(animeTitle)) {
        log("debug", `[searchAnime] Anime ${anime.animeId} filtered by name: ${animeTitle}`);
        continue; // 跳过该动漫
      }

      const animeData = globals.animes.find(a => a.animeId === anime.animeId);
      if (animeData && animeData.links) {
        let episodesList = animeData.links.map((link, index) => ({
          episodeId: link.id,
          episodeTitle: link.title,
          episodeNumber: index + 1
        }));

        // 应用过滤
        episodesList = episodesList.filter(episode => {
          return !globals.episodeTitleFilter.test(episode.episodeTitle);
        });

        log("debug", `[searchAnime] Anime ${anime.animeId} filtered episodes: ${episodesList.length}/${animeData.links.length}`);

        // 只有当过滤后还有有效剧集时才保留该动漫
        if (episodesList.length > 0) {
          validAnimes.push(anime);
        }
      }
    }
    // 用过滤后的动漫列表替换原列表
    curAnimes.length = 0;
    curAnimes.push(...validAnimes);
  }

  // 如果有新的anime获取到，则更新本地缓存
  if (globals.localCacheValid && curAnimes.length !== 0) {
    await updateLocalCaches();
  }
  // 如果有新的anime获取到，则更新redis
  if (globals.redisValid && curAnimes.length !== 0) {
    await updateRedisCaches();
  }

  // 缓存搜索结果
  if (curAnimes.length > 0) {
    setSearchCache(queryTitle, curAnimes);
  }

  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    animes: curAnimes,
  });
}

function filterSameEpisodeTitle(filteredTmpEpisodes) {
    const filteredEpisodes = filteredTmpEpisodes.filter((episode, index, episodes) => {
        // 查找当前 episode 标题是否在之前的 episodes 中出现过
        return !episodes.slice(0, index).some(prevEpisode => {
            return prevEpisode.episodeTitle === episode.episodeTitle;
        });
    });
    return filteredEpisodes;
}

// 从集标题中提取集数（支持多种格式：第1集、第01集、EP01、E01等）
function extractEpisodeNumberFromTitle(episodeTitle) {
  if (!episodeTitle) return null;
  
  // 匹配格式：第1集、第01集、第10集等
  const chineseMatch = episodeTitle.match(/第(\d+)集/);
  if (chineseMatch) {
    return parseInt(chineseMatch[1], 10);
  }
  
  // 匹配格式：EP01、EP1、E01、E1等
  const epMatch = episodeTitle.match(/[Ee][Pp]?(\d+)/);
  if (epMatch) {
    return parseInt(epMatch[1], 10);
  }
  
  // 匹配格式：01、1（纯数字，通常在标题开头或结尾）
  const numberMatch = episodeTitle.match(/(?:^|\s)(\d+)(?:\s|$)/);
  if (numberMatch) {
    return parseInt(numberMatch[1], 10);
  }
  
  return null;
}

/**
 * 计算平台匹配得分 (新增函数 - 用于支持合并源模糊匹配和杂质过滤)
 * @param {string} candidatePlatform 候选平台字符串 (e.g., "bilibili&dandan")
 * @param {string} targetPlatform 目标配置字符串 (e.g., "bilibili1&dandan")
 * @returns {number} 得分：越高越好，0表示不匹配
 */
function getPlatformMatchScore(candidatePlatform, targetPlatform) {
  if (!candidatePlatform || !targetPlatform) return 0;
  
  // 预处理：按 & 分割，转小写，去空格
  const cParts = candidatePlatform.split('&').map(s => s.trim().toLowerCase()).filter(s => s);
  const tParts = targetPlatform.split('&').map(s => s.trim().toLowerCase()).filter(s => s);
  
  let matchCount = 0;

  // 计算交集：统计有多少个目标平台在候选平台中存在
  // 使用 includes 进行模糊匹配，解决部分平台名称差异问题
  for (const tPart of tParts) {
    const isFound = cParts.some(cPart => 
        cPart === tPart || 
        (cPart.includes(tPart) && tPart.length > 2) || 
        (tPart.includes(cPart) && cPart.length > 2)
    );
    if (isFound) {
        matchCount++;
    }
  }
  
  if (matchCount === 0) return 0;

  // 评分公式：基于命中数计算权重，其次考虑候选长度（越短越好，即杂质越少分越高）
  // 示例: Target="bilibili"
  // Candidate="bilibili" -> Match=1, Len=1 -> 1000 - 1 = 999 (Best)
  // Candidate="animeko&bilibili" -> Match=1, Len=2 -> 1000 - 2 = 998 (Valid but lower score)
  return (matchCount * 1000) - cParts.length;
}

// 辅助函数：从标题中提取来源平台列表 (新增函数 - 适配合并源标题格式)
function extractPlatformFromTitle(title) {
    const match = title.match(/from\s+([a-zA-Z0-9&]+)/i);
    return match ? match[1] : null;
}

// 根据集数匹配episode（优先使用集标题中的集数，其次使用episodeNumber，最后使用数组索引）
function findEpisodeByNumber(filteredEpisodes, targetEpisode, platform = null) {
  if (!filteredEpisodes || filteredEpisodes.length === 0) {
    return null;
  }
  
  // 如果指定了平台，先过滤出该平台的集数 (修改点：使用 getPlatformMatchScore 支持模糊匹配)
  let platformEpisodes = filteredEpisodes;
  if (platform) {
    platformEpisodes = filteredEpisodes.filter(ep => {
        const epTitlePlatform = extractEpisodeTitle(ep.episodeTitle);
        // 使用评分机制判断是否匹配，只要有分就保留
        return getPlatformMatchScore(epTitlePlatform, platform) > 0;
    });
  }
  
  if (platformEpisodes.length === 0) {
    return null;
  }
  
  // 策略1：从集标题中提取集数进行匹配
  for (const ep of platformEpisodes) {
    const extractedNumber = extractEpisodeNumberFromTitle(ep.episodeTitle);
    if (extractedNumber === targetEpisode) {
      log("debug", `Found episode by title number: ${ep.episodeTitle} (extracted: ${extractedNumber})`);
      return ep;
    }
  }
  // 策略2：使用数组索引
  if (platformEpisodes.length >= targetEpisode) {
    const fallbackEp = platformEpisodes[targetEpisode - 1];
    log("debug", `Using fallback array index for episode ${targetEpisode}: ${fallbackEp.episodeTitle}`);
    return fallbackEp;
  }
  // 策略3：使用episodeNumber字段匹配
  for (const ep of platformEpisodes) {
    if (ep.episodeNumber && parseInt(ep.episodeNumber, 10) === targetEpisode) {
      log("debug", `Found episode by episodeNumber: ${ep.episodeTitle} (episodeNumber: ${ep.episodeNumber})`);
      return ep;
    }
  }
  
  return null;
}

function getAiReasonText(reason) {
  const reasonMap = {
    ai_not_ready: "AI 配置未就绪",
    ai_parse_error: "AI 响应解析失败",
    ai_no_candidate: "AI 未返回候选结果",
    ai_invalid_index: "AI 返回了无效候选索引",
    ai_selected_anime_no_valid_episodes: "AI 选中的动漫无有效剧集",
    ai_selected_anime_no_episode_match: "AI 选中动漫但未匹配到对应剧集",
    ai_success: "AI 匹配成功",
    ai_exception: "AI 调用异常",
    fast_match_cache_hit: "命中上次选择缓存（快速匹配）",
  };
  return reasonMap[reason] || `未知原因（${reason || "unknown"}）`;
}

/**
 * 是否在 AI 未命中时跳过常规兜底
 * 仅对 AI 已给出有效业务结论的未命中场景生效，技术性失败仍允许回退。
 * @param {{reason?: string}|null} aiMatchResult
 * @returns {boolean}
 */
function shouldSkipFallbackByAiResult(aiMatchResult) {
  if (!globals.aiTrustMatchResult) return false;
  const reason = aiMatchResult?.reason;
  const trustedNoFallbackReasons = new Set([
    "ai_no_candidate",
    "ai_selected_anime_no_valid_episodes",
    "ai_selected_anime_no_episode_match",
  ]);
  return trustedNoFallbackReasons.has(reason);
}

async function matchAniAndEpByAi(season, episode, year, searchData, title, req, dynamicPlatformOrder, preferAnimeId, preferredPlatform = null) {
  const aiBaseUrl = globals.aiBaseUrl;
  const aiModel = globals.aiModel;
  const aiApiKey = globals.aiApiKey;
  const aiMatchPrompt = globals.aiMatchPrompt;

  if (!globals.aiValid || !aiMatchPrompt) {
    log("warn", "AI 配置不完整，回退到常规匹配");
    return { resEpisode: null, resAnime: null, reason: "ai_not_ready" };
  }

  const aiClient = new AIClient({
    apiKey: aiApiKey,
    baseURL: aiBaseUrl,
    model: aiModel,
    systemPrompt: aiMatchPrompt
  });

  const matchData = {
    title,
    season,
    episode,
    year,
    preferredPlatform,
    dynamicPlatformOrder,
    preferAnimeId,
    animes: searchData.animes.map(anime => {
      const normalizedAnimeTitle = anime.animeTitle || '';
      const match = normalizedAnimeTitle.match(/^(.*?)\(\d{4}\)/);
      const title = match ? match[1].trim() : normalizedAnimeTitle.split("(")[0].trim();
      return {
        animeId: anime.animeId,
        animeTitle: title,
        type: anime.type,
        year: anime.startDate ? anime.startDate.slice(0, 4) : null,
        episodeCount: anime.episodeCount,
        source: anime.source
      };
    })
  };

  try {
    // userPrompt 只传入结构化数据
    const userPrompt = JSON.stringify(matchData, null, 2);

    const aiResponse = await aiClient.ask(userPrompt);
    // const aiResponse = '{ "animeIndex": 0 }';
    log("debug", `AI 匹配原始响应: ${aiResponse}`);

    let parsedResponse;
    try {
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```|```([\s\S]*?)\s*```|({[\s\S]*})/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[2] || jsonMatch[3]) : aiResponse;
      parsedResponse = JSON.parse(jsonString.trim());
    } catch (parseError) {
      log("error", `AI 响应解析失败: ${parseError.message}`);
      return { resEpisode: null, resAnime: null, reason: "ai_parse_error" };
    }

    const animeIndex = parsedResponse.animeIndex;

    if (animeIndex === null || animeIndex === undefined) {
      return { resEpisode: null, resAnime: null, reason: "ai_no_candidate" };
    }

    const selectedAnime = searchData.animes[animeIndex];
    if (!selectedAnime) {
      log("error", `AI 返回无效动漫索引: ${animeIndex}`);
      return { resEpisode: null, resAnime: null, reason: "ai_invalid_index" };
    }

    let originBangumiUrl = new URL(req.url.replace("/match", `bangumi/${selectedAnime.animeId}`));
    const bangumiRes = await getBangumi(originBangumiUrl.pathname);
    const bangumiData = await bangumiRes.json();
    const bangumiEpisodes = bangumiData?.bangumi?.episodes;

    if (!Array.isArray(bangumiEpisodes) || bangumiEpisodes.length === 0) {
      log("warn", `AI 选中的动漫无有效剧集: ${selectedAnime.animeId}`);
      return { resEpisode: null, resAnime: selectedAnime, reason: "ai_selected_anime_no_valid_episodes" };
    }

    let filteredEpisode = null;
    const aiPreferredPlatform = preferredPlatform || (Array.isArray(dynamicPlatformOrder) ? dynamicPlatformOrder.find(Boolean) : null);

    if (season && episode) {
        // 剧集模式逻辑
        const filteredTmpEpisodes = globals.enableAnimeEpisodeFilter
          ? bangumiEpisodes.filter(curEpisode => !globals.episodeTitleFilter.test(curEpisode.episodeTitle))
          : bangumiEpisodes;
        const filteredEpisodes = filterSameEpisodeTitle(filteredTmpEpisodes);

        log("debug", "过滤后的集标题", filteredEpisodes.map(episode => episode.episodeTitle));

        // 匹配集数（优先沿用请求中的平台偏好）
        filteredEpisode = findEpisodeByNumber(filteredEpisodes, episode, aiPreferredPlatform);
    } else {
        // 电影模式逻辑
        if (bangumiEpisodes.length > 0) {
          if (aiPreferredPlatform) {
            const targetEp = bangumiEpisodes.find(ep => {
              const epTitlePlatform = extractEpisodeTitle(ep.episodeTitle);
              return getPlatformMatchScore(epTitlePlatform, aiPreferredPlatform) > 0;
            });
            filteredEpisode = targetEp || bangumiEpisodes[0];
          } else {
            filteredEpisode = bangumiEpisodes[0];
          }
        }
    }

    return {
      resEpisode: filteredEpisode,
      resAnime: selectedAnime,
      reason: filteredEpisode ? "ai_success" : "ai_selected_anime_no_episode_match"
    };
  } catch (error) {
    log("error", `AI 匹配执行失败: ${error.message}`);
    return { resEpisode: null, resAnime: null, reason: "ai_exception" };
  }
}

async function matchAniAndEp(season, episode, year, searchData, title, req, platform, preferAnimeId) {
  // 定义最佳匹配结果容器
  let bestRes = {
    anime: null,
    episode: null,
    score: -9999 // 初始分数为极低值
  };

  const normalizedTitle = normalizeSpaces(title);

  // 遍历所有搜索结果，寻找最佳匹配
  for (const anime of searchData.animes) {
    // 偏好过滤
    const animeIsNotPrefer = 
        globals.rememberLastSelect && 
        preferAnimeId && 
        String(anime.bangumiId) !== String(preferAnimeId) && 
        String(anime.animeId) !== String(preferAnimeId);
    if (animeIsNotPrefer) continue;

    let isMatch = false;

    // 1. 标题/年份匹配检查
    if (season && episode) {
        // 剧集模式
        if (normalizeSpaces(anime.animeTitle).includes(normalizedTitle)) {
            // 年份匹配优先于季匹配
            if (!matchYear(anime, year)) {
                log("debug", `Year mismatch: anime year ${extractYear(anime.animeTitle)} vs query year ${year}`);
                continue;
            }

            // 年份匹配通过后，再判断season
            const animeIsPrefer = 
              globals.rememberLastSelect && 
              preferAnimeId && 
              (String(anime.bangumiId) === String(preferAnimeId) || 
              String(anime.animeId) === String(preferAnimeId));

            if (matchSeason(anime, title, season) || animeIsPrefer) {
                isMatch = true;
            }
        }
    } else {
        // 电影模式
        const animeTitle = anime.animeTitle.split("(")[0].trim();
        if (animeTitle === title) {
            // 年份匹配检查
            if (!matchYear(anime, year)) {
                log("debug", `Year mismatch: anime year ${extractYear(anime.animeTitle)} vs query year ${year}`);
                continue;
            }
            isMatch = true;
        }
    }

    if (!isMatch) continue;

    // 2. 获取剧集详情 (无条件获取，确保数据完整性)
    const bangumiId = anime.bangumiId || anime.animeId;
    let originBangumiUrl = new URL(req.url.replace("/match", `bangumi/${bangumiId}`));
    const bangumiRes = await getBangumi(originBangumiUrl.pathname);
    const bangumiData = await bangumiRes.json();
    if (!bangumiData?.success || !Array.isArray(bangumiData?.bangumi?.episodes) || bangumiData.bangumi.episodes.length === 0) {
      log("warn", `[matchAniAndEp] 跳过无效 bangumi: ${bangumiId} / ${anime.animeTitle}`);
      continue;
    }
    const bangumiEpisodes = bangumiData.bangumi.episodes;
    
    // 输出匹配分数及摘要日志，避免 info 级别打印超大对象
    log("debug", "判断剧集", `Anime: ${anime.animeTitle}`);
    log("debug", "[matchAniAndEp] bangumi摘要", {
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      episodeCount: bangumiEpisodes.length
    });

    let matchedEpisode = null;

    if (season && episode) {
        // 剧集模式逻辑
        const filteredTmpEpisodes = globals.enableAnimeEpisodeFilter
          ? bangumiEpisodes.filter(curEpisode => !globals.episodeTitleFilter.test(curEpisode.episodeTitle))
          : bangumiEpisodes;
        const filteredEpisodes = filterSameEpisodeTitle(filteredTmpEpisodes);
        
        log("debug", "过滤后的集标题", filteredEpisodes.map(episode => episode.episodeTitle));

        // 匹配集数 (注意：findEpisodeByNumber 已增强支持模糊平台匹配)
        matchedEpisode = findEpisodeByNumber(filteredEpisodes, episode, platform);
    } else {
        // 电影模式逻辑
        if (bangumiEpisodes.length > 0) {
            if (platform) {
                // 在剧集列表中寻找匹配特定平台的资源
                const targetEp = bangumiEpisodes.find(ep => {
                    const epTitlePlatform = extractEpisodeTitle(ep.episodeTitle);
                    return getPlatformMatchScore(epTitlePlatform, platform) > 0;
                });
                
                if (targetEp) {
                    matchedEpisode = targetEp;
                }
            } else {
                matchedEpisode = bangumiEpisodes[0];
            }
        }
    }

    // 3. 匹配结果处理与评分比较
    if (matchedEpisode) {
        // 计算当前匹配的得分
        const actualPlatform = extractPlatformFromTitle(anime.animeTitle) || anime.source;
        let currentScore = 0;
        
        if (platform) {
            // 如果指定了平台偏好，计算匹配得分
            currentScore = getPlatformMatchScore(actualPlatform, platform);
        } else {
            // 如果没有指定平台偏好，默认为 1
            currentScore = 1;
        }

        // 比较并更新最佳结果
        // 逻辑：如果有更好的分数，或者之前没有匹配到任何结果，则更新
        if (currentScore > bestRes.score) {
             bestRes = {
                anime: anime,
                episode: matchedEpisode,
                score: currentScore
            };
        }

        // 如果没有指定平台偏好 (platform 为空)，则保持原版行为：
        // 找到第一个符合条件的就立刻返回，不进行后续比较
        if (!platform) {
            break; 
        }
        
        // 如果指定了平台偏好，则继续循环查找是否有得分更高的源（最小杂质匹配）
    }
  }

  return { resEpisode: bestRes.episode, resAnime: bestRes.anime };
}

async function fallbackMatchAniAndEp(searchData, req, season, episode, year, resEpisode, resAnime) {
  for (const anime of searchData.animes) {
    // 年份匹配优先（如果提供了年份）
    if (year && !matchYear(anime, year)) {
      log("debug", `Fallback: Year mismatch: anime year ${extractYear(anime.animeTitle)} vs query year ${year}`);
      continue;
    }
    
    const bangumiId = anime.bangumiId || anime.animeId;
    let originBangumiUrl = new URL(req.url.replace("/match", `bangumi/${bangumiId}`));
    const bangumiRes = await getBangumi(originBangumiUrl.pathname);
    const bangumiData = await bangumiRes.json();
    if (!bangumiData?.success || !Array.isArray(bangumiData?.bangumi?.episodes) || bangumiData.bangumi.episodes.length === 0) {
      log("warn", `[fallbackMatchAniAndEp] 跳过无效 bangumi: ${bangumiId} / ${anime.animeTitle}`);
      continue;
    }
    const bangumiEpisodes = bangumiData.bangumi.episodes;
    log("debug", "[fallbackMatchAniAndEp] bangumi摘要", {
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      episodeCount: bangumiEpisodes.length
    });
    if (season && episode) {
      // 过滤集标题正则条件的 episode
      const filteredTmpEpisodes = globals.enableAnimeEpisodeFilter
        ? bangumiEpisodes.filter(curEpisode => !globals.episodeTitleFilter.test(curEpisode.episodeTitle))
        : bangumiEpisodes;

      // 过滤集标题一致的 episode，且保留首次出现的集标题的 episode
      const filteredEpisodes = filterSameEpisodeTitle(filteredTmpEpisodes);

      // 使用新的集数匹配策略
      const matchedEpisode = findEpisodeByNumber(filteredEpisodes, episode, null);
      if (matchedEpisode) {
        resEpisode = matchedEpisode;
        resAnime = anime;
        break;
      }
    } else {
      if (bangumiEpisodes.length > 0) {
        resEpisode = bangumiEpisodes[0];
        resAnime = anime;
        break;
      }
    }
  }
  return {resEpisode, resAnime};
}

export async function extractTitleSeasonEpisode(cleanFileName) {
  const regex = /^(.+?)[.\s]+S(\d+)E(\d+)/i;
  const match = cleanFileName.match(regex);

  let title, season, episode, year;

  if (match) {
    // 匹配到 S##E## 格式
    title = match[1].trim();
    season = parseInt(match[2], 10);
    episode = parseInt(match[3], 10);

    // ============ 提取年份 =============
    // 从文件名中提取年份（支持多种格式：.2009、.2024、(2009)、(2024) 等）
    const yearMatch = cleanFileName.match(/(?:\.|\(|（)((?:19|20)\d{2})(?:\)|）|\.|$)/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // ============ 新标题提取逻辑（重点）============
    // 目标：
    // 1. 优先保留最干净、最像剧名的那一段（通常是开头）
    // 2. 支持：纯中文、纯英文、中英混排、带年份的、中文+单个字母（如亲爱的X）
    // 3. 自动去掉后面的年份、技术参数等垃圾

    // 情况1：开头是中文（最常见的中文字幕组文件名）
    const chineseStart = title.match(/^[\u4e00-\u9fa5·]+[^.\r\n]*/); // 允许中文后面紧跟非.符号，如 亲爱的X、宇宙Marry Me?
    if (chineseStart) {
      title = chineseStart[0];
    }
    // 情况2：开头是英文（欧美剧常见，如 Blood.River）
    else if (/^[A-Za-z0-9]/.test(title)) {
      // 从开头一直取到第一个明显的技术字段或年份之前
      const engMatch = title.match(/^([A-Za-z0-9.&\s]+?)(?=\.\d{4}|$)/);
      if (engMatch) {
        title = engMatch[1].trim().replace(/[._]/g, ' '); // Blood.River → Blood River（也可以保留.看你喜好）
        // 如果你想保留原样点号，就去掉上面这行 replace
      }
    }
    // 情况3：中文+英文混排（如 爱情公寓.ipartment.2009）
    else {
      // 先尝试取到第一个年份或分辨率之前的所有内容，再优先保留中文开头部分
      const beforeYear = title.split(/\.(?:19|20)\d{2}|2160p|1080p|720p|H265|iPhone/)[0];
      const chineseInMixed = beforeYear.match(/^[\u4e00-\u9fa5·]+/);
      title = chineseInMixed ? chineseInMixed[0] : beforeYear.trim();
    }

    // 最后再保险清理一次常见的年份尾巴（防止漏网）
    title = title.replace(/\.\d{4}$/i, '').trim();
  } else {
    // 没有 S##E## 格式，尝试提取第一个片段作为标题
    // 匹配第一个中文/英文标题部分（在年份、分辨率等技术信息之前）
    const titleRegex = /^([^.\s]+(?:[.\s][^.\s]+)*?)(?:[.\s](?:\d{4}|(?:19|20)\d{2}|\d{3,4}p|S\d+|E\d+|WEB|BluRay|Blu-ray|HDTV|DVDRip|BDRip|x264|x265|H\.?264|H\.?265|AAC|AC3|DDP|TrueHD|DTS|10bit|HDR|60FPS))/i;
    const titleMatch = cleanFileName.match(titleRegex);

    title = titleMatch ? titleMatch[1].replace(/[._]/g, ' ').trim() : cleanFileName;
    season = null;
    episode = null;
    
    // 从文件名中提取年份
    const yearMatch = cleanFileName.match(/(?:\.|\(|（)((?:19|20)\d{2})(?:\)|）|\.|$)/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }
  }

  // 如果外语标题转换中文开关已开启，则尝试获取中文标题
  if (globals.titleToChinese) {
    // 如果title中包含.，则用空格替换
    title = await getTMDBChineseTitle(title.replace('.', ' '), season, episode);
  }

  log("info", "Parsed title, season, episode, year", {title, season, episode, year});
  return {title, season, episode, year};
}

// Extracted function for POST /api/v2/match
export async function matchAnime(url, req) {
  let body;
  try {
    // 获取请求体
    body = await req.json();
  } catch (error) {
    log("error", `Failed to parse request body: ${error.message}`);
    return jsonResponse(
      { errorCode: 400, success: false, errorMessage: "Invalid JSON body" },
      400
    );
  }

  try {
    // 验证请求体是否有效
    if (!body) {
      log("error", "Request body is empty");
      return jsonResponse(
        { errorCode: 400, success: false, errorMessage: "Empty request body" },
        400
      );
    }

    // 处理请求体中的数据
    // 假设请求体包含一个字段，比如 { query: "anime name" }
    const { fileName } = body;
    if (!fileName) {
      log("error", "Missing fileName parameter in request body");
      return jsonResponse(
        { errorCode: 400, success: false, errorMessage: "Missing fileName parameter" },
        400
      );
    }

    // 解析fileName，提取平台偏好
    const { cleanFileName, preferredPlatform } = parseFileName(fileName);
    log("info", `Processing anime match for query: ${fileName}`);
    log("info", `Parsed cleanFileName: ${cleanFileName}, preferredPlatform: ${preferredPlatform}`);

    let {title, season, episode, year} = await extractTitleSeasonEpisode(cleanFileName);

    // 使用剧名映射表转换剧名
    if (globals.titleMappingTable && globals.titleMappingTable.size > 0) {
      const mappedTitle = globals.titleMappingTable.get(title);
      if (mappedTitle) {
        title = mappedTitle;
        log("info", `Title mapped from original: ${url.searchParams.get("keyword")} to: ${title}`);
      }
    }

    // 如果启用了搜索关键字繁转简，则进行转换
    if (globals.animeTitleSimplified) {
      const simplifiedTitle = simplized(title);
      log("info", `matchAnime converted traditional to simplified: ${title} -> ${simplifiedTitle}`);
      title = simplifiedTitle;
    }

    // 获取prefer animeIdgetPreferAnimeId
    const [preferAnimeId, preferSource] = getPreferAnimeId(title);
    log("info", `prefer animeId: ${preferAnimeId} from ${preferSource}`);

    // 根据指定平台创建动态平台顺序
    const dynamicPlatformOrder = createDynamicPlatformOrder(preferredPlatform);
    log("info", "Original platformOrderArr:", globals.platformOrderArr);
    log("info", "Dynamic platformOrder:", dynamicPlatformOrder);
    log("info", `Preferred platform: ${preferredPlatform || 'none'}`);

    let resAnime;
    let resEpisode;

    // 快速路径：命中上次选择且本地缓存有链接时，直接匹配剧集，避免全源搜索
    const fastMatched = tryFastMatchFromPreferCache({
      title,
      season,
      episode,
      year,
      preferAnimeId,
      preferSource,
      preferredPlatform: preferredPlatform || dynamicPlatformOrder[0] || null
    });
    if (fastMatched.resAnime && fastMatched.resEpisode) {
      resAnime = fastMatched.resAnime;
      resEpisode = fastMatched.resEpisode;
      log("info", `[FastMatch] 使用偏好缓存命中: ${resAnime.animeTitle}; episode: ${resEpisode.episodeTitle}`);
      log("info", `[AI匹配] 已跳过，原因：${getAiReasonText("fast_match_cache_hit")}`);
    } else {
      let originSearchUrl = new URL(req.url.replace("/match", `/search/anime?keyword=${title}`));
      log("info", `[matchAnime] 开始搜索候选: title=${title}`);
      const searchRes = await searchAnime(originSearchUrl, preferAnimeId, preferSource);
      const searchData = await searchRes.json();
      const rawAnimes = Array.isArray(searchData?.animes) ? searchData.animes : [];
      log("info", `[matchAnime] 搜索候选数量: ${rawAnimes.length}`);

      // 过滤失效候选，避免列表里有条目但全局池中已不存在
      const globalAnimeIds = new Set((globals.animes || []).map(item => String(item?.animeId)));
      const globalBangumiIds = new Set((globals.animes || []).map(item => String(item?.bangumiId)));
      const validAnimes = rawAnimes.filter(anime => {
        const animeId = String(anime?.animeId ?? '');
        const bangumiId = String(anime?.bangumiId ?? '');
        return globalAnimeIds.has(animeId) || globalBangumiIds.has(bangumiId);
      });
      if (validAnimes.length !== rawAnimes.length) {
        log("info", `[matchAnime] 已过滤失效候选: ${rawAnimes.length} -> ${validAnimes.length}`);
      }
      searchData.animes = validAnimes;
      log("info", `[matchAnime] 有效候选数量: ${searchData.animes.length}`);

      if (searchData.animes.length > 0) {
        // 尝试使用AI进行匹配
        const aiPreferredPlatform = preferredPlatform || dynamicPlatformOrder.find(Boolean) || null;
        log("info", `[AI匹配] 开始请求：候选数=${searchData.animes.length}；偏好平台=${aiPreferredPlatform || "无"}`);
        const aiStartTime = Date.now();
        const aiMatchResult = await matchAniAndEpByAi(season, episode, year, searchData, title, req, dynamicPlatformOrder, preferAnimeId, aiPreferredPlatform);
        const aiLatencyMs = Date.now() - aiStartTime;
        const aiMatched = Boolean(aiMatchResult.resAnime && aiMatchResult.resEpisode);
        const aiReasonText = getAiReasonText(aiMatchResult.reason);
        log("info", `[AI匹配] 结果：${aiMatched ? "命中" : "未命中"}；原因：${aiReasonText}；耗时：${aiLatencyMs}ms；候选数：${searchData?.animes?.length || 0}；偏好平台：${aiPreferredPlatform || "无"}`);
        if (aiMatched) {
          resAnime = aiMatchResult.resAnime;
          resEpisode = aiMatchResult.resEpisode;
          log("info", `AI 匹配命中: ${resAnime.animeTitle}; 剧集: ${resEpisode.episodeTitle}`);
        } else {
          if (aiMatchResult.resAnime && !aiMatchResult.resEpisode) {
            log("warn", `AI 已选中动漫但未命中剧集，回退常规匹配: ${aiMatchResult.resAnime.animeTitle}`);
          }
          if (shouldSkipFallbackByAiResult(aiMatchResult)) {
            log("info", `[AI匹配] 已启用AI结果信任，跳过常规兜底；原因：${aiReasonText}`);
          } else {
            log("info", `[AI匹配] 未命中，进入常规匹配流程`);
            // AI匹配失败或未配置，使用传统匹配方式
            log("info", `[常规匹配] 平台尝试顺序: ${JSON.stringify(dynamicPlatformOrder)}`);
            for (const platform of dynamicPlatformOrder) {
              const __ret = await matchAniAndEp(season, episode, year, searchData, title, req, platform, preferAnimeId);
              resEpisode = __ret.resEpisode;
              resAnime = __ret.resAnime;

              if (resAnime) {
                log("info", `Found match with platform: ${platform || 'default'}`);
                break;
              }
            }

            // 如果都没有找到则返回第一个满足剧集数的剧集
            if (!resAnime) {
              log("info", `[常规匹配] 未命中，进入最终兜底匹配`);
              const __ret = await fallbackMatchAniAndEp(searchData, req, season, episode, year, resEpisode, resAnime);
              resEpisode = __ret.resEpisode;
              resAnime = __ret.resAnime;
              if (resAnime) {
                log("info", `[兜底匹配] 命中: ${resAnime.animeTitle}`);
              } else {
                log("info", `[兜底匹配] 未命中`);
              }
            }
          }
        }
      } else {
        log("info", "[matchAnime] 无可用候选，跳过 AI 与回退匹配");
      }
    }

    let resData = {
      "errorCode": 0,
      "success": true,
      "errorMessage": "",
      "isMatched": false,
      "matches": []
    };

    if (resEpisode) {
      resData["isMatched"] = true;
      resData["matches"] = [
        AnimeMatch.fromJson({
          "episodeId": resEpisode.episodeId,
          "animeId": resAnime.animeId,
          "animeTitle": resAnime.animeTitle,
          "episodeTitle": resEpisode.episodeTitle,
          "type": resAnime.type,
          "typeDescription": resAnime.typeDescription,
          "shift": 0,
          "imageUrl": resAnime.imageUrl
        })
      ]
    }

    log("info", "resMatchData:", resData);

    // 示例返回
    return jsonResponse(resData);
  } catch (error) {
    // 匹配过程异常
    log("error", `Match anime failed: ${error.message}`);
    return jsonResponse(
      { errorCode: 500, success: false, errorMessage: "Match process failed" },
      500
    );
  }
}

// Extracted function for GET /api/v2/search/episodes
export async function searchEpisodes(url) {
  let anime = url.searchParams.get("anime");
  const episode = url.searchParams.get("episode") || "";

  // 如果启用了搜索关键字繁转简，则进行转换
  if (globals.animeTitleSimplified) {
    const simplifiedTitle = simplized(anime);
    log("debug", `searchEpisodes converted traditional to simplified: ${anime} -> ${simplifiedTitle}`);
    anime = simplifiedTitle;
  }

  log("debug", `Search episodes with anime: ${anime}, episode: ${episode}`);

  if (!anime) {
    log("error", "Missing anime parameter");
    return jsonResponse(
      { errorCode: 400, success: false, errorMessage: "Missing anime parameter" },
      400
    );
  }

  // 先搜索动漫
  let searchUrl = new URL(`/search/anime?keyword=${anime}`, url.origin);
  const searchRes = await searchAnime(searchUrl);
  const searchData = await searchRes.json();

  if (!searchData.success || !searchData.animes || searchData.animes.length === 0) {
    log("info", "No anime found for the given title");
    return jsonResponse({
      errorCode: 0,
      success: true,
      errorMessage: "",
      hasMore: false,
      animes: []
    });
  }

  let resultAnimes = [];

  // 遍历所有找到的动漫，获取它们的集数信息
  for (const animeItem of searchData.animes) {
    const bangumiUrl = new URL(`/bangumi/${animeItem.bangumiId}`, url.origin);
    const bangumiRes = await getBangumi(bangumiUrl.pathname);
    const bangumiData = await bangumiRes.json();

    if (bangumiData.success && bangumiData.bangumi && bangumiData.bangumi.episodes) {
      let filteredEpisodes = bangumiData.bangumi.episodes;

      // 根据 episode 参数过滤集数
      if (episode) {
        if (episode === "movie") {
          // 仅保留剧场版结果
          filteredEpisodes = bangumiData.bangumi.episodes.filter(ep =>
            animeItem.typeDescription && (
              animeItem.typeDescription.includes("电影") ||
              animeItem.typeDescription.includes("剧场版") ||
              ep.episodeTitle.toLowerCase().includes("movie") ||
              ep.episodeTitle.includes("剧场版")
            )
          );
        } else if (/^\d+$/.test(episode)) {
          // 纯数字，仅保留指定集数
          const targetEpisode = parseInt(episode);
          filteredEpisodes = bangumiData.bangumi.episodes.filter(ep =>
            parseInt(ep.episodeNumber) === targetEpisode
          );
        }
      }

      // 只有当过滤后还有集数时才添加到结果中
      if (filteredEpisodes.length > 0) {
        resultAnimes.push(Episodes.fromJson({
          animeId: animeItem.animeId,
          animeTitle: animeItem.animeTitle,
          type: animeItem.type,
          typeDescription: animeItem.typeDescription,
          episodes: filteredEpisodes.map(ep => ({
            episodeId: ep.episodeId,
            episodeTitle: ep.episodeTitle
          }))
        }));
      }
    }
  }

  log("info", `Found ${resultAnimes.length} animes with filtered episodes`);

  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    animes: resultAnimes
  });
}

// Extracted function for GET /api/v2/bangumi/:animeId
export async function getBangumi(path) {
  const idParam = path.split("/").pop();
  const animeId = parseInt(idParam);

  // 尝试通过 animeId(数字) 或 bangumiId(字符串) 查找
  let anime;
  if (!isNaN(animeId)) {
    // 如果是有效数字,先尝试通过 animeId 查找
    anime = globals.animes.find((a) => a.animeId.toString() === animeId.toString());
  }

  // 如果通过 animeId 未找到,尝试通过 bangumiId 查找
  if (!anime) {
    anime = globals.animes.find((a) => a.bangumiId === idParam);
  }

  if (!anime) {
    log("error", `Anime with ID ${idParam} not found`);
    return jsonResponse(
      { errorCode: 404, success: false, errorMessage: "Anime not found", bangumi: null },
      404
    );
  }
  log("info", `Fetched details for anime ID: ${idParam}`);

  // 构建 episodes 列表
  let episodesList = [];
  for (let i = 0; i < anime.links.length; i++) {
    const link = anime.links[i];
    episodesList.push({
      seasonId: `season-${anime.animeId}`,
      episodeId: link.id,
      episodeTitle: `${link.title}`,
      episodeNumber: `${i+1}`,
      airDate: anime.startDate,
    });
  }

  // 如果启用了集标题过滤，则应用过滤
  if (globals.enableAnimeEpisodeFilter) {
    episodesList = episodesList.filter(episode => {
      return !globals.episodeTitleFilter.test(episode.episodeTitle);
    });
    log("debug", `[getBangumi] Episode filter enabled. Filtered episodes: ${episodesList.length}/${anime.links.length}`);

    // 如果过滤后没有有效剧集，返回错误
    if (episodesList.length === 0) {
      log("warn", `[getBangumi] No valid episodes after filtering for anime ID ${idParam}`);
      return jsonResponse(
        { errorCode: 404, success: false, errorMessage: "No valid episodes after filtering", bangumi: null },
        404
      );
    }

    // 重新排序episodeNumber
    episodesList = episodesList.map((episode, index) => ({
      ...episode,
      episodeNumber: `${index+1}`
    }));
  }

  const bangumi = Bangumi.fromJson({
    animeId: anime.animeId,
    bangumiId: anime.bangumiId,
    animeTitle: anime.animeTitle,
    imageUrl: anime.imageUrl,
    isOnAir: true,
    airDay: 1,
    isFavorited: anime.isFavorited,
    rating: anime.rating,
    type: anime.type,
    typeDescription: anime.typeDescription,
    seasons: [
      {
        id: `season-${anime.animeId}`,
        airDate: anime.startDate,
        name: "Season 1",
        episodeCount: anime.episodeCount,
      },
    ],
    episodes: episodesList,
  });

  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    bangumi: bangumi
  });
}

/**
 * 处理聚合源弹幕获取
 * @param {string} url 聚合URL
 * @returns {Promise<Array>} 合并后的弹幕列表
 */
async function fetchMergedComments(url, offsetContext = {}) {
  const parts = url.split(MERGE_DELIMITER);
  const sourceNames = parts.map(part => part.split(':')[0]).filter(Boolean);
  const sourceTag = sourceNames.join('＆');
  const { animeTitle, episodeTitle } = offsetContext || {};

  log("info", `[Merge] 开始获取 [${sourceTag}] 聚合弹幕...`);

  // 1. 检查聚合缓存
  const cached = getCommentCache(url);
  if (cached) {
    log("info", `[Merge] 命中缓存 [${sourceTag}]，返回 ${cached.length} 条`);
    return cached;
  }

  const stats = {};
  
  // 2. 并行获取所有源的弹幕
  const tasks = parts.map(async (part) => {
    const firstColonIndex = part.indexOf(':');
    if (firstColonIndex === -1) return [];

    const sourceName = part.substring(0, firstColonIndex);
    const realId = part.substring(firstColonIndex + 1);

    if (!sourceName || !realId) return [];

    // 构建去重Key
    const pendingKey = `${sourceName}:${realId}`;

    // 检查是否有正在进行的相同请求（请求合并）
    if (PENDING_DANMAKU_REQUESTS.has(pendingKey)) {
        log("info", `[Merge] 复用正在进行的请求: ${pendingKey}`);
        try {
            const list = await PENDING_DANMAKU_REQUESTS.get(pendingKey);
            return list || [];
        } catch (e) {
            return [];
        }
    }

    // 定义请求任务
    const fetchTask = (async () => {
        let sourceInstance = null;

        if (sourceName === 'renren') sourceInstance = renrenSource;
        else if (sourceName === 'hanjutv') sourceInstance = hanjutvSource;
        else if (sourceName === 'bahamut') sourceInstance = bahamutSource;
        else if (sourceName === 'dandan') sourceInstance = dandanSource;
        else if (sourceName === 'tencent') sourceInstance = tencentSource;
        else if (sourceName === 'youku') sourceInstance = youkuSource;
        else if (sourceName === 'iqiyi') sourceInstance = iqiyiSource;
        else if (sourceName === 'imgo') sourceInstance = mangoSource;
        else if (sourceName === 'bilibili') sourceInstance = bilibiliSource;
        else if (sourceName === 'migu') sourceInstance = miguSource;
        else if (sourceName === 'sohu') sourceInstance = sohuSource;
        else if (sourceName === 'leshi') sourceInstance = leshiSource;
        else if (sourceName === 'xigua') sourceInstance = xiguaSource;
        else if (sourceName === 'maiduidui') sourceInstance = maiduiduiSource;
        else if (sourceName === 'animeko') sourceInstance = animekoSource;
        // 如有新增允许的源合并，在此处添加

        if (sourceInstance) {
          try {
            // 获取原始数据 -> 格式化
            const raw = await sourceInstance.getEpisodeDanmu(realId);
            let formatted = sourceInstance.formatComments(raw);
            const offsetSeconds = resolveTimelineOffsetSeconds({
              animeTitle,
              episodeTitle,
              source: sourceName
            });
            formatted = applyOffsetToFormattedComments(formatted, offsetSeconds);
            stats[sourceName] = formatted.length;
            return formatted;
          } catch (e) {
            log("error", `[Merge] 获取 ${sourceName} 失败: ${e.message}`);
            stats[sourceName] = 0;
            return [];
          }
        }
        return [];
    })();

    // 将任务加入队列
    PENDING_DANMAKU_REQUESTS.set(pendingKey, fetchTask);

    try {
        return await fetchTask;
    } finally {
        // 任务完成后移除队列
        PENDING_DANMAKU_REQUESTS.delete(pendingKey);
    }
  });

  // 等待所有源请求完成
  const results = await Promise.all(tasks);
  
  // 3. 合并数据
  let mergedList = [];
  results.forEach(list => {
    mergedList = mergeDanmakuList(mergedList, list);
  });

  const statDetails = Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', ');
  log("info", `[Merge] 聚合原始数据完成: 总计 ${mergedList.length} 条 (${statDetails})`);

  // 4. 统一处理（去重、过滤、转JSON）
  return convertToDanmakuJson(mergedList, sourceTag);
}

// Extracted function for GET /api/v2/comment/:commentId
export async function getComment(path, queryFormat, segmentFlag) {
  const commentId = parseInt(path.split("/").pop());
  let url = findUrlById(commentId);
  let title = findTitleById(commentId);
  let plat = title ? (title.match(/【(.*?)】/) || [null])[0]?.replace(/[【】]/g, '') : null;
  const [animeId, source] = findAnimeIdByCommentId(commentId);
  const animeTitle = animeId ? (globals.animes.find(anime => anime.animeId === animeId)?.animeTitle || '') : '';
  const offsetSeconds = resolveTimelineOffsetSeconds({
    animeTitle,
    episodeTitle: title,
    platform: plat,
    source
  });
  log("debug", "comment url...", url);
  log("debug", "comment title...", title);
  log("debug", "comment platform...", plat);
  if (!url) {
    log("error", `Comment with ID ${commentId} not found`);
    return jsonResponse({ count: 0, comments: [] }, 404);
  }
  log("debug", `Fetched comment ID: ${commentId}`);

  // 检查弹幕缓存（分片列表请求不走弹幕缓存）
  const cachedComments = !segmentFlag ? getCommentCache(url) : null;
  if (cachedComments !== null) {
    const responseData = { count: cachedComments.length, comments: cachedComments };
    return formatDanmuResponse(responseData, queryFormat);
  }

  log("debug", "开始从本地请求弹幕...", url);
  const pendingKey = `comment:${url}|seg:${segmentFlag ? 1 : 0}`;
  let danmus = await withPendingCommentRequest(pendingKey, async () => {
    let fetchedDanmus = [];

    if (url && url.includes(MERGE_DELIMITER)) {
      fetchedDanmus = await fetchMergedComments(url, { animeTitle, episodeTitle: title });
    } else {
      if (url.includes('.qq.com')) {
        fetchedDanmus = await tencentSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.iqiyi.com')) {
        fetchedDanmus = await iqiyiSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.mgtv.com')) {
        fetchedDanmus = await mangoSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.bilibili.com') || url.includes('b23.tv')) {
        // 如果是 b23.tv 短链接，先解析为完整 URL
        if (url.includes('b23.tv')) {
          url = await bilibiliSource.resolveB23Link(url);
        }
        fetchedDanmus = await bilibiliSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.youku.com')) {
        fetchedDanmus = await youkuSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.miguvideo.com')) {
        fetchedDanmus = await miguSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.sohu.com')) {
        fetchedDanmus = await sohuSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.le.com')) {
        fetchedDanmus = await leshiSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.douyin.com') || url.includes('.ixigua.com')) {
        fetchedDanmus = await xiguaSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      } else if (url.includes('.mddcloud.com.cn')) {
        fetchedDanmus = await maiduiduiSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
      }

      // 请求其他平台弹幕
      const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(\/.*)?$/i;
      if (!urlPattern.test(url)) {
        if (plat === "renren") {
          fetchedDanmus = await renrenSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
        } else if (plat === "hanjutv") {
          fetchedDanmus = await hanjutvSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
        } else if (plat === "bahamut") {
          fetchedDanmus = await bahamutSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
        } else if (plat === "dandan") {
          fetchedDanmus = await dandanSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
        } else if (plat === "custom") {
          fetchedDanmus = await customSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
        } else if (plat === "animeko") {
          fetchedDanmus = await animekoSource.getComments(url, plat, segmentFlag, null, offsetSeconds);
        }
      }

      // 如果弹幕为空，则请求第三方弹幕服务器作为兜底
      if ((!fetchedDanmus || fetchedDanmus.length === 0) && urlPattern.test(url)) {
        fetchedDanmus = await otherSource.getComments(url, "other_server", segmentFlag, null, offsetSeconds);
      }
    }

    return fetchedDanmus;
  });

  if (animeId && source) {
    setPreferByAnimeId(animeId, source);
    if (globals.localCacheValid && animeId) {
        writeCacheToFile('lastSelectMap', Object.fromEntries(globals.lastSelectMap));
    }
    if (globals.redisValid && animeId) {
        setRedisKey('lastSelectMap', globals.lastSelectMap).catch(e => log("error", "Redis set error", e));
    }
  }

  // 分片列表请求：直接返回分片信息（不做 count/comments 包装，也不走 XML）
  if (segmentFlag) {
    return jsonResponse(danmus);
  }

  // 缓存弹幕结果
  if (!segmentFlag) {
    if (danmus && danmus.comments) danmus = danmus.comments;
    if (!Array.isArray(danmus)) danmus = [];
    if (danmus.length > 0) {
        setCommentCache(url, danmus);
    }
  }

  const responseData = { count: danmus.length, comments: danmus };
  return formatDanmuResponse(responseData, queryFormat);
}

// Extracted function for GET /api/v2/comment?url=xxx
export async function getCommentByUrl(videoUrl, queryFormat, segmentFlag) {
  try {
    const validation = await validateExternalUrl(videoUrl);
    if (!validation.ok) {
      return validation.response;
    }
    const originalUrl = validation.normalizedUrl;

    log("debug", `Processing comment request for URL: ${originalUrl}`);

    let url = originalUrl;

    // 仅在“非分片列表”模式下启用弹幕缓存
    if (!segmentFlag) {
      const cachedComments = getCommentCache(url);
      if (cachedComments !== null) {
        const responseData = {
          errorCode: 0,
          success: true,
          errorMessage: "",
          count: cachedComments.length,
          comments: cachedComments
        };
        return formatDanmuResponse(responseData, queryFormat);
      }
    }

    log("debug", "开始从本地请求弹幕...", url);

    // 根据URL域名判断平台并获取弹幕
    let danmus = [];

    // b23 解析（用于缓存与后续请求）
    let resolvedUrl = url;

    const findOffsetContextByUrls = (candidateUrls) => {
      for (const candidateUrl of candidateUrls) {
        if (!candidateUrl) continue;
        for (const anime of globals.animes || []) {
          const link = (anime.links || []).find(item => item.url === candidateUrl);
          if (link) {
            return {
              animeTitle: anime.animeTitle || '',
              episodeTitle: link.title || ''
            };
          }
        }
      }
      return { animeTitle: '', episodeTitle: '' };
    };

    const resolveOffsetSecondsForPlatform = (platform, candidateUrls) => {
      const { animeTitle, episodeTitle } = findOffsetContextByUrls(candidateUrls);
      return resolveTimelineOffsetSeconds({ animeTitle, episodeTitle, platform });
    };

    if (url.includes('.qq.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('qq', [url]);
      danmus = await tencentSource.getComments(url, "qq", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.iqiyi.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('qiyi', [url]);
      danmus = await iqiyiSource.getComments(url, "qiyi", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.mgtv.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('imgo', [url]);
      danmus = await mangoSource.getComments(url, "imgo", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.bilibili.com') || url.includes('b23.tv')) {
      if (url.includes('b23.tv')) {
        resolvedUrl = await bilibiliSource.resolveB23Link(url);
        const resolvedValidation = await validateExternalUrl(resolvedUrl);
        if (!resolvedValidation.ok) {
          return resolvedValidation.response;
        }
        resolvedUrl = resolvedValidation.normalizedUrl;
      }
      const offsetSeconds = resolveOffsetSecondsForPlatform('bilibili1', [resolvedUrl, url]);
      danmus = await bilibiliSource.getComments(resolvedUrl, "bilibili1", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.youku.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('youku', [url]);
      danmus = await youkuSource.getComments(url, "youku", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.miguvideo.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('migu', [url]);
      danmus = await miguSource.getComments(url, "migu", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.sohu.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('sohu', [url]);
      danmus = await sohuSource.getComments(url, "sohu", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.le.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('leshi', [url]);
      danmus = await leshiSource.getComments(url, "leshi", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.douyin.com') || url.includes('.ixigua.com')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('xigua', [url]);
      danmus = await xiguaSource.getComments(url, "xigua", segmentFlag, null, offsetSeconds);
    } else if (url.includes('.mddcloud.com.cn')) {
      const offsetSeconds = resolveOffsetSecondsForPlatform('maiduidui', [url]);
      danmus = await maiduiduiSource.getComments(url, "maiduidui", segmentFlag, null, offsetSeconds);
    } else {
      // 如果不是已知平台，尝试第三方弹幕服务器
      const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(\/.*)?$/i;
      if (urlPattern.test(url)) {
        const offsetSeconds = resolveOffsetSecondsForPlatform('other_server', [url]);
        danmus = await otherSource.getComments(url, "other_server", segmentFlag, null, offsetSeconds);
      }
    }

    // 分片列表请求：直接返回分片信息（不做 count/comments 包装，也不走 XML）
    if (segmentFlag) {
      return jsonResponse(danmus);
    }

    // 兜底：确保为数组
    if (danmus && danmus.comments) danmus = danmus.comments;
    if (!Array.isArray(danmus)) danmus = [];

    log("debug", `Successfully fetched ${danmus.length} comments from URL`);

    // 缓存弹幕结果（b23 短链同时缓存原始URL与解析后的URL，避免重复解析）
    if (danmus.length > 0) {
      setCommentCache(resolvedUrl || url, danmus);
      if (originalUrl !== (resolvedUrl || url)) {
        setCommentCache(originalUrl, danmus);
      }
    }

    const responseData = {
      errorCode: 0,
      success: true,
      errorMessage: "",
      count: danmus.length,
      comments: danmus
    };
    return formatDanmuResponse(responseData, queryFormat);
  } catch (error) {
    log("error", `Failed to process comment by URL request: ${error.message}`);
    return jsonResponse(
      { errorCode: 500, success: false, errorMessage: "Internal server error", count: 0, comments: [] },
      500
    );
  }
}

// Extracted function for GET /api/v2/segmentcomment
export async function getSegmentComment(segment, queryFormat) {
  try {
    let url = segment.url;
    let platform = segment.type;

    const validation = await validateExternalUrl(url);
    if (!validation.ok) {
      return validation.response;
    }
    url = validation.normalizedUrl;
    segment.url = url;

    log("debug", `Processing segment comment request for URL: ${url}`);

    // 检查弹幕缓存
    const cachedComments = getCommentCache(url);
    if (cachedComments !== null) {
      const responseData = {
        errorCode: 0,
        success: true,
        errorMessage: "",
        count: cachedComments.length,
        comments: cachedComments
      };
      return formatDanmuResponse(responseData, queryFormat);
    }

    log("debug", `开始从本地请求分段弹幕... URL: ${url}`);
    let danmus = [];

    // 根据平台调用相应的分段弹幕获取方法
    if (platform === "qq") {
      danmus = await tencentSource.getSegmentComments(segment);
    } else if (platform === "qiyi") {
      danmus = await iqiyiSource.getSegmentComments(segment);
    } else if (platform === "imgo") {
      danmus = await mangoSource.getSegmentComments(segment);
    } else if (platform === "bilibili1") {
      danmus = await bilibiliSource.getSegmentComments(segment);
    } else if (platform === "youku") {
      danmus = await youkuSource.getSegmentComments(segment);
    } else if (platform === "migu") {
      danmus = await miguSource.getSegmentComments(segment);
    } else if (platform === "sohu") {
      danmus = await sohuSource.getSegmentComments(segment);
    } else if (platform === "leshi") {
      danmus = await leshiSource.getSegmentComments(segment);
    } else if (platform === "xigua") {
      danmus = await xiguaSource.getSegmentComments(segment);
    } else if (platform === "maiduidui") {
      danmus = await maiduiduiSource.getSegmentComments(segment);
    } else if (platform === "hanjutv") {
      danmus = await hanjutvSource.getSegmentComments(segment);
    } else if (platform === "bahamut") {
      danmus = await bahamutSource.getSegmentComments(segment);
    } else if (platform === "renren") {
      danmus = await renrenSource.getSegmentComments(segment);
    } else if (platform === "dandan") {
      danmus = await dandanSource.getSegmentComments(segment);
	  } else if (platform === "animeko") {
      danmus = await animekoSource.getSegmentComments(segment);
    } else if (platform === "custom") {
      danmus = await customSource.getSegmentComments(segment);
    } else if (platform === "other_server") {
      danmus = await otherSource.getSegmentComments(segment);
    }

    log("debug", `Successfully fetched ${danmus.length} segment comments from URL`);

    // 缓存弹幕结果
    if (danmus.length > 0) {
      setCommentCache(url, danmus);
    }

    const responseData = {
      errorCode: 0,
      success: true,
      errorMessage: "",
      count: danmus.length,
      comments: danmus
    };
    return formatDanmuResponse(responseData, queryFormat);
  } catch (error) {
    // 处理异常
    log("error", `Failed to process segment comment request: ${error.message}`);
    return jsonResponse(
      { errorCode: 500, success: false, errorMessage: "Internal server error", count: 0, comments: [] },
      500
    );
  }
}
