import { md5, stringToUtf8Bytes, utf8BytesToString } from "./codec-util.js";

const HANJUTV_VERSION = "6.5.3";
const HANJUTV_VC = "a_7980";
const HANJUTV_UA = "HanjuTV/6.5.3 (Pixel 2 XL; Android 11; Scale/2.00)";
const HANJUTV_UK_KEY = "f349wghhe784tqwh";
const HANJUTV_UK_IV = "d3w8hf94fidk38lk";
const HANJUTV_RESPONSE_SECRET = "34F9Q53w/HJW8E6Q";
const UID_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

async function getSubtleCrypto() {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  try {
    const { webcrypto } = await import("node:crypto");
    if (webcrypto?.subtle) return webcrypto.subtle;
  } catch {
  }
  throw new Error("当前运行时不支持 crypto.subtle");
}

function utf8Encode(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  return stringToUtf8Bytes(text);
}

function utf8Decode(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  return utf8BytesToString(bytes);
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");

  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripControlChars(text) {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
}

async function aesCbcEncryptToBase64(plainText, key, iv) {
  const subtle = await getSubtleCrypto();
  const keyBytes = utf8Encode(key);
  const ivBytes = utf8Encode(iv);
  const plainBytes = utf8Encode(plainText);

  const cryptoKey = await subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const cipherBuffer = await subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, plainBytes);
  return bytesToBase64(new Uint8Array(cipherBuffer));
}

async function aesCbcDecryptBase64NoPadding(cipherBase64, key, iv) {
  const subtle = await getSubtleCrypto();
  const keyBytes = utf8Encode(key);
  const ivBytes = utf8Encode(iv);
  const cipherBytes = base64ToBytes(cipherBase64);

  if (cipherBytes.length % 16 !== 0) {
    throw new Error(`密文长度不是16的倍数: ${cipherBytes.length}`);
  }

  const cryptoKey = await subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
  const plainBuffer = await subtle.decrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, cipherBytes);
  return utf8Decode(new Uint8Array(plainBuffer));
}

function randomInt(max) {
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(1);
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function buildSearchSignPayload(uid, timestamp) {
  return JSON.stringify({
    emu: 0,
    ou: 0,
    it: timestamp,
    iit: timestamp,
    bs: 0,
    uid,
    pc: 0,
    tm: 0,
    d8m: "0,0,0,0,0,0,0,0",
    md: "Pixel 2 XL",
    maker: "Google",
    osv: "11",
    br: 100,
    rpc: 0,
    scc: 0,
    plc: 0,
    toc: 1,
    tsc: 0,
    ts: timestamp,
    pa: 1,
    nw: 2,
    px: "0",
    isp: "",
    ai: "ccffc2520864efdb",
    oa: "",
    dpc: 0,
    dsc: 0,
    qpc: 0,
    apad: 0,
    pk: "com.babycloud.hanju",
  });
}

export function createHanjutvUid(length = 20) {
  let uid = "";
  for (let i = 0; i < length; i++) uid += UID_CHARSET[randomInt(UID_CHARSET.length)];
  return uid;
}

export async function createHanjutvSearchHeaders(uid, timestamp = Date.now()) {
  const ts = Number(timestamp);
  const uidMd5 = md5(uid);
  const signPayload = buildSearchSignPayload(uid, ts);
  const sign = await aesCbcEncryptToBase64(signPayload, uidMd5.slice(0, 16), uidMd5.slice(16, 32));
  const uk = await aesCbcEncryptToBase64(uid, HANJUTV_UK_KEY, HANJUTV_UK_IV);

  return {
    app: "hj",
    ch: "qq",
    uk,
    "auth-uid": "",
    vn: HANJUTV_VERSION,
    sign,
    "User-Agent": HANJUTV_UA,
    vc: HANJUTV_VC,
    "auth-token": "",
    "Accept-Encoding": "gzip",
    Connection: "Keep-Alive",
  };
}

export async function decodeHanjutvEncryptedPayload(payload, uid = "") {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  if (typeof payload.data !== "string" || payload.data.length === 0) return payload;

  const ts = payload.ts ?? "";
  let key = typeof payload.key === "string" && payload.key ? payload.key : "";
  if (!key && uid && ts !== "") key = md5(`${uid}${ts}`);
  if (!key) throw new Error("缺少解密 key，且无法通过 uid+ts 推导");

  const mix = md5(`${key}${HANJUTV_RESPONSE_SECRET}`);
  const aesKey = mix.slice(0, 16);
  const iv = mix.slice(16, 32);
  const plainText = await aesCbcDecryptBase64NoPadding(payload.data, aesKey, iv);
  const cleanedText = stripControlChars(plainText).trim();
  return JSON.parse(cleanedText);
}
