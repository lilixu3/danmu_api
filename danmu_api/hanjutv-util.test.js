import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import HanjutvSource from "./sources/hanjutv.js";
import {
  HANJUTV_APP_PROFILE,
  clearHanjutvIdentityStateCache,
  createHanjutvSearchContext,
  createHanjutvSearchHeaders,
  decodeHanjutvEncryptedPayload,
  loadHanjutvSearchContext,
} from "./utils/hanjutv-util.js";

const STABLE_ENV = Object.freeze({
  VERCEL_PROJECT_PRODUCTION_URL: "danmu-api.vercel.app",
  VERCEL_PROJECT_ID: "prj_hanjutv_test",
  VERCEL_GIT_REPO_SLUG: "danmu_api",
});

const ORIGINAL_ENV = Object.fromEntries(
  Object.keys(STABLE_ENV).map((key) => [key, process.env[key]])
);

for (const [key, value] of Object.entries(STABLE_ENV)) {
  process.env[key] = value;
}

test.beforeEach(() => {
  for (const [key, value] of Object.entries(STABLE_ENV)) {
    process.env[key] = value;
  }
  clearHanjutvIdentityStateCache();
});

test.after(() => {
  clearHanjutvIdentityStateCache();
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function md5Hex(text) {
  return crypto.createHash("md5").update(String(text)).digest("hex");
}

function decryptAesCbcBase64(base64Cipher, key, iv, autoPadding = true) {
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  decipher.setAutoPadding(autoPadding);
  return Buffer.concat([decipher.update(base64Cipher, "base64"), decipher.final()]);
}

function encryptAesCbcBase64(plainText, key, iv) {
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  const out = Buffer.concat([cipher.update(Buffer.from(plainText, "utf8")), cipher.final()]);
  return out.toString("base64");
}

test("createHanjutvSearchHeaders should keep stable device fields and current app profile", async () => {
  const context = createHanjutvSearchContext({
    uid: "ABCDEFGHIJKLMNOPQRST",
    said: "1234567890abcdef",
    oa: "fedcba0987654321",
    installTs: 1700000000000,
    profile: HANJUTV_APP_PROFILE,
  }, 1701234567890, HANJUTV_APP_PROFILE);
  const ts = 1701234567890;

  const headers = await createHanjutvSearchHeaders(context, ts);
  const uidMd5 = md5Hex(context.uid);
  const signPlain = decryptAesCbcBase64(headers.sign, uidMd5.slice(0, 16), uidMd5.slice(16, 32), true).toString("utf8");
  const payload = JSON.parse(signPlain);

  assert.equal(headers.app, "hj");
  assert.equal(headers.ch, HANJUTV_APP_PROFILE.ch);
  assert.equal(headers.vc, HANJUTV_APP_PROFILE.vc);
  assert.equal(headers.vn, HANJUTV_APP_PROFILE.version);
  assert.equal(headers.said, context.said);
  assert.equal(headers["User-Agent"], HANJUTV_APP_PROFILE.userAgent);
  assert.equal(payload.uid, context.uid);
  assert.equal(payload.ai, context.said);
  assert.equal(payload.oa, context.oa);
  assert.equal(payload.it, context.installTs);
  assert.equal(payload.iit, context.installTs);
  assert.equal(payload.md, HANJUTV_APP_PROFILE.model);
  assert.equal(payload.maker, HANJUTV_APP_PROFILE.maker);
  assert.equal(payload.osv, HANJUTV_APP_PROFILE.osv);
  assert.equal(payload.ts, ts);
});

test("decodeHanjutvEncryptedPayload should decode response body derived from uid and ts", async () => {
  const uid = "ABCDEFGHIJKLMNOPQRST";
  const ts = 1701234567890;
  const expected = { seriesList: [{ sid: "series-1", name: "测试韩剧" }] };
  const key = md5Hex(`${uid}${ts}`);
  const mix = md5Hex(`${key}34F9Q53w/HJW8E6Q`);
  const aesKey = mix.slice(0, 16);
  const iv = mix.slice(16, 32);
  const data = encryptAesCbcBase64(JSON.stringify(expected), aesKey, iv);

  const decoded = await decodeHanjutvEncryptedPayload({ ts, data }, uid);
  assert.deepEqual(decoded, expected);
});

test("stable platform seed should keep mobile and tv identities reusable across cold starts", async () => {
  const sourceA = new HanjutvSource();
  const mobileA = sourceA.getMobileSearchContext();
  const appHeadersA = sourceA.getAppHeaders();
  const tvHeadersA = await sourceA.buildTvHeaders();

  clearHanjutvIdentityStateCache();

  const sourceB = new HanjutvSource();
  const mobileB = sourceB.getMobileSearchContext();
  const tvHeadersB = await sourceB.buildTvHeaders();

  assert.equal(mobileA.uid, mobileB.uid);
  assert.equal(mobileA.said, mobileB.said);
  assert.equal(mobileA.oa, mobileB.oa);
  assert.equal(mobileA.installTs, mobileB.installTs);
  assert.equal(appHeadersA.said, mobileA.said);
  assert.equal(appHeadersA["User-Agent"], HANJUTV_APP_PROFILE.userAgent);
  assert.equal(tvHeadersA.uid, tvHeadersB.uid);
  assert.equal(tvHeadersA.headers.said, tvHeadersB.headers.said);
});

test("loadHanjutvSearchContext should allow refreshing to a temporary new runtime identity", () => {
  const stable = loadHanjutvSearchContext();
  const refreshed = loadHanjutvSearchContext(HANJUTV_APP_PROFILE, { refresh: true, forceRandom: true });
  const reusedRefreshed = loadHanjutvSearchContext();

  assert.notEqual(refreshed.uid, stable.uid);
  assert.notEqual(refreshed.oa, stable.oa);
  assert.equal(reusedRefreshed.uid, refreshed.uid);
  assert.equal(reusedRefreshed.said, refreshed.said);
});
