import { globals } from '../configs/globals.js';
import { jsonResponse } from '../utils/http-util.js';
import { log } from '../utils/log-util.js';
import { matchAnime, searchEpisodes } from './dandan-api.js';

const MAX_FONGMI_CANDIDATES = 12;
const FONGMI_TITLE_CLEAN_RULES = [
  [/[\(\[（【]\s*(?:19|20)\d{2}\s*[\)\]）】]/g, ' '],
  [/\b(?:19|20)\d{2}\b/g, ' '],
  [/\b(?:2160p|1080p|720p|4k|web-?dl|web-?rip|blu-?ray|hdr|dv|x265|x264|h\.?265|h\.?264|60fps)\b/gi, ' '],
  [/[_.-]+/g, ' ']
];
const FONGMI_EPISODE_CLEAN_RULES = [
  [/\[[^\]]*\]/g, ' '],
  [/[【（(][^】）)]*[】）)]/g, ' '],
  [/\.(?:mp4|mkv|avi|rmvb|ts|flv|mov|m4v)$/gi, ' '],
  [/\b(?:2160p|1080p|720p|4k|web-?dl|web-?rip|blu-?ray|hdr|dv|x265|x264|h\.?265|h\.?264|60fps|aac|flac|dts)\b/gi, ' '],
  [/[_~.-]+/g, ' ']
];
const FONGMI_TITLE_NOISE_PATTERN = /[\(\[（【]\s*(?:19|20)\d{2}\s*[\)\]）】]|\b(?:19|20)\d{2}\b|\b(?:2160p|1080p|720p|4k|web-?dl|web-?rip|blu-?ray|hdr|dv|x265|x264|h\.?265|h\.?264|60fps)\b/i;

function getHeader(headers, name) {
  if (!headers) return '';

  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || '';
  }

  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function firstHeaderValue(value) {
  if (!value) return '';
  return String(value).split(',')[0].trim();
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function getSchemeFromHeaders(req, url) {
  const forwardedProto = firstHeaderValue(getHeader(req.headers, 'x-forwarded-proto'));
  if (forwardedProto) return forwardedProto;

  const cfVisitor = getHeader(req.headers, 'cf-visitor');
  if (cfVisitor) {
    try {
      const visitor = JSON.parse(cfVisitor);
      if (visitor?.scheme) return visitor.scheme;
    } catch (_) {
      // ignore malformed cf-visitor
    }
  }

  return url.protocol.replace(':', '') || 'https';
}

function getConfiguredPublicBaseUrl() {
  const rawBaseUrl = String(globals.fongmiPublicBaseUrl || '').trim();
  if (!rawBaseUrl) return '';

  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      log('warn', `[Fongmi] Ignored invalid FONGMI_PUBLIC_BASE_URL protocol: ${parsed.protocol}`);
      return '';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    log('warn', `[Fongmi] Ignored invalid FONGMI_PUBLIC_BASE_URL: ${error.message}`);
    return '';
  }
}

function getPublicOrigin(url, req) {
  const configuredBaseUrl = getConfiguredPublicBaseUrl();
  if (configuredBaseUrl) return configuredBaseUrl;

  const forwardedHost =
    firstHeaderValue(getHeader(req.headers, 'x-forwarded-host')) ||
    firstHeaderValue(getHeader(req.headers, 'x-original-host')) ||
    firstHeaderValue(getHeader(req.headers, 'host'));

  if (forwardedHost) {
    const scheme = getSchemeFromHeaders(req, url);
    return `${scheme}://${forwardedHost}`;
  }

  if (!isLocalHostname(url.hostname)) {
    return url.origin;
  }

  return url.origin;
}

function buildTokenPrefix(authContext = {}) {
  // Fongmi 弹幕下载 URL 不使用 ADMIN_TOKEN，避免把管理 token 暴露给播放器。
  if (authContext.isAdmin) {
    return null;
  }

  if (globals.token) {
    return `/${encodeURIComponent(globals.token)}`;
  }

  return '';
}

function buildCommentUrl(url, req, episodeId, authContext = {}) {
  const tokenPrefix = buildTokenPrefix(authContext);
  if (tokenPrefix === null) return null;

  const origin = getPublicOrigin(url, req).replace(/\/$/, '');
  // 使用 .xml 路径而不是 ?format=xml，避免播放器或代理在二次请求弹幕 URL 时丢查询参数。
  return `${origin}${tokenPrefix}/api/v2/comment/${episodeId}.xml`;
}

function collapseSearchWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s._~\-:：/\\]+/g, '')
    .trim();
}

function normalizeFongmiTitleByRegex(name) {
  let text = String(name || '');
  for (const [pattern, replacement] of FONGMI_TITLE_CLEAN_RULES) {
    text = text.replace(pattern, replacement);
  }
  return collapseSearchWhitespace(text);
}

function normalizeFongmiEpisodeByRegex(episode) {
  let text = String(episode || '');
  for (const [pattern, replacement] of FONGMI_EPISODE_CLEAN_RULES) {
    text = text.replace(pattern, replacement);
  }
  return collapseSearchWhitespace(text);
}

function buildFongmiSearchKeywords(name) {
  const rawName = collapseSearchWhitespace(name);
  if (!rawName) return [];

  const keywords = [];
  const pushKeyword = (value) => {
    const keyword = collapseSearchWhitespace(value);
    if (!keyword || keywords.includes(keyword)) return;
    keywords.push(keyword);
  };

  const cleanedName = normalizeFongmiTitleByRegex(rawName);
  const bracketBaseName = collapseSearchWhitespace(rawName.replace(/[\(\[（【].*$/, ''));
  const cleanedChanged = cleanedName && normalizeComparableText(cleanedName) !== normalizeComparableText(rawName);
  const hasKnownNoise = FONGMI_TITLE_NOISE_PATTERN.test(rawName);

  // 对明显带年份/清晰度/编码后缀的媒体文件名，优先用清洗后的标题，避免先触发一轮无效全源搜索。
  // 其它只是包含点号/横线的标题仍保留原始标题优先，降低误清洗风险。
  if (cleanedChanged && hasKnownNoise) {
    pushKeyword(cleanedName);
  }
  pushKeyword(rawName);
  if (cleanedChanged && !hasKnownNoise) {
    pushKeyword(cleanedName);
  }
  if (bracketBaseName && normalizeComparableText(bracketBaseName) !== normalizeComparableText(rawName)) {
    pushKeyword(bracketBaseName);
  }

  return keywords;
}

function parseChineseEpisodeNumber(text) {
  const match = text.match(/(?:第\s*)?([零〇一二两三四五六七八九十百]{1,8})\s*[集话話回期]/);
  if (!match) return null;

  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };

  const raw = match[1];
  if (raw === '十') return 10;

  const hundredParts = raw.split('百');
  let total = 0;
  let rest = raw;
  if (hundredParts.length === 2) {
    const hundred = hundredParts[0] ? digits[hundredParts[0]] : 1;
    if (hundred == null) return null;
    total += hundred * 100;
    rest = hundredParts[1];
  }

  if (rest.includes('十')) {
    const [tensText, onesText] = rest.split('十');
    const tens = tensText ? digits[tensText] : 1;
    const ones = onesText ? digits[onesText] : 0;
    if (tens == null || ones == null) return null;
    total += tens * 10 + ones;
  } else if (rest) {
    if (rest.length === 1) {
      const value = digits[rest];
      if (value == null) return null;
      total += value;
    } else {
      return null;
    }
  }

  return total > 0 ? total : null;
}

function extractDateDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(0, 8) : '';
}

function extractFongmiEpisodeNumber(episode) {
  const normalizedEpisode = normalizeFongmiEpisodeByRegex(episode);
  if (!normalizedEpisode) return null;

  const patterns = [
    /[Ss]\d{1,2}\s*[Ee]0*(\d{1,4})/,
    /(?:第\s*)0*(\d{1,4})\s*[集话話回期]/,
    /^0*(\d{1,4})\s*[集话話回期]$/,
    /(?:ep|episode|e)\.?\s*0*(\d{1,4})/i,
    /(?:^|\s)0*(\d{1,4})x(?:\s|$)/i,
    /(?:^|\s)0*(\d{1,4})(?:\s|$)/,
    /^0*(\d{1,4})$/
  ];

  for (const pattern of patterns) {
    const match = normalizedEpisode.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return parseChineseEpisodeNumber(normalizedEpisode);
}

function normalizeEpisode(episode) {
  const text = String(episode || '').trim();
  if (!text) return '';

  if (/^(movie|剧场版|劇場版|电影|電影)$/i.test(text)) {
    return 'movie';
  }

  const episodeNumber = extractFongmiEpisodeNumber(text);
  if (episodeNumber !== null) return String(episodeNumber);

  return '';
}

function normalizeFongmiParams(data = {}) {
  return {
    name: data.name || data.keyword || data.title || '',
    episode: data.episode || data.ep || ''
  };
}

async function parseFongmiParams(url, req) {
  if (req.method === 'GET') {
    return normalizeFongmiParams({
      name: url.searchParams.get('name'),
      keyword: url.searchParams.get('keyword'),
      title: url.searchParams.get('title'),
      episode: url.searchParams.get('episode'),
      ep: url.searchParams.get('ep')
    });
  }

  const contentType = getHeader(req.headers, 'content-type').toLowerCase();
  if (contentType.includes('multipart/form-data') && typeof req.formData === 'function') {
    try {
      const form = await req.formData();
      return normalizeFongmiParams({
        name: form.get('name'),
        keyword: form.get('keyword'),
        title: form.get('title'),
        episode: form.get('episode'),
        ep: form.get('ep')
      });
    } catch (error) {
      log('warn', `[Fongmi] Invalid multipart body: ${error.message}`);
      return { name: '', episode: '' };
    }
  }

  const text = typeof req.text === 'function' ? await req.text() : '';

  if (contentType.includes('application/json')) {
    try {
      const body = text
        ? JSON.parse(text)
        : (typeof req.json === 'function' ? await req.json() : {});
      return normalizeFongmiParams(body || {});
    } catch (error) {
      log('warn', `[Fongmi] Invalid JSON body: ${error.message}`);
      return { name: '', episode: '' };
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded') || text.includes('=')) {
    const form = new URLSearchParams(text);
    return normalizeFongmiParams({
      name: form.get('name'),
      keyword: form.get('keyword'),
      title: form.get('title'),
      episode: form.get('episode'),
      ep: form.get('ep')
    });
  }

  if (text) {
    try {
      return normalizeFongmiParams(JSON.parse(text) || {});
    } catch (_) {
      // ignore unknown raw body and fall back to query params
    }
  }

  return normalizeFongmiParams({
    name: url.searchParams.get('name'),
    keyword: url.searchParams.get('keyword'),
    title: url.searchParams.get('title'),
    episode: url.searchParams.get('episode'),
    ep: url.searchParams.get('ep')
  });
}

function flattenEpisodesToFongmi(animes, url, req, authContext = {}) {
  const results = [];

  for (const anime of animes || []) {
    (anime.episodes || []).forEach((episode, index) => {
      const commentUrl = buildCommentUrl(url, req, episode.episodeId, authContext);
      if (!commentUrl) return;

      results.push({
        name: `${anime.animeTitle || ''} ${episode.episodeTitle || ''}`.trim(),
        url: commentUrl,
        anime,
        episode: {
          ...episode,
          episodeNumber: episode.episodeNumber || index + 1
        },
        index
      });
    });
  }

  return results;
}

function scoreFongmiEpisodeMatch(candidate, targetEpisode) {
  const { anime, episode, index } = candidate;
  let score = Math.max(0, 200 - index);
  const normalizedTargetEpisode = normalizeFongmiEpisodeByRegex(targetEpisode);
  if (!normalizedTargetEpisode) return score;

  const targetText = normalizeComparableText(normalizedTargetEpisode);
  const episodeTitle = episode?.episodeTitle || '';
  const episodeText = normalizeComparableText(episodeTitle);
  const animeText = normalizeComparableText(anime?.animeTitle || '');

  if (targetText && episodeText) {
    if (episodeText === targetText) score += 10000;
    if (episodeText.includes(targetText) || targetText.includes(episodeText)) score += 2500;
  }

  const targetNum = extractFongmiEpisodeNumber(normalizedTargetEpisode);
  const episodeNum = extractFongmiEpisodeNumber(episodeTitle);
  const episodeIndexNum = parseInt(episode?.episodeNumber || `${index + 1}`, 10);
  if (targetNum !== null && episodeNum !== null && targetNum === episodeNum) score += 7000;
  if (targetNum !== null && Number.isFinite(episodeIndexNum) && targetNum === episodeIndexNum) score += 4000;

  const targetDate = extractDateDigits(normalizedTargetEpisode);
  const episodeDate = extractDateDigits(episodeTitle);
  if (targetDate && episodeDate && targetDate === episodeDate) score += 9000;
  if (animeText.includes('综艺') && targetDate && episodeDate) score += 1200;
  if (animeText.includes('综艺') && targetDate && !episodeDate && targetNum === null) score -= 1500;

  return score;
}

function finalizeFongmiItems(items, targetEpisode) {
  const seen = new Set();
  return items
    .map((item, order) => ({
      ...item,
      order,
      score: scoreFongmiEpisodeMatch(item, targetEpisode)
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, MAX_FONGMI_CANDIDATES)
    .map(({ name, url }) => ({ name, url }));
}

async function searchByEpisodes(url, req, name, episode, authContext = {}) {
  const normalizedEpisode = normalizeEpisode(episode);
  const keywords = buildFongmiSearchKeywords(name);

  for (const keyword of keywords) {
    const searchUrl = new URL('/api/v2/search/episodes', url.origin);
    searchUrl.searchParams.set('anime', keyword);
    if (normalizedEpisode) {
      searchUrl.searchParams.set('episode', normalizedEpisode);
    }

    const res = await searchEpisodes(searchUrl);
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.animes) || data.animes.length === 0) {
      continue;
    }

    if (keyword !== collapseSearchWhitespace(name)) {
      log('info', `[Fongmi] Search fallback hit: raw=${name}, keyword=${keyword}, episode=${episode}`);
    }

    return finalizeFongmiItems(flattenEpisodesToFongmi(data.animes, url, req, authContext), episode);
  }

  return [];
}

async function searchByMatch(url, req, name, episode, clientIp, authContext = {}) {
  const fileName = `${name || ''} ${episode || ''}`.trim();
  if (!fileName) return [];

  const matchUrl = new URL('/api/v2/match', url.origin);
  const matchReq = {
    url: matchUrl.toString(),
    json: async () => ({ fileName })
  };

  const res = await matchAnime(matchUrl, matchReq, clientIp);
  const data = await res.json();
  if (!data?.success || !Array.isArray(data.matches)) {
    return [];
  }

  return data.matches
    .map(match => {
      const commentUrl = buildCommentUrl(url, req, match.episodeId, authContext);
      if (!commentUrl) return null;

      return {
        name: `${match.animeTitle || ''} ${match.episodeTitle || ''}`.trim(),
        url: commentUrl
      };
    })
    .filter(Boolean)
    .slice(0, MAX_FONGMI_CANDIDATES);
}

export async function handleFongmiDanmaku(url, req, clientIp, authContext = {}) {
  try {
    // ADMIN_TOKEN 只用于管理，不暴露给播放器；管理员入口直接空结果。
    if (authContext.isAdmin) {
      return jsonResponse([]);
    }

    const { name, episode } = await parseFongmiParams(url, req);
    const animeName = String(name || '').trim();
    const episodeName = String(episode || '').trim();

    if (!animeName) {
      return jsonResponse([]);
    }

    const byEpisodes = await searchByEpisodes(url, req, animeName, episodeName, authContext);
    if (byEpisodes.length > 0) {
      return jsonResponse(byEpisodes);
    }

    const byMatch = await searchByMatch(url, req, animeName, episodeName, clientIp, authContext);
    return jsonResponse(byMatch);
  } catch (error) {
    log('error', `[Fongmi] Failed to handle danmaku request: ${error.message}`);
    return jsonResponse([]);
  }
}
