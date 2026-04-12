import { globals } from '../configs/globals.js';
import { normalizeSpaces } from './common-util.js';

// 弹幕时间偏移独立模块
// 职责：解析偏移规则、匹配偏移量、应用偏移到弹幕

// 来源→平台别名映射（source 名和 platform 名不一致时扩展匹配）
const SOURCE_ALIASES = {
  tencent: ['tencent', 'qq'],
  qq: ['qq', 'tencent'],
  iqiyi: ['iqiyi', 'qiyi'],
  qiyi: ['qiyi', 'iqiyi'],
  bilibili: ['bilibili', 'bilibili1'],
  bilibili1: ['bilibili1', 'bilibili']
};

function normalizeAnimeKey(title) {
  if (!title) return '';
  return normalizeSpaces(title)
    .replace(/[-_:：—–·・'’"`]/g, '')
    .toLowerCase();
}

function expandAnimeCandidates(anime) {
  const candidates = new Set();
  const animeKey = normalizeAnimeKey(anime);
  if (animeKey) candidates.add(animeKey);

  const mapping = globals.titleMappingTable;
  if (!mapping || mapping.size === 0 || candidates.size === 0) {
    return candidates;
  }

  for (const [original, mapped] of mapping.entries()) {
    const originalKey = normalizeAnimeKey(original);
    const mappedKey = normalizeAnimeKey(mapped);
    if (originalKey && candidates.has(originalKey) && mappedKey) {
      candidates.add(mappedKey);
    }
    if (mappedKey && candidates.has(mappedKey) && originalKey) {
      candidates.add(originalKey);
    }
  }

  return candidates;
}

// 规范化季/集编号（S1→S01, E3→E03）
function normalizeSegment(segment) {
  const normalized = String(segment || '').trim();
  const seasonMatch = normalized.match(/^S(\d+)$/i);
  if (seasonMatch) return `S${String(parseInt(seasonMatch[1], 10)).padStart(2, '0')}`;

  const episodeMatch = normalized.match(/^E(\d+)$/i);
  if (episodeMatch) return `E${String(parseInt(episodeMatch[1], 10)).padStart(2, '0')}`;

  return normalized;
}

/**
 * 解析 DANMU_OFFSET 环境变量为结构化规则数组（启动时调用一次，缓存到 globals）
 * @param {string} env 环境变量值
 * @returns {Array} 规则数组
 */
export function parseOffsetRules(env) {
  if (!env || typeof env !== 'string') return [];

  return env
    .split(/[;,]/)
    .map((entry) => {
      const trimmed = entry.trim();
      const colonIdx = trimmed.lastIndexOf(':');
      if (colonIdx === -1) return null;

      const rawPath = trimmed.substring(0, colonIdx).trim();
      const offsetStr = trimmed.substring(colonIdx + 1).trim();
      if (!rawPath || offsetStr === '') return null;

      const offset = parseFloat(offsetStr);
      if (!Number.isFinite(offset)) return null;

      // 百分比模式：在路径/来源段末尾追加 %，例如：东方/S03/E02@tencent%:11
      let usePercent = false;
      let normalizedPath = rawPath;
      if (normalizedPath.endsWith('%')) {
        usePercent = true;
        normalizedPath = normalizedPath.slice(0, -1).trim();
      }

      // 分离 @来源
      const atIdx = normalizedPath.lastIndexOf('@');
      let pathPart;
      let sources;
      let all;

      if (atIdx !== -1) {
        pathPart = normalizedPath.substring(0, atIdx).trim();
        const sourcePart = normalizedPath.substring(atIdx + 1).trim().toLowerCase();
        if (sourcePart === 'all' || sourcePart === '*') {
          sources = null;
          all = true;
        } else {
          sources = sourcePart.split('&').map(s => s.trim()).filter(Boolean);
          all = false;
          if (sources.length === 0) return null;
        }
      } else {
        pathPart = normalizedPath;
        sources = null;
        all = false;
      }

      const segments = pathPart.split('/').map(s => s.trim());
      const anime = normalizeSpaces(segments[0] || '');
      if (!anime) return null;

      const season = segments[1] ? normalizeSegment(segments[1]) : null;
      const episode = segments[2] ? normalizeSegment(segments[2]) : null;

      return { anime, season, episode, sources, all, offset, usePercent };
    })
    .filter(Boolean);
}

/**
 * 根据规则查找匹配的偏移量
 * @param {Array} rules parseOffsetRules 返回的规则数组
 * @param {Object} ctx 匹配上下文
 * @returns {number}
 */
export function resolveOffset(rules, { anime, season, episode, source }) {
  const matchedRule = resolveOffsetRule(rules, { anime, season, episode, source });
  return matchedRule ? matchedRule.offset : 0;
}

/**
 * 根据规则查找匹配的偏移规则
 * @param {Array} rules parseOffsetRules 返回的规则数组
 * @param {Object} ctx 匹配上下文
 * @returns {Object|null}
 */
export function resolveOffsetRule(rules, { anime, season, episode, source }) {
  if (!Array.isArray(rules) || rules.length === 0 || !anime) return null;

  const animeKeys = expandAnimeCandidates(anime);
  if (animeKeys.size === 0) return null;

  // 拆分合并来源，并展开别名
  const sourceKeys = new Set();
  if (source) {
    for (const item of String(source).split('&')) {
      const trimmed = item.trim().toLowerCase();
      if (!trimmed) continue;
      const aliases = SOURCE_ALIASES[trimmed] || [trimmed];
      aliases.forEach(alias => sourceKeys.add(alias));
    }
  }

  // 路径级别：集级 > 季级 > 剧级
  const levels = [
    { matchSeason: true, matchEpisode: true },
    { matchSeason: true, matchEpisode: false },
    { matchSeason: false, matchEpisode: false }
  ];

  for (const level of levels) {
    let specificMatch = null;
    let allMatch = null;
    let genericMatch = null;

    for (const rule of rules) {
      const ruleAnimeKey = normalizeAnimeKey(rule.anime);
      if (!ruleAnimeKey || !animeKeys.has(ruleAnimeKey)) continue;

      if (level.matchEpisode) {
        if (!rule.season || !rule.episode) continue;
        if (rule.season !== season || rule.episode !== episode) continue;
      } else if (level.matchSeason) {
        if (!rule.season || rule.episode) continue;
        if (rule.season !== season) continue;
      } else {
        if (rule.season || rule.episode) continue;
      }

      if (rule.sources) {
        if (sourceKeys.size > 0 && rule.sources.some(s => sourceKeys.has(s))) {
          specificMatch = rule;
        }
      } else if (rule.all) {
        allMatch = rule;
      } else {
        genericMatch = rule;
      }
    }

    if (specificMatch !== null) return specificMatch;
    if (allMatch !== null) return allMatch;
    if (genericMatch !== null) return genericMatch;
  }

  return null;
}

/**
 * 应用时间偏移到弹幕数组（兼容多种时间字段格式）
 * @param {Array} danmus 弹幕数组
 * @param {number} offsetSeconds 偏移秒数
 * @param {Object} options 额外选项
 * @param {boolean} options.usePercent 是否启用百分比模式
 * @param {number} options.videoDuration 视频时长（秒）
 * @returns {Array}
 */
export function applyOffset(danmus, offsetSeconds, options = {}) {
  const offset = Number(offsetSeconds);
  if (!offset || !Array.isArray(danmus) || danmus.length === 0) return danmus;

  const usePercent = options?.usePercent === true;
  const videoDuration = Number(options?.videoDuration || 0);
  const scaleRatio = usePercent && Number.isFinite(videoDuration) && videoDuration > 0
    ? (videoDuration + offset) / videoDuration
    : null;

  if (usePercent && scaleRatio === null) return danmus;

  const offsetMs = offset * 1000;
  const clamp = value => Math.max(0, value);
  const roundTo = (value, digits = 2) => Number(value.toFixed(digits));
  const transformSeconds = (time) => {
    const value = scaleRatio !== null ? clamp(time * scaleRatio) : clamp(time + offset);
    return scaleRatio !== null ? roundTo(value, 2) : value;
  };
  const transformMilliseconds = (time) => {
    const value = scaleRatio !== null ? clamp(time * scaleRatio) : clamp(time + offsetMs);
    return scaleRatio !== null ? Math.round(value) : value;
  };

  return danmus.map((danmu) => {
    if (!danmu || typeof danmu !== 'object') return danmu;
    const updated = { ...danmu };

    if (typeof updated.p === 'string') {
      const parts = updated.p.split(',');
      const time = parseFloat(parts[0]);
      if (Number.isFinite(time)) {
        parts[0] = transformSeconds(time).toFixed(2);
        updated.p = parts.join(',');
      }
    }

    if (updated.t !== undefined && updated.t !== null) {
      const t = Number(updated.t);
      if (Number.isFinite(t)) updated.t = transformSeconds(t);
    }

    if (updated.progress !== undefined && updated.progress !== null) {
      const progress = Number(updated.progress);
      if (Number.isFinite(progress)) updated.progress = transformMilliseconds(progress);
    }

    if (updated.timepoint !== undefined && updated.timepoint !== null) {
      const timepoint = Number(updated.timepoint);
      if (Number.isFinite(timepoint)) updated.timepoint = transformSeconds(timepoint);
    }

    return updated;
  });
}
