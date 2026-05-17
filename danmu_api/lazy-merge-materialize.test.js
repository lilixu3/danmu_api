import test from 'node:test';
import assert from 'node:assert/strict';

import { Globals } from './configs/globals.js';
import { handleRequest } from './worker.js';
import { MERGE_DELIMITER } from './utils/merge-util.js';
import { addAnime, findUrlById } from './utils/cache-util.js';
import { convertToAsciiSum } from './utils/codec-util.js';
import TencentSource from './sources/tencent.js';
import IqiyiSource from './sources/iqiyi.js';
import YoukuSource from './sources/youku.js';

const OFFICIAL_SOURCE_MATRIX = [
  ['tencent', TencentSource],
  ['iqiyi', IqiyiSource],
  ['youku', YoukuSource],
];

function mergeEnv(extraEnv = {}) {
  return {
    LOG_LEVEL: 'error',
    SOURCE_ORDER: 'tencent,iqiyi,youku',
    MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku',
    MAX_ANIMES: '1000',
    SEARCH_CACHE_MINUTES: '30',
    RATE_LIMIT_MAX_REQUESTS: '0',
    USE_BANGUMI_DATA: 'false',
    ...extraEnv,
  };
}

function resetRuntime(extraEnv = {}) {
  Globals.init(mergeEnv(extraEnv));
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.animeDetailsCache = new Map();
  Globals.episodeDetailsCache = new Map();
  Globals.lazyDetailDescriptors = new Map();
}

function installOfficialSourceStubs() {
  const handleCalls = new Map(OFFICIAL_SOURCE_MATRIX.map(([source]) => [source, 0]));
  const originals = [];

  for (const [source, SourceClass] of OFFICIAL_SOURCE_MATRIX) {
    const originalSearch = SourceClass.prototype.search;
    const originalHandleAnimes = SourceClass.prototype.handleAnimes;
    originals.push(() => {
      SourceClass.prototype.search = originalSearch;
      SourceClass.prototype.handleAnimes = originalHandleAnimes;
    });

    SourceClass.prototype.search = async () => [{
      provider: source,
      mediaId: `${source}-merge-1`,
      title: '合并守护者',
      type: '动漫',
      year: 2026,
      imageUrl: `https://img.example/${source}.jpg`,
      episodeCount: 2,
      aliases: ['合并守护者'],
    }];

    SourceClass.prototype.handleAnimes = async function handleAnimes(sourceAnimes, queryTitle, curAnimes, options = {}) {
      handleCalls.set(source, handleCalls.get(source) + 1);
      const detailStore = options?.detailStore instanceof Map ? options.detailStore : null;
      for (const anime of sourceAnimes || []) {
        const mediaId = anime.mediaId || `${source}-merge-1`;
        const numericAnimeId = convertToAsciiSum(mediaId);
        const summary = {
          animeId: numericAnimeId,
          bangumiId: mediaId,
          animeTitle: `${anime.title}(${anime.year})【${anime.type}】from ${source}`,
          type: anime.type,
          typeDescription: anime.type,
          imageUrl: anime.imageUrl,
          startDate: `${anime.year}-01-01T00:00:00`,
          episodeCount: 2,
          rating: 0,
          isFavorited: true,
          source,
          aliases: anime.aliases || [],
        };
        curAnimes.push(summary);
        addAnime({
          ...summary,
          links: [
            {
              name: '1',
              url: `https://video.example/${source}/${mediaId}/1`,
              title: `【${source}】 第1集`,
            },
            {
              name: '2',
              url: `https://video.example/${source}/${mediaId}/2`,
              title: `【${source}】 第2集`,
            },
          ],
        }, detailStore);
      }
      return curAnimes;
    };
  }

  return {
    handleCalls,
    totalHandleCalls() {
      return Array.from(handleCalls.values()).reduce((sum, value) => sum + value, 0);
    },
    restore() {
      originals.reverse().forEach(fn => fn());
    },
  };
}

async function requestJson(path, env = mergeEnv(), init = {}) {
  const headers = { ...(init.headers || {}) };
  let body = init.body;
  if (body && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['content-type'] = headers['content-type'] || 'application/json';
  }
  const response = await handleRequest(
    new Request(`https://example.test${path}`, { ...init, headers, body }),
    env,
    'test',
    '127.0.0.1'
  );
  return { response, body: await response.json() };
}

test('public lazy search should return a real merged summary when merge pairs are enabled', async () => {
  resetRuntime();
  const stubs = installOfficialSourceStubs();

  try {
    const { body } = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85');

    assert.equal(body.success, true);
    assert.ok(body.animes.some(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle)), 'expected merged summary in public lazy search');
    const merged = body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
    assert.ok(merged);
    assert.equal('links' in merged, false);
    assert.ok(stubs.totalHandleCalls() >= 0);
  } finally {
    stubs.restore();
  }
});

test('selected merged lazy search result should materialize merged episodes', async () => {
  resetRuntime();
  const stubs = installOfficialSourceStubs();

  try {
    const search = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85');
    const merged = search.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
    assert.ok(merged);

    const bangumi = await requestJson(`/api/v2/bangumi/${encodeURIComponent(merged.bangumiId)}?source=${encodeURIComponent(merged.source)}`);
    assert.equal(bangumi.response.status, 200);
    assert.equal(bangumi.body.success, true);
    assert.ok(Array.isArray(bangumi.body.bangumi.episodes));
    assert.equal(bangumi.body.bangumi.episodes.length, 2);

    const full = Globals.animes.find(anime => String(anime.bangumiId) === String(merged.bangumiId));
    assert.ok(full);
    assert.ok(full.links[0].url.includes(MERGE_DELIMITER));
    assert.match(full.links[0].url, /tencent:/);
    assert.match(full.links[0].url, /iqiyi:/);
    assert.match(full.links[0].url, /youku:/);
  } finally {
    stubs.restore();
  }
});

test('merged lazy search cache hit should rehydrate descriptor and keep bangumi materializable', async () => {
  resetRuntime();
  const stubs = installOfficialSourceStubs();

  try {
    const first = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85');
    const firstMerged = first.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
    assert.ok(firstMerged);
    assert.ok(Globals.lazyDetailDescriptors.size > 0, 'first search should register lazy descriptors');

    Globals.lazyDetailDescriptors = new Map();
    Globals.animes = [];
    Globals.episodeIds = [];

    const second = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85');
    const secondMerged = second.body.animes.find(anime => String(anime.bangumiId) === String(firstMerged.bangumiId));
    assert.ok(secondMerged, 'cache hit should return the same merged summary');
    assert.ok(Globals.lazyDetailDescriptors.size > 0, 'cache hit should rehydrate lazy descriptors');

    const bangumi = await requestJson(`/api/v2/bangumi/${encodeURIComponent(secondMerged.bangumiId)}?source=${encodeURIComponent(secondMerged.source)}`);
    assert.equal(bangumi.response.status, 200);
    assert.equal(bangumi.body.success, true);
    assert.equal(bangumi.body.bangumi.episodes.length, 2);
  } finally {
    stubs.restore();
  }
});

test('expired merged lazy descriptor should not materialize until search rebuilds it', async () => {
  resetRuntime();
  const stubs = installOfficialSourceStubs();

  try {
    const search = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85');
    const merged = search.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
    assert.ok(merged);

    const descriptor = Array.from(Globals.lazyDetailDescriptors.values()).find(item => item?.kind === 'lazy-merge-detail');
    assert.ok(descriptor, 'merged descriptor should be registered');
    descriptor.createdAt = Date.now() - (Globals.searchCacheMinutes + 1) * 60 * 1000;
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.searchCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();

    const expired = await requestJson(`/api/v2/bangumi/${encodeURIComponent(merged.bangumiId)}?source=${encodeURIComponent(merged.source)}`);
    assert.equal(expired.response.status, 404);
    assert.equal(expired.body.success, false);
    assert.equal(Globals.lazyDetailDescriptors.has(`tencent:${merged.bangumiId}`) || Globals.lazyDetailDescriptors.has(`${merged.source}:${merged.bangumiId}`), false);

    const rebuilt = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85');
    const rebuiltMerged = rebuilt.body.animes.find(anime => /from tencent&iqiyi&youku$/.test(anime.animeTitle));
    assert.ok(rebuiltMerged, 'search should rebuild the expired merged result');
  } finally {
    stubs.restore();
  }
});

async function assertSearchAndBangumiForMergeConfig({ mergePairs, expectedMergedFrom, expectedSources }) {
  const env = mergeEnv({ MERGE_SOURCE_PAIRS: mergePairs });
  resetRuntime({ MERGE_SOURCE_PAIRS: mergePairs });
  const stubs = installOfficialSourceStubs();

  try {
    const search = await requestJson('/api/v2/search/anime?keyword=%E5%90%88%E5%B9%B6%E5%AE%88%E6%8A%A4%E8%80%85', env);
    assert.equal(search.response.status, 200);
    assert.equal(search.body.success, true);

    const merged = search.body.animes.find(anime => anime.animeTitle.endsWith(`from ${expectedMergedFrom}`));
    assert.ok(merged, `expected merged result from ${expectedMergedFrom}; got ${search.body.animes.map(anime => anime.animeTitle).join(' | ')}`);
    assert.equal('links' in merged, false, 'search result should stay link-free');

    const bangumi = await requestJson(
      `/api/v2/bangumi/${encodeURIComponent(merged.bangumiId)}?source=${encodeURIComponent(merged.source)}`,
      env
    );
    assert.equal(bangumi.response.status, 200);
    assert.equal(bangumi.body.success, true);
    assert.equal(bangumi.body.bangumi.episodes.length, 2);

    const full = Globals.animes.find(anime => String(anime.bangumiId) === String(merged.bangumiId));
    assert.ok(full, 'selected merged result should materialize full anime');
    assert.ok(full.links[0].url.includes(MERGE_DELIMITER));
    for (const source of expectedSources) {
      assert.match(full.links[0].url, new RegExp(`${source}:`));
    }
  } finally {
    stubs.restore();
  }
}

test('public lazy search should stay stable across several merge pair configurations', async () => {
  const scenarios = [
    {
      mergePairs: 'tencent&iqiyi',
      expectedMergedFrom: 'tencent&iqiyi',
      expectedSources: ['tencent', 'iqiyi'],
    },
    {
      mergePairs: 'iqiyi&youku',
      expectedMergedFrom: 'iqiyi&youku',
      expectedSources: ['iqiyi', 'youku'],
    },
    {
      mergePairs: 'youku&tencent&iqiyi',
      expectedMergedFrom: 'youku&tencent&iqiyi',
      expectedSources: ['youku', 'tencent', 'iqiyi'],
    },
    {
      mergePairs: 'tencent&iqiyi&youku',
      expectedMergedFrom: 'tencent&iqiyi&youku',
      expectedSources: ['tencent', 'iqiyi', 'youku'],
    },
  ];

  for (const scenario of scenarios) {
    await assertSearchAndBangumiForMergeConfig(scenario);
  }
});

test('automatic match should use merged episode urls for multi-source merge configs', async () => {
  const env = mergeEnv({ MERGE_SOURCE_PAIRS: 'youku&tencent&iqiyi' });
  resetRuntime({ MERGE_SOURCE_PAIRS: 'youku&tencent&iqiyi' });
  const stubs = installOfficialSourceStubs();

  try {
    const match = await requestJson('/api/v2/match?debug=1', env, {
      method: 'POST',
      body: {
        fileName: '合并守护者 S01E2',
        matchMode: 'fileNameOnly',
      },
    });

    assert.equal(match.response.status, 200);
    assert.equal(match.body.success, true);
    assert.equal(match.body.isMatched, true);
    assert.equal(match.body.matches.length, 1);
    assert.match(match.body.matches[0].animeTitle, /from youku&tencent&iqiyi$/);
    assert.match(match.body.matches[0].episodeTitle, /第2集/);

    const matchedUrl = findUrlById(match.body.matches[0].episodeId);
    assert.ok(matchedUrl, 'matched episode should have a cached URL');
    assert.ok(matchedUrl.includes(MERGE_DELIMITER));
    assert.match(matchedUrl, /youku:/);
    assert.match(matchedUrl, /tencent:/);
    assert.match(matchedUrl, /iqiyi:/);
    assert.equal(match.body.debug.search.candidateCount, 1);
  } finally {
    stubs.restore();
  }
});
