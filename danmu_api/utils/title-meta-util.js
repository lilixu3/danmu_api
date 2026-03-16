import { extractYear, getExplicitSeasonNumber } from './common-util.js';

const SOURCE_LABEL_MAP = {
  tencent: 'qq',
  qq: 'qq',
  iqiyi: 'iqiyi',
  qiyi: 'iqiyi',
  imgo: 'imgo',
  mango: 'imgo',
  mgtv: 'imgo',
  hunantv: 'imgo',
  bilibili1: 'bilibili',
  bilibili: 'bilibili',
  youku: 'youku',
  migu: 'migu',
  acfun: 'acfun',
  sohu: 'sohu',
  leshi: 'leshi',
  xigua: 'xigua',
  douyin: 'xigua',
  maiduidui: 'maiduidui',
  renren: 'renren',
  hanjutv: 'hanjutv',
  bahamut: 'bahamut',
  dandan: 'dandan',
  animeko: 'animeko',
  custom: 'custom',
  other: 'other',
  vod: 'vod',
  '360': '360',
};

const SOURCE_SPLITTER = /[&＆+]+/;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function pad2(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, '0');
}

function normalizeYear(year, rawAnimeTitle = '', startDate = '') {
  const numericYear = Number(year);
  if (Number.isInteger(numericYear) && numericYear >= 1900 && numericYear <= 2100) {
    return numericYear;
  }

  const legacyYear = extractYear(String(rawAnimeTitle || ''));
  if (legacyYear) return legacyYear;

  const startYear = Number(String(startDate || '').slice(0, 4));
  if (Number.isInteger(startYear) && startYear >= 1900 && startYear <= 2100) {
    return startYear;
  }

  return null;
}

function normalizeSourceToken(token) {
  const normalized = normalizeText(token).toLowerCase();
  if (!normalized) return '';
  return SOURCE_LABEL_MAP[normalized] || normalized;
}

function buildSourceLabel(input) {
  const tokens = normalizeText(input)
    .split(SOURCE_SPLITTER)
    .map(normalizeSourceToken)
    .filter(Boolean);

  if (tokens.length === 0) return 'unknown';
  return Array.from(new Set(tokens)).join('+');
}

function extractSourceFromLegacyAnimeTitle(rawAnimeTitle) {
  const match = String(rawAnimeTitle || '').match(/from\s+([a-zA-Z0-9&＆+]+)/i);
  return match ? match[1] : '';
}

function extractSourceFromLegacyEpisodeTitle(rawEpisodeTitle) {
  const match = String(rawEpisodeTitle || '').match(/^【([^】]+)】/);
  return match ? match[1] : '';
}

function stripLegacyEpisodePrefix(rawEpisodeTitle) {
  return normalizeText(String(rawEpisodeTitle || '').replace(/^【[^】]+】\s*/, ''));
}

function stripLegacyAnimeDecorations(rawAnimeTitle) {
  let cleaned = normalizeText(rawAnimeTitle);
  cleaned = cleaned.replace(/\s*from\s+[a-zA-Z0-9&＆+]+\s*$/i, '').trim();
  cleaned = cleaned.replace(/【[^】]+】/g, '').trim();
  cleaned = cleaned.replace(/\((?:\d{4}|N\/A)\)\s*$/i, '').trim();
  return cleaned;
}

function stripSeasonSuffix(title) {
  let cleaned = normalizeText(title);
  const patterns = [
    /(第\s*[一二三四五六七八九十百千万零〇两\d]+\s*季)$/i,
    /(第\s*[一二三四五六七八九十百千万零〇两\d]+\s*部)$/i,
    /(第\s*[一二三四五六七八九十百千万零〇两\d]+\s*期)$/i,
    /(Season\s*\d+)$/i,
    /(S\d{1,2})$/i,
    /(Part\s*\d+)$/i,
  ];

  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  return cleaned;
}

function detectMovieLike({ type = '', typeDescription = '', rawAnimeTitle = '' } = {}) {
  const text = `${type} ${typeDescription} ${rawAnimeTitle}`.toLowerCase();
  return text.includes('电影') || text.includes('movie') || text.includes('剧场版');
}

function inferSeasonNumber({ seasonNumber, animeName, rawAnimeTitle, isMovie }) {
  const numericSeason = Number(seasonNumber);
  if (Number.isInteger(numericSeason) && numericSeason > 0) {
    return numericSeason;
  }
  if (isMovie) return null;

  const detectedSeason = getExplicitSeasonNumber(animeName) || getExplicitSeasonNumber(rawAnimeTitle);
  return detectedSeason || 1;
}

function inferEpisodeNumberFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const patterns = [
    /第\s*0*([0-9]+)\s*[集话期篇部章]/i,
    /(?:^|\s)[Ee][Pp]?\s*0*([0-9]+)(?:\s|$|[:：._-])/,
    /^0*([0-9]{1,3})(?:\s|$|[:：._-])/,
    /[_-]0*([0-9]{1,3})(?:$|[^\d])/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function inferEpisodeNumber({ episodeNumber, name, rawEpisodeTitle, fallbackEpisodeNumber, isMovie }) {
  if (isMovie) return null;

  const numericEpisode = Number(episodeNumber);
  if (Number.isInteger(numericEpisode) && numericEpisode > 0) {
    return numericEpisode;
  }

  const detectedByName = inferEpisodeNumberFromText(name);
  if (detectedByName) return detectedByName;

  const detectedByTitle = inferEpisodeNumberFromText(rawEpisodeTitle);
  if (detectedByTitle) return detectedByTitle;

  const fallback = Number(fallbackEpisodeNumber);
  if (Number.isInteger(fallback) && fallback > 0) {
    return fallback;
  }

  return 1;
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanEpisodeSubtitle(rawEpisodeTitle, episodeNumber) {
  let cleaned = stripLegacyEpisodePrefix(rawEpisodeTitle);
  if (!cleaned) return '';

  const numericEpisode = Number(episodeNumber);
  if (Number.isInteger(numericEpisode) && numericEpisode > 0) {
    const escapedEpisode = escapeRegExp(String(numericEpisode));
    const patterns = [
      new RegExp(`^第\\s*0*${escapedEpisode}\\s*[集话期篇部章]\\s*[：:_\\-\\s]*`, 'i'),
      new RegExp(`^[Ee][Pp]?\\s*0*${escapedEpisode}\\s*[：:_\\-\\s]*`, 'i'),
      new RegExp(`^0*${escapedEpisode}\\s*[：:_\\-\\s]+`, 'i')
    ];

    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

function buildEpisodeCode({ seasonNumber, episodeNumber, isMovie }) {
  if (isMovie) return '';

  const safeSeason = Number.isInteger(Number(seasonNumber)) && Number(seasonNumber) > 0
    ? Number(seasonNumber)
    : 1;
  const safeEpisode = Number.isInteger(Number(episodeNumber)) && Number(episodeNumber) > 0
    ? Number(episodeNumber)
    : 1;

  return `S${pad2(safeSeason)}E${pad2(safeEpisode)}`;
}

function sanitizeEmbySegment(text) {
  return normalizeText(text)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .trim();
}

function buildPlayerAnimeTitle({ animeName, year }) {
  if (!animeName) return '';
  return year ? `${animeName} (${year})` : animeName;
}

function buildPlayerEpisodeTitle({ episodeCode, episodeSubtitle, sourceLabel, isMovie }) {
  const parts = [];

  if (isMovie) {
    parts.push(episodeSubtitle || '正片');
  } else {
    if (episodeCode) parts.push(episodeCode);
    if (episodeSubtitle) parts.push(episodeSubtitle);
  }
  if (sourceLabel) parts.push(sourceLabel);

  return parts.join(' - ');
}

function buildDisplayTitle({ animeTitle, episodeTitle }) {
  if (!animeTitle) return episodeTitle || '';
  if (!episodeTitle) return animeTitle;
  return `${animeTitle} - ${episodeTitle}`;
}

function buildEmbyTitle({ animeName, year, episodeCode, episodeSubtitle, sourceLabel, isMovie }) {
  const segments = [sanitizeEmbySegment(animeName)];

  if (year) segments.push(String(year));
  if (!isMovie && episodeCode) segments.push(episodeCode);
  if (episodeSubtitle && (!isMovie || episodeSubtitle !== '正片')) {
    segments.push(sanitizeEmbySegment(episodeSubtitle));
  }
  if (sourceLabel) segments.push(sanitizeEmbySegment(sourceLabel));

  return segments.filter(Boolean).join('.');
}

function resolveAnimeMeta(anime = {}) {
  const rawAnimeTitle = normalizeText(anime.rawAnimeTitle || anime.animeTitle);
  const decoratedAnimeName = normalizeText(
    anime.animeName ||
    anime.titleMeta?.animeName ||
    stripLegacyAnimeDecorations(rawAnimeTitle)
  );
  const animeName = normalizeText(stripSeasonSuffix(decoratedAnimeName) || decoratedAnimeName);
  const year = normalizeYear(
    anime.animeYear || anime.year || anime.titleMeta?.year,
    rawAnimeTitle,
    anime.startDate
  );
  const sourceLabel = buildSourceLabel(
    anime.sourceLabel ||
    anime.titleMeta?.sourceLabel ||
    anime.source ||
    extractSourceFromLegacyAnimeTitle(rawAnimeTitle)
  );
  const isMovie = detectMovieLike({
    type: anime.type,
    typeDescription: anime.typeDescription,
    rawAnimeTitle
  });
  const seasonNumber = inferSeasonNumber({
    seasonNumber: anime.seasonNumber || anime.titleMeta?.seasonNumber,
    animeName: decoratedAnimeName,
    rawAnimeTitle,
    isMovie
  });
  const playerAnimeTitle = buildPlayerAnimeTitle({ animeName: animeName || decoratedAnimeName, year });

  return {
    animeName: animeName || decoratedAnimeName,
    year,
    sourceLabel,
    seasonNumber,
    isMovie,
    playerAnimeTitle,
    animeDisplayTitle: playerAnimeTitle,
  };
}

function resolveEpisodeMeta(link = {}, animeMeta = {}, fallbackEpisodeNumber = null) {
  const rawTitle = normalizeText(link.rawTitle || link.title || link.episodeTitle);
  const rawEpisodeTitle = normalizeText(
    link.rawEpisodeTitle ||
    link.episodeTitle ||
    stripLegacyEpisodePrefix(rawTitle)
  );
  const sourceLabel = buildSourceLabel(
    link.sourceLabel ||
    link.titleMeta?.sourceLabel ||
    extractSourceFromLegacyEpisodeTitle(rawTitle) ||
    animeMeta.sourceLabel
  );
  const isMovie = Boolean(link.isMovie ?? animeMeta.isMovie);
  const seasonNumber = isMovie
    ? null
    : (Number(link.seasonNumber || link.titleMeta?.seasonNumber || animeMeta.seasonNumber || 1) || 1);
  const episodeNumber = inferEpisodeNumber({
    episodeNumber: link.episodeNumber || link.titleMeta?.episodeNumber,
    name: link.name,
    rawEpisodeTitle,
    fallbackEpisodeNumber,
    isMovie
  });
  const episodeSubtitle = normalizeText(
    link.episodeSubtitle ||
    link.titleMeta?.episodeSubtitle ||
    cleanEpisodeSubtitle(rawEpisodeTitle, episodeNumber)
  );
  const episodeCode = buildEpisodeCode({ seasonNumber, episodeNumber, isMovie });
  const playerEpisodeTitle = buildPlayerEpisodeTitle({
    episodeCode,
    episodeSubtitle,
    sourceLabel,
    isMovie
  });
  const displayTitle = buildDisplayTitle({
    animeTitle: animeMeta.playerAnimeTitle || '',
    episodeTitle: playerEpisodeTitle
  });
  const embyTitle = buildEmbyTitle({
    animeName: animeMeta.animeName || '',
    year: animeMeta.year,
    episodeCode,
    episodeSubtitle,
    sourceLabel,
    isMovie
  });

  return {
    sourceLabel,
    seasonNumber,
    episodeNumber,
    episodeCode,
    episodeSubtitle,
    isMovie,
    playerEpisodeTitle,
    displayTitle,
    embyTitle,
    rawEpisodeTitle,
    rawTitle,
  };
}

export function enrichLinkTitleMeta(link, animeOrMeta = {}, fallbackEpisodeNumber = null) {
  if (!link || typeof link !== 'object') return link;

  const animeMeta = animeOrMeta.titleMeta
    ? animeOrMeta.titleMeta
    : resolveAnimeMeta(animeOrMeta);
  const episodeMeta = resolveEpisodeMeta(link, animeMeta, fallbackEpisodeNumber);

  return {
    ...link,
    rawTitle: episodeMeta.rawTitle,
    rawEpisodeTitle: episodeMeta.rawEpisodeTitle,
    sourceLabel: episodeMeta.sourceLabel,
    seasonNumber: episodeMeta.seasonNumber,
    episodeNumber: episodeMeta.episodeNumber,
    episodeCode: episodeMeta.episodeCode,
    episodeSubtitle: episodeMeta.episodeSubtitle,
    playerEpisodeTitle: episodeMeta.playerEpisodeTitle,
    displayTitle: episodeMeta.displayTitle,
    embyTitle: episodeMeta.embyTitle,
    titleMeta: {
      ...(link.titleMeta || {}),
      ...episodeMeta,
    }
  };
}

export function enrichAnimeTitleMeta(anime) {
  if (!anime || typeof anime !== 'object') return anime;

  const animeMeta = resolveAnimeMeta(anime);
  const links = Array.isArray(anime.links)
    ? anime.links.map((link, index) => enrichLinkTitleMeta(link, animeMeta, index + 1))
    : anime.links;

  return {
    ...anime,
    rawAnimeTitle: normalizeText(anime.rawAnimeTitle || anime.animeTitle),
    animeName: animeMeta.animeName,
    animeYear: animeMeta.year,
    sourceLabel: animeMeta.sourceLabel,
    seasonNumber: animeMeta.seasonNumber,
    playerAnimeTitle: animeMeta.playerAnimeTitle,
    animeDisplayTitle: animeMeta.animeDisplayTitle,
    titleMeta: {
      ...(anime.titleMeta || {}),
      ...animeMeta,
    },
    links,
  };
}

export function getAnimeTitleMeta(anime) {
  return enrichAnimeTitleMeta(anime || {}).titleMeta || resolveAnimeMeta(anime || {});
}

export function getLinkTitleMeta(link, anime, fallbackEpisodeNumber = null) {
  const enriched = enrichLinkTitleMeta(link || {}, anime || {}, fallbackEpisodeNumber);
  return enriched.titleMeta || resolveEpisodeMeta(link || {}, getAnimeTitleMeta(anime), fallbackEpisodeNumber);
}

export function getPublicAnimeTitle(anime) {
  const meta = getAnimeTitleMeta(anime);
  return meta.playerAnimeTitle || normalizeText(anime?.animeTitle);
}

export function getPublicEpisodeTitle(link, anime, fallbackEpisodeNumber = null) {
  const meta = getLinkTitleMeta(link, anime, fallbackEpisodeNumber);
  return meta.playerEpisodeTitle || stripLegacyEpisodePrefix(link?.title || link?.episodeTitle);
}

export function getDisplayTitle(link, anime, fallbackEpisodeNumber = null) {
  const meta = getLinkTitleMeta(link, anime, fallbackEpisodeNumber);
  return meta.displayTitle || '';
}

export function getEmbyTitle(link, anime, fallbackEpisodeNumber = null) {
  const meta = getLinkTitleMeta(link, anime, fallbackEpisodeNumber);
  return meta.embyTitle || '';
}
