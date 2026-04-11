import { globals } from '../configs/globals.js';
import { log } from './log-util.js'

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

// 正则表达式：提取anime标题中的内容
export const extractAnimeTitle = (str) => str.split('(')[0].trim();

// 提取年份的辅助函数
export function extractYear(animeTitle) {
  const match = animeTitle.match(/\((\d{4})\)/);
  return match ? parseInt(match[1]) : null;
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

// 解析fileName，提取动漫名称和平台偏好
export function parseFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return { cleanFileName: '', preferredPlatform: '' };
  }

  const atIndex = fileName.indexOf('@');
  if (atIndex === -1) {
    // 没有@符号，直接返回原文件名
    return { cleanFileName: fileName.trim(), preferredPlatform: '' };
  }

  // 找到@符号，需要分离平台标识
  const beforeAt = fileName.substring(0, atIndex).trim();
  const afterAt = fileName.substring(atIndex + 1).trim();

  // 检查@符号后面是否有季集信息（如 S01E01）
  const seasonEpisodeMatch = afterAt.match(/^(\w+)\s+(S\d+E\d+)$/);
  if (seasonEpisodeMatch) {
    // 格式：动漫名称@平台 S01E01
    const platform = seasonEpisodeMatch[1];
    const seasonEpisode = seasonEpisodeMatch[2];
    return {
      cleanFileName: `${beforeAt} ${seasonEpisode}`,
      preferredPlatform: normalizePlatformName(platform)
    };
  } else {
    // 检查@符号前面是否有季集信息
    const beforeAtMatch = beforeAt.match(/^(.+?)\s+(S\d+E\d+)$/);
    if (beforeAtMatch) {
      // 格式：动漫名称 S01E01@平台
      const title = beforeAtMatch[1];
      const seasonEpisode = beforeAtMatch[2];
      return {
        cleanFileName: `${title} ${seasonEpisode}`,
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

  // 直接返回输入的平台名称（如果有效）
  if (globals.allowedPlatforms.includes(input)) {
    return input;
  }

  // 如果输入的平台名称无效，返回空字符串
  return '';
}

// 根据指定平台创建动态平台顺序
export function createDynamicPlatformOrder(preferredPlatform) {
  if (!preferredPlatform) {
    return [...globals.platformOrderArr]; // 返回默认顺序的副本
  }

  // 验证平台是否有效
  if (!globals.allowedPlatforms.includes(preferredPlatform)) {
    log("warn", `Invalid platform: ${preferredPlatform}, using default order`);
    return [...globals.platformOrderArr];
  }

  // 创建新的平台顺序，将指定平台放在最前面
  const dynamicOrder = [preferredPlatform];

  // 添加其他平台（排除已指定的平台）
  for (const platform of globals.platformOrderArr) {
    if (platform !== preferredPlatform && platform !== null) {
      dynamicOrder.push(platform);
    }
  }

  // 最后添加 null（用于回退逻辑）
  dynamicOrder.push(null);

  return dynamicOrder;
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
 * 规范化标题（移除空格并清理修饰性符号）
 * @param {string} str - 输入字符串
 * @returns {string} 规范化后的字符串
 */
export function normalizeSpaces(str) {
  if (!str) return '';
  // 先清除不可见字符，再移除所有空格与修饰性符号，减少标题格式噪音
  return stripInvisibleChars(String(str).trim()).replace(/[\s【】\[\]《》<>「」!?！？.,，。~～]/g, '');
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

  const rawTitle = stripInvisibleChars(String(animeTitle))
    .replace(/【[^】]*】/g, '')
    .trim();
  let titleWithoutYear = rawTitle
    .replace(/[\(（\[]\d{4}[\)）\]].*$/u, '')
    .trim();

  const explicitSeasonMatch = titleWithoutYear.match(/第\s*([0-9一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+)\s*[季期部]/u);
  if (explicitSeasonMatch) {
    return {
      season: convertChineseNumber(explicitSeasonMatch[1]),
      baseTitle: normalizeSpaces(titleWithoutYear.replace(explicitSeasonMatch[0], '').trim()),
    };
  }

  const seasonMatch = titleWithoutYear.match(/\bS(?:eason)?\s*(\d+)\b/i) || titleWithoutYear.match(/\bSeason\s*(\d+)\b/i);
  if (seasonMatch) {
    return {
      season: parseInt(seasonMatch[1], 10),
      baseTitle: normalizeSpaces(titleWithoutYear.replace(seasonMatch[0], '').trim()),
    };
  }

  const partMatch = titleWithoutYear.match(/\bPart\s*(\d+)\b/i);
  if (partMatch) {
    return {
      season: parseInt(partMatch[1], 10),
      baseTitle: normalizeSpaces(titleWithoutYear.replace(partMatch[0], '').trim()),
    };
  }

  const trailingNumber = titleWithoutYear.match(/(\d{1,2})$/);
  if (trailingNumber) {
    return {
      season: parseInt(trailingNumber[1], 10),
      baseTitle: normalizeSpaces(titleWithoutYear.slice(0, titleWithoutYear.length - trailingNumber[1].length).trim()),
    };
  }

  const trailingChinese = titleWithoutYear.match(/([一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+)$/u);
  if (trailingChinese) {
    return {
      season: convertChineseNumber(trailingChinese[1]),
      baseTitle: normalizeSpaces(titleWithoutYear.replace(trailingChinese[0], '').trim()),
    };
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
  // 解决"和/与"等翻译差异，只要搜索词中 大于 80% 的字符出现在标题里，即视为匹配
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
