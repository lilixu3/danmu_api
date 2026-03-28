import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv } from "node:crypto";

import { md5 } from "./utils/crypto-util.js";
import {
  HANJUTV_APP_PROFILE,
  buildLiteHeaders,
  createHanjutvSearchHeaders,
  decodeHanjutvEncryptedPayload,
  getHanjutvSourceLabel,
  normalizeHanjutvEpisodeUrl,
  parseHanjutvEpisodeDanmuId,
} from "./utils/hanjutv-util.js";

const UK_KEY = "f349wghhe784tqwh";
const UK_IV = "d3w8hf94fidk38lk";
const RESPONSE_SECRET = "34F9Q53w/HJW8E6Q";

function decryptBase64(cipherText, key, iv) {
  const decipher = createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  return Buffer.concat([decipher.update(cipherText, "base64"), decipher.final()]).toString("utf8");
}

function encryptBase64(plainText, key, iv) {
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  return Buffer.concat([cipher.update(Buffer.from(plainText, "utf8")), cipher.final()]).toString("base64");
}

test("createHanjutvSearchHeaders keeps uid and app profile fields consistent", async () => {
  const uid = "AbCdEf0123456789ZyXw";
  const timestamp = 1700000000123;
  const headers = await createHanjutvSearchHeaders(uid, timestamp);

  assert.equal(headers.app, "hj");
  assert.equal(headers.ch, HANJUTV_APP_PROFILE.ch);
  assert.equal(headers.vn, HANJUTV_APP_PROFILE.version);
  assert.equal(headers.vc, HANJUTV_APP_PROFILE.vc);
  assert.equal(headers["User-Agent"], HANJUTV_APP_PROFILE.userAgent);
  assert.match(headers.said, /^[0-9a-f]{16}$/);

  assert.equal(decryptBase64(headers.uk, UK_KEY, UK_IV), uid);

  const uidMd5 = md5(uid);
  const signPayload = JSON.parse(decryptBase64(headers.sign, uidMd5.slice(0, 16), uidMd5.slice(16, 32)));
  assert.equal(signPayload.uid, uid);
  assert.equal(signPayload.it, timestamp);
  assert.equal(signPayload.iit, timestamp);
  assert.equal(signPayload.ts, timestamp);
  assert.equal(signPayload.ai, headers.said);
  assert.match(signPayload.oa, /^[0-9a-f]{16}$/);
  assert.equal(signPayload.md, HANJUTV_APP_PROFILE.model);
  assert.equal(signPayload.maker, HANJUTV_APP_PROFILE.maker);
  assert.equal(signPayload.osv, HANJUTV_APP_PROFILE.osv);
});

test("buildLiteHeaders reuses one tv session identity while request payload changes per timestamp", async () => {
  const makeHeaders = await buildLiteHeaders(1700000000000);
  const first = await makeHeaders(1700000000100);
  const second = await makeHeaders(1700000000200);

  assert.equal(first.uid, second.uid);
  assert.equal(first.headers.said, second.headers.said);
  assert.equal(first.headers.di, second.headers.di);
  assert.notEqual(first.headers.rp, second.headers.rp);
  assert.equal(first.headers.uid, "");
  assert.equal(first.headers.token, "");
  assert.equal(decryptBase64(first.headers.di, UK_KEY, UK_IV), first.uid);

  const uidMd5 = md5(first.uid);
  const firstPayload = JSON.parse(decryptBase64(first.headers.rp, uidMd5.slice(0, 16), uidMd5.slice(16, 32)));
  const secondPayload = JSON.parse(decryptBase64(second.headers.rp, uidMd5.slice(0, 16), uidMd5.slice(16, 32)));

  assert.equal(firstPayload.uid, first.uid);
  assert.equal(firstPayload.it, 1700000000000);
  assert.equal(firstPayload.ts, 1700000000100);
  assert.equal(firstPayload.ai, first.headers.said);
  assert.equal(firstPayload.oa, secondPayload.oa);
  assert.equal(secondPayload.ts, 1700000000200);
});

test("decodeHanjutvEncryptedPayload can derive response key from uid and ts", async () => {
  const uid = "AbCdEf0123456789ZyXw";
  const ts = "1700000000";
  const plain = {
    seriesData: {
      seriesList: [{ sid: "1001", name: "测试剧集" }],
    },
  };
  const key = md5(`${uid}${ts}`);
  const mix = md5(`${key}${RESPONSE_SECRET}`);
  const payload = {
    ts,
    data: encryptBase64(JSON.stringify(plain), mix.slice(0, 16), mix.slice(16, 32)),
  };

  const decoded = await decodeHanjutvEncryptedPayload(payload, uid);
  assert.deepEqual(decoded, plain);
});

test("parseHanjutvEpisodeDanmuId and getHanjutvSourceLabel normalize variant prefixes", () => {
  assert.deepEqual(parseHanjutvEpisodeDanmuId("hanjutv:tv:123"), {
    id: "123",
    preferTv: true,
    isLegacyTvCache: false,
  });
  assert.deepEqual(parseHanjutvEpisodeDanmuId("xw:456"), {
    id: "456",
    preferTv: true,
    isLegacyTvCache: true,
  });
  assert.deepEqual(parseHanjutvEpisodeDanmuId("hxq:789"), {
    id: "789",
    preferTv: false,
    isLegacyTvCache: false,
  });
  assert.deepEqual(parseHanjutvEpisodeDanmuId(""), {
    id: "",
    preferTv: false,
    isLegacyTvCache: false,
  });

  assert.equal(getHanjutvSourceLabel("hanjutv:tv:123"), "极速版");
  assert.equal(getHanjutvSourceLabel("xw:456"), "极速版");
  assert.equal(getHanjutvSourceLabel("hxq:789"), "韩小圈");
  assert.equal(getHanjutvSourceLabel("789"), "韩小圈");
});

test("normalizeHanjutvEpisodeUrl upgrades legacy xw cache markers without touching other values", () => {
  assert.equal(normalizeHanjutvEpisodeUrl("hanjutv:xw:123"), "hanjutv:tv:123");
  assert.equal(normalizeHanjutvEpisodeUrl("xw:456"), "tv:456");
  assert.equal(
    normalizeHanjutvEpisodeUrl("hanjutv:xw:123$$$hxq:456$$$xw:789"),
    "hanjutv:tv:123$$$hxq:456$$$tv:789",
  );
  assert.equal(normalizeHanjutvEpisodeUrl("hanjutv:tv:123"), "hanjutv:tv:123");
});
