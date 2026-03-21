import { md5, stringToUtf8Bytes, utf8BytesToString, bytesToBase64, base64ToBytes, aesCbcEncryptPure, aesCbcDecryptPure } from "./crypto-util.js";

export const HANJUTV_APP_PROFILE = Object.freeze({
  version: "6.8.2",
  vc: "a_8280",
  ch: "xiaomi",
  model: "23127PN0CC",
  maker: "Xiaomi",
  osv: "16",
  userAgent: "HanjuTV/6.8.2 (23127PN0CC; Android 16; Scale/2.00)",
});

const HANJUTV_APP_PROFILE_KEYS = Object.freeze([
  "version",
  "vc",
  "ch",
  "model",
  "maker",
  "osv",
  "userAgent",
]);

const HANJUTV_INSTALL_SEED_EPOCH = Date.UTC(2024, 0, 1);
const HANJUTV_INSTALL_SEED_WINDOW_MS = 540 * 24 * 60 * 60 * 1000;
const HANJUTV_STABLE_ENV_KEYS = Object.freeze([
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID",
  "VERCEL_GIT_REPO_OWNER",
  "VERCEL_GIT_REPO_SLUG",
  "NETLIFY_SITE_ID",
  "SITE_ID",
  "URL",
  "CF_PAGES_URL",
  "EDGEONE_SERVICE_NAME",
  "EDGEONE_SITE_NAME",
  "EDGEONE_ENV",
  "RAILWAY_PROJECT_ID",
  "RENDER_SERVICE_ID",
  "KOYEB_SERVICE_ID",
]);
const HANJUTV_CRYPTO = Object.freeze({
  ukKey: "f349wghhe784tqwh",
  ukIv: "d3w8hf94fidk38lk",
  responseSecret: "34F9Q53w/HJW8E6Q",
  uidCharset: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
});

const HANJUTV_TV_PROFILE = Object.freeze({
  version: "a_22570",
  versionName: "1.7.2",
  channel: "xiaomi",
  appType: "ztv",
  model: "23127PN0CC",
  osv: "16",
  userAgent: "ZTV/1.7.2 (23127PN0CC; Android 16; Scale/2.00)",
  said: "fb3597b87601d5a7",
});

let nativeCryptoModulePromise;
let hanjutvMobileIdentityState = null;
let hanjutvTvIdentityState = null;

function utf8Encode(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  return stringToUtf8Bytes(text);
}

function utf8Decode(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  return utf8BytesToString(bytes);
}

async function getNativeCryptoModule() {
  if (nativeCryptoModulePromise === undefined) {
    nativeCryptoModulePromise = import("node:crypto")
      .then((mod) => mod)
      .catch(() => null);
  }
  return nativeCryptoModulePromise;
}

async function aesCbcEncryptToBase64(plainText, key, iv) {
  const native = await getNativeCryptoModule();
  if (native) {
    const cipher = native.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
    const out = Buffer.concat([cipher.update(Buffer.from(plainText, "utf8")), cipher.final()]);
    return out.toString("base64");
  }

  const keyBytes = utf8Encode(key);
  const ivBytes = utf8Encode(iv);
  const plainBytes = utf8Encode(plainText);
  const cipherBytes = aesCbcEncryptPure(plainBytes, keyBytes, ivBytes);
  return bytesToBase64(cipherBytes);
}

async function aesCbcDecryptBase64(cipherBase64, key, iv) {
  const native = await getNativeCryptoModule();
  if (native) {
    const decipher = native.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
    return Buffer.concat([decipher.update(cipherBase64, "base64"), decipher.final()]).toString("utf8");
  }

  const cipherBytes = base64ToBytes(cipherBase64);
  const plainBytes = aesCbcDecryptPure(cipherBytes, utf8Encode(key), utf8Encode(iv));
  return utf8Decode(plainBytes);
}

function randomInt(max) {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint8Array(1);
    const limit = 256 - (256 % max); // rejection sampling 消除模偏差
    let val;
    do {
      globalThis.crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % max;
  }
  return Math.floor(Math.random() * max);
}

function randomFrom(chars, len) {
  let s = "";
  for (let i = 0; i < len; i++) s += chars[randomInt(chars.length)];
  return s;
}

function randomHex(len) {
  return randomFrom("0123456789abcdef", len);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isHex(value, length) {
  return typeof value === "string" && value.length == length && /^[0-9a-f]+$/i.test(value);
}

function normalizePositiveTimestamp(value, fallbackValue) {
  const ts = Number(value);
  return Number.isFinite(ts) && ts > 0 ? Math.trunc(ts) : Math.trunc(Number(fallbackValue) || Date.now());
}

function normalizeAppProfile(profile = null) {
  if (!profile || typeof profile !== "object") return HANJUTV_APP_PROFILE;

  const nextProfile = { ...HANJUTV_APP_PROFILE };
  for (const key of HANJUTV_APP_PROFILE_KEYS) {
    if (isNonEmptyString(profile[key])) nextProfile[key] = profile[key];
  }
  return nextProfile;
}

function getStableDeploymentSeed() {
  if (typeof process === "undefined" || !process?.env) return "";

  const parts = [];
  for (const key of HANJUTV_STABLE_ENV_KEYS) {
    const value = typeof process.env[key] === "string" ? process.env[key].trim() : "";
    if (!value) continue;
    const entry = `${key}=${value}`;
    if (!parts.includes(entry)) parts.push(entry);
  }

  return parts.join("|");
}

function deriveDeterministicString(seed, len, chars) {
  let output = "";
  for (let round = 0; output.length < len; round++) {
    const digest = md5(`${seed}:${round}`);
    for (let i = 0; i < digest.length && output.length < len; i += 2) {
      const value = parseInt(digest.slice(i, i + 2), 16);
      output += chars[value % chars.length];
    }
  }
  return output;
}

function deriveDeterministicHex(seed, len) {
  return deriveDeterministicString(seed, len, "0123456789abcdef");
}

function deriveDeterministicInstallTs(seed) {
  const hex = md5(`${seed}:installTs`);
  const offset = parseInt(hex.slice(0, 12), 16) % HANJUTV_INSTALL_SEED_WINDOW_MS;
  return HANJUTV_INSTALL_SEED_EPOCH + offset;
}

function createSeededIdentityRecord(seed, kind) {
  const scope = `${seed}:${kind}`;
  const installTs = deriveDeterministicInstallTs(scope);
  return {
    uid: deriveDeterministicString(`${scope}:uid`, 20, HANJUTV_CRYPTO.uidCharset),
    said: kind === "tv" ? HANJUTV_TV_PROFILE.said : deriveDeterministicHex(`${scope}:said`, 16),
    oa: deriveDeterministicHex(`${scope}:oa`, 16),
    installTs,
    createdAt: installTs,
  };
}

function createIdentityRecord(baseRecord = null, timestamp = Date.now(), options = {}) {
  const existing = baseRecord && typeof baseRecord === "object" ? baseRecord : {};
  const fallbackTs = normalizePositiveTimestamp(options.fallbackTs, timestamp);

  return {
    uid: isNonEmptyString(existing.uid) ? existing.uid : createHanjutvUid(),
    said: isHex(existing.said, 16) ? existing.said.toLowerCase() : options.defaultSaid(),
    oa: isHex(existing.oa, 16) ? existing.oa.toLowerCase() : randomHex(16),
    installTs: normalizePositiveTimestamp(existing.installTs, fallbackTs),
    createdAt: normalizePositiveTimestamp(existing.createdAt, fallbackTs),
  };
}

function getMobileIdentityState(options = {}) {
  if (options.refresh || !hanjutvMobileIdentityState) {
    const seed = options.forceRandom ? "" : getStableDeploymentSeed();
    const base = seed ? createSeededIdentityRecord(seed, "mobile") : null;
    hanjutvMobileIdentityState = createHanjutvSearchContext(base, base?.installTs ?? options.timestamp ?? Date.now(), HANJUTV_APP_PROFILE);
  }
  return hanjutvMobileIdentityState;
}

function getTvIdentityState(options = {}) {
  if (options.refresh || !hanjutvTvIdentityState) {
    const seed = options.forceRandom ? "" : getStableDeploymentSeed();
    const base = seed ? createSeededIdentityRecord(seed, "tv") : null;
    hanjutvTvIdentityState = createHanjutvTvContext(base, base?.installTs ?? options.timestamp ?? Date.now());
  }
  return hanjutvTvIdentityState;
}

export function clearHanjutvIdentityStateCache(kind = "") {
  if (!kind || kind === "mobile") hanjutvMobileIdentityState = null;
  if (!kind || kind === "tv") hanjutvTvIdentityState = null;
}

function buildSearchSignPayload(context, timestamp) {
  const ts = Number(timestamp);
  const profile = context.profile || HANJUTV_APP_PROFILE;

  // 模拟客户端设备指纹，字段值来自抓包，保持与真实客户端一致即可
  return JSON.stringify({
    emu: 0, ou: 0,
    it: context.installTs, iit: context.installTs,
    bs: 0, uid: context.uid, pc: 0,
    tm: 81,                        // 总内存 (GB 级别的设备指标)
    d8m: "0,0,0,0,0,0,0,4",       // 8 日活跃分布
    md: profile.model, maker: profile.maker, osv: profile.osv,
    br: 95,                        // 电量百分比
    rpc: 0, scc: 2, plc: 6,       // 各类计数器
    toc: 19, tsc: 10,             // 累计打开/搜索次数
    ts, pa: 1, crec: 0,
    nw: 2,                         // 网络类型 (2=WiFi)
    px: "0", isp: "",
    ai: context.said, oa: context.oa,
    dpc: 0, dsc: 0, qpc: 0, apad: 0,
    pk: "com.babycloud.hanju",
  });
}

export function createHanjutvUid(length = 20) {
  let uid = "";
  for (let i = 0; i < length; i++) uid += HANJUTV_CRYPTO.uidCharset[randomInt(HANJUTV_CRYPTO.uidCharset.length)];
  return uid;
}

export function createHanjutvSearchContext(baseContext = null, timestamp = Date.now(), profile = null) {
  const existing = baseContext && typeof baseContext === "object" ? baseContext : {};

  return {
    ...createIdentityRecord(existing, timestamp, {
      fallbackTs: timestamp,
      defaultSaid: () => randomHex(16),
    }),
    profile: normalizeAppProfile(profile || existing.profile || null),
  };
}

function createHanjutvTvContext(baseContext = null, timestamp = Date.now()) {
  return createIdentityRecord(baseContext, timestamp, {
    fallbackTs: timestamp,
    defaultSaid: () => HANJUTV_TV_PROFILE.said,
  });
}

export function loadHanjutvSearchContext(profile = HANJUTV_APP_PROFILE, options = {}) {
  const baseContext = getMobileIdentityState(options);
  return createHanjutvSearchContext(baseContext, options.timestamp ?? Date.now(), profile);
}

function normalizeSearchContext(contextOrUid, timestamp = Date.now()) {
  if (typeof contextOrUid === "string") {
    return createHanjutvSearchContext({ uid: contextOrUid }, timestamp);
  }
  if (contextOrUid && typeof contextOrUid === "object") {
    return createHanjutvSearchContext(contextOrUid, timestamp, contextOrUid.profile || null);
  }
  return createHanjutvSearchContext(null, timestamp);
}

export async function createHanjutvSearchHeaders(contextOrUid, timestamp = Date.now()) {
  const ts = Number(timestamp);
  const context = normalizeSearchContext(contextOrUid, ts);
  const profile = context.profile || HANJUTV_APP_PROFILE;
  const uidMd5 = md5(context.uid);
  const signPayload = buildSearchSignPayload(context, ts);
  const sign = await aesCbcEncryptToBase64(signPayload, uidMd5.slice(0, 16), uidMd5.slice(16, 32));
  const uk = await aesCbcEncryptToBase64(context.uid, HANJUTV_CRYPTO.ukKey, HANJUTV_CRYPTO.ukIv);

  return {
    app: "hj",
    ch: profile.ch,
    said: context.said,
    uk,
    vn: profile.version,
    sign,
    "User-Agent": profile.userAgent,
    vc: profile.vc,
    "Accept-Encoding": "gzip",
    Connection: "Keep-Alive",
  };
}

export async function buildLiteHeaders(sessionInitTs = Date.now()) {
  const tvContext = getTvIdentityState({ timestamp: sessionInitTs });

  return async function makeHeaders(reqTs = Date.now()) {
    const uidMd5 = md5(tvContext.uid);
    const rpPayload = JSON.stringify({
      emu: 0, ou: 0, it: tvContext.installTs, iit: tvContext.installTs, bs: 0, uid: tvContext.uid,
      isp: "", pc: 0, tm: 50, d8m: "0,0,0,0,0,0,14,7", md: HANJUTV_TV_PROFILE.model,
      dn: "", osv: HANJUTV_TV_PROFILE.osv, br: 50, rpc: 0, scc: 1, plc: 1, toc: 5, tsc: 7,
      ts: reqTs, nw: 2, px: "0", ai: tvContext.said, oa: tvContext.oa, dpc: 0, dsc: 0, qpc: 0, apad: 0,
    });

    const di = await aesCbcEncryptToBase64(tvContext.uid, HANJUTV_CRYPTO.ukKey, HANJUTV_CRYPTO.ukIv);
    const rp = await aesCbcEncryptToBase64(rpPayload, uidMd5.slice(0, 16), uidMd5.slice(16, 32));

    return {
      uid: tvContext.uid,
      headers: {
        version: HANJUTV_TV_PROFILE.version,
        "version-name": HANJUTV_TV_PROFILE.versionName,
        channel: HANJUTV_TV_PROFILE.channel,
        "app-type": HANJUTV_TV_PROFILE.appType,
        "User-Agent": HANJUTV_TV_PROFILE.userAgent,
        said: tvContext.said,
        di,
        token: "",
        uid: "",
        rp,
        "Accept-Encoding": "gzip",
        Connection: "Keep-Alive",
      },
    };
  };
}

export async function decodeHanjutvEncryptedPayload(payload, uid = "") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  if (typeof payload.data !== "string" || payload.data.length === 0) return payload;

  const ts = payload.ts ?? "";
  let key = typeof payload.key === "string" && payload.key ? payload.key : "";
  if (!key && uid && ts !== "") key = md5(`${uid}${ts}`);
  if (!key) throw new Error("缺少解密 key，且无法通过 uid+ts 推导");

  const mix = md5(`${key}${HANJUTV_CRYPTO.responseSecret}`);
  const aesKey = mix.slice(0, 16);
  const iv = mix.slice(16, 32);
  const plainText = await aesCbcDecryptBase64(payload.data, aesKey, iv);
  return JSON.parse(plainText.trim());
}
