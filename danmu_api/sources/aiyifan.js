import BaseSource from './base.js';
import { log } from "../utils/log-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { hexToInt } from "../utils/danmu-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches, getExplicitSeasonNumber, extractSeasonNumberFromAnimeTitle } from "../utils/common-util.js";
import { globals } from '../configs/globals.js';
import { AiyifanAppSigningProvider } from '../utils/aiyifan-util.js';

const AIYIFAN_APP_LINK_VERSION = "2";
const AIYIFAN_PLAYLIST_CONCURRENCY = 4;
const AIYIFAN_DANMU_CACHE_TTL_MS = 2 * 60 * 1000;
const AIYIFAN_DANMU_CACHE_MAX_ENTRIES = 8;

function hasPositiveId(value) {
  return value !== null && value !== undefined && value !== '' && Number(value) > 0;
}

function getBarrageVideoId(episode) {
  if (hasPositiveId(episode && episode.uniqueID)) {
    return episode.uniqueID;
  }
  return hasPositiveId(episode && episode.episodeId) ? episode.episodeId : null;
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// =====================
// 获取爱壹帆弹幕（官方 App 链路）
// 接口均来自官方 Android App 抓包：
//   - 搜索: POST /api/List/GetTitleGetData
//   - 选集: POST /api/Video/VideoChooseGather
//   - 弹幕: GET  /api/Video/GetBarrages
// =====================
export default class AiyifanSource extends BaseSource {
  constructor(options = {}) {
    super();
    this.USER_AGENT = "okhttp-okgo/jeasonlzy";

    // API 基础地址（App 链路）
    this.SEARCH_API   = "https://api.tripdata.app/api/List/GetTitleGetData";
    this.PLAYLIST_API = "https://api.tripdata.app/api/Video/VideoChooseGather";
    this.BARRAGE_API  = "https://api.tripdata.app/api/Video/GetBarrages";
    this.DOMAIN_API   = "https://www.yfsp.tv/play";
    this.signingProvider = options.signingProvider || new AiyifanAppSigningProvider();
    this.playlistConcurrency = Number.isFinite(options.playlistConcurrency)
      ? Math.max(1, Math.floor(options.playlistConcurrency))
      : AIYIFAN_PLAYLIST_CONCURRENCY;
    this.danmuCacheTtlMs = Number.isFinite(options.danmuCacheTtlMs)
      ? Math.max(0, options.danmuCacheTtlMs)
      : AIYIFAN_DANMU_CACHE_TTL_MS;
    this.now = options.now || (() => Date.now());
    this.inflightDanmuRequests = new Map();
    this.danmuCache = new Map();
  }

  /**
   * 解析分集链接，提取 App 接口所需参数。
   * 新链接会携带 appLinkVersion=2；无版本链接必须重新查询播放列表，
   * 因为旧实现曾将 episodeId 错写成 GetBarrages 所需的 uniqueID。
   */
  parseEpisodeLink(id) {
    if (typeof id !== "string" || !id) {
      return null;
    }

    let url;
    try {
      url = new URL(id);
    } catch (e) {
      return null;
    }

    const episodeKey = url.searchParams.get("id");
    const pathParts = url.pathname.split("/").filter(Boolean);
    let mediaKey = url.searchParams.get("mediaKey");
    if (!mediaKey && pathParts.length) {
      try {
        mediaKey = decodeURIComponent(pathParts[pathParts.length - 1]);
      } catch (error) {
        return null;
      }
    }
    const videoId = url.searchParams.get("videoId");
    const videoType = url.searchParams.get("videoType");

    if (!episodeKey || !mediaKey) {
      return null;
    }

    return {
      episodeKey,
      mediaKey,
      videoId,
      videoType,
      duration: normalizeDuration(url.searchParams.get("duration")),
      appLinkVersion: url.searchParams.get("appLinkVersion")
    };
  }

  buildEpisodeLink(episodeRequest) {
    const params = [
      `id=${encodeURIComponent(episodeRequest.episodeKey)}`,
      `mediaKey=${encodeURIComponent(episodeRequest.mediaKey)}`,
      `videoId=${encodeURIComponent(episodeRequest.videoId)}`,
      `videoType=${encodeURIComponent(episodeRequest.videoType)}`,
      `appLinkVersion=${AIYIFAN_APP_LINK_VERSION}`
    ];
    if (episodeRequest.duration > 0) {
      params.push(`duration=${encodeURIComponent(episodeRequest.duration)}`);
    }
    return `${this.DOMAIN_API}/${encodeURIComponent(episodeRequest.mediaKey)}?${params.join('&')}`;
  }

  async resolveEpisodeRequest(id) {
    const parsed = this.parseEpisodeLink(id);
    if (!parsed) {
      return null;
    }

    const trustedLink = parsed.appLinkVersion === AIYIFAN_APP_LINK_VERSION &&
      hasPositiveId(parsed.videoId) && parsed.videoType !== null && parsed.videoType !== '';
    if (trustedLink) {
      return parsed;
    }

    const episodes = await this.getPlaylist(parsed.mediaKey);
    const episode = episodes.find((item) =>
      item && String(item.episodeKey) === String(parsed.episodeKey)
    );
    const videoId = getBarrageVideoId(episode);
    const videoType = episode && episode.videoType != null ? episode.videoType : parsed.videoType;
    if (!episode || !hasPositiveId(videoId) || videoType === null || videoType === undefined || videoType === '') {
      return null;
    }

    return {
      episodeKey: parsed.episodeKey,
      mediaKey: episode.mediaKey || parsed.mediaKey,
      videoId,
      videoType,
      duration: normalizeDuration(episode.epSecond) || parsed.duration,
      appLinkVersion: AIYIFAN_APP_LINK_VERSION
    };
  }

  getDanmuRequestKey(episodeRequest) {
    return [episodeRequest.mediaKey, episodeRequest.videoId, episodeRequest.videoType].join(':');
  }

  getCachedDanmu(requestKey) {
    const cached = this.danmuCache.get(requestKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= this.now()) {
      this.danmuCache.delete(requestKey);
      return null;
    }
    return cached.comments;
  }

  setCachedDanmu(requestKey, comments) {
    if (this.danmuCacheTtlMs <= 0 || !comments.length) {
      return;
    }
    this.danmuCache.delete(requestKey);
    this.danmuCache.set(requestKey, {
      comments,
      expiresAt: this.now() + this.danmuCacheTtlMs
    });
    while (this.danmuCache.size > AIYIFAN_DANMU_CACHE_MAX_ENTRIES) {
      this.danmuCache.delete(this.danmuCache.keys().next().value);
    }
  }

  /**
   * 搜索电视剧
   * @param {string} keyword - 搜索关键词
   * @param {number} page - 页码，默认为1（App 实际请求不带分页参数）
   * @param {number} size - 每页数量，默认为10
   * @returns {Promise<Object>} 搜索结果
   */
  async searchDrama(keyword, page = 1, size = 10) {
    log("info", `[aiyifan] [搜索] 关键词: ${keyword}, 页码: ${page}`);

    try {
      const payload = await this.signingProvider.signedPostJson(
        this.SEARCH_API,
        { SearchCriteria: keyword },
        "搜索"
      );
      return payload;
    } catch (error) {
      log("error", `[aiyifan] [搜索失败] 错误: ${error.message}`);
      return null;
    }
  }

  /**
   * 从搜索结果中提取剧目列表
   * @param {Object} searchResult - 搜索结果
   * @returns {Array} 剧目列表
   */
  extractDramaList(searchResult) {
    const dramas = [];
    const infoList = searchResult?.data?.list || [];

    if (!infoList.length) {
      log("warn", "[aiyifan] [警告] 搜索结果为空");
      return dramas;
    }

    for (const dramaInfo of infoList) {
      if (!dramaInfo || !dramaInfo.mediaKey) {
        continue;
      }

      const mediaKey = dramaInfo.mediaKey;
      const title = dramaInfo.title;

      dramas.push({
        contxt: mediaKey,
        mediaId: mediaKey,
        title: title,
        ...dramaInfo
      });
      log("info", `[aiyifan] [发现剧目] ${title}  mediaKey=${mediaKey}`);
    }

    return dramas;
  }

  /**
   * 通过 VideoChooseGather 接口获取该剧集的全部集信息
   * @param {string} mediaKey - 剧集唯一标识
   * @returns {Promise<Array>} 集列表
   */
  async getPlaylist(mediaKey) {
    log("info", `[aiyifan] [播放列表] 请求 mediaKey: ${mediaKey}`);

    try {
      const payload = await this.signingProvider.signedPostJson(
        this.PLAYLIST_API,
        { mediaKey: mediaKey },
        "播放列表"
      );

      const episodes = [];
      const list = payload.data?.list || [];
      for (const ep of list) {
        // 过滤 App 返回的占位项（如 "···"）
        if (ep && ep.episodeKey && (ep.episodeId > 0 || ep.uniqueID > 0)) {
          episodes.push(ep);
        }
      }

      log("info", `[aiyifan] [播放列表] 共获取到 ${episodes.length} 集`);
      return episodes;
    } catch (error) {
      log("error", `[aiyifan] [播放列表失败] 错误: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取某集弹幕列表
   * @param {string} mediaKey - 剧集 mediaKey
   * @param {number|string} videoId - 分集 episodeId/uniqueID
   * @param {number|string} videoType - 视频类型
   * @returns {Promise<Array>} 弹幕列表
   */
  async fetchBarrage(mediaKey, videoId, videoType) {
    log("info", `[aiyifan] [弹幕] 请求 mediaKey: ${mediaKey}, videoId: ${videoId}, videoType: ${videoType}`);

    try {
      const payload = await this.signingProvider.signedGetJson(
        this.BARRAGE_API,
        {
          mediaKey: mediaKey,
          videoId: videoId,
          videoType: videoType
        },
        "弹幕"
      );

      const danmuList = payload.data?.list || [];
      log("info", `[aiyifan] [弹幕] 获取到 ${danmuList.length} 条弹幕`);
      return danmuList;
    } catch (error) {
      log("error", `[aiyifan] [弹幕失败] 错误: ${error.message}`);
      return [];
    }
  }

  /**
   * 搜索功能
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 搜索结果
   */
  async search(keyword) {
    log("info", `[aiyifan] 开始搜索: ${keyword}`);

    // Step 1: 搜索，拿到剧目列表
    const searchResult = await this.searchDrama(keyword);
    if (!searchResult) {
      log("error", "[aiyifan] 搜索失败，退出");
      return [];
    }

    const dramas = this.extractDramaList(searchResult);
    if (!dramas.length) {
      log("warn", "[aiyifan] 未找到剧目信息，退出");
      return [];
    }

    // 转换搜索结果格式
    const results = dramas.map(drama => {
      return {
        provider: "aiyifan",
        mediaId: drama.mediaKey,  // mediaKey 作为 mediaId
        title: drama.title,
        type: drama.mediaType || drama.contentType || '',  // 默认类型
        year: new Date(drama.postTime).getFullYear(),  // 年份信息
        imageUrl: drama.coverImgUrl || '',  // 图片链接
        episodeCount: 0 // 初始集数为0，后续获取
      };
    });

    log("info", `[aiyifan] 搜索完成，找到 ${results.length} 个结果`);
    return results;
  }

  /**
   * 获取剧集详情
   * @param {string} id - 剧集 mediaKey
   * @returns {Promise<Array>} 剧集列表
   */
  async getEpisodes(id) {
    log("info", `[aiyifan] 获取剧集详情: ${id}`);

    // 获取播放列表
    const episodes = await this.getPlaylist(id);
    if (!episodes.length) {
      log("error", "[aiyifan] 获取播放列表失败");
      return [];
    }

    // 转换为标准格式
    const result = episodes.map((ep, index) => {
      const videoId = getBarrageVideoId(ep);
      const mediaKey = ep.mediaKey || id;
      if (!ep.episodeKey || !mediaKey || !hasPositiveId(videoId) || ep.videoType == null) {
        return null;
      }

      const episodeRequest = {
        episodeKey: ep.episodeKey,
        mediaKey,
        videoId,
        videoType: ep.videoType,
        duration: normalizeDuration(ep.epSecond),
        appLinkVersion: AIYIFAN_APP_LINK_VERSION
      };
      return {
        vid: ep.episodeKey,  // episodeKey 作为 vid
        id: videoId,
        mediaKey,
        videoType: ep.videoType,
        title: ep.episodeTitle || ep.title || `第${index + 1}集`,
        link: this.buildEpisodeLink(episodeRequest)
      };
    }).filter(Boolean);

    log("info", `[aiyifan] 获取到 ${result.length} 个剧集`);
    return result;
  }

  /**
   * 处理搜索结果
   * @param {Array} sourceAnimes 原始数据
   * @param {string} queryTitle 关键词
   * @param {Array} curAnimes 结果池
   * @param {Map} detailStore 详情缓存
   * @param {number|null} querySeason 目标季度
   */
  async handleAnimes(sourceAnimes, queryTitle, curAnimes, detailStore = null, querySeason = null) {
    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[aiyifan] sourceAnimes is not a valid array");
      return [];
    }

    // 基础标题与季度匹配过滤
    let filteredAnimes = sourceAnimes.filter(anime => titleMatches(anime.title, queryTitle, querySeason));

    // 提取搜索词中的明确季度信息或使用传入的季度参数
    const resolvedQuerySeason = querySeason !== null ? querySeason : getExplicitSeasonNumber(queryTitle);

    // 初始列表预过滤机制：若用户指定了季度，优先检查结果中是否已包含匹配项
    if (resolvedQuerySeason !== null) {
      const seasonFiltered = filteredAnimes.filter(anime => {
        const s = extractSeasonNumberFromAnimeTitle(anime.title).season;
        return s === resolvedQuerySeason || (resolvedQuerySeason === 1 && s === null);
      });

      // 如果已命中目标，减少详情请求量
      if (seasonFiltered.length > 0) {
        filteredAnimes = seasonFiltered;
        log("info", `[aiyifan] 结果已命中目标季(第${resolvedQuerySeason}季)，跳过非目标季相关请求`);
      }
    }

    const processed = await mapWithConcurrency(
      filteredAnimes,
      this.playlistConcurrency,
      async (anime) => {
        try {
          const eps = await this.getEpisodes(anime.mediaId);
          if (eps.length === 0) {
            log("info", `[aiyifan] ${anime.title} 无分集，跳过`);
            return null;
          }

          const links = eps.map((ep, index) => ({
            name: ep.title || `${index + 1}`,
            url: ep.link,
            title: `【aiyifan】 ${ep.title}`
          }));
          if (links.length === 0) return null;

          const transformedAnime = {
            animeId: convertToAsciiSum(anime.mediaId),
            bangumiId: anime.mediaId,
            animeTitle: `${anime.title}(${anime.year || 'N/A'})【${anime.type}】from aiyifan`,
            type: anime.type || '',
            typeDescription: anime.type || '',
            imageUrl: anime.imageUrl || '',
            startDate: generateValidStartDate(anime.year),
            episodeCount: links.length,
            rating: 0,
            isFavorited: true,
            source: "aiyifan",
          };
          return { transformedAnime, links };
        } catch (error) {
          log("error", `[aiyifan] 处理 ${anime.title} 失败:`, error.message);
          return null;
        }
      }
    );

    for (const item of processed) {
      if (!item) continue;
      tmpAnimes.push(item.transformedAnime);
      addAnime({ ...item.transformedAnime, links: item.links }, detailStore);
      if (globals.animes.length > globals.MAX_ANIMES) {
        removeEarliestAnime();
      }
    }

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return tmpAnimes;
  }

  /**
   * 获取某集的弹幕
   * @param {string} id - 分集链接或 episodeKey
   * @returns {Promise<Array>} 弹幕列表
   */
  async getEpisodeDanmu(id) {
    log("info", `[aiyifan] 获取弹幕: ${id}`);

    const episodeRequest = await this.resolveEpisodeRequest(id);
    if (!episodeRequest) {
      log("warn", "[aiyifan] 无法从链接恢复 mediaKey/uniqueID/videoType");
      return [];
    }

    const requestKey = this.getDanmuRequestKey(episodeRequest);
    const cached = this.getCachedDanmu(requestKey);
    if (cached) {
      log("info", `[aiyifan] 复用短期弹幕缓存: ${requestKey}`);
      return cached;
    }

    const inflightRequest = this.inflightDanmuRequests.get(requestKey);
    if (inflightRequest) {
      log("info", `[aiyifan] 复用进行中的弹幕请求: ${requestKey}`);
      return await inflightRequest;
    }

    const requestPromise = (async () => {
      const danmuList = await this.fetchBarrage(
        episodeRequest.mediaKey,
        episodeRequest.videoId,
        episodeRequest.videoType
      );
      if (danmuList.length === 0) {
        log("info", "[aiyifan] 未获取到弹幕");
        return [];
      }

      // 按时间排序
      danmuList.sort((a, b) => (a.second || 0) - (b.second || 0));
      this.setCachedDanmu(requestKey, danmuList);

      log("info", `[aiyifan] 获取到 ${danmuList.length} 条弹幕`);
      return danmuList;
    })();

    this.inflightDanmuRequests.set(requestKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      this.inflightDanmuRequests.delete(requestKey);
    }
  }

  /**
   * 获取某集的弹幕分片列表
   * @param {string} id - 分集链接
   * @returns {Promise<any>} 弹幕分片列表
   */
  async getEpisodeDanmuSegments(id) {
    const episodeRequest = await this.resolveEpisodeRequest(id);
    if (!episodeRequest) {
      return {
        "type": "aiyifan",
        "duration": 0,
        "segmentList": []
      };
    }

    const canonicalUrl = this.buildEpisodeLink(episodeRequest);
    let duration = episodeRequest.duration;
    if (duration <= 0) {
      const danmaku = await this.getEpisodeDanmu(canonicalUrl);
      duration = danmaku.reduce((max, d) => Math.max(max, Number(d.second) || 0), 0);
    }

    const segmentList = [{
      "type": "aiyifan",
      "segment_start": 0,
      "segment_end": duration,
      "url": canonicalUrl
    }];

    return {
      "type": "aiyifan",
      "duration": duration,
      "segmentList": segmentList
    };
  }

  /**
   * 获取某集的分片弹幕
   * @param {any} segment - 分片信息
   * @returns {Promise<Array>} 分片弹幕
   */
  async getEpisodeSegmentDanmu(segment) {
    if (!segment || !segment.url) {
      return [];
    }
    return await this.getEpisodeDanmu(segment.url);
  }

  /**
   * 格式化弹幕
   * @param {Array} comments - 原始弹幕
   * @returns {Array} 格式化后的弹幕
   */
  formatComments(comments) {
    if (!Array.isArray(comments)) {
      return [];
    }

    return comments.filter(Boolean).map(comment => {
      const second = Number(comment.second);
      const colorValue = String(comment.color || '#ffffff').replace(/^#/, '');
      const normalizedColor = colorValue.length === 8 ? colorValue.slice(2) : colorValue;
      return {
        ...comment,
        p: `${Number.isFinite(second) ? second : 0},${comment.position === 1 ? 5 : 1},25,${hexToInt(normalizedColor)},0,0,0,0`,
        m: comment.contxt || comment.content || '',
        like: Number(comment.good) || 0
      };
    });
  }
}
