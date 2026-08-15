import { globals } from '../configs/globals.js';
import { log } from "./log-util.js";
import { md5 } from "./codec-util.js";
import { httpGet, httpPost } from "./http-util.js";
import { getRedisKey, setRedisKey, setRedisKeyWithExpiry } from "./redis-util.js";
import { getLocalRedisKey, setLocalRedisKey } from "./local-redis-util.js";

// =====================
// 爱壹帆 App 链路接口签名工具
// 官方 Android App (com.cqcsy.ifvod) 的请求签名规则：
//   - 请求头: x-timestamp / x-pub / x-sign
//   - 无查询参数时自动追加 _t=<秒级时间戳>
//   - x-sign = md5(最终URL的query串 + x-timestamp + privateKey)
//   - privateKey 初始为 App 内置默认值，调用 /api/home/config 获取 pConfig 后替换
// =====================

export const AIYIFAN_CONFIG_API = "https://api.tripdata.app/api/home/config";
export const AIYIFAN_DEFAULT_PRIVATE_KEY = "57688*1-331@";
export const AIYIFAN_SIGNING_CONFIG_TTL_MS = 10 * 60 * 1000;
export const AIYIFAN_DEVICE_ID_REDIS_KEY = "aiyifanDeviceId";
export const AIYIFAN_SIGNING_CONFIG_REDIS_KEY = "aiyifanSigningConfig";
export const AIYIFAN_SIGNING_CONFIG_REDIS_TTL_SECONDS = 60 * 60;

// 官方 App 的固定请求头（deviceid 单独生成，见 ensureAiyifanDeviceId）
export const AIYIFAN_APP_HEADERS = {
  "User-Agent": "okhttp-okgo/jeasonlzy",
  "Accept": "application/json",
  "Accept-Language": "zh-CN,zh;q=0.8",
  "bundleid": "com.cqcsy.ifvod",
  "appversion": "1.7.8",
  "system": "Android",
  "systemversion": "16",
  "deviceinfo": "Xiaomi 23127PN0CC",
  "version": "V3",
  "lang": "0",
  "lat": "0.0",
  "lng": "0.0"
};

let cachedDeviceId = null;
let deviceIdReadyPromise = null;

/**
 * 定位 aiyifan-util.js 所在目录（与启动时的工作目录无关）。
 * import.meta.url 不可用时回退到项目原有约定（Vercel CommonJS / Node 默认启动目录）。
 */
async function resolveAiyifanBaseDir(path) {
  try {
    const { fileURLToPath } = await import('node:url');
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (error) {
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
    return path.join(process.cwd(), 'danmu_api', 'utils');
  }
}

/**
 * 生成 32 位随机十六进制串（UUID v4 去连字符的等价格式）。
 * 与其他源保持一致，使用纯 JS Math.random，不引入任何额外依赖。
 */
function generateRandomHex32() {
  const hexChars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

function parsePersistedDeviceId(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  let parsed = raw;
  if (raw.startsWith('"')) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  if (typeof parsed === "string" && /^[0-9a-fA-F]{32,34}$/.test(parsed)) {
    return parsed.toLowerCase();
  }
  return null;
}

async function readDeviceIdFromUpstashRedis() {
  if (!globals.redisValid) {
    return null;
  }
  try {
    const result = await getRedisKey(AIYIFAN_DEVICE_ID_REDIS_KEY);
    return parsePersistedDeviceId(Array.isArray(result) ? result[0] : null);
  } catch (error) {
    log("warn", "[aiyifan] 从 Upstash 读取 deviceid 失败: " + (error.message || '未知错误'));
    return null;
  }
}

async function writeDeviceIdToUpstashRedis(deviceId) {
  if (!globals.redisValid) {
    return;
  }
  try {
    await setRedisKey(AIYIFAN_DEVICE_ID_REDIS_KEY, deviceId);
  } catch (error) {
    log("warn", "[aiyifan] 写入 Upstash deviceid 失败: " + (error.message || '未知错误'));
  }
}

async function readDeviceIdFromLocalRedis() {
  if (!globals.localRedisValid) {
    return null;
  }
  try {
    const result = await getLocalRedisKey(AIYIFAN_DEVICE_ID_REDIS_KEY);
    return parsePersistedDeviceId(result);
  } catch (error) {
    log("warn", "[aiyifan] 从本地 Redis 读取 deviceid 失败: " + (error.message || '未知错误'));
    return null;
  }
}

async function writeDeviceIdToLocalRedis(deviceId) {
  if (!globals.localRedisValid) {
    return;
  }
  try {
    await setLocalRedisKey(AIYIFAN_DEVICE_ID_REDIS_KEY, deviceId);
  } catch (error) {
    log("warn", "[aiyifan] 写入本地 Redis deviceid 失败: " + (error.message || '未知错误'));
  }
}

async function readSigningConfigFromUpstashRedis() {
  if (!globals.redisValid) {
    return null;
  }
  try {
    const result = await getRedisKey(AIYIFAN_SIGNING_CONFIG_REDIS_KEY);
    const raw = Array.isArray(result) ? result[0] : null;
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (parsed &&
          typeof parsed.publicKey === "string" &&
          typeof parsed.privateKey === "string") {
        return parsed;
      }
    }
  } catch (error) {
    log("warn", "[aiyifan] 从 Upstash 读取签名配置失败: " + (error.message || '未知错误'));
  }
  return null;
}

async function writeSigningConfigToUpstashRedis(signingConfig) {
  if (!globals.redisValid) {
    return;
  }
  try {
    await setRedisKeyWithExpiry(
      AIYIFAN_SIGNING_CONFIG_REDIS_KEY,
      signingConfig,
      AIYIFAN_SIGNING_CONFIG_REDIS_TTL_SECONDS
    );
  } catch (error) {
    log("warn", "[aiyifan] 写入 Upstash 签名配置失败: " + (error.message || '未知错误'));
  }
}

/**
 * 获取爱壹帆 App 接口的设备标识。
 * 官方 Android 客户端逻辑（com.blankj.utilcode.util.k.n()）：
 *   - 优先复用已持久化的 KEY_UDID；
 *   - Android ID 可用时生成 "02" + UUID v3(Android ID)；
 *   - Android ID 不可用（模拟器/权限受限）时生成 "09" + 随机 UUID v4；
 *   - 生成后写入本地 SharedPreferences，后续请求保持稳定。
 * 服务端无 Android ID 环境，因此按官方无 Android ID 分支生成 "09" + UUID v4（去除连字符）。
 * 持久化策略：
 *   - Node/VM 等可写文件系统环境：写入项目已有的 .cache/ 目录，重启后复用；
 *   - Cloudflare/Vercel/Netlify 等只读或临时文件系统环境：自动回退为内存生成（冷启动后重新生成，
 *     服务端仅将 deviceid 作为不透明标识使用，不影响接口可用性）。
 */
export async function ensureAiyifanDeviceId() {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  if (deviceIdReadyPromise) {
    return deviceIdReadyPromise;
  }

  deviceIdReadyPromise = (async () => {
    const fromUpstash = await readDeviceIdFromUpstashRedis();
    if (fromUpstash) {
      cachedDeviceId = fromUpstash;
      return cachedDeviceId;
    }

    const fromLocalRedis = await readDeviceIdFromLocalRedis();
    if (fromLocalRedis) {
      cachedDeviceId = fromLocalRedis;
      return cachedDeviceId;
    }

    let fs, path, baseDir;
    try {
      fs = await import('node:fs');
      path = await import('node:path');
      baseDir = await resolveAiyifanBaseDir(path);
      const cacheFilePath = path.join(baseDir, '..', '..', '.cache', 'aiyifan-deviceid');

      if (fs.existsSync(cacheFilePath)) {
        const stored = parsePersistedDeviceId(fs.readFileSync(cacheFilePath, 'utf8').trim());
        if (stored) {
          cachedDeviceId = stored;
          return cachedDeviceId;
        }
      }
    } catch (error) {
      log("warn", "[aiyifan] 读取本地 deviceid 缓存失败，将重新生成: " + (error.message || '未知错误'));
    }

    const generated = "09" + generateRandomHex32();
    cachedDeviceId = generated;

    await writeDeviceIdToUpstashRedis(generated);
    await writeDeviceIdToLocalRedis(generated);

    try {
      fs = await import('node:fs');
      path = await import('node:path');
      baseDir = await resolveAiyifanBaseDir(path);
      const cacheDir = path.join(baseDir, '..', '..', '.cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(path.join(cacheDir, 'aiyifan-deviceid'), JSON.stringify(generated), 'utf8');
    } catch (error) {
      log("info", "[aiyifan] 当前环境不支持本地持久化，deviceid 仅本次进程内有效");
    }

    return cachedDeviceId;
  })();

  return deviceIdReadyPromise;
}

// 安全获取对象属性（替代可选链操作符）
function safeGet(obj, path, defaultValue) {
  if (obj == null) return defaultValue;
  const keys = path.split('.');
  let result = obj;
  for (let i = 0; i < keys.length; i++) {
    if (result == null) return defaultValue;
    const key = keys[i];
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrKey = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      result = result[arrKey];
      if (Array.isArray(result) && index < result.length) {
        result = result[index];
      } else {
        return defaultValue;
      }
    } else {
      result = result[key];
    }
  }
  return result !== undefined ? result : defaultValue;
}

function normalizeJsonPayload(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return data;
}

function getFailureMessage(payload, status) {
  const msg = safeGet(payload, 'msg', null);
  return msg || ('HTTP ' + status);
}

function isRequestSuccessful(payload) {
  return safeGet(payload, 'ret', null) === 200;
}

/**
 * 构建查询串，仅保留非空参数。
 * 值与 OkHttp 构建的 URL 保持一致（ASCII 参数不做额外转义）。
 */
function buildQueryString(params) {
  if (!params) return "";
  if (typeof params === "string") {
    return params.replace(/^\?/, "");
  }
  return Object.keys(params)
    .filter(function(key) {
      const value = params[key];
      return value !== undefined && value !== null;
    })
    .map(function(key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]));
    })
    .join("&");
}

export class AiyifanAppSigningProvider {
  constructor(options) {
    options = options || {};
    this.proxyUrlBuilder = options.proxyUrlBuilder || function(url) {
      return globals.makeProxyUrl(url);
    };
    this.ttlMs = options.ttlMs || AIYIFAN_SIGNING_CONFIG_TTL_MS;
    this.now = options.now || function() { return Date.now(); };
    this.deviceId = options.deviceId || null;
    this.publicKey = "";
    this.privateKey = AIYIFAN_DEFAULT_PRIVATE_KEY;
    this.configFetchedAt = 0;
    this.inflightConfigPromise = null;
  }

  async getDeviceId() {
    if (this.deviceId) {
      return this.deviceId;
    }
    this.deviceId = await ensureAiyifanDeviceId();
    return this.deviceId;
  }

  timestamp() {
    return Math.floor(this.now() / 1000);
  }

  /**
   * 获取 App 签名配置（publicKey / privateKey）。
   * 首次使用内置默认 privateKey 请求 /api/home/config，成功后缓存。
   */
  async getSigningConfig(forceRefresh) {
    forceRefresh = forceRefresh || false;
    const now = this.now();
    const cacheValid = this.publicKey &&
      this.privateKey &&
      (now - this.configFetchedAt) < this.ttlMs;

    if (!forceRefresh && cacheValid) {
      return {
        publicKey: this.publicKey,
        privateKey: this.privateKey
      };
    }

    // serverless 多实例/冷启动场景：先从 Upstash 恢复签名配置，避免每次冷启动都请求 /api/home/config
    if (!forceRefresh) {
      const cached = await readSigningConfigFromUpstashRedis();
      if (cached) {
        this.publicKey = cached.publicKey;
        this.privateKey = cached.privateKey;
        this.configFetchedAt = now;
        log("info", '[system] [aiyifan] 已从 Upstash 恢复 App 签名配置: ' + this.publicKey.slice(0, 12) + '...');
        return {
          publicKey: this.publicKey,
          privateKey: this.privateKey
        };
      }
    }

    if (this.inflightConfigPromise && !forceRefresh) {
      return this.inflightConfigPromise;
    }

    const task = (async () => {
      const ts = this.timestamp();
      const deviceId = await this.getDeviceId();
      const url = AIYIFAN_CONFIG_API + "?_t=" + ts;
      const sign = md5("_t=" + ts + ts + AIYIFAN_DEFAULT_PRIVATE_KEY);
      const headers = Object.assign({}, AIYIFAN_APP_HEADERS, {
        "deviceid": deviceId,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-timestamp": String(ts),
        "x-pub": "",
        "x-sign": sign
      });

      const response = await httpPost(this.proxyUrlBuilder(url), "", {
        headers: headers,
        timeout: 10000,
        retries: 1
      });
      const payload = normalizeJsonPayload(response.data);
      if (!payload || !isRequestSuccessful(payload)) {
        throw new Error("获取 App 签名配置失败: " + getFailureMessage(payload, response.status));
      }

      const pConfig = safeGet(payload, 'data.list.pConfig', null);
      if (!pConfig ||
          !pConfig.publicKey ||
          !Array.isArray(pConfig.privateKey) ||
          !pConfig.privateKey.length) {
        throw new Error("App 签名配置响应缺少 pConfig");
      }

      this.publicKey = pConfig.publicKey;
      this.privateKey = pConfig.privateKey[0];
      this.configFetchedAt = this.now();
      log("info", '[system] [aiyifan] 已更新 App 签名配置: ' + this.publicKey.slice(0, 12) + '...');
      writeSigningConfigToUpstashRedis({
        publicKey: this.publicKey,
        privateKey: this.privateKey
      });
      return {
        publicKey: this.publicKey,
        privateKey: this.privateKey
      };
    })();

    this.inflightConfigPromise = task;
    try {
      return await task;
    } finally {
      this.inflightConfigPromise = null;
    }
  }

  /**
   * 构建带签名请求。
   * @param {string} api - 接口地址
   * @param {Object|null} params - GET 查询参数；POST 传 null（自动追加 _t）
   * @returns {Promise<{url: string, headers: Object}>}
   */
  async buildSignedRequest(api, params) {
    await this.getSigningConfig(false);
    const ts = this.timestamp();
    const deviceId = await this.getDeviceId();
    let url = api;
    let query;

    if (params && Object.keys(params).length) {
      query = buildQueryString(params);
      url += (api.indexOf("?") === -1 ? "?" : "&") + query;
    } else {
      query = "_t=" + ts;
      url += (api.indexOf("?") === -1 ? "?" : "&") + query;
    }

    const sign = md5(query + ts + this.privateKey);
    const headers = Object.assign({}, AIYIFAN_APP_HEADERS, {
      "deviceid": deviceId,
      "x-timestamp": String(ts),
      "x-pub": this.publicKey,
      "x-sign": sign
    });

    return { url: url, headers: headers };
  }

  /**
   * 发送带签名的 GET 请求并校验响应。
   */
  async signedGetJson(api, params, logPrefix, forceRefresh) {
    logPrefix = logPrefix || "Aiyifan";
    forceRefresh = forceRefresh || false;

    try {
      const { url, headers } = await this.buildSignedRequest(api, params);
      const response = await httpGet(this.proxyUrlBuilder(url), {
        headers: headers,
        timeout: 10000,
        retries: 1
      });
      const payload = normalizeJsonPayload(response.data);
      if (!payload || !isRequestSuccessful(payload)) {
        throw new Error(getFailureMessage(payload, response.status));
      }
      return payload;
    } catch (error) {
      if (!forceRefresh) {
        log("warn", '[' + logPrefix + '] App 请求失败，刷新签名配置后重试: ' + (error.message || '未知错误'));
        await this.getSigningConfig(true);
        return this.signedGetJson(api, params, logPrefix, true);
      }
      throw error;
    }
  }

  /**
   * 发送带签名的 POST 请求并校验响应。
   * @param {string} api - 接口地址（无查询参数，自动追加 _t）
   * @param {Object} body - JSON 请求体
   */
  async signedPostJson(api, body, logPrefix, forceRefresh) {
    logPrefix = logPrefix || "Aiyifan";
    forceRefresh = forceRefresh || false;
    body = body || {};

    try {
      const { url, headers } = await this.buildSignedRequest(api, null);
      headers["Content-Type"] = "application/json;charset=utf-8";
      const response = await httpPost(this.proxyUrlBuilder(url), JSON.stringify(body), {
        headers: headers,
        timeout: 10000,
        retries: 1
      });
      const payload = normalizeJsonPayload(response.data);
      if (!payload || !isRequestSuccessful(payload)) {
        throw new Error(getFailureMessage(payload, response.status));
      }
      return payload;
    } catch (error) {
      if (!forceRefresh) {
        log("warn", '[' + logPrefix + '] App 请求失败，刷新签名配置后重试: ' + (error.message || '未知错误'));
        await this.getSigningConfig(true);
        return this.signedPostJson(api, body, logPrefix, true);
      }
      throw error;
    }
  }
}
