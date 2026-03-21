import { globals } from '../configs/globals.js';
import { log } from './log-util.js'
import { Anime } from "../models/dandan-model.js";
import { simpleHash } from "./codec-util.js";
let fs, path;

// =====================
// cache数据结构处理函数
// =====================

// 用于存储最后一次搜索的上下文 (IP -> Context)
const lastSearchMap = new Map();

export function setLastSearch(ip, data) {
    if (!ip) {
        return;
    }

    lastSearchMap.set(ip, { ...data, timestamp: Date.now() });
    if (lastSearchMap.size > 200) {
        for (const [key, value] of lastSearchMap) {
            if (Date.now() - value.timestamp > 3600 * 1000) {
                lastSearchMap.delete(key);
            }
        }
    }
}

export function getLastSearch(ip) {
    return ip ? lastSearchMap.get(ip) : null;
}

function parseCacheContent(raw) {
    if (raw === null || raw === undefined) return null;
    let v = raw;
    if (typeof v === 'string') v = v.trim();
    if (v === '') return null;

    // First parse if it's a JSON string
    if (typeof v === 'string') {
        try {
            v = JSON.parse(v);
        } catch {
            return null;
        }
    }

    // Handle double-encoded JSON
    if (typeof v === 'string') {
        const s = v.trim();
        if (s !== '') {
            try {
                v = JSON.parse(s);
            } catch {
                // keep as string if second parse fails
            }
        }
    }

    return v;
}


function shouldUseRuntimeResponseCache() {
    const platform = String(globals.deployPlatform || '').trim().toLowerCase();
    return platform === '' || platform === 'node';
}

export function clearDisabledRuntimeResponseCaches() {
    if (shouldUseRuntimeResponseCache()) {
        return false;
    }

    let changed = false;

    if (globals.searchCache instanceof Map && globals.searchCache.size > 0) {
        globals.searchCache = new Map();
        changed = true;
    }

    if (globals.commentCache instanceof Map && globals.commentCache.size > 0) {
        globals.commentCache = new Map();
        changed = true;
    }

    if (changed) {
        log('info', '[cache] 非 node 平台已清空搜索/弹幕运行时缓存');
    }

    return changed;
}

function normalizeLegacyHanjutvEpisodeUrl(url, source = '', title = '') {
    const rawUrl = String(url ?? '').trim();
    if (!rawUrl.startsWith('xw:')) {
        return rawUrl;
    }

    const sourceName = String(source || '').trim().toLowerCase();
    const titleText = String(title || '');
    const isHanjutvLink = sourceName === 'hanjutv' || titleText.includes('【hanjutv】');

    return isHanjutvLink ? rawUrl.slice(3) : rawUrl;
}

function migrateLegacyAnimeLinks(anime) {
    if (!anime || !Array.isArray(anime.links)) {
        return { anime, changed: false };
    }

    let changed = false;
    const nextLinks = anime.links.map((link) => {
        if (!link || typeof link !== 'object') {
            return link;
        }

        const normalizedUrl = normalizeLegacyHanjutvEpisodeUrl(link.url, anime.source, link.title);
        if (normalizedUrl === link.url) {
            return link;
        }

        changed = true;
        return { ...link, url: normalizedUrl };
    });

    if (!changed) {
        return { anime, changed: false };
    }

    return {
        anime: Anime.fromJson({ ...anime, links: nextLinks }),
        changed: true,
    };
}

export function migrateLegacyRuntimeCaches() {
    let changed = false;

    if (Array.isArray(globals.episodeIds)) {
        globals.episodeIds = globals.episodeIds.map((episode) => {
            if (!episode || typeof episode !== 'object') {
                return episode;
            }

            const normalizedUrl = normalizeLegacyHanjutvEpisodeUrl(episode.url, 'hanjutv', episode.title);
            if (normalizedUrl === episode.url) {
                return episode;
            }

            changed = true;
            return { ...episode, url: normalizedUrl };
        });
    }

    if (Array.isArray(globals.animes)) {
        globals.animes = globals.animes.map((anime) => {
            const result = migrateLegacyAnimeLinks(anime);
            if (result.changed) {
                changed = true;
            }
            return result.anime;
        });
    }

    if (globals.animeDetailsCache instanceof Map) {
        globals.animeDetailsCache = new Map(
            Array.from(globals.animeDetailsCache.entries()).map(([key, entry]) => {
                if (!entry?.anime) {
                    return [key, entry];
                }

                const result = migrateLegacyAnimeLinks(entry.anime);
                if (!result.changed) {
                    return [key, entry];
                }

                changed = true;
                return [key, { ...entry, anime: result.anime }];
            })
        );
    }

    if (globals.episodeDetailsCache instanceof Map) {
        globals.episodeDetailsCache = new Map(
            Array.from(globals.episodeDetailsCache.entries()).map(([key, entry]) => {
                if (!entry || typeof entry !== 'object') {
                    return [key, entry];
                }

                const animeResult = migrateLegacyAnimeLinks(entry.anime);
                const normalizedUrl = normalizeLegacyHanjutvEpisodeUrl(entry?.link?.url, entry?.anime?.source, entry?.link?.title);
                const linkChanged = normalizedUrl !== entry?.link?.url;

                if (!animeResult.changed && !linkChanged) {
                    return [key, entry];
                }

                changed = true;
                return [
                    key,
                    {
                        ...entry,
                        anime: animeResult.anime,
                        link: linkChanged ? { ...entry.link, url: normalizedUrl } : entry.link,
                    },
                ];
            })
        );
    }

    if (globals.searchCache instanceof Map) {
        globals.searchCache = new Map(
            Array.from(globals.searchCache.entries()).map(([key, entry]) => {
                if (!entry || !Array.isArray(entry.details)) {
                    return [key, entry];
                }

                let entryChanged = false;
                const nextDetails = entry.details.map((anime) => {
                    const result = migrateLegacyAnimeLinks(anime);
                    if (result.changed) {
                        entryChanged = true;
                    }
                    return result.anime;
                });

                if (!entryChanged) {
                    return [key, entry];
                }

                changed = true;
                return [key, { ...entry, details: nextDetails }];
            })
        );
    }

    if (changed) {
        log('info', '[cache] 已迁移旧版 hanjutv xw: 剧集链接格式');
    }

    return changed;
}


function ensureDetailCaches() {
    if (!(globals.animeDetailsCache instanceof Map)) {
        globals.animeDetailsCache = new Map();
    }
    if (!(globals.episodeDetailsCache instanceof Map)) {
        globals.episodeDetailsCache = new Map();
    }
}

function getDetailCacheMinutes() {
    const cacheMinutes = Number(globals.searchCacheMinutes);
    return Number.isFinite(cacheMinutes) && cacheMinutes > 0 ? cacheMinutes : 3;
}

function getDetailCacheMaxItems(cacheName) {
    const configuredMaxItems = Number(
        cacheName === 'anime' ? globals.animeDetailCacheMaxItems : globals.episodeDetailCacheMaxItems
    );
    if (Number.isFinite(configuredMaxItems) && configuredMaxItems > 0) {
        return configuredMaxItems;
    }

    const searchCacheMaxItems = Number(globals.searchCacheMaxItems);
    const runtimeAnimeMaxItems = Number(globals.MAX_ANIMES);

    if (cacheName === 'anime') {
        return Math.max(
            Number.isFinite(searchCacheMaxItems) && searchCacheMaxItems > 0 ? searchCacheMaxItems * 4 : 0,
            Number.isFinite(runtimeAnimeMaxItems) && runtimeAnimeMaxItems > 0 ? runtimeAnimeMaxItems * 4 : 0,
            200
        );
    }

    return Math.max(
        Number.isFinite(searchCacheMaxItems) && searchCacheMaxItems > 0 ? searchCacheMaxItems * 20 : 0,
        Number.isFinite(runtimeAnimeMaxItems) && runtimeAnimeMaxItems > 0 ? runtimeAnimeMaxItems * 50 : 0,
        1000
    );
}

function normalizeAnimeId(idParam) {
    const rawId = String(idParam ?? '');
    if (!/^\d+$/.test(rawId)) {
        return null;
    }

    return String(parseInt(rawId, 10));
}

function normalizeAnimeSource(sourceParam) {
    const rawSource = String(sourceParam ?? '').trim();
    return rawSource === '' ? null : rawSource;
}

function getAnimeSourcePrefix(sourceParam) {
    const normalizedSource = normalizeAnimeSource(sourceParam);
    return normalizedSource ? `${normalizedSource}:` : '';
}

function getAnimeCacheKeyByAnimeId(idParam, sourceParam = null) {
    const normalizedAnimeId = normalizeAnimeId(idParam);
    return normalizedAnimeId === null ? null : `anime:${getAnimeSourcePrefix(sourceParam)}${normalizedAnimeId}`;
}

function getAnimeCacheKeyByBangumiId(idParam, sourceParam = null) {
    const rawId = String(idParam ?? '');
    return rawId === '' ? null : `bangumi:${getAnimeSourcePrefix(sourceParam)}${rawId}`;
}

function getAnimeDetailCacheKeys(anime) {
    return [
        getAnimeCacheKeyByAnimeId(anime?.animeId, anime?.source),
        getAnimeCacheKeyByBangumiId(anime?.bangumiId, anime?.source)
    ].filter((cacheKey, index, keys) => cacheKey && keys.indexOf(cacheKey) === index);
}

function getEpisodeDetailCacheKeys(anime) {
    return [
        ...new Set(
            (anime?.links || [])
                .map(link => {
                    if (link?.id === undefined || link?.id === null) {
                        return null;
                    }
                    return String(link.id);
                })
                .filter(Boolean)
        )
    ];
}

function getAnimePrimaryCacheKey(anime) {
    const sourcePrefix = getAnimeSourcePrefix(anime?.source);
    if (anime?.bangumiId !== undefined && anime?.bangumiId !== null && anime?.bangumiId !== '') {
        return `bangumi:${sourcePrefix}${String(anime.bangumiId)}`;
    }

    return `anime:${sourcePrefix}${String(anime?.animeId)}`;
}

function getAnimeDetailStore(detailStore = null) {
    return detailStore instanceof Map ? detailStore : null;
}

function storeAnimeInDetailStore(detailStore, anime) {
    const store = getAnimeDetailStore(detailStore);
    if (!(store instanceof Map) || !anime) {
        return;
    }

    getAnimeDetailCacheKeys(anime).forEach(cacheKey => {
        if (cacheKey) {
            store.set(cacheKey, anime);
        }
    });
}

function findAnimeInDetailStore(idParam, sourceParam = null, matchFn = null, detailStore = null) {
    const store = getAnimeDetailStore(detailStore);
    if (!(store instanceof Map)) {
        return null;
    }

    const rawId = String(idParam ?? '');
    if (rawId === '') {
        return null;
    }

    const cacheKeys = [
        getAnimeCacheKeyByBangumiId(rawId, sourceParam),
        getAnimeCacheKeyByAnimeId(rawId, sourceParam)
    ].filter(Boolean);

    for (const cacheKey of cacheKeys) {
        const anime = store.get(cacheKey);
        if (anime && matchesAnimeSource(anime, sourceParam) && (!matchFn || matchFn(anime))) {
            return anime;
        }
    }

    let fallback = null;
    const seen = new Set();
    for (const anime of store.values()) {
        if (!anime) {
            continue;
        }

        const identityKey = getAnimePrimaryCacheKey(anime);
        if (identityKey && seen.has(identityKey)) {
            continue;
        }
        if (identityKey) {
            seen.add(identityKey);
        }

        if (!matchesAnimeSource(anime, sourceParam)) {
            continue;
        }
        if (matchFn && !matchFn(anime)) {
            continue;
        }
        if (matchesBangumiId(anime, rawId) || matchesAnimeId(anime, rawId)) {
            fallback = anime;
            break;
        }
    }

    return fallback;
}

function getLatestAnimeDetailEntryByMatcher(matchFn) {
    ensureDetailCaches();

    let latestEntry = null;
    const seen = new Set();
    for (const [cacheKey] of globals.animeDetailsCache.entries()) {
        const entry = isDetailEntryValid(globals.animeDetailsCache, cacheKey);
        if (!entry?.anime) {
            continue;
        }

        const identityKey = getAnimePrimaryCacheKey(entry.anime);
        if (identityKey && seen.has(identityKey)) {
            continue;
        }
        if (identityKey) {
            seen.add(identityKey);
        }

        if (matchFn(entry.anime) && (!latestEntry || entry.timestamp > latestEntry.timestamp)) {
            latestEntry = entry;
        }
    }

    return latestEntry;
}

function isDetailEntryValid(cacheMap, cacheKey) {
    const entry = cacheMap.get(cacheKey);
    if (!entry) {
        return null;
    }

    const cacheAgeMinutes = (Date.now() - entry.timestamp) / (1000 * 60);
    if (cacheAgeMinutes > getDetailCacheMinutes()) {
        cacheMap.delete(cacheKey);
        return null;
    }

    return entry;
}

function getLatestAnimeDetailEntry(anime) {
    ensureDetailCaches();

    let latestEntry = null;
    for (const cacheKey of getAnimeDetailCacheKeys(anime)) {
        const entry = isDetailEntryValid(globals.animeDetailsCache, cacheKey);
        if (entry && (!latestEntry || entry.timestamp > latestEntry.timestamp)) {
            latestEntry = entry;
        }
    }

    return latestEntry;
}

function clearAnimeDetailCacheEntries(anime) {
    if (!anime) {
        return;
    }

    ensureDetailCaches();

    const latestEntry = getLatestAnimeDetailEntry(anime);
    const animeCacheKeys = new Set(getAnimeDetailCacheKeys(anime));
    const episodeIds = new Set();

    [anime, latestEntry?.anime].forEach(candidate => {
        getAnimeDetailCacheKeys(candidate).forEach(cacheKey => animeCacheKeys.add(cacheKey));
        (candidate?.links || []).forEach(link => {
            if (link?.id !== undefined && link?.id !== null) {
                episodeIds.add(String(link.id));
            }
        });
    });

    animeCacheKeys.forEach(cacheKey => globals.animeDetailsCache.delete(cacheKey));
    episodeIds.forEach(episodeId => globals.episodeDetailsCache.delete(episodeId));
}

function clearEpisodeDetailCacheEntries(anime) {
    getEpisodeDetailCacheKeys(anime).forEach(cacheKey => {
        globals.episodeDetailsCache.delete(cacheKey);
    });
}

function enforceAnimeDetailCacheMaxItems() {
    const maxItems = getDetailCacheMaxItems('anime');
    if (!Number.isFinite(maxItems) || maxItems <= 0) {
        return;
    }

    while (globals.animeDetailsCache.size > maxItems) {
        const oldestEntry = globals.animeDetailsCache.entries().next().value;
        if (!oldestEntry) {
            break;
        }

        const [oldestKey, oldestValue] = oldestEntry;
        if (!oldestValue?.anime) {
            globals.animeDetailsCache.delete(oldestKey);
            continue;
        }

        log("debug", `anime-detail cache exceeded max items (${maxItems}), evicted oldest anime: ${oldestKey}`);
        clearAnimeDetailCacheEntries(oldestValue.anime);
    }
}

function enforceEpisodeDetailCacheMaxItems() {
    const maxItems = getDetailCacheMaxItems('episode');
    if (!Number.isFinite(maxItems) || maxItems <= 0) {
        return;
    }

    while (globals.episodeDetailsCache.size > maxItems) {
        const oldestEntry = globals.episodeDetailsCache.entries().next().value;
        if (!oldestEntry) {
            break;
        }

        const [oldestKey, oldestValue] = oldestEntry;
        if (!oldestValue?.anime) {
            globals.episodeDetailsCache.delete(oldestKey);
            continue;
        }

        const animeEpisodeKeys = getEpisodeDetailCacheKeys(oldestValue.anime)
            .filter(cacheKey => globals.episodeDetailsCache.has(cacheKey));

        if (animeEpisodeKeys.length === 0) {
            globals.episodeDetailsCache.delete(oldestKey);
            continue;
        }

        // 单个番剧的剧集数超过上限时，宁可软超限也不拆散同一番剧的上下文。
        if (animeEpisodeKeys.length === globals.episodeDetailsCache.size) {
            log("debug", `episode-detail cache size ${globals.episodeDetailsCache.size} exceeds max items (${maxItems}), keeping newest anime episode set intact`);
            break;
        }

        log("debug", `episode-detail cache exceeded max items (${maxItems}), evicted oldest anime episodes: ${oldestKey}`);
        clearEpisodeDetailCacheEntries(oldestValue.anime);
    }
}

function cacheAnimeDetail(anime, timestamp = Date.now()) {
    if (!anime) {
        return null;
    }

    ensureDetailCaches();

    const existingEntry = getLatestAnimeDetailEntry(anime);
    if (existingEntry?.anime && existingEntry.timestamp > timestamp) {
        return existingEntry.anime;
    }

    clearAnimeDetailCacheEntries(anime);

    const animeCopy = Anime.fromJson(anime);
    const entry = { anime: animeCopy, timestamp };

    const animeCacheKey = getAnimeCacheKeyByAnimeId(animeCopy.animeId, animeCopy.source);
    const bangumiCacheKey = getAnimeCacheKeyByBangumiId(animeCopy.bangumiId, animeCopy.source);

    if (animeCacheKey) {
        globals.animeDetailsCache.set(animeCacheKey, entry);
    }
    if (bangumiCacheKey) {
        globals.animeDetailsCache.set(bangumiCacheKey, entry);
    }

    (animeCopy.links || []).forEach((link, linkIndex) => {
        globals.episodeDetailsCache.set(String(link.id), {
            anime: animeCopy,
            link,
            linkIndex,
            timestamp
        });
    });

    enforceAnimeDetailCacheMaxItems();
    enforceEpisodeDetailCacheMaxItems();

    return animeCopy;
}

function cacheAnimeDetails(animes, timestamp = Date.now()) {
    if (!Array.isArray(animes)) {
        return;
    }

    animes.forEach(anime => {
        cacheAnimeDetail(anime, timestamp);
    });
}

function getAnimeFromDetailCacheByAnimeId(idParam, sourceParam = null) {
    ensureDetailCaches();

    const cacheKey = getAnimeCacheKeyByAnimeId(idParam, sourceParam);
    if (cacheKey) {
        const entry = isDetailEntryValid(globals.animeDetailsCache, cacheKey);
        if (entry?.anime) {
            return entry.anime;
        }
    }

    const normalizedAnimeId = normalizeAnimeId(idParam);
    if (normalizedAnimeId === null) {
        return null;
    }

    return getLatestAnimeDetailEntryByMatcher(anime => matchesAnimeSource(anime, sourceParam) && matchesAnimeId(anime, normalizedAnimeId))?.anime || null;
}

function getAnimeFromDetailCacheByBangumiId(idParam, sourceParam = null) {
    ensureDetailCaches();

    const cacheKey = getAnimeCacheKeyByBangumiId(idParam, sourceParam);
    if (cacheKey) {
        const entry = isDetailEntryValid(globals.animeDetailsCache, cacheKey);
        if (entry?.anime) {
            return entry.anime;
        }
    }

    const rawId = String(idParam ?? '');
    if (rawId === '') {
        return null;
    }

    return getLatestAnimeDetailEntryByMatcher(anime => matchesAnimeSource(anime, sourceParam) && matchesBangumiId(anime, rawId))?.anime || null;
}

function getEpisodeDetailFromCache(commentId) {
    ensureDetailCaches();
    const entry = isDetailEntryValid(globals.episodeDetailsCache, String(commentId));
    return entry || null;
}

function getEpisodeDetailFromAnimeCache(commentId) {
    const rawCommentId = String(commentId ?? '');
    if (rawCommentId === '') {
        return null;
    }

    const entry = getLatestAnimeDetailEntryByMatcher(
        anime => Array.isArray(anime?.links) && anime.links.some(link => String(link?.id) === rawCommentId)
    );
    if (!entry?.anime || !Array.isArray(entry.anime.links)) {
        return null;
    }

    const linkIndex = entry.anime.links.findIndex(link => String(link?.id) === rawCommentId);
    if (linkIndex === -1) {
        return null;
    }

    const animeCopy = cacheAnimeDetail(entry.anime, entry.timestamp);
    return {
        anime: animeCopy,
        link: animeCopy.links[linkIndex],
        linkIndex,
        timestamp: entry.timestamp
    };
}

function matchesAnimeId(anime, targetId) {
    if (!anime) {
        return false;
    }

    const normalizedAnimeId = normalizeAnimeId(targetId);
    return normalizedAnimeId !== null && String(anime.animeId) === normalizedAnimeId;
}

function matchesBangumiId(anime, targetId) {
    if (!anime) {
        return false;
    }

    const rawId = String(targetId ?? '');
    return rawId !== '' && String(anime.bangumiId ?? '') === rawId;
}

function matchesAnimeSource(anime, sourceParam = null) {
    const normalizedSource = normalizeAnimeSource(sourceParam);
    if (!normalizedSource) {
        return true;
    }

    return normalizeAnimeSource(anime?.source) === normalizedSource;
}

function hasSameAnimeIdentity(leftAnime, rightAnime) {
    if (!leftAnime || !rightAnime || !matchesAnimeSource(leftAnime, rightAnime?.source)) {
        return false;
    }

    const leftBangumiId = String(leftAnime?.bangumiId ?? '');
    const rightBangumiId = String(rightAnime?.bangumiId ?? '');
    if (leftBangumiId !== '' && rightBangumiId !== '' && leftBangumiId === rightBangumiId) {
        return true;
    }

    const leftAnimeId = normalizeAnimeId(leftAnime?.animeId);
    const rightAnimeId = normalizeAnimeId(rightAnime?.animeId);
    return leftAnimeId !== null && leftAnimeId === rightAnimeId;
}

function findRuntimeAnime(matchFn, sourceParam = null) {
    for (const anime of globals.animes) {
        if (matchesAnimeSource(anime, sourceParam) && matchFn(anime)) {
            return anime;
        }
    }

    return null;
}

function findAnimeInSearchCache(matchFn, sourceParam = null) {
    if (!shouldUseRuntimeResponseCache()) {
        return null;
    }

    let latestMatch = null;

    for (const [keyword] of globals.searchCache.entries()) {
        if (!isSearchCacheValid(keyword)) {
            continue;
        }

        const cached = globals.searchCache.get(keyword);
        if (!cached || !Array.isArray(cached.details)) {
            continue;
        }

        const matchedAnime = cached.details.find(anime => matchesAnimeSource(anime, sourceParam) && matchFn(anime));
        if (matchedAnime && (!latestMatch || cached.timestamp > latestMatch.timestamp)) {
            latestMatch = { anime: matchedAnime, timestamp: cached.timestamp };
        }
    }

    return latestMatch ? cacheAnimeDetail(latestMatch.anime, latestMatch.timestamp) : null;
}

function findAnimeByAnimeIdFromRuntime(idParam, sourceParam = null, detailStore = null) {
    const runtimeAnime = findRuntimeAnime(anime => matchesAnimeId(anime, idParam), sourceParam);
    if (runtimeAnime) {
        return cacheAnimeDetail(runtimeAnime);
    }

    const detailAnime = findAnimeInDetailStore(idParam, sourceParam, anime => matchesAnimeId(anime, idParam), detailStore);
    if (detailAnime) {
        return detailAnime;
    }

    return getAnimeFromDetailCacheByAnimeId(idParam, sourceParam);
}

function findAnimeByBangumiIdFromRuntime(idParam, sourceParam = null, detailStore = null) {
    const runtimeAnime = findRuntimeAnime(anime => matchesBangumiId(anime, idParam), sourceParam);
    if (runtimeAnime) {
        return cacheAnimeDetail(runtimeAnime);
    }

    const detailAnime = findAnimeInDetailStore(idParam, sourceParam, anime => matchesBangumiId(anime, idParam), detailStore);
    if (detailAnime) {
        return detailAnime;
    }

    return getAnimeFromDetailCacheByBangumiId(idParam, sourceParam);
}

function findAnimeByAnimeIdFromSearchCache(idParam, sourceParam = null) {
    return findAnimeInSearchCache(anime => matchesAnimeId(anime, idParam), sourceParam);
}

function findAnimeByBangumiIdFromSearchCache(idParam, sourceParam = null) {
    return findAnimeInSearchCache(anime => matchesBangumiId(anime, idParam), sourceParam);
}

function collectMatchedSearchDetails(results, detailStore = null) {
    if (!Array.isArray(results) || results.length === 0) {
        return [];
    }

    const matchedDetails = new Map();
    for (const anime of results) {
        if (!anime) {
            continue;
        }

        const detailAnime = findAnimeByBangumiIdFromRuntime(anime.bangumiId, anime.source, detailStore) || findAnimeByAnimeIdFromRuntime(anime.animeId, anime.source, detailStore);
        if (!detailAnime) {
            continue;
        }

        matchedDetails.set(getAnimePrimaryCacheKey(detailAnime), detailAnime);
    }

    return Array.from(matchedDetails.values());
}

function findCachedAnimeLinkByCommentId(commentId) {
    for (const anime of globals.animes) {
        if (!anime || !Array.isArray(anime.links)) {
            continue;
        }

        const linkIndex = anime.links.findIndex(link => String(link.id) === String(commentId));
        if (linkIndex !== -1) {
            const animeCopy = cacheAnimeDetail(anime);
            return { anime: animeCopy, link: animeCopy.links[linkIndex], linkIndex, timestamp: Date.now() };
        }
    }

    const cachedDetail = getEpisodeDetailFromCache(commentId);
    if (cachedDetail) {
        return cachedDetail;
    }

    const animeCachedDetail = getEpisodeDetailFromAnimeCache(commentId);
    if (animeCachedDetail) {
        return animeCachedDetail;
    }

    let latestMatch = null;
    if (shouldUseRuntimeResponseCache()) {
        for (const [keyword] of globals.searchCache.entries()) {
            if (!isSearchCacheValid(keyword)) {
                continue;
            }

            const cached = globals.searchCache.get(keyword);
            if (!cached || !Array.isArray(cached.details)) {
                continue;
            }

            for (const anime of cached.details) {
                if (!anime || !Array.isArray(anime.links)) {
                    continue;
                }

                const linkIndex = anime.links.findIndex(link => String(link.id) === String(commentId));
                if (linkIndex !== -1) {
                    if (!latestMatch || cached.timestamp > latestMatch.timestamp) {
                        latestMatch = { anime, linkIndex, timestamp: cached.timestamp };
                    }
                }
            }
        }
    }

    if (!latestMatch) {
        return null;
    }

    const animeCopy = cacheAnimeDetail(latestMatch.anime, latestMatch.timestamp);
    return {
        anime: animeCopy,
        link: animeCopy.links[latestMatch.linkIndex],
        linkIndex: latestMatch.linkIndex,
        timestamp: latestMatch.timestamp
    };
}

export function findAnimeByAnimeId(idParam, sourceParam = null, detailStore = null) {
    return findAnimeByAnimeIdFromRuntime(idParam, sourceParam, detailStore) || findAnimeByAnimeIdFromSearchCache(idParam, sourceParam);
}

export function findAnimeByBangumiId(idParam, sourceParam = null, detailStore = null) {
    return findAnimeByBangumiIdFromRuntime(idParam, sourceParam, detailStore) || findAnimeByBangumiIdFromSearchCache(idParam, sourceParam);
}

export function findAnimeById(idParam, sourceParam = null, detailStore = null) {
    const rawId = String(idParam ?? '');
    if (rawId === '') {
        return null;
    }

    const normalizedAnimeId = normalizeAnimeId(rawId);
    if (normalizedAnimeId !== null && rawId !== normalizedAnimeId) {
        return findAnimeByBangumiId(rawId, sourceParam, detailStore) || findAnimeByAnimeId(rawId, sourceParam, detailStore);
    }

    return findAnimeByAnimeId(rawId, sourceParam, detailStore) || findAnimeByBangumiId(rawId, sourceParam, detailStore);
}

// 检查搜索缓存是否有效（未过期）
export function isSearchCacheValid(keyword) {
    if (!shouldUseRuntimeResponseCache()) {
        return false;
    }

    if (!globals.searchCache.has(keyword)) {
        return false;
    }

    const cached = globals.searchCache.get(keyword);
    const now = Date.now();
    const cacheAgeMinutes = (now - cached.timestamp) / (1000 * 60);

    if (cacheAgeMinutes > globals.searchCacheMinutes) {
        // 缓存已过期，删除它
        globals.searchCache.delete(keyword);
        log("info", `Search cache for "${keyword}" expired after ${cacheAgeMinutes.toFixed(2)} minutes`);
        return false;
    }

    return true;
}

// 获取搜索缓存
export function getSearchCache(keyword, detailStore = null) {
    if (!shouldUseRuntimeResponseCache()) {
        return null;
    }

    if (isSearchCacheValid(keyword)) {
        log("info", `Using search cache for "${keyword}"`);
        const cached = globals.searchCache.get(keyword);
        const details = Array.isArray(cached.details) ? cached.details : [];
        details.forEach(anime => storeAnimeInDetailStore(detailStore, anime));
        // 命中搜索缓存时顺带预热详情索引，确保被 MAX_ANIMES 裁剪后的详情仍可回填。
        cacheAnimeDetails(details, cached.timestamp);
        return cached.results;
    }
    return null;
}

function enforceCacheMaxItems(cacheMap, maxItems, cacheName) {
    if (!Number.isFinite(maxItems) || maxItems <= 0) return;
    while (cacheMap.size > maxItems) {
        const oldestKey = cacheMap.keys().next().value;
        if (typeof oldestKey === 'undefined') break;
        cacheMap.delete(oldestKey);
        log("debug", `${cacheName} cache exceeded max items (${maxItems}), evicted oldest key: ${oldestKey}`);
    }
}

// 设置搜索缓存
export function setSearchCache(keyword, results, detailStore = null) {
    if (!shouldUseRuntimeResponseCache()) {
        return;
    }

    const timestamp = Date.now();
    const details = collectMatchedSearchDetails(results, detailStore);
    cacheAnimeDetails(details, timestamp);

    // 先删除再写入，确保命中的 key 会刷新到最新顺序
    if (globals.searchCache.has(keyword)) {
        globals.searchCache.delete(keyword);
    }

    globals.searchCache.set(keyword, {
        results: results,
        details: details,
        timestamp
    });
    enforceCacheMaxItems(globals.searchCache, Number(globals.searchCacheMaxItems), 'search');

    log("info", `Cached search results for "${keyword}" (${results.length} animes)`);
}

// 检查弹幕缓存是否有效（未过期）
export function isCommentCacheValid(videoUrl) {
    if (!shouldUseRuntimeResponseCache()) {
        return false;
    }

    if (!globals.commentCache.has(videoUrl)) {
        return false;
    }

    const cached = globals.commentCache.get(videoUrl);
    const now = Date.now();
    const cacheAgeMinutes = (now - cached.timestamp) / (1000 * 60);

    if (cacheAgeMinutes > globals.commentCacheMinutes) {
        // 缓存已过期，删除它
        globals.commentCache.delete(videoUrl);
        log("info", `Comment cache for "${videoUrl}" expired after ${cacheAgeMinutes.toFixed(2)} minutes`);
        return false;
    }

    return true;
}

// 获取弹幕缓存
export function getCommentCache(videoUrl) {
    if (!shouldUseRuntimeResponseCache()) {
        return null;
    }

    if (isCommentCacheValid(videoUrl)) {
        log("info", `Using comment cache for "${videoUrl}"`);
        return globals.commentCache.get(videoUrl).comments;
    }
    return null;
}

// 设置弹幕缓存
export function setCommentCache(videoUrl, comments) {
    if (!shouldUseRuntimeResponseCache()) {
        return;
    }

    // 先删除再写入，确保命中的 key 会刷新到最新顺序
    if (globals.commentCache.has(videoUrl)) {
        globals.commentCache.delete(videoUrl);
    }

    globals.commentCache.set(videoUrl, {
        comments: comments,
        timestamp: Date.now()
    });
    enforceCacheMaxItems(globals.commentCache, Number(globals.commentCacheMaxItems), 'comment');

    log("info", `Cached comments for "${videoUrl}" (${comments.length} comments)`);
}

// 添加元素到 episodeIds：检查 url 是否存在，若不存在则以自增 id 添加
export function addEpisode(url, title) {
    // 检查是否已存在相同的 url 和 title
    const existingEpisode = globals.episodeIds.find(episode => episode.url === url && episode.title === title);
    if (existingEpisode) {
        log("info", `Episode with URL ${url} and title ${title} already exists in episodeIds, returning existing episode.`);
        return existingEpisode; // 返回已存在的 episode
    }

    // 自增 episodeNum 并使用作为 id
    globals.episodeNum++;
    const newEpisode = { id: globals.episodeNum, url: url, title: title };

    // 添加新对象
    globals.episodeIds.push(newEpisode);

    log("info", `Added to episodeIds: ${JSON.stringify(newEpisode)}`);
    return newEpisode; // 返回新添加的对象
}

// 删除指定 URL 的对象从 episodeIds
export function removeEpisodeByUrl(url) {
    const initialLength = globals.episodeIds.length;
    globals.episodeIds = globals.episodeIds.filter(episode => episode.url !== url);
    const removedCount = initialLength - globals.episodeIds.length;
    if (removedCount > 0) {
        log("info", `Removed ${removedCount} episode(s) from episodeIds with URL: ${url}`);
        return true;
    }
    log("error", `No episode found in episodeIds with URL: ${url}`);
    return false;
}

function removeEpisodeById(id) {
    const initialLength = globals.episodeIds.length;
    globals.episodeIds = globals.episodeIds.filter(episode => String(episode.id) !== String(id));
    const removedCount = initialLength - globals.episodeIds.length;
    if (removedCount > 0) {
        log("info", `Removed ${removedCount} episode(s) from episodeIds with ID: ${id}`);
        return true;
    }
    return false;
}

function cleanupDetachedEpisodeIds(links, retainedEpisodeIds = new Set()) {
    if (!Array.isArray(links) || links.length === 0) {
        return;
    }

    ensureDetailCaches();

    const activeEpisodeIds = new Set();
    for (const anime of globals.animes) {
        if (!anime || !Array.isArray(anime.links)) {
            continue;
        }

        anime.links.forEach(link => {
            if (link?.id !== undefined && link?.id !== null) {
                activeEpisodeIds.add(String(link.id));
            }
        });
    }

    retainedEpisodeIds.forEach(episodeId => {
        if (episodeId !== undefined && episodeId !== null) {
            activeEpisodeIds.add(String(episodeId));
        }
    });

    links.forEach(link => {
        const episodeId = String(link?.id ?? '');
        if (!episodeId || activeEpisodeIds.has(episodeId)) {
            return;
        }

        removeEpisodeById(episodeId);
        globals.episodeDetailsCache.delete(episodeId);
    });
}

// 根据 ID 查找 URL
export function findUrlById(id) {
    const episode = globals.episodeIds.find(episode => String(episode.id) === String(id));
    if (episode) {
        log("info", `Found URL for ID ${id}: ${episode.url}`);
        return episode.url;
    }

    const cachedDetail = findCachedAnimeLinkByCommentId(id);
    if (cachedDetail?.link?.url) {
        log("info", `Found URL for ID ${id} from detail cache: ${cachedDetail.link.url}`);
        return cachedDetail.link.url;
    }

    log("error", `No URL found for ID: ${id}`);
    return null;
}

// 根据 ID 查找 TITLE
export function findTitleById(id) {
    const episode = globals.episodeIds.find(episode => String(episode.id) === String(id));
    if (episode) {
        log("info", `Found TITLE for ID ${id}: ${episode.title}`);
        return episode.title;
    }

    const cachedDetail = findCachedAnimeLinkByCommentId(id);
    if (cachedDetail?.link?.title) {
        log("info", `Found TITLE for ID ${id} from detail cache: ${cachedDetail.link.title}`);
        return cachedDetail.link.title;
    }

    log("error", `No TITLE found for ID: ${id}`);
    return null;
}

// 根据 ID 查找 animeTitle
export function findAnimeTitleById(id) {
    for (const anime of globals.animes) {
        if (!anime.links || !Array.isArray(anime.links)) {
            continue;
        }

        const match = anime.links.find(link => String(link.id) === String(id));
        if (match) {
            log("info", `Found animeTitle for ID ${id}: ${anime.animeTitle}`);
            return anime.animeTitle;
        }
    }

    const cachedDetail = findCachedAnimeLinkByCommentId(id);
    if (cachedDetail?.anime?.animeTitle) {
        log("info", `Found animeTitle for ID ${id} from detail cache: ${cachedDetail.anime.animeTitle}`);
        return cachedDetail.anime.animeTitle;
    }

    log("error", `No animeTitle found for ID: ${id}`);
    return null;
}

// 添加 anime 对象到 animes，并将其 links 添加到 episodeIds
export function addAnime(anime, detailStore = null) {
    anime = Anime.fromJson(anime);
    try {
        // 确保 anime 有 links 属性且是数组
        if (!anime.links || !Array.isArray(anime.links)) {
            log("error", `Invalid or missing links in anime: ${JSON.stringify(anime)}`);
            return false;
        }

        // 遍历 links，调用 addEpisode，并收集返回的对象
        const newLinks = [];
        anime.links.forEach(link => {
            if (link.url) {
                const episode = addEpisode(link.url, link.title);
                if (episode) {
                    newLinks.push(episode); // 仅添加成功添加的 episode
                }
            } else {
                log("error", `Invalid link in anime, missing url: ${JSON.stringify(link)}`);
            }
        });

        // 检查是否已存在相同 animeId 的 anime
        const existingAnimeIndex = globals.animes.findIndex(a => hasSameAnimeIdentity(a, anime));
        const existingAnime = existingAnimeIndex !== -1 ? globals.animes[existingAnimeIndex] : null;
        const retainedEpisodeIds = new Set(newLinks.map(link => String(link.id)));

        if (existingAnimeIndex !== -1) {
            // 如果存在，先删除旧的，避免旧详情或旧剧集索引污染新数据
            globals.animes.splice(existingAnimeIndex, 1);
            clearAnimeDetailCacheEntries(existingAnime);
            cleanupDetachedEpisodeIds(existingAnime?.links || [], retainedEpisodeIds);
            log("info", `Removed old anime at index: ${existingAnimeIndex}`);
        }

        // 创建新的 anime 副本
        const animeCopy = Anime.fromJson({ ...anime, links: newLinks });

        // 当前请求内保留一份详情，避免同轮搜索结果被全局运行时裁剪影响
        storeAnimeInDetailStore(detailStore, animeCopy);

        // 统一写入详情索引，避免依赖全局热缓存是否被裁剪
        cacheAnimeDetail(animeCopy);

        // 将新的添加到数组末尾（最新位置）
        globals.animes.push(animeCopy);
        log("info", `Added anime to latest position: ${anime.animeId}`);

        // 检查是否超过 MAX_ANIMES，超过则删除最早的
        if (globals.animes.length > globals.MAX_ANIMES) {
            const removeSuccess = removeEarliestAnime();
            if (!removeSuccess) {
                log("error", "Failed to remove earliest anime, but continuing");
            }
        }

        // 避免 info 级别输出超大数组，降低 I/O 开销
        log("debug", `[cache] animes size=${globals.animes.length}, latest=${animeCopy.animeId}`);

        return true;
    } catch (error) {
        log("error", `addAnime failed: ${error.message}`);
        return false;
    }
}

// 删除最早添加的 anime，并从 episodeIds 删除其 links 中的 url
export function removeEarliestAnime() {
    if (globals.animes.length === 0) {
        log("error", "No animes to remove.");
        return false;
    }

    // 移除最早的 anime（第一个元素）
    const removedAnime = globals.animes.shift();
    log("info", `Removed earliest anime: ${JSON.stringify(removedAnime)}`);

    clearAnimeDetailCacheEntries(removedAnime);
    cleanupDetachedEpisodeIds(removedAnime?.links || []);

    return true;
}

// 将所有动漫的 animeId 存入 lastSelectMap 的 animeIds 数组中
export function storeAnimeIdsToMap(curAnimes, key) {
    const uniqueAnimeIds = new Set();
    for (const anime of curAnimes) {
        uniqueAnimeIds.add(anime.animeId);
    }

    // 保存旧的 prefer/source/offsets（兼容旧结构）
    const oldValue = globals.lastSelectMap.get(key);
    const oldPrefer = oldValue?.prefer;
    const oldSource = oldValue?.source;
    const oldPreferBySeason = oldValue?.preferBySeason;
    const oldSourceBySeason = oldValue?.sourceBySeason;
    const oldOffsets = oldValue?.offsets;

    const preferBySeason = oldPreferBySeason ? { ...oldPreferBySeason } : {};
    const sourceBySeason = oldSourceBySeason ? { ...oldSourceBySeason } : {};

    if (oldPrefer !== undefined) {
        preferBySeason.default = oldPrefer;
    }
    if (oldSource !== undefined) {
        sourceBySeason.default = oldSource;
    }

    // 如果key已存在，先删除它（为了更新顺序，保证 FIFO）
    if (globals.lastSelectMap.has(key)) {
        globals.lastSelectMap.delete(key);
    }

    // 添加新记录，保留 prefer/source/offsets 结构
    globals.lastSelectMap.set(key, {
        animeIds: [...uniqueAnimeIds],
        ...(Object.keys(preferBySeason).length > 0 && { preferBySeason }),
        ...(Object.keys(sourceBySeason).length > 0 && { sourceBySeason }),
        ...(oldOffsets !== undefined && { offsets: oldOffsets })
    });

    // 检查是否超过 MAX_LAST_SELECT_MAP，超过则删除最早的
    if (globals.lastSelectMap.size > globals.MAX_LAST_SELECT_MAP) {
        const firstKey = globals.lastSelectMap.keys().next().value;
        globals.lastSelectMap.delete(firstKey);
        log("info", `Removed earliest entry from lastSelectMap: ${firstKey}`);
    }
}

// 根据给定的 commentId 查找对应的 animeId
export function findAnimeIdByCommentId(commentId) {
  const cachedDetail = findCachedAnimeLinkByCommentId(commentId);
  if (cachedDetail?.anime) {
    return [cachedDetail.anime.animeId, cachedDetail.anime.source, cachedDetail.link?.title || null];
  }

  for (const anime of globals.animes) {
    if (!anime || !Array.isArray(anime.links)) {
      continue;
    }
    for (const link of anime.links) {
      if (String(link.id) === String(commentId)) {
        return [anime.animeId, anime.source, link?.title || null];
      }
    }
  }
  return [null, null, null];
}

// 通过 animeId 查找 lastSelectMap 中 animeIds 包含该 animeId 的 key，并设置其 prefer 为 animeId
export function setPreferByAnimeId(animeId, source, season = null, offset = null) {
  for (const [key, value] of globals.lastSelectMap.entries()) {
    if (value.animeIds && value.animeIds.includes(animeId)) {
      const seasonKey = season === null ? 'default' : String(season);
      value.preferBySeason = value.preferBySeason || {};
      value.sourceBySeason = value.sourceBySeason || {};
      value.preferBySeason[seasonKey] = animeId;
      value.sourceBySeason[seasonKey] = source;
      if (season !== null && offset !== null) {
        value.offsets = value.offsets || {};
        value.offsets[seasonKey] = offset;
      }
      globals.lastSelectMap.set(key, value); // 确保更新被保存
      return key; // 返回被修改的 key
    }
  }
  return null; // 如果没有找到匹配的 key，返回 null
}

// 通过 title 查询优选 animeId（按 season 维度）
export function getPreferAnimeId(title, season = null) {
  const value = globals.lastSelectMap.get(title);
  if (!value) {
    return [null, null, null];
  }

  const seasonKey = season === null ? 'default' : String(season);
  const preferBySeason = value.preferBySeason || {};
  const sourceBySeason = value.sourceBySeason || {};

  const prefer = preferBySeason[seasonKey] ?? preferBySeason.default ?? value.prefer ?? null;
  const source = sourceBySeason[seasonKey] ?? sourceBySeason.default ?? value.source ?? null;
  const offsets = value.offsets || null;

  return [prefer, source, offsets];
}

// 清理所有过期的 IP 记录（超过 1 分钟没有请求的 IP）
export function cleanupExpiredIPs(currentTime) {
  const oneMinute = 60 * 1000;
  let cleanedCount = 0;

  for (const [ip, timestamps] of globals.requestHistory.entries()) {
    const validTimestamps = timestamps.filter(ts => currentTime - ts <= oneMinute);
    if (validTimestamps.length === 0) {
      globals.requestHistory.delete(ip);
      cleanedCount++;
      log("info", `[Rate Limit] Cleaned up expired IP record: ${ip}`);
    } else if (validTimestamps.length < timestamps.length) {
      globals.requestHistory.set(ip, validTimestamps);
    }
  }

  if (cleanedCount > 0) {
    log("info", `[Rate Limit] Cleanup completed: removed ${cleanedCount} expired IP records`);
  }
}

// 获取当前文件目录的兼容方式
export function getDirname() {
  if (typeof __dirname !== 'undefined') {
    // CommonJS 环境 (Vercel)
    return __dirname;
  }
  // ES Module 环境 (本地)
  // 假设 cache-util.js 在 danmu_api/utils/ 目录下
  return path.join(process.cwd(), 'danmu_api', 'utils');
}

// 从本地缓存目录读取缓存数据
export function readCacheFromFile(key) {
  const cacheFilePath = path.join(getDirname(), '..', '..', '.cache', `${key}`);
  if (fs.existsSync(cacheFilePath)) {
    return fs.readFileSync(cacheFilePath, 'utf8');
  }
  return null;
}

// 将缓存数据写入本地缓存文件
export function writeCacheToFile(key, value) {
  const cacheFilePath = path.join(getDirname(), '..', '..', '.cache', `${key}`);
  fs.writeFileSync(cacheFilePath, JSON.stringify(value), 'utf8');
}

// 从本地获取缓存
export async function getLocalCaches() {
  if (!globals.localCacheInitialized) {
    try {
      log("info", 'getLocalCaches start.');

      // 从本地缓存文件读取数据并恢复到 globals 中
      const animes = parseCacheContent(readCacheFromFile('animes'));
      const episodeIds = parseCacheContent(readCacheFromFile('episodeIds'));
      let episodeNum = parseCacheContent(readCacheFromFile('episodeNum'));
      const reqRecords = parseCacheContent(readCacheFromFile('reqRecords'));
      let todayReqNum = parseCacheContent(readCacheFromFile('todayReqNum'));

      if (typeof episodeNum === 'string') {
        const n = Number(episodeNum);
        if (Number.isFinite(n)) episodeNum = n;
      }

      if (animes !== null && animes !== undefined) globals.animes = animes;
      if (episodeIds !== null && episodeIds !== undefined) globals.episodeIds = episodeIds;
      if (episodeNum !== null && episodeNum !== undefined) globals.episodeNum = episodeNum;
      if (reqRecords !== null && reqRecords !== undefined) globals.reqRecords = reqRecords;
      if (typeof todayReqNum === 'string') {
        const n = Number(todayReqNum);
        if (Number.isFinite(n)) todayReqNum = n;
      }
      if (todayReqNum !== null && todayReqNum !== undefined) globals.todayReqNum = todayReqNum;

      // 恢复 lastSelectMap 并转换为 Map 对象
      const lastSelectMapData = parseCacheContent(readCacheFromFile('lastSelectMap'));
      if (lastSelectMapData) {
        if (lastSelectMapData instanceof Map) {
          globals.lastSelectMap = lastSelectMapData;
        } else if (typeof lastSelectMapData === 'object') {
          globals.lastSelectMap = new Map(Object.entries(lastSelectMapData));
        }
        log("debug", `Restored lastSelectMap from local cache with ${globals.lastSelectMap.size} entries`);
      }

      // 更新哈希值
      globals.lastHashes.animes = simpleHash(JSON.stringify(globals.animes));
      globals.lastHashes.episodeIds = simpleHash(JSON.stringify(globals.episodeIds));
      globals.lastHashes.episodeNum = simpleHash(JSON.stringify(globals.episodeNum));
      globals.lastHashes.reqRecords = simpleHash(JSON.stringify(globals.reqRecords));
      globals.lastHashes.todayReqNum = simpleHash(JSON.stringify(globals.todayReqNum));
      globals.lastHashes.lastSelectMap = simpleHash(JSON.stringify(Object.fromEntries(globals.lastSelectMap)));

      globals.localCacheInitialized = true;
      log("info", 'getLocalCaches completed successfully.');
    } catch (error) {
      log("error", `getLocalCaches failed: ${error.message}`, error.stack);
      globals.localCacheInitialized = true; // 标记为已初始化，避免重复尝试
    }
  }
}

// 更新本地缓存
export async function updateLocalCaches() {
  try {
    log("info", 'updateLocalCaches start.');
    const updates = [];

    // 检查每个变量的哈希值
    const variables = [
      { key: 'animes', value: globals.animes },
      { key: 'episodeIds', value: globals.episodeIds },
      { key: 'episodeNum', value: globals.episodeNum },
      { key: 'reqRecords', value: globals.reqRecords },
      { key: 'lastSelectMap', value: globals.lastSelectMap },
      { key: 'todayReqNum', value: globals.todayReqNum }
    ];

    for (const { key, value } of variables) {
      const valueToWrite = key === 'lastSelectMap' ? Object.fromEntries(value) : value;
      const serializedValue = JSON.stringify(valueToWrite);
      const currentHash = simpleHash(serializedValue);
      if (currentHash !== globals.lastHashes[key]) {
        writeCacheToFile(key, valueToWrite);
        updates.push({ key, hash: currentHash });
      }
    }

    // 输出更新日志
    if (updates.length > 0) {
      log("info", `Updated local caches for keys: ${updates.map(u => u.key).join(', ')}`);
      updates.forEach(({ key, hash }) => {
        globals.lastHashes[key] = hash; // 更新本地哈希
      });
    } else {
      log("info", 'No changes detected, skipping local cache update.');
    }

  } catch (error) {
    log("error", `updateLocalCaches failed: ${error.message}`, error.stack);
    log("error", `Error details - Name: ${error.name}, Cause: ${error.cause ? error.cause.message : 'N/A'}`);
  }
}

// 判断是否有效的本地缓存目录
export async function judgeLocalCacheValid(urlPath, deployPlatform) {
  if (deployPlatform === 'node') {
    try {
      fs = await import('fs');
      path = await import('path');

      if (!globals.localCacheValid && urlPath !== "/favicon.ico" && urlPath !== "/robots.txt") {
        const cacheDirPath = path.join(getDirname(), '..', '..', '.cache');

        if (fs.existsSync(cacheDirPath)) {
          globals.localCacheValid = true;
        } else {
          globals.localCacheValid = false;
        }
      }
    } catch (error) {
      console.warn('Node.js modules not available:', error.message);
      globals.localCacheValid = false;
    }
  }
}
