import { globals } from '../configs/globals.js';
import { log } from "./log-util.js";
import { md5 } from "./codec-util.js";
import { httpGet, updateQueryString } from "./http-util.js";

const DEFAULT_CONFIG_PAGE_URL = "https://www.yfsp.tv/";
const DEFAULT_USER_AGENT = (
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0 Safari/537.36"
);

export const AIYIFAN_SIGNING_CONFIG_TTL_MS = 60 * 1000;

function safeGet(obj, path, defaultValue) {
  if (obj == null) {
    return defaultValue;
  }

  const keys = path.split(".");
  let result = obj;

  for (let i = 0; i < keys.length; i++) {
    if (result == null) {
      return defaultValue;
    }

    const key = keys[i];
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrKey = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      result = result[arrKey];
      if (!Array.isArray(result) || index >= result.length) {
        return defaultValue;
      }
      result = result[index];
      continue;
    }

    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}

function mergeObjects(base, extra) {
  const result = {};
  const sources = [base, extra];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) {
      continue;
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        result[key] = source[key];
      }
    }
  }

  return result;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, "%20"));
  } catch (error) {
    return value;
  }
}

function extractAssignedObjectLiteral(html, variableName) {
  const assignmentPattern = new RegExp("\\b(?:var|let|const)\\s+" + variableName + "\\s*=\\s*");
  const match = assignmentPattern.exec(html);
  if (!match) {
    return null;
  }

  const objectStart = html.indexOf("{", match.index + match[0].length);
  if (objectStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;

  for (let i = objectStart; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(objectStart, i + 1);
      }
    }
  }

  return null;
}

function parseFallbackPConfig(html) {
  const match = html.match(/"pConfig"\s*:\s*\{\s*"publicKey"\s*:\s*"([^"]+)"\s*,\s*"privateKey"\s*:\s*\[(.*?)\]\s*\}/s);
  if (!match) {
    return null;
  }

  let privateKeys = [];
  try {
    privateKeys = JSON.parse("[" + match[2] + "]");
  } catch (error) {
    return null;
  }

  if (!match[1] || !privateKeys.length) {
    return null;
  }

  return {
    publicKey: match[1],
    privateKey: privateKeys[0]
  };
}

export function extractPConfigFromInjectJson(injectJson) {
  const config = safeGet(injectJson, "config[0].pConfig", null);
  if (!config) {
    return null;
  }

  const publicKey = config.publicKey;
  const privateKey = Array.isArray(config.privateKey) ? config.privateKey[0] : config.privateKey;

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey };
}

export function extractPConfigFromHtml(html) {
  const objectLiteral = extractAssignedObjectLiteral(html, "injectJson");
  if (objectLiteral) {
    try {
      const injectJson = JSON.parse(objectLiteral);
      const signingConfig = extractPConfigFromInjectJson(injectJson);
      if (signingConfig) {
        return signingConfig;
      }
    } catch (error) {
      log("warn", "[Aiyifan] 解析 injectJson 失败，回退到 pConfig 提取: " + ((error && error.message) || "未知错误"));
    }
  }

  return parseFallbackPConfig(html);
}

function normalizeQueryValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function isSigningParam(key) {
  return key === "vv" || key === "pub";
}

function splitQueryString(queryString) {
  if (!queryString) {
    return [];
  }

  return queryString
    .split("&")
    .filter(Boolean)
    .map(function(pair) {
      const equalsIndex = pair.indexOf("=");
      const rawKey = equalsIndex === -1 ? pair : pair.slice(0, equalsIndex);
      const rawValue = equalsIndex === -1 ? "" : pair.slice(equalsIndex + 1);
      const key = safeDecodeURIComponent(rawKey);
      const value = safeDecodeURIComponent(rawValue);
      return [key, value];
    });
}

function getIterableEntries(input) {
  if (!input || typeof input.entries !== "function") {
    return null;
  }

  try {
    const entries = input.entries();
    if (Array.isArray(entries)) {
      return entries;
    }

    if (entries && typeof entries.next === "function") {
      const result = [];
      let current = entries.next();
      while (!current.done) {
        result.push(current.value);
        current = entries.next();
      }
      return result;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function getQueryEntries(input) {
  if (!input) {
    return [];
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return [];
    }

    let queryString = trimmed;
    const queryIndex = trimmed.indexOf("?");
    if (queryIndex !== -1) {
      const hashIndex = trimmed.indexOf("#", queryIndex);
      queryString = trimmed.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
    } else if (trimmed.charAt(0) === "?") {
      queryString = trimmed.slice(1);
    }

    return splitQueryString(queryString);
  }

  const iterableEntries = getIterableEntries(input);
  if (iterableEntries) {
    return iterableEntries
      .map(function(item) {
        return [item[0], normalizeQueryValue(item[1])];
      })
      .filter(function(item) {
        return item[1] !== null;
      });
  }

  if (typeof input.forEach === "function") {
    const result = [];
    input.forEach(function(value, key) {
      result.push([key, normalizeQueryValue(value)]);
    });
    return result.filter(function(item) {
      return item[1] !== null;
    });
  }

  if (typeof input === "object") {
    return Object.keys(input)
      .map(function(key) {
        return [key, normalizeQueryValue(input[key])];
      })
      .filter(function(item) {
        return item[1] !== null;
      });
  }

  return [];
}

export function buildCanonicalQuery(input) {
  return getQueryEntries(input)
    .filter(function(item) {
      return !isSigningParam(item[0]);
    })
    .map(function(item) {
      return item[0] + "=" + item[1];
    })
    .join("&");
}

export function computeAiyifanVv(input, signingConfig) {
  const query = buildCanonicalQuery(input);
  const raw = signingConfig.publicKey + "&" + query.toLowerCase() + "&" + signingConfig.privateKey;
  return md5(raw);
}

function normalizeJsonPayload(data) {
  if (typeof data === "string") {
    return JSON.parse(data);
  }
  return data;
}

function defaultIsResponseSuccessful(payload) {
  return safeGet(payload, "ret", null) === 200 && safeGet(payload, "data.code", null) === 0;
}

function defaultGetFailureMessage(payload, status) {
  return safeGet(payload, "data.msg", null) || safeGet(payload, "msg", null) || ("HTTP " + status);
}

export class AiyifanSigningProvider {
  constructor(options) {
    options = options || {};
    this.request = options.request || httpGet;
    this.proxyUrlBuilder = options.proxyUrlBuilder || function(url) {
      return globals.makeProxyUrl(url);
    };
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    this.configPageUrl = options.configPageUrl || DEFAULT_CONFIG_PAGE_URL;
    this.ttlMs = options.ttlMs || AIYIFAN_SIGNING_CONFIG_TTL_MS;
    this.now = options.now || function() {
      return Date.now();
    };
    this.getConfigHeaders = options.getConfigHeaders || function() {
      return {};
    };
    this.isResponseSuccessful = options.isResponseSuccessful || defaultIsResponseSuccessful;
    this.getFailureMessage = options.getFailureMessage || defaultGetFailureMessage;
    this.signingConfig = null;
    this.signingConfigFetchedAt = 0;
  }

  async getSigningConfig(forceRefresh) {
    forceRefresh = forceRefresh || false;
    const now = this.now();
    const cacheValid = this.signingConfig && (now - this.signingConfigFetchedAt) < this.ttlMs;

    if (!forceRefresh && cacheValid) {
      return this.signingConfig;
    }

    const headers = mergeObjects(
      {
        "User-Agent": this.userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      this.getConfigHeaders() || {}
    );

    const response = await this.request(this.proxyUrlBuilder(this.configPageUrl), { headers });
    const html = typeof response.data === "string"
      ? response.data
      : String(response && response.data != null ? response.data : "");
    const signingConfig = extractPConfigFromHtml(html);
    if (!signingConfig) {
      throw new Error("未能从桌面站页面解析到 pConfig");
    }

    this.signingConfig = signingConfig;
    this.signingConfigFetchedAt = now;
    log("info", "[Aiyifan] 已更新桌面站签名配置: " + signingConfig.publicKey.slice(0, 12) + "...");
    return signingConfig;
  }

  buildSignedParams(baseParams, signingConfig) {
    const result = {};

    for (const key in baseParams) {
      if (Object.prototype.hasOwnProperty.call(baseParams, key)) {
        result[key] = baseParams[key];
      }
    }

    result.vv = computeAiyifanVv(baseParams, signingConfig);
    result.pub = signingConfig.publicKey;
    return result;
  }

  async signedGetJson(api, baseParams, headers, logPrefix, forceRefresh) {
    headers = headers || {};
    logPrefix = logPrefix || "Aiyifan";
    forceRefresh = forceRefresh || false;

    const signingConfig = await this.getSigningConfig(forceRefresh);
    const signedParams = this.buildSignedParams(baseParams, signingConfig);
    const requestUrl = updateQueryString(api, signedParams);
    const response = await this.request(this.proxyUrlBuilder(requestUrl), { headers });
    const status = response && response.status != null ? response.status : 200;

    let payload;
    try {
      payload = normalizeJsonPayload(response.data);
    } catch (error) {
      if (!forceRefresh) {
        log("warn", "[" + logPrefix + "] 响应无法解析为 JSON，刷新签名配置后重试: " + ((error && error.message) || "未知错误"));
        return this.signedGetJson(api, baseParams, headers, logPrefix, true);
      }
      throw error;
    }

    if (status !== 200 || !this.isResponseSuccessful(payload)) {
      if (!forceRefresh) {
        log("warn", "[" + logPrefix + "] 当前签名请求失败，刷新 pConfig 后重试: " + this.getFailureMessage(payload, status));
        return this.signedGetJson(api, baseParams, headers, logPrefix, true);
      }
      throw new Error(this.getFailureMessage(payload, status));
    }

    return {
      data: payload,
      vv: signedParams.vv,
      signingConfig: signingConfig
    };
  }
}
