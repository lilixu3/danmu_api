import test from 'node:test';
import assert from 'node:assert/strict';
import { Globals } from './configs/globals.js';
import { searchAnime, getBangumi } from './apis/dandan-api.js';
import { handleClearCache } from './apis/system-api.js';
import { handleRequest } from './worker.js';

function resetRuntime() {
  Globals.init({
    LOG_LEVEL: 'error',
    SOURCE_ORDER: 'vod',
    VOD_SERVERS: 'MockVod@https://mock-vod.example',
    VOD_RETURN_MODE: 'all',
    VOD_REQUEST_TIMEOUT: '1000',
    MERGE_SOURCE_PAIRS: '',
    MAX_ANIMES: '1000',
    SEARCH_CACHE_MINUTES: '30',
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

function mockVodFetch(rawCandidates) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ list: rawCandidates }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

test('lazy manual VOD search should keep API schema and materialize details on bangumi lookup', async () => {
  resetRuntime();
  const vodMock = mockVodFetch([
    {
      vod_id: 940001,
      vod_name: '懒加载测试番剧',
      vod_year: '2026',
      type_name: 'TV动画',
      vod_pic: 'https://img.example/lazy.jpg',
      vod_play_from: 'qq',
      vod_play_url: '第1集$https://vod.example/lazy/ep1#第2集$https://vod.example/lazy/ep2',
    },
  ]);

  try {
    const response = await searchAnime(
      new URL('https://example.test/api/v2/search/anime?keyword=%E6%87%92%E5%8A%A0%E8%BD%BD%E6%B5%8B%E8%AF%95%E7%95%AA%E5%89%A7'),
      null,
      null,
      new Map(),
      { lazySearch: true }
    );
    const body = await response.json();

    assert.deepEqual(Object.keys(body).sort(), ['animes', 'errorCode', 'errorMessage', 'success'].sort());
    assert.equal(body.success, true);
    assert.equal(body.animes.length, 1);
    assert.equal(body.animes[0].source, 'vod');
    assert.equal(body.animes[0].bangumiId, '940001');
    assert.equal(body.animes[0].episodeCount, 2);
    assert.equal('links' in body.animes[0], false);
    assert.equal(Globals.animes.length, 0, 'lazy search must not add full anime into global runtime cache');
    assert.equal(Globals.episodeIds.length, 0, 'lazy search must not allocate comment ids before materialization');
    assert.equal(Globals.searchCache.has('lazy:懒加载测试番剧'), true, 'lazy search should use a lazy-specific search cache key');
    assert.equal(Globals.searchCache.has('懒加载测试番剧'), false, 'lazy search must not pollute the eager search cache key');

    const bangumiResponse = await getBangumi('/api/v2/bangumi/940001', null, 'vod');
    const bangumiBody = await bangumiResponse.json();

    assert.equal(bangumiBody.success, true);
    assert.equal(bangumiBody.bangumi.bangumiId, '940001');
    assert.equal(bangumiBody.bangumi.episodes.length, 2);
    assert.equal(bangumiBody.bangumi.episodes[0].episodeTitle, '【qq】 第1集');
    assert.equal(Globals.animes.length, 1, 'bangumi lookup should materialize the full anime once');
    assert.equal(Globals.episodeIds.length, 2, 'materialization should allocate real comment ids for episodes');
  } finally {
    vodMock.restore();
  }
});

async function prepareLazyVodDescriptor(vodId = 940002) {
  const vodMock = mockVodFetch([
    {
      vod_id: vodId,
      vod_name: '懒加载清理番剧',
      vod_year: '2026',
      type_name: 'TV动画',
      vod_pic: '',
      vod_play_from: 'qq',
      vod_play_url: '第1集$https://vod.example/cleanup/ep1',
    },
  ]);

  try {
    await searchAnime(
      new URL('https://example.test/api/v2/search/anime?keyword=%E6%87%92%E5%8A%A0%E8%BD%BD%E6%B8%85%E7%90%86%E7%95%AA%E5%89%A7'),
      null,
      null,
      new Map(),
      { lazySearch: true }
    );
  } finally {
    vodMock.restore();
  }
}

test('plain /api/v2/search/anime route should use lazy VOD summaries without adding query parameters', async () => {
  resetRuntime();
  const vodMock = mockVodFetch([
    {
      vod_id: 940010,
      vod_name: '普通接口懒搜索番剧',
      vod_year: '2026',
      type_name: 'TV动画',
      vod_pic: '',
      vod_play_from: 'qq',
      vod_play_url: '第1集$https://vod.example/plain/ep1#第2集$https://vod.example/plain/ep2',
    },
  ]);

  try {
    const response = await handleRequest(
      new Request('https://example.test/api/v2/search/anime?keyword=%E6%99%AE%E9%80%9A%E6%8E%A5%E5%8F%A3%E6%87%92%E6%90%9C%E7%B4%A2%E7%95%AA%E5%89%A7'),
      {
        LOG_LEVEL: 'error',
        SOURCE_ORDER: 'vod',
        VOD_SERVERS: 'MockVod@https://mock-vod.example',
        VOD_RETURN_MODE: 'all',
        VOD_REQUEST_TIMEOUT: '1000',
        MERGE_SOURCE_PAIRS: '',
        MAX_ANIMES: '1000',
        SEARCH_CACHE_MINUTES: '30',
        RATE_LIMIT_MAX_REQUESTS: '0',
        USE_BANGUMI_DATA: 'false',
      },
      'test',
      '127.0.0.1'
    );
    const body = await response.json();

    assert.equal(body.success, true);
    assert.equal(body.animes.length, 1);
    assert.equal(body.animes[0].bangumiId, '940010');
    assert.equal(body.animes[0].episodeCount, 2);
    assert.equal('links' in body.animes[0], false);
    assert.equal(Globals.animes.length, 0, 'plain public search route must not eagerly add full VOD anime');
    assert.equal(Globals.episodeIds.length, 0, 'plain public search route must not allocate comment ids during search');
    assert.equal(Globals.searchCache.has('lazy:普通接口懒搜索番剧'), true, 'plain public search route should populate the lazy search cache');
    assert.equal(Globals.searchCache.has('普通接口懒搜索番剧'), false, 'plain public search route should not populate the eager search cache');

    const bangumiResponse = await handleRequest(
      new Request('https://example.test/api/v2/bangumi/940010'),
      {
        LOG_LEVEL: 'error',
        SOURCE_ORDER: 'vod',
        VOD_SERVERS: 'MockVod@https://mock-vod.example',
        VOD_RETURN_MODE: 'all',
        VOD_REQUEST_TIMEOUT: '1000',
        MERGE_SOURCE_PAIRS: '',
        MAX_ANIMES: '1000',
        SEARCH_CACHE_MINUTES: '30',
        RATE_LIMIT_MAX_REQUESTS: '0',
        USE_BANGUMI_DATA: 'false',
      },
      'test',
      '127.0.0.1'
    );
    const bangumiBody = await bangumiResponse.json();
    assert.equal(bangumiBody.success, true);
    assert.equal(bangumiBody.bangumi.episodes.length, 2);
    assert.equal(bangumiBody.bangumi.episodes[0].episodeTitle, '【qq】 第1集');
    assert.equal(Globals.episodeIds.length, 2, 'bangumi lookup through the existing endpoint should materialize comment ids');
  } finally {
    vodMock.restore();
  }
});

test('lazy VOD descriptor should expire with search cache window before materialization', async () => {
  resetRuntime();
  await prepareLazyVodDescriptor(940002);
  const descriptor = Globals.lazyDetailDescriptors.get('vod:940002');
  assert.ok(descriptor, 'lazy descriptor should be registered before expiry check');
  descriptor.createdAt = Date.now() - (Globals.searchCacheMinutes + 1) * 60 * 1000;

  const bangumiResponse = await getBangumi('/api/v2/bangumi/940002', null, 'vod');
  const bangumiBody = await bangumiResponse.json();

  assert.equal(bangumiResponse.status, 404);
  assert.equal(bangumiBody.success, false);
  assert.equal(Globals.lazyDetailDescriptors.has('vod:940002'), false);
});

test('clear cache should drop lazy VOD descriptors as well as normal runtime caches', async () => {
  resetRuntime();
  await prepareLazyVodDescriptor(940003);
  assert.ok(Globals.lazyDetailDescriptors.has('vod:940003'));

  const clearResponse = await handleClearCache();
  const clearBody = await clearResponse.json();
  assert.equal(clearBody.success, true);
  assert.equal(Globals.lazyDetailDescriptors.size, 0);

  const bangumiResponse = await getBangumi('/api/v2/bangumi/940003', null, 'vod');
  assert.equal(bangumiResponse.status, 404);
});
