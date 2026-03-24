import test from "node:test";
import assert from "node:assert/strict";

import {
  HANJUTV_APP_PROFILE,
  clearHanjutvIdentityStateCache,
  loadHanjutvSearchContext,
} from "./utils/hanjutv-util.js";

const MOBILE_SEED_ENV_KEYS = [
  "VERCEL_PROJECT_ID",
  "VERCEL_ORG_ID",
  "VERCEL_GIT_REPO_OWNER",
  "VERCEL_GIT_REPO_SLUG",
  "HANJUTV_UID",
];

function withEnv(nextEnv, fn) {
  const backup = new Map();
  for (const key of MOBILE_SEED_ENV_KEYS) backup.set(key, process.env[key]);

  try {
    for (const key of MOBILE_SEED_ENV_KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(nextEnv)) process.env[key] = value;
    clearHanjutvIdentityStateCache("mobile");
    return fn();
  } finally {
    clearHanjutvIdentityStateCache("mobile");
    for (const key of MOBILE_SEED_ENV_KEYS) {
      const value = backup.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Hanjutv mobile refresh keeps device identifiers stable while rotating install identity", async () => {
  await withEnv({
    VERCEL_PROJECT_ID: "proj_hanjutv_identity_test",
    VERCEL_ORG_ID: "org_hanjutv_identity_test",
  }, async () => {
    const initial = loadHanjutvSearchContext(HANJUTV_APP_PROFILE, { timestamp: 1700000000000 });
    const refreshed = loadHanjutvSearchContext(HANJUTV_APP_PROFILE, {
      refresh: true,
      forceRandom: true,
      timestamp: 1700000004321,
    });

    assert.notEqual(refreshed.uid, initial.uid);
    assert.notEqual(refreshed.installTs, initial.installTs);
    assert.equal(refreshed.installTs, 1700000004321);
    assert.equal(refreshed.createdAt, 1700000004321);
    assert.equal(refreshed.said, initial.said);
    assert.equal(refreshed.oa, initial.oa);
  });
});

test("Hanjutv mobile env uid override keeps seeded device identifiers stable", async () => {
  await withEnv({
    VERCEL_PROJECT_ID: "proj_hanjutv_identity_test",
    VERCEL_ORG_ID: "org_hanjutv_identity_test",
    HANJUTV_UID: "AbCdEf0123456789ZyXw",
  }, async () => {
    const contextA = loadHanjutvSearchContext(HANJUTV_APP_PROFILE, { timestamp: 1700000010000 });
    const contextB = loadHanjutvSearchContext(HANJUTV_APP_PROFILE, { refresh: true, timestamp: 1700000019999 });

    assert.equal(contextA.uid, "AbCdEf0123456789ZyXw");
    assert.equal(contextB.uid, "AbCdEf0123456789ZyXw");
    assert.equal(contextB.said, contextA.said);
    assert.equal(contextB.oa, contextA.oa);
  });
});
