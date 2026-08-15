import { globals } from '../configs/globals.js';
import { log } from "./log-util.js";
import { md5 } from "./codec-util.js";
import { httpGet, httpPost } from "./http-util.js";
import { getRedisKey } from "./redis-util.js";

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
let localRedisModulePromise = null;

function isNodeRuntime() {
  return typeof process !== "undefined" && Boolean(process.versions && process.versions.node);
}

async function importLocalRedisModule() {
  if (!localRedisModulePromise) {
    localRedisModulePromise = import(['./local-redis-util', '.js'].join('')).catch((error) => {
      localRedisModulePromise = null;
      throw error;
    });
  }
  return localRedisModulePromise;
}

async function importNodePersistenceModules() {
  if (!isNodeRuntime()) {
    return null;
  }

  const [fs, path, url] = await Promise.all([
    import(['node:', 'fs'].join('')),
    import(['node:', 'path'].join('')),
    import(['node:', 'url'].join(''))
  ]);
  return { fs, path, url };
}

/**
 * 定位 aiyifan-util.js 所在目录（与启动时的工作目录无关）。
 * import.meta.url 不可用时回退到项目原有约定（Vercel CommonJS / Node 默认启动目录）。
 */
function resolveAiyifanBaseDir(path, fileURLToPath) {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (error) {
    if (typeof __dirname !== 'undefined') {
      return __dirname;
    }
    return path.join(process.cwd(), 'danmu_api', 'utils');
  }
}

/**
 * 使用纯 JS 生成去连字符的 UUID v4，不依赖运行时加密 API。
 */
function generateRandomHex32() {
  const hexChars = '0123456789abcdef';
  const randomBytes = new Uint8Array(16);
  for (let i = 0; i < randomBytes.length; i++) {
    randomBytes[i] = Math.floor(Math.random() * 256);
  }
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

  let result = '';
  for (let i = 0; i < randomBytes.length; i++) {
    result += hexChars[(randomBytes[i] >> 4) & 0x0f];
    result += hexChars[randomBytes[i] & 0x0f];
  }
  return result;
}

export function unwrapAiyifanRedisResult(result) {
  let value = result;
  for (let depth = 0; depth < 3; depth++) {
    if (Array.isArray(value)) {
      value = value.length ? value[0] : null;
      continue;
    }
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'result')) {
      value = value.result;
      continue;
    }
    break;
  }
  return value == null ? null : value;
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
  if (typeof parsed === "string" && /^09[0-9a-fA-F]{32}$/.test(parsed)) {
    return parsed.toLowerCase();
  }
  return null;
}

async function readUpstashRedisValue(key) {
  return unwrapAiyifanRedisResult(await getRedisKey(key));
}

async function writeUpstashRedisValue(key, value, expirySeconds) {
  const baseUrl = String(globals.redisUrl || '').replace(/\/+$/, '');
  if (!baseUrl || !globals.redisToken) {
    return;
  }

  const expiryQuery = Number.isFinite(expirySeconds) && expirySeconds > 0
    ? `?EX=${Math.floor(expirySeconds)}`
    : '';
  const response = await fetch(`${baseUrl}/set/${encodeURIComponent(key)}${expiryQuery}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${globals.redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const result = unwrapAiyifanRedisResult(payload);
  if (result !== 'OK') {
    throw new Error(`Redis SET 返回异常: ${String(result)}`);
  }
}

async function readDeviceIdFromUpstashRedis() {
  if (!globals.redisValid) {
    return null;
  }
  try {
    return parsePersistedDeviceId(await readUpstashRedisValue(AIYIFAN_DEVICE_ID_REDIS_KEY));
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
    await writeUpstashRedisValue(AIYIFAN_DEVICE_ID_REDIS_KEY, deviceId);
  } catch (error) {
    log("warn", "[aiyifan] 写入 Upstash deviceid 失败: " + (error.message || '未知错误'));
  }
}

async function readDeviceIdFromLocalRedis() {
  if (!globals.localRedisValid) {
    return null;
  }
  try {
    const { getLocalRedisKey } = await importLocalRedisModule();
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
    const { setLocalRedisKey } = await importLocalRedisModule();
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
    const raw = await readUpstashRedisValue(AIYIFAN_SIGNING_CONFIG_REDIS_KEY);
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed &&
        typeof parsed.publicKey === "string" &&
        typeof parsed.privateKey === "string") {
      return parsed;
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
    await writeUpstashRedisValue(
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

    let nodeModules = null;
    try {
      nodeModules = await importNodePersistenceModules();
      if (nodeModules) {
        const { fs, path, url } = nodeModules;
        const baseDir = resolveAiyifanBaseDir(path, url.fileURLToPath);
        const cacheFilePath = path.join(baseDir, '..', '..', '.cache', 'aiyifan-deviceid');
        try {
          const stored = parsePersistedDeviceId((await fs.promises.readFile(cacheFilePath, 'utf8')).trim());
          if (stored) {
            cachedDeviceId = stored;
            return cachedDeviceId;
          }
        } catch (error) {
          if (error && error.code !== 'ENOENT') {
            log("warn", "[aiyifan] 读取本地 deviceid 缓存失败，将重新生成: " + (error.message || '未知错误'));
          }
        }
      }
    } catch (error) {
      log("warn", "[aiyifan] 当前 Node 环境无法加载 deviceid 文件存储: " + (error.message || '未知错误'));
    }

    const generated = "09" + generateRandomHex32();
    cachedDeviceId = generated;

    await writeDeviceIdToUpstashRedis(generated);
    await writeDeviceIdToLocalRedis(generated);

    if (nodeModules) {
      try {
        const { fs, path, url } = nodeModules;
        const baseDir = resolveAiyifanBaseDir(path, url.fileURLToPath);
        const cacheDir = path.join(baseDir, '..', '..', '.cache');
        await fs.promises.mkdir(cacheDir, { recursive: true });
        await fs.promises.writeFile(
          path.join(cacheDir, 'aiyifan-deviceid'),
          JSON.stringify(generated),
          'utf8'
        );
      } catch (error) {
        log("info", "[aiyifan] 当前环境不支持本地持久化，deviceid 仅本次进程内有效");
      }
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

class AiyifanApiResponseError extends Error {
  constructor(payload, status) {
    super(getFailureMessage(payload, status));
    this.name = 'AiyifanApiResponseError';
    this.payload = payload;
    this.status = status;
    this.ret = safeGet(payload, 'ret', null);
  }
}

function isSigningFailure(error) {
  const status = Number(error && error.status);
  const ret = Number(error && error.ret);
  if (status === 401 || status === 403 || ret === 401 || ret === 403) {
    return true;
  }

  const message = String(error && error.message || '');
  return /(?:验签|签名|密钥|x-sign|signature|invalid\s+sign|public\s*key|private\s*key)/i.test(message) ||
    /HTTP error! status: (?:401|403)\b/i.test(message);
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
    this.httpGet = options.httpGet || httpGet;
    this.httpPost = options.httpPost || httpPost;
    this.readSigningConfig = options.readSigningConfig || readSigningConfigFromUpstashRedis;
    this.writeSigningConfig = options.writeSigningConfig || writeSigningConfigToUpstashRedis;
    this.deviceId = options.deviceId || null;
    this.publicKey = "";
    this.privateKey = AIYIFAN_DEFAULT_PRIVATE_KEY;
    this.configFetchedAt = 0;
    this.configGeneration = 0;
    this.inflightConfigPromise = null;
  }

  applySigningConfig(signingConfig) {
    this.publicKey = signingConfig.publicKey;
    this.privateKey = signingConfig.privateKey;
    this.configFetchedAt = this.now();
    this.configGeneration += 1;
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

    if (this.inflightConfigPromise) {
      return this.inflightConfigPromise;
    }

    const task = (async () => {
      // serverless 多实例/冷启动场景：先从 Upstash 恢复，避免每次冷启动请求配置接口。
      if (!forceRefresh) {
        const cached = await this.readSigningConfig();
        if (cached) {
          this.applySigningConfig(cached);
          log("info", '[system] [aiyifan] 已从 Upstash 恢复 App 签名配置: ' + this.publicKey.slice(0, 12) + '...');
          return {
            publicKey: this.publicKey,
            privateKey: this.privateKey
          };
        }
      }

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

      const response = await this.httpPost(this.proxyUrlBuilder(url), "", {
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

      this.applySigningConfig({
        publicKey: pConfig.publicKey,
        privateKey: pConfig.privateKey[0]
      });
      log("info", '[system] [aiyifan] 已更新 App 签名配置: ' + this.publicKey.slice(0, 12) + '...');
      await this.writeSigningConfig({
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

    return { url: url, headers: headers, configGeneration: this.configGeneration };
  }

  /**
   * 发送带签名的 GET 请求并校验响应。
   */
  async signedGetJson(api, params, logPrefix, forceRefresh) {
    logPrefix = logPrefix || "Aiyifan";
    forceRefresh = forceRefresh || false;
    let requestConfigGeneration = null;

    try {
      const signedRequest = await this.buildSignedRequest(api, params);
      requestConfigGeneration = signedRequest.configGeneration;
      const response = await this.httpGet(this.proxyUrlBuilder(signedRequest.url), {
        headers: signedRequest.headers,
        timeout: 10000,
        retries: 1
      });
      const payload = normalizeJsonPayload(response.data);
      if (!payload || !isRequestSuccessful(payload)) {
        throw new AiyifanApiResponseError(payload, response.status);
      }
      return payload;
    } catch (error) {
      if (!forceRefresh && isSigningFailure(error)) {
        log("warn", '[' + logPrefix + '] App 验签失败，刷新签名配置后重试: ' + (error.message || '未知错误'));
        if (requestConfigGeneration === this.configGeneration) {
          await this.getSigningConfig(true);
        }
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
    let requestConfigGeneration = null;

    try {
      const signedRequest = await this.buildSignedRequest(api, null);
      requestConfigGeneration = signedRequest.configGeneration;
      signedRequest.headers["Content-Type"] = "application/json;charset=utf-8";
      const response = await this.httpPost(this.proxyUrlBuilder(signedRequest.url), JSON.stringify(body), {
        headers: signedRequest.headers,
        timeout: 10000,
        retries: 1
      });
      const payload = normalizeJsonPayload(response.data);
      if (!payload || !isRequestSuccessful(payload)) {
        throw new AiyifanApiResponseError(payload, response.status);
      }
      return payload;
    } catch (error) {
      if (!forceRefresh && isSigningFailure(error)) {
        log("warn", '[' + logPrefix + '] App 验签失败，刷新签名配置后重试: ' + (error.message || '未知错误'));
        if (requestConfigGeneration === this.configGeneration) {
          await this.getSigningConfig(true);
        }
        return this.signedPostJson(api, body, logPrefix, true);
      }
      throw error;
    }
  }
}
