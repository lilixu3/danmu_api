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

function mockDandanFetch() {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const textUrl = String(url);
    calls.push(textUrl);
    const parsed = new URL(textUrl);
    const path = parsed.searchParams.get('path') || '';

    if (path.startsWith('/v2/search/anime')) {
      return new Response(JSON.stringify({
        animes: [
          {
            animeId: 950001,
            bangumiId: '950001',
            animeTitle: '爱情懒搜索测试',
            type: 'tvseries',
            typeDescription: 'TV动画',
            imageUrl: 'https://img.example/dandan-1.jpg',
            startDate: '2026-01-01T00:00:00',
            episodeCount: 2,
            rating: 0,
          },
          {
            animeId: 950002,
            bangumiId: '950002',
            animeTitle: '爱情懒搜索测试 第二季',
            type: 'tvseries',
            typeDescription: 'TV动画',
            imageUrl: 'https://img.example/dandan-2.jpg',
            startDate: '2027-01-01T00:00:00',
            episodeCount: 1,
            rating: 0,
          },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const bangumiMatch = path.match(/^\/v2\/bangumi\/(\d+)/);
    if (bangumiMatch) {
      const id = bangumiMatch[1];
      return new Response(JSON.stringify({
        bangumi: {
          animeId: Number(id),
          animeTitle: id === '950001' ? '爱情懒搜索测试' : '爱情懒搜索测试 第二季',
          imageUrl: `https://img.example/dandan-${id}.jpg`,
          type: 'tvseries',
          typeDescription: 'TV动画',
          startDate: id === '950001' ? '2026-01-01T00:00:00' : '2027-01-01T00:00:00',
          rating: 0,
          titles: [
            { language: '主标题', title: id === '950001' ? '爱情懒搜索测试' : '爱情懒搜索测试 第二季' },
          ],
          relateds: [],
          episodes: id === '950001'
            ? [
                { episodeId: 951001, episodeTitle: '第1集', episodeNumber: 1, airDate: '2026-01-01T00:00:00' },
                { episodeId: 951002, episodeTitle: '第2集', episodeNumber: 2, airDate: '2026-01-08T00:00:00' },
              ]
            : [
                { episodeId: 952001, episodeTitle: '第1集', episodeNumber: 1, airDate: '2027-01-01T00:00:00' },
              ],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({}), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    calls,
    detailCalls() {
      return calls.filter(call => {
        const parsed = new URL(call);
        return (parsed.searchParams.get('path') || '').startsWith('/v2/bangumi/');
      });
    },
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function resetDandanRuntime() {
  resetRuntime();
  Globals.sourceOrderArr = ['dandan'];
  Globals.useBangumiData = false;
}

test('lazy public Dandan search should not fan out bangumi detail requests until selected', async () => {
  resetDandanRuntime();
  const dandanMock = mockDandanFetch();

  try {
    const response = await handleRequest(
      new Request('https://example.test/api/v2/search/anime?keyword=%E7%88%B1%E6%83%85'),
      {
        LOG_LEVEL: 'error',
        SOURCE_ORDER: 'dandan',
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
    assert.equal(body.animes.length, 2);
    const targetSummary = body.animes.find(anime => String(anime.bangumiId) === '950001');
    assert.ok(targetSummary, 'search results should include the target Dandan summary');
    assert.equal(targetSummary.source, 'dandan');
    assert.equal(targetSummary.episodeCount, 2);
    assert.equal('links' in targetSummary, false);
    assert.equal(Globals.animes.length, 0, 'lazy Dandan search must not add full anime into global runtime cache');
    assert.equal(Globals.episodeIds.length, 0, 'lazy Dandan search must not allocate comment ids during search');
    assert.equal(dandanMock.detailCalls().length, 0, 'lazy Dandan search must not call /v2/bangumi for every search result');

    const bangumiResponse = await handleRequest(
      new Request('https://example.test/api/v2/bangumi/950001'),
      {
        LOG_LEVEL: 'error',
        SOURCE_ORDER: 'dandan',
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
    assert.equal(bangumiBody.bangumi.bangumiId, '950001');
    assert.equal(bangumiBody.bangumi.episodes.length, 2);
    assert.equal(dandanMock.detailCalls().length, 1, 'only the selected Dandan bangumi should be materialized');
    assert.equal(Globals.episodeIds.length, 2, 'materialized Dandan bangumi should allocate real comment ids');
  } finally {
    dandanMock.restore();
  }
});
