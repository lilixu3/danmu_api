import { md5, stringToUtf8Bytes, utf8BytesToString, bytesToBase64, base64ToBytes, invSubBytes, subWord, keyExpansion, invShiftRows } from "./codec-util.js";

export const HANJUTV_APP_PROFILES = Object.freeze([
  Object.freeze({
    id: "current",
    version: "6.8.2",
    vc: "a_8280",
    ch: "xiaomi",
    model: "23127PN0CC",
    maker: "Xiaomi",
    osv: "16",
    userAgent: "HanjuTV/6.8.2 (23127PN0CC; Android 16; Scale/2.00)",
  }),
  Object.freeze({
    id: "legacy",
    version: "6.8.2",
    vc: "a_8280",
    ch: "xiaomi",
    model: "Redmi Note 12",
    maker: "Xiaomi",
    osv: "14",
    userAgent: "HanjuTV/6.8.2 (Redmi Note 12; Android 14; Scale/2.00)",
  }),
]);

export const HANJUTV_APP_PROFILE = HANJUTV_APP_PROFILES[0];

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

function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function pkcs7Pad(bytes, blockSize = 16) {
  const remain = bytes.length % blockSize;
  const padSize = remain === 0 ? blockSize : blockSize - remain;
  const result = new Uint8Array(bytes.length + padSize);
  result.set(bytes, 0);
  result.fill(padSize, bytes.length);
  return result;
}

function stripControlChars(text) {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
}

function addRoundKey(state, w, round) {
  const out = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[r + 4 * c] = state[r + 4 * c] ^ w[round * 4 + c][r];
    }
  }
  return out;
}

function shiftRows(state) {
  const out = new Uint8Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r + 4 * c] = state[r + 4 * ((c + r) % 4)];
    }
  }
  return out;
}

function gfMul(a, b) {
  let p = 0;
  let aa = a;
  let bb = b;
  for (let i = 0; i < 8; i++) {
    if (bb & 1) p ^= aa;
    const hi = aa & 0x80;
    aa = (aa << 1) & 0xff;
    if (hi) aa ^= 0x1b;
    bb >>= 1;
  }
  return p;
}

function mixColumns(state) {
  const out = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    const col = state.slice(4 * c, 4 * c + 4);
    out[4 * c + 0] = gfMul(col[0], 0x02) ^ gfMul(col[1], 0x03) ^ col[2] ^ col[3];
    out[4 * c + 1] = col[0] ^ gfMul(col[1], 0x02) ^ gfMul(col[2], 0x03) ^ col[3];
    out[4 * c + 2] = col[0] ^ col[1] ^ gfMul(col[2], 0x02) ^ gfMul(col[3], 0x03);
    out[4 * c + 3] = gfMul(col[0], 0x03) ^ col[1] ^ col[2] ^ gfMul(col[3], 0x02);
  }
  return out;
}

function invMixColumns(state) {
  const out = new Uint8Array(16);
  for (let c = 0; c < 4; c++) {
    const col = state.slice(4 * c, 4 * c + 4);
    out[4 * c + 0] = gfMul(col[0], 0x0e) ^ gfMul(col[1], 0x0b) ^ gfMul(col[2], 0x0d) ^ gfMul(col[3], 0x09);
    out[4 * c + 1] = gfMul(col[0], 0x09) ^ gfMul(col[1], 0x0e) ^ gfMul(col[2], 0x0b) ^ gfMul(col[3], 0x0d);
    out[4 * c + 2] = gfMul(col[0], 0x0d) ^ gfMul(col[1], 0x09) ^ gfMul(col[2], 0x0e) ^ gfMul(col[3], 0x0b);
    out[4 * c + 3] = gfMul(col[0], 0x0b) ^ gfMul(col[1], 0x0d) ^ gfMul(col[2], 0x09) ^ gfMul(col[3], 0x0e);
  }
  return out;
}

function aesEncryptBlock(input, w) {
  let state = new Uint8Array(input);
  state = addRoundKey(state, w, 0);

  for (let round = 1; round <= 9; round++) {
    state = subWord(state);
    state = shiftRows(state);
    state = mixColumns(state);
    state = addRoundKey(state, w, round);
  }

  state = subWord(state);
  state = shiftRows(state);
  state = addRoundKey(state, w, 10);
  return state;
}

function aesDecryptBlock(input, w) {
  let state = new Uint8Array(input);
  state = addRoundKey(state, w, 10);

  for (let round = 9; round >= 1; round--) {
    state = invShiftRows(state);
    state = invSubBytes(state);
    state = addRoundKey(state, w, round);
    state = invMixColumns(state);
  }

  state = invShiftRows(state);
  state = invSubBytes(state);
  state = addRoundKey(state, w, 0);
  return state;
}

function aesCbcEncryptPure(plainBytes, keyBytes, ivBytes) {
  const padded = pkcs7Pad(plainBytes, 16);
  const w = keyExpansion(keyBytes);
  const out = new Uint8Array(padded.length);
  let prev = new Uint8Array(ivBytes);

  for (let i = 0; i < padded.length; i += 16) {
    const block = padded.slice(i, i + 16);
    const mixed = xorBytes(block, prev);
    const cipherBlock = aesEncryptBlock(mixed, w);
    out.set(cipherBlock, i);
    prev = cipherBlock;
  }

  return out;
}

function aesCbcDecryptPureNoUnpad(cipherBytes, keyBytes, ivBytes) {
  if (cipherBytes.length % 16 !== 0) {
    throw new Error(`密文长度不是16的倍数: ${cipherBytes.length}`);
  }

  const w = keyExpansion(keyBytes);
  const out = new Uint8Array(cipherBytes.length);
  let prev = new Uint8Array(ivBytes);

  for (let i = 0; i < cipherBytes.length; i += 16) {
    const block = cipherBytes.slice(i, i + 16);
    const plainBlock = xorBytes(aesDecryptBlock(block, w), prev);
    out.set(plainBlock, i);
    prev = block;
  }

  return out;
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

async function aesCbcDecryptBase64NoPadding(cipherBase64, key, iv) {
  const native = await getNativeCryptoModule();
  if (native) {
    const decipher = native.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(cipherBase64, "base64"), decipher.final()]).toString("utf8");
  }

  const keyBytes = utf8Encode(key);
  const ivBytes = utf8Encode(iv);
  const cipherBytes = base64ToBytes(cipherBase64);
  const plainBytes = aesCbcDecryptPureNoUnpad(cipherBytes, keyBytes, ivBytes);
  return utf8Decode(plainBytes);
}

function randomInt(max) {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(1);
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] % max;
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
  if (isNonEmptyString(profile.id)) {
    const matched = HANJUTV_APP_PROFILES.find((item) => item.id === profile.id);
    if (matched) return matched;
  }
  return HANJUTV_APP_PROFILE;
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

  return JSON.stringify({
    emu: 0,
    ou: 0,
    it: context.installTs,
    iit: context.installTs,
    bs: 0,
    uid: context.uid,
    pc: 0,
    tm: 81,
    d8m: "0,0,0,0,0,0,0,4",
    md: profile.model,
    maker: profile.maker,
    osv: profile.osv,
    br: 95,
    rpc: 0,
    scc: 2,
    plc: 6,
    toc: 19,
    tsc: 10,
    ts,
    pa: 1,
    crec: 0,
    nw: 2,
    px: "0",
    isp: "",
    ai: context.said,
    oa: context.oa,
    dpc: 0,
    dsc: 0,
    qpc: 0,
    apad: 0,
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
  const plainText = await aesCbcDecryptBase64NoPadding(payload.data, aesKey, iv);
  const cleanedText = stripControlChars(plainText).trim();
  return JSON.parse(cleanedText);
}
