import { globals } from '../configs/globals.js';
import { log } from './log-util.js'

const UNICODE_WHITESPACE_REGEX = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/gu;
const TRAILING_YEAR_REGEX = /[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*[\(（\[]\s*([0-9０-９]{4})\s*[\)）\]].*$/u;
const LEADING_TITLE_TAG_REGEX = /^(?:\s*[【\[][^\]】]+[\]】]\s*)+/u;
const TRAILING_SEASON_DELIMITER_REGEX = /[\s._\-:：]+$/u;
const CJK_TRAILING_CHAR_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]$/u;
const NORMALIZED_TITLE_KEEP_REGEX = /[^\u4e00-\u9fa5\u3400-\u4DBF\u{20000}-\u{2EE5F}\u{30000}-\u{323AF}\u3040-\u30ff\uFF65-\uFF9F\uAC00-\uD7AFa-zA-Z0-9\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\u2160-\u217F\u0400-\u04FF\u00C0-\u024F\u0370-\u03FF]/gu;

// =====================
// 通用工具方法
// =====================

// 打印数据前200个字符
export function printFirst200Chars(data) {
  let dataToPrint;

  if (typeof data === 'string') {
    dataToPrint = data;  // 如果是字符串，直接使用
  } else if (Array.isArray(data)) {
    dataToPrint = JSON.stringify(data);  // 如果是数组，转为字符串
  } else if (typeof data === 'object') {
    dataToPrint = JSON.stringify(data);  // 如果是对象，转为字符串
  } else {
    log("error", "Unsupported data type");
    return;
  }

  log("info", dataToPrint.slice(0, 200));  // 打印前200个字符
}

// 正则表达式：提取episode标题中的内容
export const extractEpisodeTitle = (title) => {
  const match = title.match(/【(.*?)】/);  // 匹配【】中的内容
  return match ? match[1] : null;  // 返回方括号中的内容，若没有匹配到，则返回null
};

export function normalizeUnicodeWhitespace(str) {
  if (!str) return '';
  return stripInvisibleChars(String(str)).replace(UNICODE_WHITESPACE_REGEX, ' ').trim();
}

function safeNormalizeNFKC(str) {
  if (str === null || str === undefined) return '';
  const text = String(str);
  if (typeof text.normalize !== 'function') return text;
  try {
    return text.normalize('NFKC');
  } catch {
    return text;
  }
}

function stripLeadingTitleTags(str) {
  return normalizeUnicodeWhitespace(str).replace(LEADING_TITLE_TAG_REGEX, '').trim();
}

function removeTrailingYearSuffix(str) {
  return stripLeadingTitleTags(str).replace(TRAILING_YEAR_REGEX, '').trim();
}

export function extractAnimeTitleMeta(str) {
  const normalizedTitle = stripLeadingTitleTags(str);
  const yearMatch = normalizedTitle.match(TRAILING_YEAR_REGEX);
  const year = yearMatch ? Number.parseInt(safeNormalizeNFKC(yearMatch[1]), 10) : null;
  const displayTitle = normalizedTitle.replace(TRAILING_YEAR_REGEX, '').trim();

  return {
    displayTitle,
    compareTitle: normalizeSpaces(displayTitle),
    year: Number.isFinite(year) ? year : null,
  };
}

// 正则表达式：提取anime标题中的内容
export const extractAnimeTitle = (str) => extractAnimeTitleMeta(str).displayTitle;

export function normalizeTitleForComparison(str) {
  return extractAnimeTitleMeta(str).compareTitle;
}

export function normalizeTitleCacheKey(str) {
  if (!str) return '';
  return safeNormalizeNFKC(normalizeUnicodeWhitespace(String(str))).toLowerCase();
}

// 提取年份的辅助函数
export function extractYear(animeTitle) {
  return extractAnimeTitleMeta(animeTitle).year;
}

export function convertChineseNumber(chineseNumber) {
  // 如果是阿拉伯数字，直接转换
  if (/^\d+$/.test(chineseNumber)) {
    return Number(chineseNumber);
  }

  // 中文数字映射（简体+繁体）
  const digits = {
    // 简体
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9,
    // 繁体
    '壹': 1, '貳': 2, '參': 3, '肆': 4, '伍': 5,
    '陸': 6, '柒': 7, '捌': 8, '玖': 9
  };

  // 单位映射（简体+繁体）
  const units = {
    // 简体
    '十': 10, '百': 100, '千': 1000,
    // 繁体
    '拾': 10, '佰': 100, '仟': 1000
  };

  let result = 0;
  let current = 0;
  let lastUnit = 1;

  for (let i = 0; i < chineseNumber.length; i++) {
    const char = chineseNumber[i];

    if (digits[char] !== undefined) {
      // 数字
      current = digits[char];
    } else if (units[char] !== undefined) {
      // 单位
      const unit = units[char];

      if (current === 0) current = 1;

      if (unit >= lastUnit) {
        // 更大的单位，重置结果
        result = current * unit;
      } else {
        // 更小的单位，累加到结果
        result += current * unit;
      }

      lastUnit = unit;
      current = 0;
    }
  }

  // 处理最后的个位数
  if (current > 0) {
    result += current;
  }

  return result;
}

function isNonAsciiChar(char) {
  return !!char && char.charCodeAt(0) > 127;
}

function trimTrailingSeasonDelimiters(str) {
  return String(str || '').replace(TRAILING_SEASON_DELIMITER_REGEX, '').trim();
}

export function splitTitleAndTrailingSeasonEpisode(text) {
  const normalizedText = normalizeUnicodeWhitespace(text);
  if (!normalizedText) return null;

  const regex = /S(\d+)E(\d+)/ig;
  let match;
  while ((match = regex.exec(normalizedText)) !== null) {
    const tokenIndex = match.index;
    const tokenText = match[0];
    const titlePart = normalizedText.slice(0, tokenIndex);
    const suffixPart = normalizedText.slice(tokenIndex + tokenText.length);

    if (!titlePart.trim()) continue;

    const charBeforeToken = titlePart.slice(-1);
    const hasExplicitSeparator = /[.\s_-]/.test(charBeforeToken);
    if (!hasExplicitSeparator && !isNonAsciiChar(charBeforeToken)) {
      continue;
    }

    const charAfterToken = suffixPart.charAt(0);
    if (charAfterToken && !/[.\s_-]/.test(charAfterToken)) {
      continue;
    }

    return {
      title: trimTrailingSeasonDelimiters(titlePart),
      season: Number.parseInt(match[1], 10),
      episode: Number.parseInt(match[2], 10),
      token: tokenText.toUpperCase(),
    };
  }

  return null;
}

// 解析fileName，提取动漫名称和平台偏好
export function parseFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return { cleanFileName: '', preferredPlatform: '' };
  }

  const normalizedFileName = normalizeUnicodeWhitespace(fileName);
  const atIndex = normalizedFileName.indexOf('@');
  if (atIndex === -1) {
    // 没有@符号，直接返回原文件名
    return { cleanFileName: normalizedFileName, preferredPlatform: '' };
  }

  // 找到@符号，需要分离平台标识
  const beforeAt = normalizedFileName.substring(0, atIndex).trim();
  const afterAt = normalizedFileName.substring(atIndex + 1).trim();

  // 检查@符号后面是否有季集信息（如 S01E01）
  const seasonEpisodeMatch = afterAt.match(/^(\w+)\s+(S\d+E\d+)$/i);
  if (seasonEpisodeMatch) {
    // 格式：动漫名称@平台 S01E01
    const platform = seasonEpisodeMatch[1];
    const seasonEpisode = seasonEpisodeMatch[2].toUpperCase();
    return {
      cleanFileName: `${beforeAt} ${seasonEpisode}`.trim(),
      preferredPlatform: normalizePlatformName(platform)
    };
  } else {
    // 检查@符号前面是否有季集信息
    const parsedSeasonEpisode = splitTitleAndTrailingSeasonEpisode(beforeAt);
    if (parsedSeasonEpisode) {
      // 格式：动漫名称 S01E01@平台
      const title = parsedSeasonEpisode.title;
      const seasonEpisode = parsedSeasonEpisode.token;
      return {
        cleanFileName: `${extractAnimeTitle(title)} ${seasonEpisode}`.trim(),
        preferredPlatform: normalizePlatformName(afterAt)
      };
    } else {
      // 格式：动漫名称@平台（没有季集信息）
      return {
        cleanFileName: beforeAt,
        preferredPlatform: normalizePlatformName(afterAt)
      };
    }
  }
}

// 将用户输入的平台名称映射为标准平台名称
function normalizePlatformName(inputPlatform) {
  if (!inputPlatform || typeof inputPlatform !== 'string') {
    return '';
  }

  const input = inputPlatform.trim();
  const allowedPlatforms = Array.isArray(globals.allowedPlatforms) ? globals.allowedPlatforms : [];

  // 直接返回输入的平台名称（如果有效）
  if (allowedPlatforms.includes(input)) {
    return input;
  }

  // 如果输入的平台名称无效，返回空字符串
  return '';
}

function normalizeRuleSeason(season) {
  if (season === null || season === undefined || season === '') return null;
  const match = String(season).trim().match(/^S?(\d+)$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function appendPlatformOrder(target, item) {
  if (!item || item === null) return;
  if (!target.includes(item)) {
    target.push(item);
  }
}

function mergePlatformOrders(primaryOrder = [], fallbackOrder = []) {
  const result = [];
  primaryOrder.forEach(item => appendPlatformOrder(result, item));
  fallbackOrder.forEach(item => appendPlatformOrder(result, item));
  result.push(null);
  return result;
}

function resolveMatchPlatformRuleOrder(title, season = null) {
  const rules = Array.isArray(globals.matchPlatformRules) ? globals.matchPlatformRules : [];
  if (!title || rules.length === 0) return [];

  const normalizedTitles = new Set(
    (Array.isArray(title) ? title : [title])
      .map(item => normalizeTitleForComparison(item))
      .filter(Boolean)
  );
  if (normalizedTitles.size === 0) return [];

  const normalizedSeason = normalizeRuleSeason(season);
  let genericMatch = null;
  let seasonMatch = null;

  for (const rule of rules) {
    const ruleTitle = normalizeTitleForComparison(rule?.title || '');
    if (!ruleTitle || !normalizedTitles.has(ruleTitle)) continue;

    const ruleSeason = normalizeRuleSeason(rule?.season);
    if (ruleSeason !== null && normalizedSeason !== null && ruleSeason === normalizedSeason) {
      seasonMatch = rule;
    } else if (ruleSeason === null) {
      genericMatch = rule;
    }
  }

  const matchedRule = seasonMatch || genericMatch;
  return Array.isArray(matchedRule?.platforms) ? matchedRule.platforms : [];
}

// 根据指定平台创建动态平台顺序
export function createDynamicPlatformOrder(preferredPlatform, title = '', season = null) {
  const ruleOrder = resolveMatchPlatformRuleOrder(title, season);

  if (!preferredPlatform) {
    if (ruleOrder.length > 0) {
      return mergePlatformOrders(ruleOrder, globals.platformOrderArr);
    }
    return [...globals.platformOrderArr]; // 返回默认顺序的副本
  }

  // 验证平台是否有效
  if (!globals.allowedPlatforms.includes(preferredPlatform)) {
    log("warn", `Invalid platform: ${preferredPlatform}, using default order`);
    if (ruleOrder.length > 0) {
      return mergePlatformOrders(ruleOrder, globals.platformOrderArr);
    }
    return [...globals.platformOrderArr];
  }

  return mergePlatformOrders([preferredPlatform, ...ruleOrder], globals.platformOrderArr);
}

/**
 * 清除不可见 Unicode 字符（零宽空格、方向控制符等，\s 无法覆盖的部分）
 * @param {string} str - 输入字符串
 * @returns {string} 清理后的字符串
 */
export function stripInvisibleChars(str) {
  if (!str) return '';
  return String(str).replace(/[\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g, '');
}

/**
 * 净化搜索关键词（专门针对请求源阶段的温和版）
 * @param {string} str - 原始搜索词
 * @returns {string} 净化后的搜索词
 */
export function sanitizeSearchKeyword(str) {
  if (!str) return '';
  // 搜索阶段统一零宽字符与各种 Unicode 空格，但保留正常标点，避免影响源站命中率。
  return normalizeUnicodeWhitespace(String(str));
}

/**
 * 规范化结果标题（移除空格并清理修饰性符号）
 * @param {string} str - 输入字符串
 * @returns {string} 规范化后的字符串
 */
export function normalizeSpaces(str) {
  if (!str) return '';
  // 比较阶段：先统一 Unicode 空白与全角字符，再仅保留核心文字/数字。
  return safeNormalizeNFKC(normalizeUnicodeWhitespace(String(str)))
    .replace(NORMALIZED_TITLE_KEEP_REGEX, '');
}

/**
 * 严格标题匹配函数
 * @param {string} title - 动漫标题
 * @param {string} query - 搜索关键词
 * @returns {boolean} 是否匹配
 */
export function strictTitleMatch(title, query) {
  if (!title || !query) return false;

  const t = normalizeSpaces(title);
  const q = normalizeSpaces(query);

  // 完全匹配
  if (t === q) return true;

  // 标题以搜索词开头，且后面跟着空格、括号等分隔符
  const separators = [' ', '(', '（', ':', '：', '-', '—', '·', '第', 'S', 's', '年番', '合集'];
  for (const sep of separators) {
    if (t.startsWith(q + sep)) return true;
  }

  return false;
}

/**
 * 从文本中提取明确的季度数字
 * 支持阿拉伯数字、中文数字与 Part 表达
 * @param {string} text - 需要解析的文本
 * @returns {number|null} 提取出的季度数字，未匹配到时返回 null
 */
export function getExplicitSeasonNumber(text) {
  if (!text) return null;

  const normalizedText = normalizeSpaces(String(text));
  const match = normalizedText.match(/(?:第([0-9一二三四五六七八九十百千万]+)[季期部])|(?:S(?:eason)?(\d+))|(?:Part(\d+))/i);
  if (!match) return null;

  const numStr = match[1] || match[2] || match[3];
  return numStr ? convertChineseNumber(numStr) : null;
}

/**
 * 从 animeTitle 中提取季数和纯剧名
 * @param {string} animeTitle
 * @returns {{ season: number|null, baseTitle: string|null }}
 */
export function extractSeasonNumberFromAnimeTitle(animeTitle) {
  if (!animeTitle) return { season: null, baseTitle: null };

  const titleWithoutYear = removeTrailingYearSuffix(animeTitle);

  const buildSeasonResult = (season, baseTitle) => ({
    season,
    baseTitle: normalizeSpaces(baseTitle.replace(TRAILING_SEASON_DELIMITER_REGEX, '').trim()),
  });

  const explicitSeasonMatch = titleWithoutYear.match(/第\s*([0-9一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)\s*[季期部]/u);
  if (explicitSeasonMatch) {
    return buildSeasonResult(
      convertChineseNumber(explicitSeasonMatch[1]),
      titleWithoutYear.replace(explicitSeasonMatch[0], ' ')
    );
  }

  const seasonMatch = titleWithoutYear.match(/(?:^|[\s._-])S(?:eason)?\s*([0-9０-９]{1,2})(?=$|[\s._:\-])/iu);
  if (seasonMatch) {
    return buildSeasonResult(
      Number.parseInt(safeNormalizeNFKC(seasonMatch[1]), 10),
      titleWithoutYear.replace(seasonMatch[0], ' ')
    );
  }

  const partMatch = titleWithoutYear.match(/(?:^|[\s._-])Part\s*([0-9０-９]{1,2})(?=$|[\s._:\-])/iu);
  if (partMatch) {
    return buildSeasonResult(
      Number.parseInt(safeNormalizeNFKC(partMatch[1]), 10),
      titleWithoutYear.replace(partMatch[0], ' ')
    );
  }

  const trailingNumber = titleWithoutYear.match(/^(.*?)([0-9０-９]{1,2})$/u);
  if (trailingNumber) {
    const baseTitle = trailingNumber[1];
    const normalizedDigits = safeNormalizeNFKC(trailingNumber[2]);
    const season = Number.parseInt(normalizedDigits, 10);
    const trimmedBaseTitle = baseTitle.replace(TRAILING_SEASON_DELIMITER_REGEX, '').trim();
    const hasExplicitDelimiter = TRAILING_SEASON_DELIMITER_REGEX.test(baseTitle);

    if (
      Number.isFinite(season)
      && season >= 1
      && season <= 30
      && trimmedBaseTitle
      && !/^0+$/.test(normalizedDigits)
      && (hasExplicitDelimiter || CJK_TRAILING_CHAR_REGEX.test(trimmedBaseTitle))
    ) {
      return buildSeasonResult(season, trimmedBaseTitle);
    }
  }

  const trailingChinese = titleWithoutYear.match(/^(.*?)([一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+)$/u);
  if (trailingChinese) {
    const baseTitle = trailingChinese[1];
    const season = convertChineseNumber(trailingChinese[2]);
    const trimmedBaseTitle = baseTitle.replace(TRAILING_SEASON_DELIMITER_REGEX, '').trim();
    const hasExplicitDelimiter = TRAILING_SEASON_DELIMITER_REGEX.test(baseTitle);

    if (
      Number.isFinite(season)
      && season >= 1
      && season <= 30
      && trimmedBaseTitle
      && (hasExplicitDelimiter || CJK_TRAILING_CHAR_REGEX.test(trimmedBaseTitle))
    ) {
      return buildSeasonResult(season, trimmedBaseTitle);
    }
  }

  return { season: null, baseTitle: normalizeSpaces(titleWithoutYear) };
}

/**
 * 从集标题中提取集数（支持多种格式：第1集、第01集、EP01、E01 等）
 * @param {string} episodeTitle
 * @returns {number|null}
 */
export function extractEpisodeNumberFromTitle(episodeTitle) {
  if (!episodeTitle) return null;

  const rawTitle = stripInvisibleChars(String(episodeTitle))
    .replace(/【[^】]*】/g, ' ')
    .trim();

  const chineseMatch = rawTitle.match(/第\s*(\d+)\s*[集话期]/);
  if (chineseMatch) {
    return parseInt(chineseMatch[1], 10);
  }

  const epMatch = rawTitle.match(/[Ee][Pp]?\s*(\d+)/);
  if (epMatch) {
    return parseInt(epMatch[1], 10);
  }

  const numberMatch = rawTitle.match(/(?:^|\s)(\d+)(?:\s|$)/);
  if (numberMatch) {
    return parseInt(numberMatch[1], 10);
  }

  return null;
}

/**
 * 从标题中提取动漫名称、季数和集数
 * @param {string} animeTitle
 * @param {string} episodeTitle
 * @returns {{ baseTitle: string|null, season: number|null, episode: number|null }}
 */
export function extractAnimeInfo(animeTitle, episodeTitle) {
  const { season, baseTitle } = extractSeasonNumberFromAnimeTitle(animeTitle);
  const episode = extractEpisodeNumberFromTitle(episodeTitle);
  return { baseTitle, season, episode };
}

/**
 * 标题匹配路由函数：支持严格模式，或 宽松模式下的"包含+相似度"混合策略
 * @param {string} title - 动漫标题
 * @param {string} query - 搜索关键词
 * @returns {boolean} 是否匹配
 */
export function titleMatches(title, query) {
  // 策略1：严格模式仅允许头部或完全匹配
  if (globals.strictTitleMatch) return strictTitleMatch(title, query);

  // 预处理：移除干扰字符并转小写，消除格式与大小写差异
  const t = normalizeSpaces(title).toLowerCase();
  const q = normalizeSpaces(query).toLowerCase();

  // 策略2：包含匹配优先 (性能最优且准确，只要完整包含即匹配)
  if (t.includes(q)) return true;

  // 季度特征校验，避免宽松相似度把不同季度误判为同一作品
  const querySeason = getExplicitSeasonNumber(query);
  if (querySeason !== null) {
    const titleSeason = getExplicitSeasonNumber(title);

    if (querySeason > 1 && (titleSeason || 1) !== querySeason) {
      return false;
    }

    if (querySeason === 1 && titleSeason !== null && titleSeason !== 1) {
      return false;
    }
  }

  // 策略3：相似度匹配 (阈值0.8)
  // 长度差异过大，或纯英文/数字时，禁止使用字符打散策略阻断
  if (Math.abs(t.length - q.length) > Math.max(t.length, q.length) * 0.7 || /^[a-zA-Z0-9]+$/.test(q)) {
    return false;
  }
  // 核心相似度计算：解决"和/与"等翻译差异
  const qSet = new Set(q);
  const tSet = new Set(t);
  const matchCount = [...qSet].reduce((acc, char) => acc + (tSet.has(char) ? 1 : 0), 0);

  return (matchCount / qSet.size) > 0.8;
}

/**
 * 数据类型校验
 * @param {string} value - 值
 * @param {string} expectedType - 期望类型
 * @param {string} fieldName - 参数名称
 */
export function validateType(value, expectedType) {
  const fieldName = value?.constructor?.name;  // 获取字段名
  if (expectedType === "array") {
    if (!Array.isArray(value)) {
      throw new TypeError(`${value} 必须是一个数组，但传入的是 ${fieldName}`);
    }
  } else if (expectedType === "boolean") {
    // 对于 boolean 类型，允许任何可转换为布尔值的类型（number, boolean）
    if (typeof value !== "boolean" && typeof value !== "number") {
      throw new TypeError(`${value} 必须是 boolean 或 number，但传入的是 ${fieldName}`);
    }
  } else if (typeof value !== expectedType) {
    throw new TypeError(`${value} 必须是 ${expectedType}，但传入的是 ${fieldName}`);
  }
}

/**
 * 解析布尔类型参数（来自 query/body/env 等）
 * 兼容：true/false, 1/0, "true"/"false", "1"/"0", "yes"/"no", "on"/"off"
 * @param {any} value - 输入值
 * @param {boolean} [defaultValue=false] - 默认值
 * @returns {boolean}
 */
export function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const str = String(value).trim().toLowerCase();
  if (str === '') return defaultValue;

  if (['true', '1', 'yes', 'y', 'on'].includes(str)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(str)) return false;

  return defaultValue;
}
