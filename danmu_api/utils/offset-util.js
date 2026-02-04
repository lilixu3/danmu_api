import { globals } from '../configs/globals.js';
import { extractAnimeTitle, normalizeSpaces } from './common-util.js';

const SOURCE_PLATFORM_ALIASES = {
  tencent: 'qq',
  iqiyi: 'qiyi',
  bilibili: 'bilibili1'
};

function normalizePlatform(platform, source) {
  const allowed = Array.isArray(globals.allowedPlatforms) ? globals.allowedPlatforms : [];
  const normalizedPlatform = platform ? String(platform).trim().toLowerCase() : '';
  if (normalizedPlatform && allowed.includes(normalizedPlatform)) {
    return normalizedPlatform;
  }

  const normalizedSource = source ? String(source).trim().toLowerCase() : '';
  if (!normalizedSource) return '';
  const mapped = SOURCE_PLATFORM_ALIASES[normalizedSource] || normalizedSource;
  return allowed.includes(mapped) ? mapped : '';
}

function normalizeTitle(title) {
  if (!title) return '';
  const cleaned = String(title)
    .replace(/【[^】]*】/g, '')
    .replace(/[《》]/g, '')
    .trim();
  return normalizeSpaces(cleaned).toLowerCase();
}

function buildTitleCandidates(animeTitle, episodeTitle) {
  const candidates = new Set();

  if (animeTitle) {
    const baseTitle = extractAnimeTitle(String(animeTitle));
    if (baseTitle) candidates.add(baseTitle);
  }

  if (episodeTitle) {
    const cleanedEpisodeTitle = String(episodeTitle).replace(/【[^】]*】/g, '').trim();
    if (cleanedEpisodeTitle) candidates.add(cleanedEpisodeTitle);

    const strippedEpisode = cleanedEpisodeTitle
      .replace(/第[0-9一二三四五六七八九十百千]+[集话期]/g, '')
      .replace(/\bEP\s*\d+\b/gi, '')
      .replace(/\bE\s*\d+\b/gi, '')
      .trim();
    if (strippedEpisode && strippedEpisode !== cleanedEpisodeTitle) {
      candidates.add(strippedEpisode);
    }
  }

  return candidates;
}

function expandWithTitleMapping(candidates) {
  const mapping = globals.titleMappingTable;
  if (!mapping || mapping.size === 0) return candidates;

  const expanded = new Set(candidates);
  const normalizedCandidates = new Set([...candidates].map(normalizeTitle).filter(Boolean));

  for (const [original, mapped] of mapping.entries()) {
    const originalKey = normalizeTitle(original);
    const mappedKey = normalizeTitle(mapped);
    if (originalKey && normalizedCandidates.has(originalKey) && mapped) {
      expanded.add(mapped);
    }
    if (mappedKey && normalizedCandidates.has(mappedKey) && original) {
      expanded.add(original);
    }
  }

  return expanded;
}

export function resolveTimelineOffsetSeconds({ animeTitle, episodeTitle, platform, source } = {}) {
  const rules = globals.titlePlatformOffsetRules;
  if (!Array.isArray(rules) || rules.length === 0) return 0;

  const platformKey = normalizePlatform(platform, source);
  if (!platformKey) return 0;

  const candidates = expandWithTitleMapping(buildTitleCandidates(animeTitle, episodeTitle));
  if (candidates.size === 0) return 0;

  const normalizedCandidates = new Set([...candidates].map(normalizeTitle).filter(Boolean));
  if (normalizedCandidates.size === 0) return 0;

  for (const rule of rules) {
    if (!rule || !rule.title) continue;
    const ruleTitle = normalizeTitle(rule.title);
    if (!ruleTitle || !normalizedCandidates.has(ruleTitle)) continue;

    if (rule.all === true) {
      return Number.isFinite(Number(rule.offset)) ? Number(rule.offset) : 0;
    }

    if (Array.isArray(rule.platforms) && rule.platforms.includes(platformKey)) {
      return Number.isFinite(Number(rule.offset)) ? Number(rule.offset) : 0;
    }
  }

  return 0;
}

export function applyOffsetToFormattedComments(comments, offsetSeconds) {
  const offset = Number(offsetSeconds);
  if (!offset || !Array.isArray(comments) || comments.length === 0) return comments;

  const offsetMs = offset * 1000;

  return comments.map(item => {
    if (!item || typeof item !== 'object') return item;

    const updated = { ...item };
    const clamp = value => Math.max(0, value);

    if (updated.progress !== undefined && updated.progress !== null) {
      const current = Number(updated.progress);
      if (Number.isFinite(current)) {
        updated.progress = clamp(current + offsetMs);
      }
    }

    if (updated.timepoint !== undefined && updated.timepoint !== null) {
      const current = Number(updated.timepoint);
      if (Number.isFinite(current)) {
        updated.timepoint = clamp(current + offset);
      }
    }

    if (updated.t !== undefined && updated.t !== null) {
      const current = Number(updated.t);
      if (Number.isFinite(current)) {
        updated.t = clamp(current + offset);
      }
    }

    if (typeof updated.p === 'string') {
      const parts = updated.p.split(',');
      if (parts.length > 0) {
        const current = Number(parts[0]);
        if (Number.isFinite(current)) {
          parts[0] = clamp(current + offset).toFixed(2);
          updated.p = parts.join(',');
        }
      }
    }

    return updated;
  });
}
