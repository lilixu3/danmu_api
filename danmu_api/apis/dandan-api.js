import { globals } from '../configs/globals.js';
import { getPageTitle, jsonResponse, httpGet } from '../utils/http-util.js';
import { log } from '../utils/log-util.js'
import { simplized } from '../utils/zh-util.js';
import { setRedisKey, updateRedisCaches } from "../utils/redis-util.js";
import { setLocalRedisKey, updateLocalRedisCaches } from "../utils/local-redis-util.js";
import {
    setCommentCache, addAnime, findAnimeByAnimeId, findAnimeById, findAnimeIdByCommentId,
    findAnimeTitleById, findTitleById, findUrlById, getCommentCache, getPreferAnimeId, getSearchCache,
    removeEarliestAnime, resolveAnimeById, resolveAnimeByIdFromDetailStore, setPreferByAnimeId, setSearchCache,
    storeAnimeIdsToMap, writeCacheToFile, updateLocalCaches, setLastSearch, getLastSearch
} from "../utils/cache-util.js";
import { formatDanmuResponse, convertToDanmakuJson } from "../utils/danmu-util.js";
import { applyOffset, resolveOffsetRule } from "../utils/offset-util.js";
import { extractEpisodeTitle, convertChineseNumber, parseFileName, createDynamicPlatformOrder, normalizeSpaces, stripInvisibleChars, extractYear, titleMatches, extractAnimeInfo, extractSeasonNumberFromAnimeTitle, extractAnimeTitle, normalizeTitleForComparison, sanitizeSearchKeyword, normalizeUnicodeWhitespace, splitTitleAndTrailingSeasonEpisode, preferSeasonCandidatesIfPresent, normalizeTitleCacheKey } from "../utils/common-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { getTMDBChineseTitle } from "../utils/tmdb-util.js";
import { applyMergeLogic, mergeDanmakuList, MERGE_DELIMITER, alignSourceTimelines } from "../utils/merge-util.js";
import { getHanjutvSourceLabel, HANJUTV_FULL_EPISODE_FALLBACK_SEGMENT_DATA } from "../utils/hanjutv-util.js";
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
import AcfunSource from "../sources/acfun.js";
import AiyifanSource from "../sources/aiyifan.js";
import AnimekoSource from "../sources/animeko.js";
import EzdmwSource from "../sources/ezdmw.js";
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
const acfunSource = new AcfunSource();
const aiyifanSource = new AiyifanSource();
const animekoSource = new AnimekoSource();
const ezdmwSource = new EzdmwSource();
const otherSource = new OtherSource();
const doubanSource = new DoubanSource(tencentSource, iqiyiSource, youkuSource, bilibiliSource, miguSource);
const tmdbSource = new TmdbSource(doubanSource);

// 用于聚合请求的去重Map
const PENDING_DANMAKU_REQUESTS = new Map();
// 用于弹幕请求(按集ID/URL)的去重Map
const PENDING_COMMENT_REQUESTS = new Map();
// 用于懒详情物化的去重Map，避免同一条目被并发 /bangumi 请求重复打源
const PENDING_LAZY_DETAIL_MATERIALIZATIONS = new Map();
let nodeDnsLookup = null;

function normalizeDurationValue(rawValue) {
  const duration = Number(rawValue || 0);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration > 6 * 60 * 60 ? duration / 1000 : duration;
}

function shouldIncludeVideoDuration(queryFormat, includeDuration = false) {
  if (!includeDuration) return false;
  const format = String(queryFormat || globals.danmuOutputFormat || 'json').toLowerCase();
  return format === 'json';
}

function buildDanmuResponse(data, videoDuration = null) {
  if (videoDuration === null) return data;
  return { videoDuration, ...data };
}

function buildDurationResponse(videoDuration = 0) {
  return { videoDuration };
}

function extractDurationFromSegments(segmentResult) {
  const explicitDuration = normalizeDurationValue(segmentResult?.duration || segmentResult?.videoDuration || 0);
  if (explicitDuration > 0) return explicitDuration;

  const segmentList = Array.isArray(segmentResult?.segmentList) ? segmentResult.segmentList : [];
  if (!segmentList.length) return 0;

  if (
    segmentResult?.type === 'hanjutv'
    && segmentList.length === 1
    && segmentList[0]?.data === HANJUTV_FULL_EPISODE_FALLBACK_SEGMENT_DATA
  ) {
    return 0;
  }

  let duration = 0;
  segmentList.forEach((segment) => {
    const normalized = normalizeDurationValue(segment?.segment_end || 0);
    if (normalized <= 0) return;
    if (normalized > duration) duration = normalized;
  });

  return duration > 0 ? duration : 0;
}

async function resolveUrlDuration(url) {
  if (/^acfun:\/\//i.test(url)) {
    const { durationMs } = acfunSource.parseEpisodeRef(url);
    return normalizeDurationValue(durationMs);
  }

  try {
    let targetUrl = url;
    let segmentResult = null;

    if (typeof targetUrl !== 'string' || !targetUrl) {
      return 0;
    }

    if (targetUrl.includes('.qq.com')) {
      segmentResult = await tencentSource.getComments(targetUrl, 'qq', true);
    } else if (targetUrl.includes('.iqiyi.com')) {
      segmentResult = await iqiyiSource.getComments(targetUrl, 'qiyi', true);
    } else if (targetUrl.includes('.mgtv.com')) {
      segmentResult = await mangoSource.getComments(targetUrl, 'imgo', true);
    } else if (targetUrl.includes('.bilibili.com') || targetUrl.includes('b23.tv')) {
      if (targetUrl.includes('b23.tv')) {
        targetUrl = await bilibiliSource.resolveB23Link(targetUrl);
      }
      segmentResult = await bilibiliSource.getComments(targetUrl, 'bilibili1', true);
    } else if (targetUrl.includes('.youku.com')) {
      segmentResult = await youkuSource.getComments(targetUrl, 'youku', true);
    } else if (targetUrl.includes('.miguvideo.com')) {
      segmentResult = await miguSource.getComments(targetUrl, 'migu', true);
    } else if (targetUrl.includes('.sohu.com')) {
      segmentResult = await sohuSource.getComments(targetUrl, 'sohu', true);
    } else if (targetUrl.includes('.le.com')) {
      segmentResult = await leshiSource.getComments(targetUrl, 'leshi', true);
    } else if (targetUrl.includes('.douyin.com') || targetUrl.includes('.ixigua.com')) {
      segmentResult = await xiguaSource.getComments(targetUrl, 'xigua', true);
    } else if (targetUrl.includes('.mddcloud.com.cn')) {
      segmentResult = await maiduiduiSource.getComments(targetUrl, 'maiduidui', true);
    } else if (targetUrl.includes('.yfsp.tv')) {
      segmentResult = await aiyifanSource.getComments(targetUrl, 'aiyifan', true);
    } else if (/^https?:\/\//i.test(targetUrl)) {
      const response = await getCommentByUrl(targetUrl, 'json', true);
      if (!response?.ok) return 0;
      segmentResult = await response.json();
    } else {
      return 0;
    }

    return extractDurationFromSegments(segmentResult);
  } catch (error) {
    log('warn', '[Duration] 获取时长失败: ' + error.message);
    return 0;
  }
}

function extractMergedUrls(url) {
  return String(url || '')
    .split(MERGE_DELIMITER)
    .map((part) => {
      const firstColonIndex = part.indexOf(':');
      if (firstColonIndex === -1) return part.trim();
      return part.slice(firstColonIndex + 1).trim();
    })
    .filter(Boolean);
}

async function resolveMergedDuration(url) {
  if (!url) return 0;

  try {
    const targetUrls = url.includes(MERGE_DELIMITER) ? extractMergedUrls(url) : [url];
    const durations = await Promise.all(targetUrls.map(resolveUrlDuration));
    return durations.reduce((maxValue, currentValue) => Math.max(maxValue, currentValue || 0), 0);
  } catch (error) {
    log('warn', '[Duration] 获取时长失败: ' + error.message);
    return 0;
  }
}

function findEpisodeIndexByCommentId(commentId) {
  for (const anime of globals.animes || []) {
    if (!anime || !Array.isArray(anime.links)) continue;
    const index = anime.links.findIndex(link => String(link?.id) === String(commentId));
    if (index !== -1) return index;
  }
  return -1;
}

function buildDanmuOffsetMatchContext({ animeTitle, episodeTitle, source, commentId = null } = {}) {
  if (!animeTitle) return null;

  const { baseTitle, season: detectedSeason, episode: detectedEpisode } = extractAnimeInfo(animeTitle, episodeTitle);
  if (!baseTitle) return null;

  const season = detectedSeason || 1;
  const fallbackEpisodeIndex = commentId !== null ? findEpisodeIndexByCommentId(commentId) : -1;
  const episode = detectedEpisode || (fallbackEpisodeIndex >= 0 ? fallbackEpisodeIndex + 1 : null);

  return {
    anime: baseTitle,
    season: `S${String(season).padStart(2, '0')}`,
    episode: episode ? `E${String(episode).padStart(2, '0')}` : null,
    source
  };
}

function resolveDanmuOffsetRule(context = {}) {
  if (!globals.danmuOffsetRules?.length) return null;
  const matchContext = buildDanmuOffsetMatchContext(context);
  if (!matchContext?.anime) return null;
  return resolveOffsetRule(globals.danmuOffsetRules, matchContext);
}

function resolveSourceInstance(sourceName) {
  if (sourceName === '360') return kan360Source;
  if (sourceName === 'tmdb') return tmdbSource;
  if (sourceName === 'douban') return doubanSource;
  if (sourceName === 'renren') return renrenSource;
  if (sourceName === 'hanjutv') return hanjutvSource;
  if (sourceName === 'bahamut') return bahamutSource;
  if (sourceName === 'dandan') return dandanSource;
  if (sourceName === 'tencent') return tencentSource;
  if (sourceName === 'youku') return youkuSource;
  if (sourceName === 'iqiyi') return iqiyiSource;
  if (sourceName === 'imgo') return mangoSource;
  if (sourceName === 'bilibili') return bilibiliSource;
  if (sourceName === 'migu') return miguSource;
  if (sourceName === 'sohu') return sohuSource;
  if (sourceName === 'leshi') return leshiSource;
  if (sourceName === 'xigua') return xiguaSource;
  if (sourceName === 'maiduidui') return maiduiduiSource;
  if (sourceName === 'acfun') return acfunSource;
  if (sourceName === 'aiyifan') return aiyifanSource;
  if (sourceName === 'animeko') return animekoSource;
  if (sourceName === 'ezdmw') return ezdmwSource;
  if (sourceName === 'custom') return customSource;
  if (sourceName === 'other_server') return otherSource;
  return null;
}

function getLazyDetailDescriptorStore() {
  if (!(globals.lazyDetailDescriptors instanceof Map)) {
    globals.lazyDetailDescriptors = new Map();
  }
  return globals.lazyDetailDescriptors;
}

function isLazyDetailDescriptorExpired(descriptor) {
  const createdAt = Number(descriptor?.createdAt || 0);
  if (!createdAt) return true;
  const ttlMinutes = Number(globals.searchCacheMinutes || 0);
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) return true;
  return (Date.now() - createdAt) / (1000 * 60) > ttlMinutes;
}

function removeLazyDetailDescriptor(descriptor) {
  const store = getLazyDetailDescriptorStore();
  for (const [key, value] of store.entries()) {
    if (value === descriptor) {
      store.delete(key);
    }
  }
}

function buildLazyDescriptorKey(source, id) {
  const normalizedSource = String(source || '').trim().toLowerCase();
  const normalizedId = String(id ?? '').trim();
  if (!normalizedSource || !normalizedId) return null;
  return `${normalizedSource}:${normalizedId}`;
}

function isPositiveSearchCacheWindow() {
  const minutes = Number(globals.searchCacheMinutes);
  return Number.isFinite(minutes) && minutes > 0;
}

function clonePlainAnime(anime) {
  if (!anime || typeof anime !== 'object') return null;
  return {
    ...anime,
    aliases: Array.isArray(anime.aliases) ? [...anime.aliases] : [],
    links: Array.isArray(anime.links) ? anime.links.map(link => ({ ...link })) : [],
  };
}

function buildMergeSourcePairsFingerprint() {
  return JSON.stringify(globals.mergeSourcePairs || []);
}

function buildSourceOrderFingerprint() {
  return JSON.stringify(globals.sourceOrderArr || []);
}

function isDescriptorConfigCompatible(descriptor) {
  if (!descriptor) return false;
  if (descriptor.kind !== 'lazy-merge-detail') return true;
  return descriptor.mergeSourcePairsFingerprint === buildMergeSourcePairsFingerprint()
    && descriptor.sourceOrderFingerprint === buildSourceOrderFingerprint();
}

function getConfiguredMergeSources() {
  const sources = new Set();
  for (const group of globals.mergeSourcePairs || []) {
    if (group?.primary) sources.add(group.primary);
    for (const secondary of group?.secondaries || []) {
      if (secondary) sources.add(secondary);
    }
  }
  return sources;
}

function shouldRunLazyMergeBridge(lazySearch) {
  return lazySearch === true
    && Array.isArray(globals.mergeSourcePairs)
    && globals.mergeSourcePairs.length > 0
    && isPositiveSearchCacheWindow();
}

function cloneLazyDescriptor(descriptor) {
  if (!descriptor) return null;
  return {
    ...descriptor,
    rawCandidate: descriptor.rawCandidate && typeof descriptor.rawCandidate === 'object'
      ? { ...descriptor.rawCandidate }
      : descriptor.rawCandidate,
    identityIds: Array.isArray(descriptor.identityIds) ? [...descriptor.identityIds] : [],
    fullAnime: clonePlainAnime(descriptor.fullAnime),
    componentDescriptors: Array.isArray(descriptor.componentDescriptors)
      ? descriptor.componentDescriptors.map(item => cloneLazyDescriptor(item)).filter(Boolean)
      : [],
  };
}

function findSearchCacheEntry(cacheKey) {
  if (!(globals.searchCache instanceof Map)) return null;
  const candidates = [
    cacheKey,
    normalizeTitleCacheKey(cacheKey) || '',
  ].filter(Boolean);

  for (const key of candidates) {
    if (globals.searchCache.has(key)) {
      return globals.searchCache.get(key);
    }
  }
  return null;
}

function collectLazyDescriptorsForSearchResults(results) {
  if (!Array.isArray(results) || results.length === 0) return [];
  const store = getLazyDetailDescriptorStore();
  const descriptors = [];
  const seen = new Set();

  for (const anime of results) {
    const source = anime?.source;
    const keys = [
      buildLazyDescriptorKey(source, anime?.bangumiId),
      buildLazyDescriptorKey(source, anime?.animeId),
    ].filter(Boolean);

    for (const key of keys) {
      const descriptor = store.get(key);
      if (!descriptor || seen.has(descriptor)) continue;
      seen.add(descriptor);
      descriptors.push(cloneLazyDescriptor(descriptor));
      break;
    }
  }

  return descriptors;
}

function attachLazyDescriptorsToSearchCache(cacheKey, results) {
  const cacheEntry = findSearchCacheEntry(cacheKey);
  if (!cacheEntry) return;
  const descriptors = collectLazyDescriptorsForSearchResults(results);
  if (descriptors.length > 0) {
    cacheEntry.lazyDetailDescriptors = descriptors;
  }
  pruneLazyDetailDescriptors();
}

function rehydrateLazyDescriptorsFromSearchCache(cacheKey) {
  const cacheEntry = findSearchCacheEntry(cacheKey);
  const descriptors = Array.isArray(cacheEntry?.lazyDetailDescriptors) ? cacheEntry.lazyDetailDescriptors : [];
  if (descriptors.length === 0) return;
  for (const descriptor of descriptors) {
    const cloned = cloneLazyDescriptor(descriptor);
    if (!isDescriptorConfigCompatible(cloned)) continue;
    if (cloned?.kind === 'lazy-merge-detail') {
      registerLazyDescriptor(cloned, clonePlainAnime(cloned.fullAnime));
      continue;
    }
    const summary = descriptor?.source === 'vod'
      ? buildVodAnimeFromLazyDescriptor(cloned, false)
      : descriptor?.source === 'dandan'
        ? buildDandanAnimeFromLazyDescriptor(cloned, null, false)
        : buildGenericLazySourceSummary(cloned?.source, cloned?.rawCandidate, cloned?.queryTitle, cloned?.querySeason, cloned);
    registerLazyDescriptor(cloned, summary);
  }
}

function pruneLazyDetailDescriptors() {
  const store = getLazyDetailDescriptorStore();
  for (const descriptor of [...new Set(store.values())]) {
    if (isLazyDetailDescriptorExpired(descriptor)) {
      removeLazyDetailDescriptor(descriptor);
    }
  }

}

function buildVodScopedLazyId(vodName, rawId) {
  const normalizedVodName = String(vodName || '').trim();
  const normalizedId = String(rawId ?? '').trim();
  if (!normalizedVodName || !normalizedId) return normalizedId;
  return `${encodeURIComponent(normalizedVodName)}:${encodeURIComponent(normalizedId)}`;
}

function normalizeVodPlatform(platform) {
  if (platform === 'mgtv') return 'imgo';
  if (platform === 'bilibili') return 'bilibili1';
  return platform;
}

function buildVodLinksFromRawCandidate(rawCandidate) {
  if (!rawCandidate?.vod_play_from || !rawCandidate?.vod_play_url) return [];

  const vodPlayFromList = String(rawCandidate.vod_play_from).split('$$$').map(normalizeVodPlatform);
  const vodPlayUrlList = String(rawCandidate.vod_play_url).split('$$$');
  const links = [];
  let count = 0;

  vodPlayFromList.forEach((platform, index) => {
    if (!globals.vodAllowedPlatforms.includes(platform)) return;
    const playUrl = vodPlayUrlList[index];
    if (!playUrl) return;

    for (const ep of playUrl.split('#')) {
      const [episodeName, episodeUrl] = String(ep || '').split('$');
      if (!episodeName || !episodeUrl) continue;
      count++;
      links.push({
        name: String(count),
        url: episodeUrl,
        title: `【${platform}】 ${episodeName}`,
      });
    }
  });

  return links;
}

function buildVodAnimeFromLazyDescriptor(descriptor, includeLinks = false) {
  const rawCandidate = descriptor?.rawCandidate || {};
  const links = buildVodLinksFromRawCandidate(rawCandidate);
  if (links.length === 0) return null;

  const anime = {
    animeId: Number(rawCandidate.vod_id),
    bangumiId: String(descriptor.publicBangumiId || rawCandidate.vod_id),
    animeTitle: `${rawCandidate.vod_name}(${rawCandidate.vod_year})【${rawCandidate.type_name}】from ${descriptor.vodName}`,
    type: rawCandidate.type_name,
    typeDescription: rawCandidate.type_name,
    imageUrl: rawCandidate.vod_pic,
    startDate: generateValidStartDate(rawCandidate.vod_year),
    episodeCount: links.length,
    rating: 0,
    isFavorited: true,
    source: 'vod',
  };

  return includeLinks ? { ...anime, links } : anime;
}

function getRawCandidateId(rawCandidate, sourceName = '') {
  const id = extractRawCandidateIdentity(rawCandidate, sourceName);
  if (id === undefined || id === null || id === '') return null;
  return String(id);
}

function buildDandanLinksFromEpisodes(episodes) {
  if (!Array.isArray(episodes)) return [];

  return episodes
    .filter(ep => ep?.episodeId !== undefined && ep?.episodeId !== null)
    .map((ep) => {
      const epTitle = ep.episodeTitle && String(ep.episodeTitle).trim() !== "" ? `${ep.episodeTitle}` : `第${ep.episodeNumber}集`;
      return {
        name: epTitle,
        url: ep.episodeId.toString(),
        title: `【dandan】 ${epTitle}`,
      };
    });
}

function resolveDandanYear(rawCandidate, details, links) {
  const rawDate = rawCandidate?.startDate || (Array.isArray(details?.episodes) && details.episodes[0]?.airDate) || '';
  if (rawDate) {
    const year = new Date(rawDate).getFullYear();
    if (Number.isFinite(year)) return String(year);
  }

  const titleYear = extractYear(rawCandidate?.animeTitle || rawCandidate?.title || '');
  return titleYear || '未知';
}

function buildDandanAnimeFromLazyDescriptor(descriptor, details = null, includeLinks = false) {
  const rawCandidate = descriptor?.rawCandidate || {};
  const rawId = getRawCandidateId(rawCandidate);
  if (!rawId) return null;

  const episodes = Array.isArray(details?.episodes) ? details.episodes : [];
  const links = includeLinks ? buildDandanLinksFromEpisodes(episodes) : [];
  if (includeLinks && links.length === 0) return null;

  const displayTitle = rawCandidate._displayTitle || rawCandidate.animeTitle || rawCandidate.title || rawId;
  const resolvedType = details?.type || rawCandidate.type || 'tvseries';
  const resolvedTypeDescription = details?.typeDescription || rawCandidate.typeDescription || 'TV动画';
  const resolvedStartDate = rawCandidate.startDate || (episodes.length > 0 ? episodes[0].airDate : null);
  const yearStr = resolveDandanYear(rawCandidate, details, links);
  const aliases = [...new Set([
    ...(Array.isArray(details?.titles) ? details.titles : []),
    ...(Array.isArray(rawCandidate.aliases) ? rawCandidate.aliases : []),
  ].filter(Boolean))];
  if (rawCandidate.animeTitle && rawCandidate.animeTitle !== displayTitle && !aliases.includes(rawCandidate.animeTitle)) {
    aliases.push(rawCandidate.animeTitle);
  }

  const episodeCount = includeLinks
    ? links.length
    : Number(rawCandidate.episodeCount || (Array.isArray(rawCandidate.episodes) ? rawCandidate.episodes.length : 0) || 0);

  const anime = {
    animeId: Number(rawId),
    bangumiId: rawId,
    animeTitle: `${displayTitle}(${yearStr})【${resolvedTypeDescription}】from dandan`,
    aliases,
    type: resolvedType,
    typeDescription: resolvedTypeDescription,
    imageUrl: details?.imageUrl || rawCandidate.imageUrl || '',
    startDate: resolvedStartDate,
    episodeCount,
    rating: rawCandidate.rating || 0,
    isFavorited: rawCandidate.isFavorited ?? true,
    source: 'dandan',
  };

  return includeLinks ? { ...anime, links } : anime;
}

function registerLazyDescriptor(descriptor, summary) {
  if (!summary || isLazyDetailDescriptorExpired(descriptor)) return null;

  descriptor.identityIds = [...new Set([
    ...(Array.isArray(descriptor.identityIds) ? descriptor.identityIds : []),
    summary.animeId,
    summary.bangumiId,
  ].filter(value => value !== undefined && value !== null && value !== '').map(String))];

  const store = getLazyDetailDescriptorStore();
  const animeKey = buildLazyDescriptorKey(descriptor.source, summary.animeId);
  const bangumiKey = buildLazyDescriptorKey(descriptor.source, summary.bangumiId);
  if (animeKey) store.set(animeKey, descriptor);
  if (bangumiKey) store.set(bangumiKey, descriptor);
  return summary;
}

function registerLazyMergedDescriptor(mergedAnime, componentDescriptors = []) {
  const fullAnime = clonePlainAnime(mergedAnime);
  if (!fullAnime || !Array.isArray(fullAnime.links) || fullAnime.links.length === 0) return null;

  const descriptor = {
    kind: 'lazy-merge-detail',
    source: fullAnime.source,
    rawCandidate: {
      animeId: fullAnime.animeId,
      bangumiId: fullAnime.bangumiId,
      animeTitle: fullAnime.animeTitle,
    },
    fullAnime,
    componentDescriptors: componentDescriptors.map(cloneLazyDescriptor).filter(Boolean),
    mergeSourcePairsFingerprint: buildMergeSourcePairsFingerprint(),
    sourceOrderFingerprint: buildSourceOrderFingerprint(),
    identityIds: [fullAnime.animeId, fullAnime.bangumiId],
    createdAt: Date.now(),
  };

  return registerLazyDescriptor(descriptor, fullAnime);
}

function registerLazyVodDescriptor(rawCandidate, queryTitle, querySeason, vodName, forceSourceAwareId = false) {
  const rawId = getRawCandidateId(rawCandidate, 'vod');
  const publicBangumiId = forceSourceAwareId ? buildVodScopedLazyId(vodName, rawId) : String(rawId || rawCandidate?.vod_id || '');
  const descriptor = {
    kind: 'lazy-detail',
    source: 'vod',
    rawCandidate: { ...rawCandidate },
    queryTitle,
    querySeason,
    vodName,
    publicBangumiId,
    createdAt: Date.now(),
  };
  const summary = buildVodAnimeFromLazyDescriptor(descriptor, false);
  return registerLazyDescriptor(descriptor, summary);
}

function registerLazyDandanDescriptor(rawCandidate, queryTitle, querySeason) {
  const descriptor = {
    kind: 'lazy-detail',
    source: 'dandan',
    rawCandidate: { ...rawCandidate },
    queryTitle,
    querySeason,
    createdAt: Date.now(),
  };
  const summary = buildDandanAnimeFromLazyDescriptor(descriptor, null, false);
  return registerLazyDescriptor(descriptor, summary);
}

function buildLazyVodSearchSummaries(vodCandidates, queryTitle, querySeason, vodName, duplicateVodIds = new Set()) {
  if (!Array.isArray(vodCandidates)) return [];

  const seasonPreferredAnimes = preferSeasonCandidatesIfPresent(vodCandidates, querySeason, anime => anime?.vod_name || '');
  return seasonPreferredAnimes
    .filter(anime => titleMatches(anime?.vod_name || '', queryTitle))
    .map(anime => registerLazyVodDescriptor(
      anime,
      queryTitle,
      querySeason,
      vodName,
      duplicateVodIds.has(String(getRawCandidateId(anime, 'vod') || ''))
    ))
    .filter(Boolean);
}

function collectDuplicateVodCandidateIds(vodResults) {
  const counts = new Map();
  if (!Array.isArray(vodResults)) return new Set();
  for (const vodResult of vodResults) {
    if (!Array.isArray(vodResult?.list)) continue;
    for (const candidate of vodResult.list) {
      const id = getRawCandidateId(candidate, 'vod');
      if (!id) continue;
      const key = String(id);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
}

function buildLazyDandanSearchSummaries(dandanCandidates, queryTitle, querySeason) {
  if (!Array.isArray(dandanCandidates)) return [];

  const seasonPreferredAnimes = preferSeasonCandidatesIfPresent(dandanCandidates, querySeason, anime => anime?._displayTitle || anime?.animeTitle || anime?.title || '');
  return seasonPreferredAnimes
    .filter(anime => titleMatches(anime?._displayTitle || anime?.animeTitle || anime?.title || '', queryTitle))
    .map(anime => registerLazyDandanDescriptor(anime, queryTitle, querySeason))
    .filter(Boolean);
}

function isGenericLazySourceSupported(sourceName) {
  if (!sourceName || sourceName === 'vod' || sourceName === 'dandan') return false;
  const source = resolveSourceInstance(sourceName);
  return Boolean(source && typeof source.handleAnimes === 'function');
}

function firstNonEmptyValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function extractRawCandidateIdentity(rawCandidate, sourceName = '') {
  if (sourceName === 'xigua' && rawCandidate?.url) {
    const id = String(rawCandidate.url).split('?')[0].split('/').filter(Boolean).pop();
    if (id) return id;
  }

  return firstNonEmptyValue(
    rawCandidate?.bangumiId,
    rawCandidate?.mediaId,
    rawCandidate?.animeId,
    rawCandidate?.id,
    rawCandidate?.seasonId,
    rawCandidate?.subjectId,
    rawCandidate?.cid,
    rawCandidate?.tvid,
    rawCandidate?.epsId,
    rawCandidate?.url,
    rawCandidate?.vod_id
  );
}

function buildLazySummaryAnimeId(rawCandidate, identity) {
  if (rawCandidate?.animeId !== undefined && rawCandidate?.animeId !== null && rawCandidate?.animeId !== '') {
    const numericAnimeId = Number(rawCandidate.animeId);
    return Number.isFinite(numericAnimeId) ? numericAnimeId : convertToAsciiSum(String(rawCandidate.animeId));
  }
  if (identity === undefined || identity === null || identity === '') return null;
  return convertToAsciiSum(String(identity));
}

function extractRawCandidateTitle(rawCandidate, fallbackId = '') {
  return String(firstNonEmptyValue(
    rawCandidate?._displayTitle,
    rawCandidate?.animeTitle,
    rawCandidate?.title,
    rawCandidate?.name_cn,
    rawCandidate?.cnName,
    rawCandidate?.titleTxt,
    rawCandidate?.name,
    rawCandidate?.vod_name,
    rawCandidate?.subjectTitle,
    rawCandidate?.jpName,
    fallbackId
  ) || '').replace(/^\s*--+>\s*/, '').trim();
}

function extractRawCandidateYear(rawCandidate, title = '') {
  const rawYear = firstNonEmptyValue(
    rawCandidate?.year,
    rawCandidate?.vod_year,
    rawCandidate?.releaseYear,
    rawCandidate?.publishYear,
    rawCandidate?.pubYear
  );
  if (rawYear !== null) return String(rawYear);
  const rawDate = firstNonEmptyValue(
    rawCandidate?.startDate,
    rawCandidate?.airDate,
    rawCandidate?.air_date,
    rawCandidate?.date,
    rawCandidate?.begin,
    rawCandidate?.beginDate,
    rawCandidate?.pubdate,
    rawCandidate?.pubtime,
    rawCandidate?.publishTime,
    rawCandidate?.publish_time,
    rawCandidate?.releaseTime,
    rawCandidate?.release_time,
    rawCandidate?.releaseDate,
    rawCandidate?.release_date
  );
  if (rawDate !== null) {
    const parsed = new Date(rawDate).getFullYear();
    if (Number.isFinite(parsed)) return String(parsed);
    const textYear = String(rawDate).match(/(?:19|20)\d{2}/)?.[0];
    if (textYear) return textYear;
  }
  return extractYear(title) || 'N/A';
}

function extractRawCandidateType(rawCandidate) {
  return String(firstNonEmptyValue(
    rawCandidate?.typeDescription,
    rawCandidate?.type,
    rawCandidate?.type_name,
    rawCandidate?.cat_name,
    rawCandidate?.classify,
    rawCandidate?.categoryName,
    rawCandidate?.mediaType,
    rawCandidate?.category,
    rawCandidate?.channel,
    '未知'
  ));
}

function extractRawCandidateImage(rawCandidate) {
  return String(firstNonEmptyValue(
    rawCandidate?.imageUrl,
    rawCandidate?.vod_pic,
    rawCandidate?.img,
    rawCandidate?.imgUrl,
    rawCandidate?.cover,
    rawCandidate?.coverUrl,
    rawCandidate?.coverImageH,
    rawCandidate?.coverImageV,
    rawCandidate?.poster,
    rawCandidate?.pic,
    rawCandidate?.horizontal_picture,
    rawCandidate?.images?.common,
    rawCandidate?.images?.large,
    rawCandidate?.images?.medium,
    rawCandidate?.images?.grid,
    rawCandidate?.images?.small,
    rawCandidate?.image?.thumb,
    rawCandidate?.image?.posterThumb,
    rawCandidate?.image?.poster,
    rawCandidate?.image?.url,
    ''
  ));
}

function extractRawCandidateEpisodeCount(rawCandidate, typeDescription = '') {
  const count = Number(firstNonEmptyValue(
    rawCandidate?.episodeCount,
    rawCandidate?.ep_size,
    rawCandidate?.episodesCount,
    rawCandidate?.totalEpisode,
    rawCandidate?.totalEpisodes,
    rawCandidate?.total_episodes,
    rawCandidate?.eps,
    rawCandidate?.epCount,
    rawCandidate?.total,
    rawCandidate?.total_video_count,
    rawCandidate?.videoNum,
    Array.isArray(rawCandidate?.episodes) ? rawCandidate.episodes.length : null,
    Array.isArray(rawCandidate?._eps) ? rawCandidate._eps.length : null,
    Array.isArray(rawCandidate?.seriesPlaylinks) ? rawCandidate.seriesPlaylinks.length : null,
    null
  ));
  if (Number.isFinite(count) && count > 0) return count;
  if (String(typeDescription).includes('电影')) return 1;
  return 0;
}

function buildGenericLazySourceSummary(sourceName, rawCandidate) {
  const identity = extractRawCandidateIdentity(rawCandidate, sourceName);
  if (identity === null) return null;

  const bangumiId = String(identity);
  const animeId = buildLazySummaryAnimeId(rawCandidate, identity);
  if (animeId === null) return null;

  const title = extractRawCandidateTitle(rawCandidate, bangumiId);
  if (!title) return null;
  const year = extractRawCandidateYear(rawCandidate, title);
  const source = resolveSourceInstance(sourceName);
  const rawTypeDescription = extractRawCandidateType(rawCandidate);
  const rawCategory = rawCandidate?.category;
  const typeDescription = sourceName === 'hanjutv'
    && rawCategory !== undefined
    && rawCategory !== null
    && Number.isFinite(Number(rawCategory))
    && typeof source?.getCategory === 'function'
    ? source.getCategory(rawCategory)
    : rawTypeDescription;
  const episodeCount = extractRawCandidateEpisodeCount(rawCandidate, typeDescription);
  const aliases = [
    ...(Array.isArray(rawCandidate?.aliases) ? rawCandidate.aliases : []),
    rawCandidate?.org_title,
    rawCandidate?.originalTitle,
  ].filter(Boolean);

  return {
    animeId,
    bangumiId,
    animeTitle: `${title}(${year})【${typeDescription}】from ${sourceName}`,
    aliases: [...new Set(aliases)],
    type: rawCandidate?.type || typeDescription,
    typeDescription,
    imageUrl: extractRawCandidateImage(rawCandidate),
    startDate: generateValidStartDate(year),
    episodeCount,
    rating: rawCandidate?.rating || 0,
    isFavorited: rawCandidate?.isFavorited ?? true,
    source: sourceName,
  };
}

function registerLazyGenericSourceDescriptor(sourceName, rawCandidate, queryTitle, querySeason) {
  const summary = buildGenericLazySourceSummary(sourceName, rawCandidate);
  if (!summary) return null;
  const descriptor = {
    kind: 'lazy-detail',
    source: sourceName,
    rawCandidate: { ...rawCandidate },
    queryTitle,
    querySeason,
    identityIds: [summary.animeId, summary.bangumiId],
    createdAt: Date.now(),
  };
  return registerLazyDescriptor(descriptor, summary);
}

function buildLazyGenericSourceSearchSummaries(sourceName, sourceCandidates, queryTitle, querySeason) {
  if (!Array.isArray(sourceCandidates) || !isGenericLazySourceSupported(sourceName)) return [];
  const seasonPreferredAnimes = preferSeasonCandidatesIfPresent(sourceCandidates, querySeason, anime => extractRawCandidateTitle(anime));
  return seasonPreferredAnimes
    .filter(anime => titleMatches(extractRawCandidateTitle(anime), queryTitle))
    .map(anime => registerLazyGenericSourceDescriptor(sourceName, anime, queryTitle, querySeason))
    .filter(Boolean);
}

function descriptorCandidateIds(descriptor) {
  const rawCandidate = descriptor?.rawCandidate || {};
  const ids = [
    ...(Array.isArray(descriptor?.identityIds) ? descriptor.identityIds : []),
    rawCandidate.animeId,
    rawCandidate.bangumiId,
    rawCandidate.mediaId,
    rawCandidate.id,
    rawCandidate.seasonId,
    rawCandidate.subjectId,
    rawCandidate.cid,
    rawCandidate.tvid,
    rawCandidate.vod_id,
  ];
  return [...new Set(ids.filter(value => value !== undefined && value !== null && value !== '').map(String))];
}

function findLazyDetailDescriptor(idParam, source = null) {
  const store = getLazyDetailDescriptorStore();
  if (source) {
    const descriptorKey = buildLazyDescriptorKey(source, idParam);
    return descriptorKey ? store.get(descriptorKey) || null : null;
  }

  const normalizedId = String(idParam ?? '').trim();
  if (!normalizedId) return null;

  const seen = new Set();
  for (const descriptor of store.values()) {
    if (!descriptor || seen.has(descriptor)) continue;
    seen.add(descriptor);
    if (descriptorCandidateIds(descriptor).includes(normalizedId)) {
      return descriptor;
    }
  }
  return null;
}

function findLazyDescriptorForSummary(summary) {
  if (!summary?.source) return null;
  return findLazyDetailDescriptor(summary.bangumiId, summary.source)
    || findLazyDetailDescriptor(summary.animeId, summary.source);
}

function isMergedLazySummary(result) {
  return typeof result?.animeTitle === 'string' && /from\s+[^\s]+&[^\s]+\s*$/.test(result.animeTitle);
}

function areLazyResultsMaterializable(results) {
  if (!Array.isArray(results)) return true;
  return results.every(result => {
    if (!result?.source) return true;
    const descriptor = findLazyDescriptorForSummary(result);
    const descriptorUsable = descriptor && isDescriptorConfigCompatible(descriptor) && !isLazyDetailDescriptorExpired(descriptor);
    if (isMergedLazySummary(result)) return Boolean(descriptorUsable);
    if (descriptorUsable) return true;
    return Boolean(resolveAnimeById(result.bangumiId, null, result.source)
      || resolveAnimeById(result.animeId, null, result.source));
  });
}

async function materializeLazyMergeCandidates(curAnimes, detailStore) {
  const mergeSources = getConfiguredMergeSources();
  if (mergeSources.size === 0 || !Array.isArray(curAnimes) || curAnimes.length === 0) return [];

  const materialized = [];
  const seen = new Set();

  for (const summary of curAnimes) {
    if (!summary || !mergeSources.has(summary.source)) continue;
    const descriptor = findLazyDescriptorForSummary(summary);
    if (!descriptor || !isDescriptorConfigCompatible(descriptor) || isLazyDetailDescriptorExpired(descriptor)) continue;

    const identity = `${summary.source}:${summary.bangumiId || summary.animeId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    try {
      const fullAnime = await materializeLazyDetailDescriptor(summary.bangumiId || summary.animeId, detailStore, summary.source);
      if (fullAnime && Array.isArray(fullAnime.links) && fullAnime.links.length > 0) {
        materialized.push({ summary, descriptor: cloneLazyDescriptor(descriptor), fullAnime });
      }
    } catch (error) {
      log('warn', `[LazyMerge] 物化 ${identity} 失败，跳过该候选: ${error?.message || error}`);
    }
  }

  return materialized;
}

function resolveFullAnimeFromDetailStoreOrRuntime(idParam, descriptor, detailStore = null) {
  const ids = [idParam, ...descriptorCandidateIds(descriptor)];
  for (const id of ids) {
    if (id === undefined || id === null || id === '') continue;
    const anime = resolveAnimeById(id, detailStore, descriptor.source) || resolveAnimeById(id, detailStore, null);
    if (anime) return anime;
  }
  return null;
}

async function buildFullAnimeFromLazyDescriptor(descriptor, detailStore = null) {
  if (descriptor?.kind === 'lazy-merge-detail') {
    if (!isDescriptorConfigCompatible(descriptor)) return null;
    const fullAnime = clonePlainAnime(descriptor.fullAnime);
    if (!fullAnime || !Array.isArray(fullAnime.links) || fullAnime.links.length === 0) return null;
    return fullAnime;
  }

  if (descriptor?.source === 'vod') {
    return buildVodAnimeFromLazyDescriptor(descriptor, true);
  }

  if (descriptor?.source === 'dandan') {
    const id = getRawCandidateId(descriptor.rawCandidate);
    if (!id) return null;
    const details = await dandanSource.getEpisodes(id);
    return buildDandanAnimeFromLazyDescriptor(descriptor, details, true);
  }

  const source = resolveSourceInstance(descriptor?.source);
  if (!source || typeof source.handleAnimes !== 'function') return null;

  const localCurAnimes = [];
  const requestDetailStore = detailStore instanceof Map ? detailStore : new Map();
  const sourceHandleOptions = {
    detailStore: requestDetailStore,
    querySeason: descriptor.querySeason,
    preferAnimeId: getRawCandidateId(descriptor.rawCandidate, descriptor.source),
    preferSource: descriptor.source,
  };

  await source.handleAnimes([descriptor.rawCandidate], descriptor.queryTitle || '', localCurAnimes, sourceHandleOptions);
  const fullAnime = resolveFullAnimeFromDetailStoreOrRuntime(null, descriptor, requestDetailStore)
    || localCurAnimes
      .map(anime => resolveAnimeById(anime?.bangumiId || anime?.animeId, requestDetailStore, descriptor.source))
      .find(Boolean)
    || null;

  return fullAnime ? { fullAnime, alreadyAdded: true } : null;
}

async function materializeLazyDetailDescriptor(idParam, detailStore = null, source = null) {
  const descriptor = findLazyDetailDescriptor(idParam, source);
  if (!descriptor) return null;
  if (!isDescriptorConfigCompatible(descriptor)) return null;
  if (isLazyDetailDescriptorExpired(descriptor)) {
    removeLazyDetailDescriptor(descriptor);
    return null;
  }

  const pendingKey = `${descriptor.source}:${getRawCandidateId(descriptor.rawCandidate, descriptor.source) || idParam}`;
  if (PENDING_LAZY_DETAIL_MATERIALIZATIONS.has(pendingKey)) {
    return await PENDING_LAZY_DETAIL_MATERIALIZATIONS.get(pendingKey);
  }

  const materializeTask = (async () => {
    const materialized = await buildFullAnimeFromLazyDescriptor(descriptor, detailStore);
    const fullAnime = materialized?.fullAnime || materialized;
    if (!fullAnime) return null;

    if (!materialized?.alreadyAdded) {
      addAnime(fullAnime, { detailStore: detailStore instanceof Map ? detailStore : null });
      if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
    }
    return resolveAnimeById(idParam, detailStore, descriptor.source) || fullAnime;
  })();

  PENDING_LAZY_DETAIL_MATERIALIZATIONS.set(pendingKey, materializeTask);
  try {
    return await materializeTask;
  } finally {
    PENDING_LAZY_DETAIL_MATERIALIZATIONS.delete(pendingKey);
  }
}

async function applyDanmuOffsetByRule(danmus, offsetRule, targetUrl, logPrefix = '[Offset]') {
  const offset = Number(offsetRule?.offset || 0);
  if (!offset || !Array.isArray(danmus) || danmus.length === 0) return danmus;

  const usePercent = offsetRule?.usePercent === true;
  let videoDuration = 0;
  if (usePercent) {
    videoDuration = await resolveUrlDuration(targetUrl);
    if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
      log('warn', `${logPrefix} 跳过百分比偏移 ${offset}%，未获取到有效时长`);
      return danmus;
    }
  }

  const offsetMode = usePercent ? '%' : 's';
  log('info', `${logPrefix} 应用偏移 ${offset}${offsetMode}${usePercent ? `, duration=${videoDuration}s` : ''}`);

  return applyOffset(danmus, offset, {
    usePercent,
    videoDuration
  });
}

export async function getCommentDuration(path) {
  const parts = String(path || '').split('/');
  const commentId = parseInt(parts[parts.length - 2], 10);
  if (!Number.isFinite(commentId)) {
    return jsonResponse(buildDurationResponse(), 400);
  }

  const url = findUrlById(commentId);
  if (!url) {
    return jsonResponse(buildDurationResponse(), 404);
  }

  try {
    const targetUrls = url.includes(MERGE_DELIMITER) ? extractMergedUrls(url) : [url];
    const durations = await Promise.all(targetUrls.map(resolveUrlDuration));
    const videoDuration = durations.reduce((maxValue, currentValue) => Math.max(maxValue, currentValue || 0), 0);
    return jsonResponse(buildDurationResponse(videoDuration));
  } catch (error) {
    log('warn', '[Duration] 获取时长失败: ' + error.message);
    return jsonResponse(buildDurationResponse());
  }
}

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
    log("info", `[getBangumi] Episode filter enabled. Filtered episodes: ${episodesList.length}/${anime.links.length}`);
    episodesList = episodesList.map((ep, index) => ({
      ...ep,
      episodeNumber: `${index + 1}`
    }));
  }

  return filterSameEpisodeTitle(episodesList);
}

function buildBangumiData(anime, idParam = "") {
  const targetId = idParam || anime?.bangumiId || anime?.animeId;
  log("info", `Fetched details for anime ID: ${targetId}`);

  const episodesList = buildEpisodesFromAnimeLinks(anime);
  if (episodesList.length === 0) {
    log("warn", `[getBangumi] No valid episodes after filtering for anime ID ${targetId}`);
    return {
      errorCode: 404,
      success: false,
      errorMessage: "No valid episodes after filtering",
      bangumi: null
    };
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

  return {
    errorCode: 0,
    success: true,
    errorMessage: "",
    bangumi
  };
}

function tryFastMatchFromPreferCache({ title, season, episode, year, preferAnimeId, preferSource, preferredPlatform, offsets = null, detailStore = null }) {
  if (!preferAnimeId || !globals.rememberLastSelect) return { resAnime: null, resEpisode: null };

  const targetAnime =
    resolveAnimeByIdFromDetailStore(preferAnimeId, detailStore, preferSource) ||
    (preferSource ? null : resolveAnimeByIdFromDetailStore(preferAnimeId, detailStore));

  if (!targetAnime || !Array.isArray(targetAnime.links) || targetAnime.links.length === 0) {
    return { resAnime: null, resEpisode: null };
  }

  // 保护性校验：标题与年份至少应与请求一致，避免误命中旧缓存
  const normalizedAnimeTitle = normalizeTitleForComparison(targetAnime.animeTitle || '');
  const normalizedQueryTitle = normalizeTitleForComparison(title);
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
    let targetEpisode = episode;
    if (offsets && offsets[String(season)] !== undefined) {
      targetEpisode = computeTargetEpisode(offsets, season, episode, episodes, targetEpisode);
    }
    matchedEpisode = findEpisodeByNumber(episodes, episode, targetEpisode, preferredPlatform || null);
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
  const rawAnimeTitle = anime?.animeTitle || '';
  const normalizedAnimeTitle = normalizeTitleForComparison(rawAnimeTitle);
  const normalizedQueryTitle = normalizeTitleForComparison(queryTitle);

  if (!normalizedAnimeTitle.includes(normalizedQueryTitle)) {
    return false;
  }

  const { season: parsedSeason, baseTitle } = extractSeasonNumberFromAnimeTitle(rawAnimeTitle);
  if (!baseTitle || !baseTitle.startsWith(normalizedQueryTitle)) {
    return false;
  }

  if (parsedSeason === null) {
    return season === 1;
  }
  return parsedSeason === season;
}

function parsePositiveIntegerParam(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildSearchCacheKey(queryTitle, querySeason = null, cacheMode = 'eager') {
  const season = parsePositiveIntegerParam(querySeason);
  const baseKey = season ? `search:${queryTitle}:season:${season}` : queryTitle;
  return cacheMode === 'lazy' ? `lazy:${baseKey}` : baseKey;
}

// Extracted function for GET /api/v2/search/anime
export async function searchAnime(url, preferAnimeId = null, preferSource = null, detailStore = null, options = {}) {
  let queryTitle = sanitizeSearchKeyword(url.searchParams.get("keyword"));
  let querySeason = parsePositiveIntegerParam(url.searchParams.get("season"));
  log("info", `Search anime with keyword: ${queryTitle}${querySeason ? `, season: ${querySeason}` : ''}`);
  const perfCollector = options?.perfCollector || null;
  const totalPerfToken = perfCollector?.start('searchAnime.total', { keyword: queryTitle, querySeason });
  let cacheHit = false;
  let resultCount = 0;

  try {
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

  const requestAnimeDetailsMap = detailStore instanceof Map ? detailStore : new Map();
  let lazySearch = options?.lazySearch === true;
  if (lazySearch && !isPositiveSearchCacheWindow()) {
    log("info", `[searchAnime] SEARCH_CACHE_MINUTES<=0，禁用公共懒搜索以避免返回不可物化的摘要`);
    lazySearch = false;
  }
  const sourceHandleOptions = {
    detailStore: requestAnimeDetailsMap,
    querySeason,
    preferAnimeId,
    preferSource,
    perfCollector,
  };
  const searchCacheKey = buildSearchCacheKey(queryTitle, querySeason, lazySearch ? 'lazy' : 'eager');

  // 检查搜索缓存
  const cachePerfToken = perfCollector?.start('searchAnime.cache', { keyword: queryTitle, querySeason, cacheKey: searchCacheKey });
  let cachedResults = getSearchCache(searchCacheKey, requestAnimeDetailsMap);
  let cacheKeyUsed = searchCacheKey;

  // `/match` 以前只按标题预热搜索缓存。为避免引入 season 参数后让旧缓存全部失效，
  // 只允许 match 内部搜索显式启用无 season 旧缓存回退；直接 `/search/anime?season=...` 仍保持隔离。
  if (!lazySearch && cachedResults === null && querySeason && options?.allowUnseasonedCacheFallback) {
    const legacyCachedResults = getSearchCache(queryTitle, requestAnimeDetailsMap);
    if (legacyCachedResults !== null) {
      cachedResults = preferSeasonCandidatesIfPresent(legacyCachedResults, querySeason, anime => anime?.animeTitle || anime?.title || '');
      cacheKeyUsed = queryTitle;
    }
  }

  cacheHit = cachedResults !== null;
  perfCollector?.end(cachePerfToken, {
    hit: cacheHit,
    cacheKeyUsed,
    resultCount: Array.isArray(cachedResults) ? cachedResults.length : 0,
  });
  if (cachedResults !== null) {
    if (lazySearch) {
      rehydrateLazyDescriptorsFromSearchCache(cacheKeyUsed);
      if (!areLazyResultsMaterializable(cachedResults)) {
        log("warn", `[searchAnime] 懒搜索缓存 ${cacheKeyUsed} 缺少可物化 descriptor，忽略缓存并重新搜索`);
        cachedResults = null;
        cacheHit = false;
      }
    }
    if (cachedResults !== null) {
      resultCount = cachedResults.length;
      return jsonResponse({
        errorCode: 0,
        success: true,
        errorMessage: "",
        animes: cachedResults,
      });
    }
  }

  const curAnimes = [];

  // 链接弹幕解析
  const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,6}(:\d+)?(\/[^\s]*)?$/;
  if (urlRegex.test(queryTitle)) {
    const tmpAnime = Anime.fromJson({
      "animeId": 0,
      "bangumiId": "0",
      "animeTitle": queryTitle,
      "type": "",
      "typeDescription": "链接解析",
      "imageUrl": "",
      "startDate": "",
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
    } else if (queryTitle.includes('.acfun.cn')) {
      platform = "acfun";
    } else if (queryTitle.includes('.yfsp.tv')) {
      platform = "aiyifan";
    }

    const pageTitle = await getPageTitle(queryTitle);

    const links = [{
      "name": "手动解析链接弹幕",
      "url": queryTitle,
      "title": `【${platform}】 ${pageTitle}`
    }];
    curAnimes.push(tmpAnime);
    addAnime(Anime.fromJson({...tmpAnime, links: links}), requestAnimeDetailsMap);
    if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();

    // 如果有新的anime获取到，则更新本地缓存
    if (globals.localCacheValid && curAnimes.length !== 0) {
      await updateLocalCaches();
    }
    // 如果有新的anime获取到，则更新redis
    if (globals.redisValid && curAnimes.length !== 0) {
      await updateRedisCaches();
    }
    if (globals.localRedisValid && curAnimes.length !== 0) {
      await updateLocalRedisCaches();
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
      if (source === "acfun") return acfunSource.search(queryTitle);
      if (source === "aiyifan") return aiyifanSource.search(queryTitle);
      if (source === "animeko") return animekoSource.search(queryTitle);
      if (source === "ezdmw") return ezdmwSource.search(queryTitle);
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

    // 按顺序处理每个来源的结果（单源处理失败不影响其它源）
    for (const key of globals.sourceOrderArr) {
      try {
        if (lazySearch && isGenericLazySourceSupported(key)) {
          curAnimes.push(...buildLazyGenericSourceSearchSummaries(key, resultData[key], queryTitle, querySeason));
          continue;
        }

        if (key === 'vod') {
          // Vod 结果按服务器分组，handleAnimes 需要保留 vodName 这个兼容位置参数。
          const animesVodResults = resultData[key];
          const duplicateVodIds = lazySearch ? collectDuplicateVodCandidateIds(animesVodResults) : new Set();
          if (animesVodResults && Array.isArray(animesVodResults)) {
            for (const vodResult of animesVodResults) {
              if (vodResult && vodResult.list && vodResult.list.length > 0) {
                if (lazySearch) {
                  curAnimes.push(...buildLazyVodSearchSummaries(vodResult.list, queryTitle, querySeason, vodResult.serverName, duplicateVodIds));
                } else {
                  await vodSource.handleAnimes(vodResult.list, queryTitle, curAnimes, vodResult.serverName, sourceHandleOptions);
                }
              }
            }
          }
        } else if (key === 'dandan') {
          // 公共懒搜索只返回摘要，不在搜索阶段 fanout /bangumi 详情。
          const animesDandan = resultData[key];
          if (lazySearch) {
            curAnimes.push(...buildLazyDandanSearchSummaries(animesDandan, queryTitle, querySeason));
          } else {
            await dandanSource.handleAnimes(animesDandan, queryTitle, curAnimes, sourceHandleOptions);
          }
        } else {
          const source = resolveSourceInstance(key);
          if (source && typeof source.handleAnimes === 'function') {
            await source.handleAnimes(resultData[key], queryTitle, curAnimes, sourceHandleOptions);
          }
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
  if (shouldRunLazyMergeBridge(lazySearch)) {
    const materializedCandidates = await materializeLazyMergeCandidates(curAnimes, requestAnimeDetailsMap);
    const componentDescriptors = materializedCandidates.map(item => item.descriptor).filter(Boolean);
    await applyMergeLogic(curAnimes, requestAnimeDetailsMap, {
      onMergedAnime: (mergedAnime) => registerLazyMergedDescriptor(mergedAnime, componentDescriptors),
    });
  } else if (!lazySearch && globals.mergeSourcePairs.length > 0) {
    await applyMergeLogic(curAnimes, requestAnimeDetailsMap);
  }

  storeAnimeIdsToMap(curAnimes, queryTitle);

  // 如果启用了集标题过滤，则为每个动漫添加过滤后的 episodes
  if (!lazySearch && globals.enableAnimeEpisodeFilter) {
    const validAnimes = [];
    for (const anime of curAnimes) {
      // 首先检查剧名是否包含过滤关键词
      const animeTitle = anime.animeTitle || '';
      if (globals.animeTitleFilter && globals.animeTitleFilter.test(animeTitle)) {
        log("info", `[searchAnime] Anime ${anime.animeId} filtered by name: ${animeTitle}`);
        continue; // 跳过该动漫
      }

      const animeData =
        resolveAnimeByIdFromDetailStore(anime.bangumiId, requestAnimeDetailsMap, anime.source) ||
        resolveAnimeByIdFromDetailStore(anime.animeId, requestAnimeDetailsMap, anime.source);
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

        log("info", `[searchAnime] Anime ${anime.animeId} filtered episodes: ${episodesList.length}/${animeData.links.length}`);

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
  if (globals.localRedisValid && curAnimes.length !== 0) {
    await updateLocalRedisCaches();
  }

  const responseAnimes = curAnimes.map(({ links, ...pureAnime }) => pureAnime);

  // 缓存搜索结果；详情 links 已通过 requestAnimeDetailsMap/animeDetailsCache 保存，响应缓存只保留摘要。
  if (responseAnimes.length > 0) {
    setSearchCache(searchCacheKey, responseAnimes, requestAnimeDetailsMap);
    if (lazySearch) {
      attachLazyDescriptorsToSearchCache(searchCacheKey, responseAnimes);
    }
  }

  resultCount = responseAnimes.length;
  return jsonResponse({
    errorCode: 0,
    success: true,
    errorMessage: "",
    animes: responseAnimes,
  });
  } finally {
    perfCollector?.end(totalPerfToken, { cacheHit, resultCount });
  }
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

  // 匹配格式：01、1（纯数字，通常在标题开头、结尾或下划线后）
  const numberMatch = episodeTitle.match(/(?:^|\s|_)(\d+)(?:\s|$)/);
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
function findEpisodeByNumber(filteredEpisodes, episode, targetEpisode, platform = null) {
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

  // 仅在未应用偏移时，才优先信任标题中解析出的集数；
  // 一旦 targetEpisode 经过偏移修正，应优先按数组索引定位，避免被标题数字误导。
  for (const ep of platformEpisodes) {
    const extractedNumber = extractEpisodeNumberFromTitle(ep.episodeTitle);
    if (episode === targetEpisode && extractedNumber === targetEpisode) {
      log("info", `Found episode by title number: ${ep.episodeTitle} (extracted: ${extractedNumber})`);
      return ep;
    }
  }
  // 策略2：使用数组索引
  if (platformEpisodes.length >= targetEpisode) {
    const fallbackEp = platformEpisodes[targetEpisode - 1];
    log("info", `Using fallback array index for episode ${targetEpisode}: ${fallbackEp.episodeTitle}`);
    return fallbackEp;
  }
  // 策略3：使用episodeNumber字段匹配
  for (const ep of platformEpisodes) {
    if (ep.episodeNumber && parseInt(ep.episodeNumber, 10) === targetEpisode) {
      log("info", `Found episode by episodeNumber: ${ep.episodeTitle} (episodeNumber: ${ep.episodeNumber})`);
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

async function matchAniAndEpByAi(season, episode, year, searchData, title, req, dynamicPlatformOrder, preferAnimeId, preferredPlatform = null, offsets = null, detailStore = null) {
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
      return {
        animeId: anime.animeId,
        animeTitle: extractAnimeTitle(anime.animeTitle || ''),
        aliases: anime.aliases || [],
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

    const bangumiData = getBangumiDataForMatch(selectedAnime, detailStore);
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

        let targetEpisode = episode;
        if (offsets && offsets[String(season)] !== undefined) {
          targetEpisode = computeTargetEpisode(offsets, season, episode, filteredEpisodes, targetEpisode);
        }

        // 匹配集数（优先沿用请求中的平台偏好）
        filteredEpisode = findEpisodeByNumber(filteredEpisodes, episode, targetEpisode, aiPreferredPlatform);
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

function getBangumiDataForMatch(anime, detailStore = null) {
  const detailAnime =
    resolveAnimeByIdFromDetailStore(anime?.bangumiId, detailStore, anime?.source) ||
    resolveAnimeByIdFromDetailStore(anime?.animeId, detailStore, anime?.source);

  if (!detailAnime) {
    log("warn", `[matchAnime] Missing request detail snapshot for anime ${anime?.animeId ?? anime?.bangumiId}`);
    return null;
  }

  return buildBangumiData(detailAnime, anime?.bangumiId || anime?.animeId || "");
}

function computeTargetEpisode(offsets, season, episode, filteredEpisodes, targetEpisode) {
  const seasonKey = String(season);
  const offsetValue = offsets?.[seasonKey];
  if (typeof offsetValue !== "string") {
    return targetEpisode;
  }

  const match = offsetValue.match(/^([^:]+):(.+)$/);
  if (!match) {
    return targetEpisode;
  }

  const offsetEpisode = Number(match[1]);
  const offsetEpisodeTitle = match[2];
  if (!Number.isFinite(offsetEpisode) || !offsetEpisodeTitle) {
    return targetEpisode;
  }

  const offset = episode - offsetEpisode;
  const offsetIndex = filteredEpisodes.findIndex(candidate => candidate.episodeTitle === offsetEpisodeTitle);
  if (offsetIndex !== -1) {
    targetEpisode = offsetIndex + offset + 1;
    log("info", `Applying offset "${offsetValue}" for S${season}E${episode} -> ${targetEpisode}`);
  }

  return targetEpisode;
}

async function matchAniAndEp(season, episode, year, searchData, title, req, platform, preferAnimeId, offsets, detailStore = null, debugCollector = null) {
  let bestRes = {
    anime: null,
    episode: null,
    score: -9999
  };

  const normalizedTitle = normalizeTitleForComparison(title);
  const attemptTrace = debugCollector?.enabled ? {
    phase: 'normal',
    platform: platform ?? null,
    candidates: []
  } : null;

  for (const anime of searchData.animes) {
    const candidateTrace = attemptTrace ? {
      animeId: anime?.animeId ?? null,
      animeTitle: anime?.animeTitle ?? '',
      source: anime?.source ?? '',
      decision: 'rejected',
      reasonCode: 'title_miss'
    } : null;

    const animeIsNotPrefer =
      globals.rememberLastSelect &&
      preferAnimeId &&
      String(anime.bangumiId) !== String(preferAnimeId) &&
      String(anime.animeId) !== String(preferAnimeId);
    if (animeIsNotPrefer) {
      if (candidateTrace) attemptTrace.candidates.push({ ...candidateTrace, reasonCode: 'prefer_filtered' });
      continue;
    }

    let isMatch = false;
    let candidateReason = 'title_miss';
    const candidateTitles = [anime.animeTitle];
    if (anime.aliases && Array.isArray(anime.aliases)) {
      candidateTitles.push(...anime.aliases);
    }

    for (const candTitle of candidateTitles) {
      if (!candTitle) continue;

      if (season && episode) {
        if (normalizeTitleForComparison(candTitle).includes(normalizedTitle)) {
          if (!matchYear(anime, year)) {
            candidateReason = 'year_miss';
            log("info", `Year mismatch: anime year ${extractYear(anime.animeTitle)} vs query year ${year}`);
            continue;
          }

          candidateReason = 'season_miss';
          const animeIsPrefer =
            globals.rememberLastSelect &&
            preferAnimeId &&
            (String(anime.bangumiId) === String(preferAnimeId) ||
            String(anime.animeId) === String(preferAnimeId));

          const tempAnime = { ...anime, animeTitle: candTitle };
          if (matchSeason(tempAnime, title, season) || animeIsPrefer) {
            isMatch = true;
            candidateReason = 'matched';
            break;
          }
        }
      } else {
        const cleanTitle = extractAnimeTitle(candTitle);
        if (normalizeTitleForComparison(cleanTitle) === normalizedTitle) {
          if (!matchYear(anime, year)) {
            candidateReason = 'year_miss';
            log("info", `Year mismatch: anime year ${extractYear(anime.animeTitle)} vs query year ${year}`);
            continue;
          }
          isMatch = true;
          candidateReason = 'matched';
          break;
        }
      }
    }

    if (!isMatch) {
      if (candidateTrace) attemptTrace.candidates.push({ ...candidateTrace, reasonCode: candidateReason });
      continue;
    }

    const bangumiData = getBangumiDataForMatch(anime, detailStore);
    if (!bangumiData?.success || !Array.isArray(bangumiData?.bangumi?.episodes) || bangumiData.bangumi.episodes.length === 0) {
      log("warn", `[matchAniAndEp] 跳过无效 bangumi: ${anime.bangumiId || anime.animeId} / ${anime.animeTitle}`);
      if (candidateTrace) attemptTrace.candidates.push({ ...candidateTrace, reasonCode: 'detail_missing' });
      continue;
    }
    const bangumiEpisodes = bangumiData.bangumi.episodes;

    log("info", "判断剧集", `Anime: ${anime.animeTitle}`);
    log("debug", "[matchAniAndEp] bangumi摘要", {
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      episodeCount: bangumiEpisodes.length
    });

    let matchedEpisode = null;
    let targetEpisode = episode;
    let filteredEpisodeCount = bangumiEpisodes.length;

    if (season && episode) {
      const filteredTmpEpisodes = globals.enableAnimeEpisodeFilter
        ? bangumiEpisodes.filter(curEpisode => !globals.episodeTitleFilter.test(curEpisode.episodeTitle))
        : bangumiEpisodes;
      const filteredEpisodes = filterSameEpisodeTitle(filteredTmpEpisodes);
      filteredEpisodeCount = filteredEpisodes.length;

      log("info", "过滤后的集标题", filteredEpisodes.map(item => item.episodeTitle));

      if (offsets && offsets[String(season)] !== undefined) {
        targetEpisode = computeTargetEpisode(offsets, season, episode, filteredEpisodes, targetEpisode);
      }

      matchedEpisode = findEpisodeByNumber(filteredEpisodes, episode, targetEpisode, platform);
    } else if (bangumiEpisodes.length > 0) {
      if (platform) {
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

    if (!matchedEpisode) {
      if (candidateTrace) {
        attemptTrace.candidates.push({
          ...candidateTrace,
          reasonCode: 'episode_not_found',
          requestedEpisode: episode ?? null,
          targetEpisode: targetEpisode ?? null,
          filteredEpisodeCount
        });
      }
      continue;
    }

    const actualPlatform = extractPlatformFromTitle(anime.animeTitle) || anime.source;
    let currentScore = 0;

    if (platform) {
      currentScore = getPlatformMatchScore(actualPlatform, platform);
    } else {
      currentScore = 1;
    }

    if (candidateTrace) {
      attemptTrace.candidates.push({
        ...candidateTrace,
        decision: 'matched',
        reasonCode: 'matched',
        score: currentScore,
        matchedEpisodeTitle: matchedEpisode.episodeTitle
      });
    }

    if (currentScore > bestRes.score) {
      bestRes = {
        anime,
        episode: matchedEpisode,
        score: currentScore
      };
    }

    if (!platform) {
      break;
    }
  }

  if (attemptTrace) {
    debugCollector.addAttempt(attemptTrace);
  }

  return { resEpisode: bestRes.episode, resAnime: bestRes.anime };
}

async function fallbackMatchAniAndEp(searchData, req, season, episode, year, resEpisode, resAnime, offsets, detailStore = null, debugCollector = null) {
  const attemptTrace = debugCollector?.enabled ? {
    phase: 'fallback',
    platform: null,
    candidates: []
  } : null;

  for (const anime of searchData.animes) {
    const candidateTrace = attemptTrace ? {
      animeId: anime?.animeId ?? null,
      animeTitle: anime?.animeTitle ?? '',
      source: anime?.source ?? '',
      decision: 'rejected',
      reasonCode: 'no_match'
    } : null;

    if (year && !matchYear(anime, year)) {
      log("info", `Fallback: Year mismatch: anime year ${extractYear(anime.animeTitle)} vs query year ${year}`);
      if (candidateTrace) attemptTrace.candidates.push({ ...candidateTrace, reasonCode: 'year_miss' });
      continue;
    }

    const bangumiData = getBangumiDataForMatch(anime, detailStore);
    if (!bangumiData?.success || !Array.isArray(bangumiData?.bangumi?.episodes) || bangumiData.bangumi.episodes.length === 0) {
      log("warn", `[fallbackMatchAniAndEp] 跳过无效 bangumi: ${anime.bangumiId || anime.animeId} / ${anime.animeTitle}`);
      if (candidateTrace) attemptTrace.candidates.push({ ...candidateTrace, reasonCode: 'detail_missing' });
      continue;
    }
    const bangumiEpisodes = bangumiData.bangumi.episodes;
    log("debug", "[fallbackMatchAniAndEp] bangumi摘要", {
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      episodeCount: bangumiEpisodes.length
    });

    if (season && episode) {
      const filteredTmpEpisodes = globals.enableAnimeEpisodeFilter
        ? bangumiEpisodes.filter(curEpisode => !globals.episodeTitleFilter.test(curEpisode.episodeTitle))
        : bangumiEpisodes;
      const filteredEpisodes = filterSameEpisodeTitle(filteredTmpEpisodes);

      let targetEpisode = episode;
      if (offsets && offsets[String(season)] !== undefined) {
        targetEpisode = computeTargetEpisode(offsets, season, episode, filteredEpisodes, targetEpisode);
      }

      const matchedEpisode = findEpisodeByNumber(filteredEpisodes, episode, targetEpisode, null);
      if (matchedEpisode) {
        if (candidateTrace) {
          attemptTrace.candidates.push({
            ...candidateTrace,
            decision: 'matched',
            reasonCode: 'matched',
            matchedEpisodeTitle: matchedEpisode.episodeTitle
          });
        }
        resEpisode = matchedEpisode;
        resAnime = anime;
        break;
      }

      if (candidateTrace) {
        attemptTrace.candidates.push({
          ...candidateTrace,
          reasonCode: 'episode_not_found',
          requestedEpisode: episode ?? null,
          targetEpisode: targetEpisode ?? null,
          filteredEpisodeCount: filteredEpisodes.length
        });
      }
    } else if (bangumiEpisodes.length > 0) {
      if (candidateTrace) {
        attemptTrace.candidates.push({
          ...candidateTrace,
          decision: 'matched',
          reasonCode: 'matched',
          matchedEpisodeTitle: bangumiEpisodes[0].episodeTitle
        });
      }
      resEpisode = bangumiEpisodes[0];
      resAnime = anime;
      break;
    }
  }

  if (attemptTrace) {
    debugCollector.addAttempt(attemptTrace);
  }

  return {resEpisode, resAnime};
}

export async function extractTitleSeasonEpisode(cleanFileName) {
  const normalizedFileName = normalizeUnicodeWhitespace(cleanFileName);
  const parsedSeasonEpisode = splitTitleAndTrailingSeasonEpisode(normalizedFileName);

  let title, season, episode, year;

  if (parsedSeasonEpisode) {
    // 匹配到 S##E## 格式
    title = parsedSeasonEpisode.title;
    season = parsedSeasonEpisode.season;
    episode = parsedSeasonEpisode.episode;

    // ============ 提取年份 =============
    // 从文件名中提取年份（支持多种格式：.2009、.2024、(2009)、(2024) 等）
    const yearMatch = normalizedFileName.match(/(?:\.|\(|（)((?:19|20)\d{2})(?:\)|）|\.|$)/);
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
    title = extractAnimeTitle(title.replace(/\.\d{4}$/i, '').trim());
  } else {
    // 没有 S##E## 格式，尝试提取第一个片段作为标题
    // 匹配第一个中文/英文标题部分（在年份、分辨率等技术信息之前）
    const titleRegex = /^([^.\s]+(?:[.\s][^.\s]+)*?)(?:[.\s](?:\d{4}|(?:19|20)\d{2}|\d{3,4}p|S\d+|E\d+|WEB|BluRay|Blu-ray|HDTV|DVDRip|BDRip|x264|x265|H\.?264|H\.?265|AAC|AC3|DDP|TrueHD|DTS|10bit|HDR|60FPS))/i;
    const titleMatch = normalizedFileName.match(titleRegex);

    title = titleMatch ? extractAnimeTitle(titleMatch[1].replace(/[._]/g, ' ').trim()) : extractAnimeTitle(normalizedFileName);
    season = null;
    episode = null;

    // 从文件名中提取年份
    const yearMatch = normalizedFileName.match(/(?:\.|\(|（)((?:19|20)\d{2})(?:\)|）|\.|$)/);
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
function isMatchDebugEnabled(url) {
  if (!url || !url.searchParams) return false;
  const raw = url.searchParams.get('debug');
  if (raw == null) return false;
  return raw === '' || raw === '1' || raw === 'true' || raw === 'yes';
}

function createMatchDebugCollector(enabled = false) {
  if (!enabled) {
    return {
      enabled: false,
      set() {},
      addAttempt() {},
      finish() {},
      toJSON() { return undefined; }
    };
  }

  const state = {
    version: 1,
    input: {},
    normalized: {},
    preference: {},
    search: {
      used: false,
      skippedReason: null,
      rawCandidateCount: 0,
      candidateCount: 0,
      candidates: []
    },
    ai: {
      attempted: false,
      matched: false,
      reasonCode: null,
      skippedReason: null,
      latencyMs: 0,
      preferredPlatform: null,
      selectedAnimeId: null,
      selectedAnimeTitle: null,
      selectedEpisodeTitle: null
    },
    attempts: [],
    final: {}
  };

  return {
    enabled: true,
    set(section, value) {
      state[section] = value;
    },
    addAttempt(attempt) {
      state.attempts.push(attempt);
    },
    finish(finalState) {
      state.final = finalState;
    },
    toJSON() {
      return state;
    }
  };
}

function summarizeMatchDebugAnimeCandidate(anime) {
  return {
    animeId: anime?.animeId ?? null,
    bangumiId: anime?.bangumiId ?? null,
    animeTitle: anime?.animeTitle ?? '',
    source: anime?.source ?? '',
    episodeCount: anime?.episodeCount ?? 0,
    year: anime?.startDate ? String(anime.startDate).slice(0, 4) : null,
    aliases: Array.isArray(anime?.aliases) ? anime.aliases.slice(0, 5) : []
  };
}

export function buildMatchSearchUrl(url, title, season = null) {
  const searchUrl = new URL('/api/v2/search/anime', url.origin);
  searchUrl.searchParams.set('keyword', title || '');
  const numericSeason = Number(season);
  if (Number.isInteger(numericSeason) && numericSeason > 0) {
    searchUrl.searchParams.set('season', String(numericSeason));
  }
  return searchUrl;
}

function deriveMatchFinalReasonCode(debugCollector, fallbackReasonCode) {
  if (!debugCollector?.enabled) return fallbackReasonCode;

  const attempts = debugCollector.toJSON()?.attempts || [];
  const reasons = attempts
    .flatMap(attempt => Array.isArray(attempt?.candidates) ? attempt.candidates : [])
    .filter(candidate => candidate?.decision !== 'matched')
    .map(candidate => candidate?.reasonCode)
    .filter(Boolean);

  if (reasons.length === 0) return fallbackReasonCode;

  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length === 1) return uniqueReasons[0];

  const priority = [
    'episode_not_found',
    'year_miss',
    'detail_missing',
    'season_miss',
    'title_miss',
    'prefer_filtered'
  ];

  return priority.find(reason => uniqueReasons.includes(reason)) || fallbackReasonCode;
}

export async function matchAnime(url, req, clientIp = null) {
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

    const debugCollector = createMatchDebugCollector(isMatchDebugEnabled(url));

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
    debugCollector.set('input', {
      fileName,
      cleanFileName,
      preferredPlatform
    });

    let {title, season, episode, year} = await extractTitleSeasonEpisode(cleanFileName);
    title = stripInvisibleChars(title);
    let mappedFrom = null;
    let simplifiedFrom = null;

    // 使用剧名映射表转换剧名
    if (globals.titleMappingTable && globals.titleMappingTable.size > 0) {
      const mappedTitle = globals.titleMappingTable.get(title);
      if (mappedTitle) {
        mappedFrom = title;
        title = mappedTitle;
        log("info", `Title mapped from original: ${url.searchParams.get("keyword")} to: ${title}`);
      }
    }

    // 如果启用了搜索关键字繁转简，则进行转换
    if (globals.animeTitleSimplified) {
      const simplifiedTitle = simplized(title);
      log("info", `matchAnime converted traditional to simplified: ${title} -> ${simplifiedTitle}`);
      simplifiedFrom = title;
      title = simplifiedTitle;
    }

    debugCollector.set('normalized', {
      title,
      season,
      episode,
      year,
      mappedFrom,
      simplifiedFrom
    });

    // 获取 prefer animeId（按 season 维度）
    const [preferAnimeId, preferSource, offsets] = getPreferAnimeId(title, season);
    log("info", `prefer animeId: ${preferAnimeId} from ${preferSource}`);

    // 根据指定平台创建动态平台顺序
    const platformRuleTitles = [title, simplifiedFrom, mappedFrom].filter(Boolean);
    const dynamicPlatformOrder = createDynamicPlatformOrder(preferredPlatform, platformRuleTitles, season);
    log("info", "Original platformOrderArr:", globals.platformOrderArr);
    log("info", "Dynamic platformOrder:", dynamicPlatformOrder);
    log("info", `Preferred platform: ${preferredPlatform || 'none'}`);
    debugCollector.set('preference', {
      preferAnimeId: preferAnimeId ?? null,
      preferSource: preferSource ?? null,
      offsets: offsets ?? null,
      dynamicPlatformOrder
    });

    const requestAnimeDetailsMap = new Map();
    getSearchCache(title, requestAnimeDetailsMap);

    let resAnime;
    let resEpisode;
    let resData = {
      "errorCode": 0,
      "success": true,
      "errorMessage": "",
      "isMatched": false,
      "matches": []
    };
    let finalMode = 'none';
    let finalReasonCode = 'no_match';

    // 快速路径：命中上次选择且本地缓存有链接时，直接匹配剧集，避免全源搜索
    const fastMatched = tryFastMatchFromPreferCache({
      title,
      season,
      episode,
      year,
      preferAnimeId,
      preferSource,
      preferredPlatform: preferredPlatform || dynamicPlatformOrder[0] || null,
      offsets,
      detailStore: requestAnimeDetailsMap
    });
    if (fastMatched.resAnime && fastMatched.resEpisode) {
      resAnime = fastMatched.resAnime;
      resEpisode = fastMatched.resEpisode;
      finalMode = 'fast_match';
      finalReasonCode = 'fast_match_cache_hit';
      log("info", `[FastMatch] 使用偏好缓存命中: ${resAnime.animeTitle}; episode: ${resEpisode.episodeTitle}`);
      log("info", `[AI匹配] 已跳过，原因：${getAiReasonText("fast_match_cache_hit")}`);
      debugCollector.set('search', {
        used: false,
        skippedReason: 'fast_match_cache_hit',
        rawCandidateCount: 0,
        candidateCount: 0,
        candidates: []
      });
      debugCollector.set('ai', {
        attempted: false,
        matched: false,
        reasonCode: 'fast_match_cache_hit',
        skippedReason: 'fast_match_cache_hit',
        latencyMs: 0,
        preferredPlatform: preferredPlatform || dynamicPlatformOrder[0] || null,
        selectedAnimeId: null,
        selectedAnimeTitle: null,
        selectedEpisodeTitle: null
      });
    } else {
      const originSearchUrl = buildMatchSearchUrl(url, title, season);
      log("info", `[matchAnime] 开始搜索候选: title=${title}, season=${season || 'N/A'}`);
      const searchRes = await searchAnime(
        originSearchUrl,
        preferAnimeId,
        preferSource,
        requestAnimeDetailsMap,
        { allowUnseasonedCacheFallback: true }
      );
      const searchData = await searchRes.json();
      const rawAnimes = Array.isArray(searchData?.animes) ? searchData.animes : [];
      log("info", `[matchAnime] 搜索候选数量: ${rawAnimes.length}`);

      // 过滤失效候选，避免列表里有条目但详情索引已不存在
      const validAnimes = rawAnimes.filter(anime => {
        return Boolean(
          resolveAnimeByIdFromDetailStore(anime?.bangumiId, requestAnimeDetailsMap, anime?.source) ||
          resolveAnimeByIdFromDetailStore(anime?.animeId, requestAnimeDetailsMap, anime?.source)
        );
      });
      if (validAnimes.length !== rawAnimes.length) {
        log("info", `[matchAnime] 已过滤失效候选: ${rawAnimes.length} -> ${validAnimes.length}`);
      }
      searchData.animes = validAnimes;
      log("info", `[matchAnime] 有效候选数量: ${searchData.animes.length}`);
      debugCollector.set('search', {
        used: true,
        skippedReason: null,
        rawCandidateCount: rawAnimes.length,
        candidateCount: searchData.animes.length,
        candidates: searchData.animes.slice(0, 20).map(summarizeMatchDebugAnimeCandidate)
      });

      if (searchData.animes.length > 0) {
        // 尝试使用AI进行匹配
        const aiPreferredPlatform = preferredPlatform || dynamicPlatformOrder.find(Boolean) || null;
        log("info", `[AI匹配] 开始请求：候选数=${searchData.animes.length}；偏好平台=${aiPreferredPlatform || "无"}`);
        const aiStartTime = Date.now();
        const aiMatchResult = await matchAniAndEpByAi(season, episode, year, searchData, title, req, dynamicPlatformOrder, preferAnimeId, aiPreferredPlatform, offsets, requestAnimeDetailsMap);
        const aiLatencyMs = Date.now() - aiStartTime;
        const aiMatched = Boolean(aiMatchResult.resAnime && aiMatchResult.resEpisode);
        const aiReasonText = getAiReasonText(aiMatchResult.reason);
        debugCollector.set('ai', {
          attempted: true,
          matched: aiMatched,
          reasonCode: aiMatchResult.reason || null,
          skippedReason: null,
          latencyMs: aiLatencyMs,
          preferredPlatform: aiPreferredPlatform,
          selectedAnimeId: aiMatchResult.resAnime?.animeId ?? null,
          selectedAnimeTitle: aiMatchResult.resAnime?.animeTitle ?? null,
          selectedEpisodeTitle: aiMatchResult.resEpisode?.episodeTitle ?? null
        });
        log("info", `[AI匹配] 结果：${aiMatched ? "命中" : "未命中"}；原因：${aiReasonText}；耗时：${aiLatencyMs}ms；候选数：${searchData?.animes?.length || 0}；偏好平台：${aiPreferredPlatform || "无"}`);
        if (aiMatched) {
          resAnime = aiMatchResult.resAnime;
          resEpisode = aiMatchResult.resEpisode;
          finalMode = 'ai';
          finalReasonCode = 'matched';
          log("info", `AI 匹配命中: ${resAnime.animeTitle}; 剧集: ${resEpisode.episodeTitle}`);
        } else {
          if (aiMatchResult.resAnime && !aiMatchResult.resEpisode) {
            log("warn", `AI 已选中动漫但未命中剧集，回退常规匹配: ${aiMatchResult.resAnime.animeTitle}`);
          }
          if (shouldSkipFallbackByAiResult(aiMatchResult)) {
            finalMode = 'ai';
            finalReasonCode = aiMatchResult.reason || 'ai_no_candidate';
            log("info", `[AI匹配] 已启用AI结果信任，跳过常规兜底；原因：${aiReasonText}`);
          } else {
            log("info", `[AI匹配] 未命中，进入常规匹配流程`);
            // AI匹配失败或未配置，使用传统匹配方式
            log("info", `[常规匹配] 平台尝试顺序: ${JSON.stringify(dynamicPlatformOrder)}`);
            for (const platform of dynamicPlatformOrder) {
              const __ret = await matchAniAndEp(season, episode, year, searchData, title, req, platform, preferAnimeId, offsets, requestAnimeDetailsMap, debugCollector);
              resEpisode = __ret.resEpisode;
              resAnime = __ret.resAnime;

              if (resAnime) {
                finalMode = 'normal';
                finalReasonCode = 'matched';
                log("info", `Found match with platform: ${platform || 'default'}`);
                break;
              }
            }

            // 如果都没有找到则返回第一个满足剧集数的剧集
            if (!resAnime) {
              log("info", `[常规匹配] 未命中，进入最终兜底匹配`);
              const __ret = await fallbackMatchAniAndEp(searchData, req, season, episode, year, resEpisode, resAnime, offsets, requestAnimeDetailsMap, debugCollector);
              resEpisode = __ret.resEpisode;
              resAnime = __ret.resAnime;
              if (resAnime) {
                finalMode = 'fallback';
                finalReasonCode = 'matched';
                log("info", `[兜底匹配] 命中: ${resAnime.animeTitle}`);
              } else {
                finalMode = 'fallback';
                finalReasonCode = 'no_match';
                log("info", `[兜底匹配] 未命中`);
              }
            }
          }
        }
      } else {
        const searchFailureReason = rawAnimes.length === 0 ? 'search_empty' : 'search_no_valid_candidates';
        finalMode = 'search';
        finalReasonCode = searchFailureReason;
        debugCollector.set('ai', {
          attempted: false,
          matched: false,
          reasonCode: null,
          skippedReason: searchFailureReason,
          latencyMs: 0,
          preferredPlatform: preferredPlatform || dynamicPlatformOrder.find(Boolean) || null,
          selectedAnimeId: null,
          selectedAnimeTitle: null,
          selectedEpisodeTitle: null
        });
        log("info", "[matchAnime] 无可用候选，跳过 AI 与回退匹配");
      }
    }

    if (resEpisode) {
      if (clientIp) {
        setLastSearch(clientIp, { title, season, episode, episodeId: resEpisode.episodeId });
      }
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

    debugCollector.finish({
      matched: Boolean(resAnime && resEpisode),
      mode: finalMode,
      reasonCode: resEpisode ? 'matched' : deriveMatchFinalReasonCode(debugCollector, finalReasonCode),
      animeId: resAnime?.animeId ?? null,
      animeTitle: resAnime?.animeTitle ?? null,
      episodeId: resEpisode?.episodeId ?? null,
      episodeTitle: resEpisode?.episodeTitle ?? null
    });
    if (debugCollector.enabled) {
      resData.debug = debugCollector.toJSON();
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
    log("info", `searchEpisodes converted traditional to simplified: ${anime} -> ${simplifiedTitle}`);
    anime = simplifiedTitle;
  }

  log("info", `Search episodes with anime: ${anime}, episode: ${episode}`);

  if (!anime) {
    log("error", "Missing anime parameter");
    return jsonResponse(
      { errorCode: 400, success: false, errorMessage: "Missing anime parameter" },
      400
    );
  }

  // 先搜索动漫。这里必须用 URLSearchParams 编码，避免剧名含 &/#/? 时被截断。
  let searchUrl = new URL('/search/anime', url.origin);
  searchUrl.searchParams.set('keyword', anime);
  const requestAnimeDetailsMap = new Map();
  const searchRes = await searchAnime(searchUrl, null, null, requestAnimeDetailsMap);
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
    const detailAnime =
      resolveAnimeByIdFromDetailStore(animeItem.bangumiId, requestAnimeDetailsMap, animeItem.source) ||
      resolveAnimeByIdFromDetailStore(animeItem.animeId, requestAnimeDetailsMap, animeItem.source);

    let bangumiData = null;
    if (detailAnime) {
      bangumiData = buildBangumiData(detailAnime, animeItem.bangumiId || animeItem.animeId);
    } else {
      const bangumiUrl = new URL(`/bangumi/${animeItem.bangumiId || animeItem.animeId}`, url.origin);
      const bangumiRes = await getBangumi(bangumiUrl.pathname, requestAnimeDetailsMap, animeItem.source);
      bangumiData = await bangumiRes.json();
    }

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
export async function getBangumi(path, detailStore = null, source = null) {
  const rawIdParam = path.split("/").pop();
  const idParam = decodeURIComponent(rawIdParam || '');
  let anime = resolveAnimeById(idParam, detailStore, source);
  if (!anime) {
    anime = await materializeLazyDetailDescriptor(idParam, detailStore, source);
  }

  if (!anime) {
    log("error", `Anime with ID ${idParam} not found`);
    return jsonResponse(
      { errorCode: 404, success: false, errorMessage: "Anime not found", bangumi: null },
      404
    );
  }

  const bangumiData = buildBangumiData(anime, idParam);
  if (!bangumiData.success && bangumiData.errorCode === 404) {
    return jsonResponse(bangumiData, 404);
  }

  return jsonResponse(bangumiData);
}

/**
 * 处理聚合源弹幕获取
 * @param {string} url 聚合URL
 * @returns {Promise<Array>} 合并后的弹幕列表
 */
async function fetchMergedComments(url, offsetContext = {}) {
  const parts = url.split(MERGE_DELIMITER);
  const resolveMergedLabel = (sourceName, realId) => {
    if (sourceName === 'hanjutv') {
      return getHanjutvSourceLabel(realId);
    }
    return sourceName;
  };

  const sourceParts = parts.map((part) => {
    const firstColonIndex = part.indexOf(':');
    if (firstColonIndex === -1) return null;
    const sourceName = part.substring(0, firstColonIndex);
    const realId = part.substring(firstColonIndex + 1);
    if (!sourceName || !realId) return null;
    return {
      sourceName,
      realId,
      label: resolveMergedLabel(sourceName, realId)
    };
  }).filter(Boolean);
  const sourceNames = sourceParts.map(part => part.sourceName);
  const realIds = sourceParts.map(part => part.realId);
  const sourceTag = sourceParts.map(part => part.label).join('＆');
  const { animeTitle, episodeTitle, commentId = null } = offsetContext || {};

  log("info", `[Merge] 开始获取 [${sourceTag}] 聚合弹幕...`);

  // 1. 检查聚合缓存
  const cached = getCommentCache(url);
  if (cached) {
    log("info", `[Merge] 命中缓存 [${sourceTag}]，返回 ${cached.length} 条`);
    return cached;
  }

  const stats = {};

  // 2. 并行获取所有源的弹幕
  const tasks = sourceParts.map(async ({ sourceName, realId, label }) => {
    const pendingKey = `${sourceName}:${realId}`;
    const statKey = sourceName === 'hanjutv' ? `hanjutv:${label}` : sourceName;

    if (PENDING_DANMAKU_REQUESTS.has(pendingKey)) {
      log("info", `[Merge] 复用正在进行的请求: ${pendingKey}`);
      try {
        const list = await PENDING_DANMAKU_REQUESTS.get(pendingKey);
        return list || [];
      } catch (e) {
        return [];
      }
    }

    const fetchTask = (async () => {
      const sourceInstance = resolveSourceInstance(sourceName);
      if (!sourceInstance) return [];

      try {
        const raw = await sourceInstance.getEpisodeDanmu(realId, parts);
        const formatted = sourceInstance.formatComments(raw);

        if (formatted && Array.isArray(formatted)) {
          formatted.forEach(item => item._sourceLabel = label);
        }

        stats[statKey] = Array.isArray(formatted) ? formatted.length : 0;
        return formatted;
      } catch (e) {
        log("error", `[Merge] 获取 ${sourceName} 失败: ${e.message}`);
        stats[statKey] = 0;
        return [];
      }
    })();

    PENDING_DANMAKU_REQUESTS.set(pendingKey, fetchTask);

    try {
      return await fetchTask;
    } finally {
      PENDING_DANMAKU_REQUESTS.delete(pendingKey);
    }
  });

  const results = await Promise.all(tasks);

  // 跨源时间轴对齐（函数内部会自行判断是否存在 dandan 源）
  alignSourceTimelines(results, sourceNames, realIds);

  // 按来源分别应用 DANMU_OFFSET（对齐后、合并前）
  if (globals.danmuOffsetRules?.length > 0) {
    for (let idx = 0; idx < results.length; idx++) {
      const list = results[idx];
      if (!Array.isArray(list) || list.length === 0) continue;

      const offsetRule = resolveDanmuOffsetRule({
        animeTitle,
        episodeTitle,
        source: sourceNames[idx],
        commentId
      });
      if (!offsetRule?.offset) continue;

      results[idx] = await applyDanmuOffsetByRule(
        list,
        offsetRule,
        realIds[idx],
        `[Merge] ${sourceNames[idx]} ${animeTitle || ''}/${episodeTitle || ''}`
      );

      if (Array.isArray(results[idx])) {
        results[idx].forEach(item => {
          if (!item._sourceLabel) item._sourceLabel = sourceParts[idx].label;
        });
      }
    }
  }

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
export async function getComment(path, queryFormat, segmentFlag, clientIp = null, includeDuration = false) {
  const commentId = parseInt(path.split("/").pop());
  const [animeId, source, cachedEpisodeTitle] = findAnimeIdByCommentId(commentId);
  let url = findUrlById(commentId);
  const episodeTitle = findTitleById(commentId) || cachedEpisodeTitle || null;
  const plat = episodeTitle ? (episodeTitle.match(/【(.*?)】/) || [null])[0]?.replace(/[【】]/g, '') : null;
  const animeTitle = findAnimeTitleById(commentId) || (animeId ? (findAnimeByAnimeId(animeId, source)?.animeTitle || '') : '');
  const shouldAttachDuration = shouldIncludeVideoDuration(queryFormat, includeDuration);
  log("debug", "comment url...", url);
  log("debug", "comment title...", episodeTitle);
  log("debug", "comment platform...", plat);
  if (!url) {
    log("error", `Comment with ID ${commentId} not found`);
    return jsonResponse({ count: 0, comments: [] }, 404);
  }
  log("info", `Fetched comment ID: ${commentId}`);

  // 检查弹幕缓存（分片列表请求不走弹幕缓存）
  const cachedComments = !segmentFlag ? getCommentCache(url) : null;
  if (cachedComments !== null) {
    const responseData = buildDanmuResponse(
      { count: cachedComments.length, comments: cachedComments },
      shouldAttachDuration ? await resolveMergedDuration(url) : null
    );
    return formatDanmuResponse(responseData, queryFormat);
  }

  log("info", "开始从本地请求弹幕...", url);
  const pendingKey = `comment:${url}|seg:${segmentFlag ? 1 : 0}`;
  const durationPromise = shouldAttachDuration ? resolveMergedDuration(url) : null;
  const isMergedUrl = url && url.includes(MERGE_DELIMITER);
  let danmus = await withPendingCommentRequest(pendingKey, async () => {
    let fetchedDanmus = [];

    if (isMergedUrl) {
      fetchedDanmus = await fetchMergedComments(url, { animeTitle, episodeTitle, commentId });
    } else {
      if (url.includes('.qq.com')) {
        fetchedDanmus = await tencentSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.iqiyi.com')) {
        fetchedDanmus = await iqiyiSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.mgtv.com')) {
        fetchedDanmus = await mangoSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.bilibili.com') || url.includes('b23.tv')) {
        if (url.includes('b23.tv')) {
          url = await bilibiliSource.resolveB23Link(url);
        }
        fetchedDanmus = await bilibiliSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.youku.com')) {
        fetchedDanmus = await youkuSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.miguvideo.com')) {
        fetchedDanmus = await miguSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.sohu.com')) {
        fetchedDanmus = await sohuSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.le.com')) {
        fetchedDanmus = await leshiSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.douyin.com') || url.includes('.ixigua.com')) {
        fetchedDanmus = await xiguaSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.mddcloud.com.cn')) {
        fetchedDanmus = await maiduiduiSource.getComments(url, plat, segmentFlag);
      } else if (url.startsWith('acfun://')) {
        fetchedDanmus = await acfunSource.getComments(url, plat, segmentFlag);
      } else if (url.includes('.yfsp.tv')) {
        fetchedDanmus = await aiyifanSource.getComments(url, plat, segmentFlag);
      }

      const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(\/.*)?$/i;
      if (!urlPattern.test(url)) {
        if (plat === "renren") {
          fetchedDanmus = await renrenSource.getComments(url, plat, segmentFlag);
        } else if (plat === "hanjutv") {
          fetchedDanmus = await hanjutvSource.getComments(url, plat, segmentFlag);
        } else if (plat === "bahamut") {
          fetchedDanmus = await bahamutSource.getComments(url, plat, segmentFlag);
        } else if (plat === "dandan") {
          fetchedDanmus = await dandanSource.getComments(url, plat, segmentFlag);
        } else if (plat === "custom") {
          fetchedDanmus = await customSource.getComments(url, plat, segmentFlag);
        } else if (plat === "acfun") {
          fetchedDanmus = await acfunSource.getComments(url, plat, segmentFlag);
        } else if (plat === "animeko") {
          fetchedDanmus = await animekoSource.getComments(url, plat, segmentFlag);
        } else if (plat === "ezdmw") {
          fetchedDanmus = await ezdmwSource.getComments(url, plat, segmentFlag);
        }
      }

      if ((!fetchedDanmus || fetchedDanmus.length === 0) && urlPattern.test(url)) {
        fetchedDanmus = await otherSource.getComments(url, "other_server", segmentFlag);
      }
    }

    return fetchedDanmus;
  });

  let updatedPreferKey = null;
  if (animeId && source) {
    let lastTitle = null;
    let lastSeason = null;
    let offset = null;

    if (clientIp) {
      const lastSearch = getLastSearch(clientIp);
      if (lastSearch?.episodeId === commentId && lastSearch.title) {
        lastTitle = lastSearch.title;
        lastSeason = lastSearch.season ?? null;
        if (lastSearch.season && lastSearch.episode && episodeTitle) {
          offset = `${lastSearch.episode}:${episodeTitle}`;
          log("info", `Calculated episode offset for IP ${clientIp}: Query E${lastSearch.episode}, Selected ${episodeTitle} -> Offset ${offset} (Season ${lastSeason})`);
        }
      }
    }

    const shouldUpdatePrefer = Boolean(lastTitle) && titleMatches(animeTitle, lastTitle);
    log("info", `animeTitle：${animeTitle}; lastTitle：${lastTitle}; titleMatches：${shouldUpdatePrefer}`);

    if (shouldUpdatePrefer) {
      updatedPreferKey = setPreferByAnimeId(animeId, source, lastSeason, offset);
    }
  }

  if (updatedPreferKey !== null) {
    if (globals.localCacheValid) {
        writeCacheToFile('lastSelectMap', Object.fromEntries(globals.lastSelectMap));
    }
    if (globals.redisValid) {
        setRedisKey('lastSelectMap', globals.lastSelectMap).catch(e => log("error", "Redis set error", e));
    }
    if (globals.localRedisValid) {
        setLocalRedisKey('lastSelectMap', globals.lastSelectMap);
    }
  }

  // 分片列表请求：直接返回分片信息（不做偏移、不做 count/comments 包装，也不走 XML）
  if (segmentFlag) {
    return jsonResponse(danmus);
  }

  if (danmus && danmus.comments) danmus = danmus.comments;
  if (!Array.isArray(danmus)) danmus = [];

  if (!isMergedUrl) {
    const offsetRule = resolveDanmuOffsetRule({ animeTitle, episodeTitle, source, commentId });
    if (offsetRule?.offset) {
      danmus = await applyDanmuOffsetByRule(
        danmus,
        offsetRule,
        url,
        `[Comment] ${animeTitle || ''}/${episodeTitle || ''}`
      );
    }
  }

  if (danmus.length > 0) {
    setCommentCache(url, danmus);
  }

  const responseData = buildDanmuResponse(
    { count: danmus.length, comments: danmus },
    durationPromise ? await durationPromise : null
  );
  return formatDanmuResponse(responseData, queryFormat);
}

// Extracted function for GET /api/v2/comment?url=xxx or /api/v2/extcomment?url=xxx
export async function getCommentByUrl(videoUrl, queryFormat, segmentFlag, includeDuration = false) {
  try {
    if (typeof videoUrl === 'string' && videoUrl.includes(MERGE_DELIMITER)) {
      return buildUrlValidationError('Merged url is not supported in url parameter, please provide a single video url');
    }

    const validation = await validateExternalUrl(videoUrl);
    if (!validation.ok) {
      return validation.response;
    }
    const originalUrl = validation.normalizedUrl;

    log("debug", `Processing comment request for URL: ${originalUrl}`);

    let url = originalUrl;
    const shouldAttachDuration = shouldIncludeVideoDuration(queryFormat, includeDuration);
    const durationPromise = shouldAttachDuration ? resolveMergedDuration(originalUrl) : null;

    if (!segmentFlag) {
      const cachedComments = getCommentCache(url);
      if (cachedComments !== null) {
        const responseData = buildDanmuResponse({
          errorCode: 0,
          success: true,
          errorMessage: "",
          count: cachedComments.length,
          comments: cachedComments
        }, durationPromise ? await durationPromise : null);
        return formatDanmuResponse(responseData, queryFormat);
      }
    }

    log("debug", "开始从本地请求弹幕...", url);

    let danmus = [];
    let resolvedUrl = url;
    let matchedSource = null;

    const findOffsetContextByUrls = (candidateUrls) => {
      for (const candidateUrl of candidateUrls) {
        if (!candidateUrl) continue;
        for (const anime of globals.animes || []) {
          const link = (anime.links || []).find(item => item.url === candidateUrl);
          if (link) {
            return {
              animeTitle: anime.animeTitle || '',
              episodeTitle: link.title || '',
              source: anime.source || matchedSource || null,
              commentId: link.id ?? null
            };
          }
        }
      }
      return {
        animeTitle: '',
        episodeTitle: '',
        source: matchedSource || null,
        commentId: null
      };
    };

    if (url.includes('.qq.com')) {
      matchedSource = 'tencent';
      danmus = await tencentSource.getComments(url, "qq", segmentFlag);
    } else if (url.includes('.iqiyi.com')) {
      matchedSource = 'iqiyi';
      danmus = await iqiyiSource.getComments(url, "qiyi", segmentFlag);
    } else if (url.includes('.mgtv.com')) {
      matchedSource = 'imgo';
      danmus = await mangoSource.getComments(url, "imgo", segmentFlag);
    } else if (url.includes('.bilibili.com') || url.includes('b23.tv')) {
      matchedSource = 'bilibili';
      if (url.includes('b23.tv')) {
        resolvedUrl = await bilibiliSource.resolveB23Link(url);
        const resolvedValidation = await validateExternalUrl(resolvedUrl);
        if (!resolvedValidation.ok) {
          return resolvedValidation.response;
        }
        resolvedUrl = resolvedValidation.normalizedUrl;
      }
      danmus = await bilibiliSource.getComments(resolvedUrl, "bilibili1", segmentFlag);
    } else if (url.includes('.youku.com')) {
      matchedSource = 'youku';
      danmus = await youkuSource.getComments(url, "youku", segmentFlag);
    } else if (url.includes('.miguvideo.com')) {
      matchedSource = 'migu';
      danmus = await miguSource.getComments(url, "migu", segmentFlag);
    } else if (url.includes('.sohu.com')) {
      matchedSource = 'sohu';
      danmus = await sohuSource.getComments(url, "sohu", segmentFlag);
    } else if (url.includes('.le.com')) {
      matchedSource = 'leshi';
      danmus = await leshiSource.getComments(url, "leshi", segmentFlag);
    } else if (url.includes('.douyin.com') || url.includes('.ixigua.com')) {
      matchedSource = 'xigua';
      danmus = await xiguaSource.getComments(url, "xigua", segmentFlag);
    } else if (url.includes('.mddcloud.com.cn')) {
      matchedSource = 'maiduidui';
      danmus = await maiduiduiSource.getComments(url, "maiduidui", segmentFlag);
    } else if (url.includes('.yfsp.tv')) {
      matchedSource = 'aiyifan';
      danmus = await aiyifanSource.getComments(url, "aiyifan", segmentFlag);
    } else {
      const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(\/.*)?$/i;
      if (urlPattern.test(url)) {
        matchedSource = 'other_server';
        danmus = await otherSource.getComments(url, "other_server", segmentFlag);
      }
    }

    if (segmentFlag) {
      return jsonResponse(danmus);
    }

    if (danmus && danmus.comments) danmus = danmus.comments;
    if (!Array.isArray(danmus)) danmus = [];

    const offsetContext = findOffsetContextByUrls([resolvedUrl, url, originalUrl]);
    const offsetRule = resolveDanmuOffsetRule({
      animeTitle: offsetContext.animeTitle,
      episodeTitle: offsetContext.episodeTitle,
      source: offsetContext.source || matchedSource,
      commentId: offsetContext.commentId
    });
    if (offsetRule?.offset) {
      danmus = await applyDanmuOffsetByRule(
        danmus,
        offsetRule,
        resolvedUrl || url,
        `[CommentByUrl] ${offsetContext.animeTitle || ''}/${offsetContext.episodeTitle || ''}`
      );
    }

    log("debug", `Successfully fetched ${danmus.length} comments from URL`);

    if (danmus.length > 0) {
      setCommentCache(resolvedUrl || url, danmus);
      if (originalUrl !== (resolvedUrl || url)) {
        setCommentCache(originalUrl, danmus);
      }
    }

    const responseData = buildDanmuResponse({
      errorCode: 0,
      success: true,
      errorMessage: "",
      count: danmus.length,
      comments: danmus
    }, durationPromise ? await durationPromise : null);
    return formatDanmuResponse(responseData, queryFormat);
  } catch (error) {
    log("error", `Failed to process comment by URL request: ${error.message}`);
    return jsonResponse(
      { errorCode: 500, success: false, errorMessage: "Internal server error", count: 0, comments: [] },
      500
    );
  }
}

function buildSegmentCommentCacheKey(segment = {}) {
  const url = String(segment?.url || '');
  const type = String(segment?.type || '');
  const start = Number(segment?.segment_start);
  const end = Number(segment?.segment_end);

  let dataPart = '';
  if (typeof segment?.data === 'string') {
    dataPart = segment.data;
  } else if (segment?.data !== undefined && segment?.data !== null) {
    try {
      dataPart = JSON.stringify(segment.data);
    } catch {
      dataPart = String(segment.data);
    }
  }

  return ['segment', type, url, Number.isFinite(start) ? start : '', Number.isFinite(end) ? end : '', dataPart].join('|');
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
    const segmentCacheKey = buildSegmentCommentCacheKey(segment);

    log("debug", `Processing segment comment request for URL: ${url}`);

    // 检查弹幕缓存
    const cachedComments = getCommentCache(segmentCacheKey);
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

    log("info", `开始从本地请求分段弹幕... URL: ${url}`);
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
    } else if (platform === "acfun") {
      danmus = await acfunSource.getSegmentComments(segment);
    } else if (platform === "aiyifan") {
      danmus = await aiyifanSource.getSegmentComments(segment);
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
    } else if (platform === "ezdmw") {
      danmus = await ezdmwSource.getSegmentComments(segment);
    } else if (platform === "custom") {
      danmus = await customSource.getSegmentComments(segment);
    } else if (platform === "other_server") {
      danmus = await otherSource.getSegmentComments(segment);
    }

    log("info", `Successfully fetched ${danmus.length} segment comments from URL`);

    // 缓存弹幕结果
    if (danmus.length > 0) {
      setCommentCache(segmentCacheKey, danmus);
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
