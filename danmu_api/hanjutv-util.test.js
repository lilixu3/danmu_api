import test from "node:test";
import assert from "node:assert/strict";
import { md5 } from "./utils/codec-util.js";
import { createHanjutvUid, createHanjutvSearchHeaders, decodeHanjutvEncryptedPayload } from "./utils/hanjutv-util.js";

const RESPONSE_SECRET = "34F9Q53w/HJW8E6Q";

async function getSubtleCrypto() {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  const { webcrypto } = await import("node:crypto");
  return webcrypto.subtle;
}

function utf8Encode(text) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  return new Uint8Array(Buffer.from(text, "utf8"));
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");

  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function pkcs7Pad(bytes, blockSize = 16) {
  const remain = bytes.length % blockSize;
  const padSize = remain === 0 ? blockSize : blockSize - remain;
  const result = new Uint8Array(bytes.length + padSize);
  result.set(bytes, 0);
  result.fill(padSize, bytes.length);
  return result;
}

async function aesCbcEncryptToBase64(plainText, key, iv) {
  const subtle = await getSubtleCrypto();
  const keyBytes = utf8Encode(key);
  const ivBytes = utf8Encode(iv);
  const plainBytes = pkcs7Pad(utf8Encode(plainText), 16);

  const cryptoKey = await subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const cipherBuffer = await subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, plainBytes);
  return bytesToBase64(new Uint8Array(cipherBuffer));
}

async function encryptResponsePayload(dataObj, key) {
  const mix = md5(`${key}${RESPONSE_SECRET}`);
  const aesKey = mix.slice(0, 16);
  const iv = mix.slice(16, 32);
  const data = await aesCbcEncryptToBase64(JSON.stringify(dataObj), aesKey, iv);
  return { data };
}

test("createHanjutvUid 生成合法 uid", () => {
  const uid = createHanjutvUid();
  assert.equal(uid.length, 20);
  assert.match(uid, /^[0-9A-Za-z]{20}$/);
});

test("createHanjutvSearchHeaders 生成必要请求头", async () => {
  const headers = await createHanjutvSearchHeaders("AbCdEf0123456789XYza", 1700000000000);
  assert.equal(headers.app, "hj");
  assert.equal(headers.ch, "qq");
  assert.ok(typeof headers.uk === "string" && headers.uk.length > 0);
  assert.ok(typeof headers.sign === "string" && headers.sign.length > 0);
  assert.equal(headers.vn, "6.5.3");
  assert.equal(headers.uk, "Hlyp5D7xaL86V45e4NMq9lEFqaIlw70Ofr3SViAVPXw=");
});

test("createHanjutvSearchHeaders 的 uk 与官方算法一致", async () => {
  const headers = await createHanjutvSearchHeaders("R4VRuaXvhTDZ8g9oOiSd", 1700000000000);
  assert.equal(headers.uk, "cU3pQcUA5bnaKgiKxs+twGGCbldX/SfYF8rpSrIk328=");
});

test("decodeHanjutvEncryptedPayload 支持 key 解密", async () => {
  const raw = { ok: 1, list: [{ sid: "A1", name: "测试剧集" }] };
  const key = "0123456789abcdef0123456789abcdef";
  const payload = await encryptResponsePayload(raw, key);
  payload.key = key;
  payload.ts = 1700000000000;

  const decoded = await decodeHanjutvEncryptedPayload(payload);
  assert.deepEqual(decoded, raw);
});

test("decodeHanjutvEncryptedPayload 支持 uid+ts 推导 key", async () => {
  const raw = { ok: 1, list: [{ sid: "B2", name: "社内相亲" }] };
  const uid = "AbCdEf0123456789XYza";
  const ts = 1700000000000;
  const key = md5(`${uid}${ts}`);
  const payload = await encryptResponsePayload(raw, key);
  payload.ts = ts;

  const decoded = await decodeHanjutvEncryptedPayload(payload, uid);
  assert.deepEqual(decoded, raw);
});

test("decodeHanjutvEncryptedPayload 对非加密数据透传", async () => {
  const raw = { rescode: 0, ts: 1700000000000 };
  const decoded = await decodeHanjutvEncryptedPayload(raw);
  assert.deepEqual(decoded, raw);
});
