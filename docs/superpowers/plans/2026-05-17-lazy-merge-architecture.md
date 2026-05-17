# Lazy Merge Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public lazy `/api/v2/search/anime` fully compatible with configured `MERGE_SOURCE_PAIRS`: search should return real merged results, selected merged results should materialize reliably, and lazy/search caches must not return unmaterializable summaries.

**Architecture:** Implement a lazy-aware merge pipeline, not a fallback-to-eager stopgap. The key invariant is: any merged result shown in search must be produced from full episode links, never from summary-only guessing. Keep source adapters and `materializeLazyDetailDescriptor()` as full-anime resolvers, add a request-local lazy merge bridge in `searchAnime()`, then persist merged detail descriptors/cache metadata so cache hits and selected `/bangumi/:id` stay reliable.

**Tech Stack:** Node.js ESM, `node:test`, current `danmu_api` source adapters, `Globals` runtime caches, `utils/merge-util.js` merge engine.

---

## Files and responsibilities

- Modify: `danmu_api/apis/dandan-api.js`
  - Add lazy merge bridge helpers.
  - Add source-aware descriptor lookup helpers for merge candidates.
  - Register merged lazy detail descriptors.
  - Rehydrate merged descriptors from search cache.
  - Call merge bridge when `lazySearch === true && globals.mergeSourcePairs.length > 0`.

- Modify: `danmu_api/utils/merge-util.js`
  - Keep existing merge behavior intact.
  - Add optional metadata return/collector so callers can identify which merged animes were produced.
  - Do not make `merge-util` import API/source modules.

- Modify: `danmu_api/utils/cache-util.js`
  - If needed, add a minimal cache-entry metadata/version helper or expose a safe search-cache entry updater. Keep existing `getSearchCache()` / `setSearchCache()` public behavior compatible.

- Create: `danmu_api/lazy-merge-materialize.test.js`
  - Dedicated integration tests for `lazySearch + MERGE_SOURCE_PAIRS`.

- Modify: `danmu_api/lazy-search-materialize.test.js`
  - Keep existing tests as guardrails; add at most small helper exports/imports if needed.

---

## Non-negotiable invariants

- Do not simply remove `!lazySearch` from the existing merge condition. Lazy summaries do not contain `links`; `applyMergeLogic()` needs full episode links.
- Public search must still omit `links` from response objects.
- When merge is disabled, current lazy behavior must remain: no search-stage `handleAnimes()` fanout for official/Dandan sources and no runtime cache pollution.
- When merge is enabled, only merge-relevant candidates may be materialized; unrelated source summaries should remain lazy.
- A returned merged search result must be selectable via `/api/v2/bangumi/:id` after:
  - the same request lifecycle,
  - a search-cache hit with `Globals.lazyDetailDescriptors` cleared,
  - `Globals.animes` / `Globals.episodeIds` cleared while search cache remains.
- `SEARCH_CACHE_MINUTES <= 0` must not return descriptor-dependent lazy/merged summaries. Existing fallback-to-eager behavior stays valid.
- All descriptor identity lookups must be source-aware where possible: prefer `${source}:${bangumiId}` / `${source}:${animeId}` over bare ID.
- Cache entries for lazy merge must include a fingerprint of `MERGE_SOURCE_PAIRS` and `SOURCE_ORDER`; stale cache entries must not be reused across config changes.

---

## Task 1: Add red tests for public lazy search with merge enabled

**Files:**
- Create: `danmu_api/lazy-merge-materialize.test.js`

- [ ] **Step 1: Create test scaffolding**

Add a new test file with a reset helper that mirrors `lazy-search-materialize.test.js` but enables merge:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { Globals, globals } from './configs/globals.js';
import { handleRequest } from './worker.js';
import { MERGE_DELIMITER } from './utils/merge-util.js';

function resetRuntime(extraEnv = {}) {
  Globals.init({
    LOG_LEVEL: 'error',
    RATE_LIMIT_MAX_REQUESTS: '0',
    SEARCH_CACHE_MINUTES: '30',
    MAX_ANIMES: '1000',
    USE_BANGUMI_DATA: 'false',
    ...extraEnv,
  });
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.animeDetailsCache = new Map();
  Globals.episodeDetailsCache = new Map();
  Globals.lazyDetailDescriptors = new Map();
}

async function requestJson(path) {
  const response = await handleRequest(new Request(`https://example.test${path}`));
  return { response, body: await response.json() };
}
```

- [ ] **Step 2: Add a public-route red test for official source lazy merge**

Mock `tencent`, `iqiyi`, and `youku` source methods the same way existing lazy tests monkey-patch source classes. The test must assert the current bug first:

```js
test('public lazy search should return real merged summary when MERGE_SOURCE_PAIRS is enabled', async () => {
  resetRuntime({
    SOURCE_ORDER: 'tencent,iqiyi,youku',
    MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku',
  });

  // Patch source.search to return same-title raw candidates.
  // Patch source.handleAnimes to build two full links only when materialization is intentionally triggered.
  // The exact patching pattern should follow lazy-search-materialize.test.js official-source matrix tests.

  const { body } = await requestJson('/api/v2/search/anime?keyword=%E7%B4%A2%E5%BC%95%E5%AE%88%E6%8A%A4%E8%80%85');

  assert.equal(body.success, true);
  assert.ok(body.animes.some(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle)), 'public lazy search should expose merged summary');
  const merged = body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
  assert.ok(merged);
  assert.equal('links' in merged, false, 'search response must remain link-free');
});
```

Expected before implementation: FAIL because the public route returns single-source summaries.

- [ ] **Step 3: Add selected merged bangumi materialization red test**

Extend the same fixture:

```js
test('selected merged lazy search result should materialize merged episodes', async () => {
  resetRuntime({
    SOURCE_ORDER: 'tencent,iqiyi,youku',
    MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku',
  });

  // Install same source mocks as previous test.

  const search = await requestJson('/api/v2/search/anime?keyword=%E7%B4%A2%E5%BC%95%E5%AE%88%E6%8A%A4%E8%80%85');
  const merged = search.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
  assert.ok(merged);

  const bangumi = await requestJson(`/api/v2/bangumi/${encodeURIComponent(merged.bangumiId)}?source=${encodeURIComponent(merged.source)}`);
  assert.equal(bangumi.response.status, 200);
  assert.equal(bangumi.body.success, true);
  assert.equal(bangumi.body.bangumi.episodes.length, 2);

  const full = globals.animes.find(anime => String(anime.bangumiId) === String(merged.bangumiId));
  assert.ok(full, 'merged full anime should be in runtime/detail cache after selection');
  assert.ok(full.links[0].url.includes(MERGE_DELIMITER));
  assert.match(full.links[0].url, /tencent:/);
  assert.match(full.links[0].url, /iqiyi:/);
  assert.match(full.links[0].url, /youku:/);
});
```

Expected before implementation: FAIL because `merged` is absent.

- [ ] **Step 4: Run the new test and confirm it fails for the expected reason**

Run:

```bash
node --test danmu_api/lazy-merge-materialize.test.js
```

Expected: FAIL with assertion about missing merged summary, not syntax/import errors.

---

## Task 2: Add source-aware lazy merge candidate helpers

**Files:**
- Modify: `danmu_api/apis/dandan-api.js`

- [ ] **Step 1: Add merge source set helper near lazy descriptor helpers**

Add after `isPositiveSearchCacheWindow()`:

```js
function getConfiguredMergeSources() {
  const sources = new Set();
  for (const group of globals.mergeSourcePairs || []) {
    if (group?.primary) sources.add(group.primary);
    for (const secondary of group?.secondaries || []) {
      if (secondary) sources.add(secondary);
    }
  }
  return sources;
}

function shouldRunLazyMergeBridge(lazySearch) {
  return lazySearch === true
    && Array.isArray(globals.mergeSourcePairs)
    && globals.mergeSourcePairs.length > 0
    && isPositiveSearchCacheWindow();
}
```

- [ ] **Step 2: Add descriptor lookup by returned summary**

Add:

```js
function findLazyDescriptorForSummary(summary) {
  if (!summary?.source) return null;
  return findLazyDetailDescriptor(summary.bangumiId, summary.source)
    || findLazyDetailDescriptor(summary.animeId, summary.source);
}
```

- [ ] **Step 3: Add materialization for merge-relevant summaries**

Add:

```js
async function materializeLazyMergeCandidates(curAnimes, detailStore) {
  const mergeSources = getConfiguredMergeSources();
  if (mergeSources.size === 0) return [];

  const materialized = [];
  const seen = new Set();

  for (const summary of curAnimes) {
    if (!summary || !mergeSources.has(summary.source)) continue;
    const descriptor = findLazyDescriptorForSummary(summary);
    if (!descriptor) continue;

    const identity = `${summary.source}:${summary.bangumiId || summary.animeId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    try {
      const fullAnime = await materializeLazyDetailDescriptor(summary.bangumiId || summary.animeId, detailStore, summary.source);
      if (fullAnime && Array.isArray(fullAnime.links) && fullAnime.links.length > 0) {
        materialized.push({ summary, descriptor: cloneLazyDescriptor(descriptor), fullAnime });
      }
    } catch (error) {
      log('warn', `[LazyMerge] 物化 ${identity} 失败，跳过该候选: ${error?.message || error}`);
    }
  }

  return materialized;
}
```

Rationale: this is not eager fallback. It materializes only candidates from configured merge source groups and keeps unrelated sources lazy.

- [ ] **Step 4: Do not call this helper when merge is disabled**

This is a behavior invariant, checked by existing lazy tests. No code needed beyond using `shouldRunLazyMergeBridge()` later.

---

## Task 3: Make merge-util expose produced merged animes without changing semantics

**Files:**
- Modify: `danmu_api/utils/merge-util.js`

- [ ] **Step 1: Extend `applyMergeLogic` signature with optional metadata collector**

Change:

```js
export async function applyMergeLogic(curAnimes, detailStore = null) {
```

to:

```js
export async function applyMergeLogic(curAnimes, detailStore = null, options = {}) {
  const onMergedAnime = typeof options?.onMergedAnime === 'function' ? options.onMergedAnime : null;
```

Place `onMergedAnime` after the early `curAnimes`/groups checks so old callers stay compatible.

- [ ] **Step 2: Call collector only after merged anime is accepted**

In the existing block:

```js
if (newMergedAnimes.length > 0) {
   for (const anime of newMergedAnimes) addAnime(anime, detailStore);
   curAnimes.unshift(...newMergedAnimes);
}
```

Change to:

```js
if (newMergedAnimes.length > 0) {
   for (const anime of newMergedAnimes) {
     addAnime(anime, detailStore);
     if (onMergedAnime) onMergedAnime(anime);
   }
   curAnimes.unshift(...newMergedAnimes);
}
```

Do not alter matching, sorting, URL generation, consumed ID behavior, or existing golden output.

- [ ] **Step 3: Run existing merge tests**

Run:

```bash
node --test danmu_api/merge-index.test.js danmu_api/worker.test.js
```

Expected: existing merge tests pass.

---

## Task 4: Register merged lazy detail descriptors

**Files:**
- Modify: `danmu_api/apis/dandan-api.js`

- [ ] **Step 1: Add a merged descriptor kind**

Add near descriptor helpers:

```js
function registerLazyMergedDescriptor(mergedAnime, componentDescriptors = []) {
  if (!mergedAnime || !Array.isArray(mergedAnime.links) || mergedAnime.links.length === 0) return null;

  const descriptor = {
    kind: 'lazy-merge-detail',
    source: mergedAnime.source,
    rawCandidate: {
      animeId: mergedAnime.animeId,
      bangumiId: mergedAnime.bangumiId,
      animeTitle: mergedAnime.animeTitle,
    },
    fullAnime: clonePlainAnime(mergedAnime),
    componentDescriptors: componentDescriptors.map(cloneLazyDescriptor).filter(Boolean),
    mergeSourcePairsFingerprint: buildMergeSourcePairsFingerprint(),
    sourceOrderFingerprint: buildSourceOrderFingerprint(),
    createdAt: Date.now(),
  };

  return registerLazyDescriptor(descriptor, mergedAnime);
}
```

- [ ] **Step 2: Add plain anime clone helper**

Add:

```js
function clonePlainAnime(anime) {
  if (!anime || typeof anime !== 'object') return null;
  return {
    ...anime,
    aliases: Array.isArray(anime.aliases) ? [...anime.aliases] : [],
    links: Array.isArray(anime.links) ? anime.links.map(link => ({ ...link })) : [],
  };
}
```

- [ ] **Step 3: Add config fingerprints**

Add:

```js
function buildMergeSourcePairsFingerprint() {
  return JSON.stringify(globals.mergeSourcePairs || []);
}

function buildSourceOrderFingerprint() {
  return JSON.stringify(globals.sourceOrderArr || []);
}

function isDescriptorConfigCompatible(descriptor) {
  if (!descriptor) return false;
  if (descriptor.kind !== 'lazy-merge-detail') return true;
  return descriptor.mergeSourcePairsFingerprint === buildMergeSourcePairsFingerprint()
    && descriptor.sourceOrderFingerprint === buildSourceOrderFingerprint();
}
```

- [ ] **Step 4: Update descriptor expiry/rehydrate checks to reject stale merge config**

Where descriptors are rehydrated or found, skip merged descriptors when `isDescriptorConfigCompatible(descriptor)` is false. The minimum safe points are:

- `rehydrateLazyDescriptorsFromSearchCache(cacheKey)` before `registerLazyDescriptor(...)`.
- `materializeLazyDetailDescriptor(...)` immediately after descriptor lookup.

Expected behavior: changing `MERGE_SOURCE_PAIRS` or `SOURCE_ORDER` makes old merged descriptors unusable rather than returning stale merged results.

---

## Task 5: Materialize merged descriptors in `/bangumi/:id`

**Files:**
- Modify: `danmu_api/apis/dandan-api.js`

- [ ] **Step 1: Teach full-anime builder about merged descriptors**

At the start of `buildFullAnimeFromLazyDescriptor(descriptor, detailStore)` add:

```js
if (descriptor?.kind === 'lazy-merge-detail') {
  if (!isDescriptorConfigCompatible(descriptor)) return null;
  const fullAnime = clonePlainAnime(descriptor.fullAnime);
  if (!fullAnime || !Array.isArray(fullAnime.links) || fullAnime.links.length === 0) return null;
  return fullAnime;
}
```

This makes selected merged results materialize without refetching every component when a valid merged descriptor already exists.

- [ ] **Step 2: Preserve existing single-source materialization paths**

Do not change existing branches for:

- `descriptor.source === 'vod'`
- `descriptor.source === 'dandan'`
- generic source `handleAnimes([rawCandidate], ...)`

Existing lazy tests must remain green.

---

## Task 6: Run lazy merge bridge inside searchAnime

**Files:**
- Modify: `danmu_api/apis/dandan-api.js`

- [ ] **Step 1: Replace merge condition with explicit lazy/eager branches**

Replace:

```js
if (!lazySearch && globals.mergeSourcePairs.length > 0) {
  await applyMergeLogic(curAnimes, requestAnimeDetailsMap);
}
```

with:

```js
if (shouldRunLazyMergeBridge(lazySearch)) {
  const materializedCandidates = await materializeLazyMergeCandidates(curAnimes, requestAnimeDetailsMap);
  const componentDescriptors = materializedCandidates.map(item => item.descriptor).filter(Boolean);
  await applyMergeLogic(curAnimes, requestAnimeDetailsMap, {
    onMergedAnime: (mergedAnime) => registerLazyMergedDescriptor(mergedAnime, componentDescriptors),
  });
} else if (!lazySearch && globals.mergeSourcePairs.length > 0) {
  await applyMergeLogic(curAnimes, requestAnimeDetailsMap);
}
```

- [ ] **Step 2: Verify response still strips links**

Do not change existing response generation:

```js
const responseAnimes = curAnimes.map(({ links, ...pureAnime }) => pureAnime);
```

This ensures public search output remains compatible.

- [ ] **Step 3: Verify lazy cache stores descriptors after merge**

Existing flow calls `setSearchCache(searchCacheKey, responseAnimes, requestAnimeDetailsMap)` and then `attachLazyDescriptorsToSearchCache(searchCacheKey, responseAnimes)`. Ensure `registerLazyMergedDescriptor()` happens before `attachLazyDescriptorsToSearchCache()` so merged descriptors are collected into the search cache entry.

---

## Task 7: Harden cache hit and descriptor rehydrate

**Files:**
- Modify: `danmu_api/apis/dandan-api.js`
- Modify if necessary: `danmu_api/utils/cache-util.js`

- [ ] **Step 1: Rehydrate merged descriptors from search cache**

Update `rehydrateLazyDescriptorsFromSearchCache(cacheKey)`:

```js
if (cloned?.kind === 'lazy-merge-detail') {
  if (!isDescriptorConfigCompatible(cloned)) continue;
  registerLazyDescriptor(cloned, clonePlainAnime(cloned.fullAnime));
  continue;
}
```

Keep existing `vod`, `dandan`, and generic summary reconstruction branches unchanged.

- [ ] **Step 2: On cache hit, ensure returned lazy merged results are materializable**

After `rehydrateLazyDescriptorsFromSearchCache(cacheKeyUsed)` in the `cachedResults !== null` branch, add a validation helper:

```js
function areLazyResultsMaterializable(results) {
  if (!Array.isArray(results)) return true;
  return results.every(result => {
    if (!result?.source) return true;
    return Boolean(findLazyDescriptorForSummary(result)
      || resolveAnimeById(result.bangumiId, null, result.source)
      || resolveAnimeById(result.animeId, null, result.source));
  });
}
```

If validation fails for lazy results, ignore the cache hit and continue to fresh search. Do not return an unmaterializable cached response.

- [ ] **Step 3: Avoid stale merge config cache hits**

Because `buildSearchCacheKey()` currently does not include merge/source-order fingerprints, use descriptor compatibility validation to reject stale merged descriptors. If the cached result includes merged titles but no compatible merged descriptor/full detail exists, treat as cache miss.

---

## Task 8: Add cache-hit and expiry tests

**Files:**
- Modify: `danmu_api/lazy-merge-materialize.test.js`

- [ ] **Step 1: Add cache-hit rehydrate test**

Add:

```js
test('merged lazy search cache hit should rehydrate descriptor and keep bangumi materializable', async () => {
  resetRuntime({
    SOURCE_ORDER: 'tencent,iqiyi,youku',
    MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku',
  });

  // Install source mocks and counters.

  const first = await requestJson('/api/v2/search/anime?keyword=%E7%B4%A2%E5%BC%95%E5%AE%88%E6%8A%A4%E8%80%85');
  const firstMerged = first.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
  assert.ok(firstMerged);

  Globals.lazyDetailDescriptors = new Map();
  Globals.animes = [];
  Globals.episodeIds = [];

  const second = await requestJson('/api/v2/search/anime?keyword=%E7%B4%A2%E5%BC%95%E5%AE%88%E6%8A%A4%E8%80%85');
  const secondMerged = second.body.animes.find(anime => String(anime.bangumiId) === String(firstMerged.bangumiId));
  assert.ok(secondMerged);

  const bangumi = await requestJson(`/api/v2/bangumi/${encodeURIComponent(secondMerged.bangumiId)}?source=${encodeURIComponent(secondMerged.source)}`);
  assert.equal(bangumi.response.status, 200);
  assert.equal(bangumi.body.success, true);
});
```

- [ ] **Step 2: Add expired merged descriptor test**

Add:

```js
test('expired merged lazy descriptor should not materialize until search rebuilds it', async () => {
  resetRuntime({
    SOURCE_ORDER: 'tencent,iqiyi,youku',
    MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku',
  });

  // Install source mocks.

  const search = await requestJson('/api/v2/search/anime?keyword=%E7%B4%A2%E5%BC%95%E5%AE%88%E6%8A%A4%E8%80%85');
  const merged = search.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
  assert.ok(merged);

  const descriptor = findLazyDetailDescriptorForTestOnlyOrLocateThroughGlobals(merged);
  descriptor.createdAt = Date.now() - (Globals.searchCacheMinutes + 1) * 60 * 1000;

  const expired = await requestJson(`/api/v2/bangumi/${encodeURIComponent(merged.bangumiId)}?source=${encodeURIComponent(merged.source)}`);
  assert.equal(expired.response.status, 404);

  const rebuilt = await requestJson('/api/v2/search/anime?keyword=%E7%B4%A2%E5%BC%95%E5%AE%88%E6%8A%A4%E8%80%85');
  const rebuiltMerged = rebuilt.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
  assert.ok(rebuiltMerged);
});
```

Implementation note: do not export production internals just for tests unless necessary. Prefer locating descriptors through `Globals.lazyDetailDescriptors` by matching `source` and `bangumiId`.

---

## Task 9: Add VOD and Dandan coverage

**Files:**
- Modify: `danmu_api/lazy-merge-materialize.test.js`

- [ ] **Step 1: Add VOD + official merge test**

Use VOD raw candidates with `vod_play_from` / `vod_play_url` and one official source candidate. Assert:

- public search returns merged summary,
- selected result materializes,
- merged link URL includes both `vod:` and official source prefix,
- duplicate VOD `vod_id` scoped IDs still work if two servers appear.

- [ ] **Step 2: Add Dandan + official merge test**

Use Dandan candidate where `getEpisodes(id)` returns two episodes only during merge bridge materialization. Assert:

- merge disabled: Dandan lazy search does not call detail API at search stage, preserving old behavior;
- merge enabled: Dandan detail API is called only for merge-relevant candidates;
- selected merged bangumi contains `dandan:` and official source prefixes.

---

## Task 10: Verification commands

**Files:** none

- [ ] **Step 1: Syntax checks**

Run:

```bash
node --check danmu_api/apis/dandan-api.js
node --check danmu_api/utils/merge-util.js
```

Expected: no syntax errors.

- [ ] **Step 2: Focused regression tests**

Run:

```bash
node --test danmu_api/lazy-merge-materialize.test.js
node --test danmu_api/lazy-search-materialize.test.js danmu_api/merge-index.test.js danmu_api/cache-index.test.js danmu_api/source-options.test.js
```

Expected: all pass.

- [ ] **Step 3: Main integration tests**

Run:

```bash
node --test danmu_api/worker.test.js
```

Expected: all pass.

- [ ] **Step 4: Full suite**

Run:

```bash
npm test
```

Expected: all pass.

---

## Self-review checklist

- The plan does not propose fallback-to-eager as the fix.
- The plan does not propose summary-only fake merges.
- Search-visible merged results are generated by existing full `applyMergeLogic()` after selective materialization.
- Merge-util remains source-agnostic and does not import API/source modules.
- Merged descriptors exist and are rehydrated from search cache.
- Cache/config fingerprints prevent stale merged results after source/merge config changes.
- Existing no-merge lazy behavior is protected.
- Tests cover public route, selected `/bangumi`, cache hit, descriptor expiry, official/VOD/Dandan classes.
