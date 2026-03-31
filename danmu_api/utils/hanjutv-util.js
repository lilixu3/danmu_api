import { md5, stringToUtf8Bytes, utf8BytesToString, bytesToBase64, base64ToBytes, aesCbcEncryptPure, aesCbcDecryptPure } from "./crypto-util.js";

export const HANJUTV_FULL_EPISODE_FALLBACK_SEGMENT_DATA = "__hanjutv_full_episode_fallback__";

export const HANJUTV_APP_PROFILE = Object.freeze({
  version: "6.8.2",
  vc: "a_8280",
  ch: "xiaomi",
  model: "23127PN0CC",
  maker: "Xiaomi",
  osv: "16",
  userAgent: "HanjuTV/6.8.2 (23127PN0CC; Android 16; Scale/2.00)",
});

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
    const limit = 256 - (256 % max);
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
  let value = "";
  for (let i = 0; i < len; i++) value += chars[randomInt(chars.length)];
  return value;
}

function randomHex(len) {
  return randomFrom("0123456789abcdef", len);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function normalizePositiveTimestamp(value, fallbackValue = Date.now()) {
  const ts = Number(value);
  return Number.isFinite(ts) && ts > 0 ? Math.trunc(ts) : Math.trunc(Number(fallbackValue) || Date.now());
}

function createSearchContext(uid, timestamp = Date.now()) {
  const installTs = normalizePositiveTimestamp(timestamp);
  return {
    uid: isNonEmptyString(uid) ? uid : createHanjutvUid(),
    said: randomHex(16),
    oa: randomHex(16),
    installTs,
  };
}

function createTvContext(sessionInitTs = Date.now()) {
  return {
    uid: createHanjutvUid(),
    said: HANJUTV_TV_PROFILE.said,
    oa: randomHex(16),
    installTs: normalizePositiveTimestamp(sessionInitTs),
  };
}

function buildSearchSignPayload(context, timestamp) {
  const ts = normalizePositiveTimestamp(timestamp);

  return JSON.stringify({
    emu: 0, ou: 0,
    it: context.installTs, iit: context.installTs,
    bs: 0, uid: context.uid, pc: 0,
    tm: 81,
    d8m: "0,0,0,0,0,0,0,4",
    md: HANJUTV_APP_PROFILE.model, maker: HANJUTV_APP_PROFILE.maker, osv: HANJUTV_APP_PROFILE.osv,
    br: 95,
    rpc: 0, scc: 2, plc: 6,
    toc: 19, tsc: 10,
    ts, pa: 1, crec: 0,
    nw: 2,
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

export async function createHanjutvSearchHeaders(uid, timestamp = Date.now()) {
  const context = createSearchContext(uid, timestamp);
  const uidMd5 = md5(context.uid);
  const signPayload = buildSearchSignPayload(context, timestamp);
  const sign = await aesCbcEncryptToBase64(signPayload, uidMd5.slice(0, 16), uidMd5.slice(16, 32));
  const uk = await aesCbcEncryptToBase64(context.uid, HANJUTV_CRYPTO.ukKey, HANJUTV_CRYPTO.ukIv);

  return {
    app: "hj",
    ch: HANJUTV_APP_PROFILE.ch,
    said: context.said,
    uk,
    vn: HANJUTV_APP_PROFILE.version,
    sign,
    "User-Agent": HANJUTV_APP_PROFILE.userAgent,
    vc: HANJUTV_APP_PROFILE.vc,
    "Accept-Encoding": "gzip",
    Connection: "Keep-Alive",
  };
}

export async function buildLiteHeaders(sessionInitTs = Date.now()) {
  const tvContext = createTvContext(sessionInitTs);

  return async function makeHeaders(reqTs = Date.now()) {
    const ts = normalizePositiveTimestamp(reqTs);
    const uidMd5 = md5(tvContext.uid);
    const rpPayload = JSON.stringify({
      emu: 0, ou: 0, it: tvContext.installTs, iit: tvContext.installTs, bs: 0, uid: tvContext.uid,
      isp: "", pc: 0, tm: 50, d8m: "0,0,0,0,0,0,14,7", md: HANJUTV_TV_PROFILE.model,
      dn: "", osv: HANJUTV_TV_PROFILE.osv, br: 50, rpc: 0, scc: 1, plc: 1, toc: 5, tsc: 7,
      ts, nw: 2, px: "0", ai: tvContext.said, oa: tvContext.oa, dpc: 0, dsc: 0, qpc: 0, apad: 0,
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

function normalizeHanjutvEpisodeIdText(rawId = "") {
  const idText = String(rawId || "").trim();
  return idText.startsWith("hanjutv:") ? idText.slice("hanjutv:".length) : idText;
}

export function parseHanjutvEpisodeDanmuId(rawId = "") {
  const normalizedId = normalizeHanjutvEpisodeIdText(rawId);
  if (!normalizedId) {
    return { id: "", preferTv: false, isLegacyTvCache: false };
  }

  if (normalizedId.startsWith("tv:")) {
    return {
      id: normalizedId.slice(3),
      preferTv: true,
      isLegacyTvCache: false,
    };
  }

  if (normalizedId.startsWith("xw:")) {
    return {
      id: normalizedId.slice(3),
      preferTv: true,
      isLegacyTvCache: true,
    };
  }

  if (normalizedId.startsWith("hxq:")) {
    return {
      id: normalizedId.slice(4),
      preferTv: false,
      isLegacyTvCache: false,
    };
  }

  return {
    id: normalizedId,
    preferTv: false,
    isLegacyTvCache: false,
  };
}

export function getHanjutvSourceLabel(rawId = "") {
  const normalizedId = normalizeHanjutvEpisodeIdText(rawId);
  return normalizedId.startsWith("tv:") || normalizedId.startsWith("xw:") ? "极速版" : "韩小圈";
}

export function normalizeHanjutvEpisodeUrl(url) {
  const rawUrl = String(url ?? "").trim();
  if (!rawUrl) {
    return rawUrl;
  }

  let changed = false;
  const normalized = rawUrl
    .split("$$$")
    .map((part) => {
      const value = String(part ?? "").trim();
      if (value.startsWith("hanjutv:xw:")) {
        changed = true;
        return `hanjutv:tv:${value.slice("hanjutv:xw:".length)}`;
      }
      if (value.startsWith("xw:")) {
        changed = true;
        return `tv:${value.slice(3)}`;
      }
      return value;
    })
    .join("$$$");

  return changed ? normalized : rawUrl;
}
