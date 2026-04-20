// 加载 .env 文件
import dotenv from 'dotenv';
dotenv.config();

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleRequest } from './worker.js';
import { extractTitleSeasonEpisode, getBangumi, getComment, searchAnime } from "./apis/dandan-api.js";
import { getRedisKey, pingRedis, setRedisKey, setRedisKeyWithExpiry } from "./utils/redis-util.js";
import { getLocalRedisKey, setLocalRedisKey, setLocalRedisKeyWithExpiry } from "./utils/local-redis-util.js";
import { getImdbepisodes } from "./utils/imdb-util.js";
import { getTMDBChineseTitle, getTmdbJpDetail, searchTmdbTitles } from "./utils/tmdb-util.js";
import { getDoubanDetail, getDoubanInfoByImdbId, searchDoubanTitles } from "./utils/douban-util.js";
import AIClient from './utils/ai-util.js';
import { alignSourceTimelines, applyMergeLogic, findSecondaryMatches, MERGE_DELIMITER } from "./utils/merge-util.js";
import RenrenSource from "./sources/renren.js";
import HanjutvSource from "./sources/hanjutv.js";
import BahamutSource from "./sources/bahamut.js";
import TencentSource from "./sources/tencent.js";
import IqiyiSource from "./sources/iqiyi.js";
import MangoSource from "./sources/mango.js";
import BilibiliSource from "./sources/bilibili.js";
import YoukuSource from "./sources/youku.js";
import MiguSource from "./sources/migu.js";
import SohuSource from "./sources/sohu.js";
import LeshiSource from "./sources/leshi.js";
import XiguaSource from "./sources/xigua.js";
import MaiduiduiSource from "./sources/maiduidui.js";
import AnimekoSource from "./sources/animeko.js";
import AiyifanSource from "./sources/aiyifan.js";
import DoubanSource from "./sources/douban.js";
import OtherSource from "./sources/other.js";
import { NodeHandler } from "./configs/handlers/node-handler.js";
import { VercelHandler } from "./configs/handlers/vercel-handler.js";
import { NetlifyHandler } from "./configs/handlers/netlify-handler.js";
import { CloudflareHandler } from "./configs/handlers/cloudflare-handler.js";
import { EdgeoneHandler } from "./configs/handlers/edgeone-handler.js";
import { Globals, globals } from "./configs/globals.js";
import { addAnime, addEpisode, migrateLegacyRuntimeCaches, setLastSearch, setSearchCache, storeAnimeIdsToMap } from "./utils/cache-util.js";
import { convertToAsciiSum } from "./utils/codec-util.js";
import { handleDanmusLike } from "./utils/danmu-util.js";
import { Segment, SegmentListResponse } from "./models/dandan-model.js"
import { HANJUTV_FULL_EPISODE_FALLBACK_SEGMENT_DATA } from "./utils/hanjutv-util.js";
import { AiyifanSigningProvider } from "./utils/aiyifan-util.js";

// Mock Request class for testing
class MockRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.json = options.body ? async () => options.body : undefined;  // 模拟 POST 请求的 body
  }
}

// Helper to parse JSON response
async function parseResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function createFetchResponse(body, overrides = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://example.com/mock',
    headers: {
      entries() {
        return [];
      }
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
    ...overrides,
  };
}

const urlPrefix = "http://localhost:9321";
const token = "87654321";

test('Aiyifan searchDrama tolerates fw-style responses without status/ret fields', async () => {
  const source = new AiyifanSource();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => createFetchResponse(
    { data: { info: [{ result: [] }] } },
    { status: undefined }
  );

  try {
    const result = await source.searchDrama('test');
    assert.deepEqual(result, { data: { info: [{ result: [] }] } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AiyifanSigningProvider keeps custom headers and success hooks after fw compatibility refactor', async () => {
  const calls = [];
  const provider = new AiyifanSigningProvider({
    request: async (url, options = {}) => {
      calls.push({ url, options });

      if (calls.length === 1) {
        return {
          status: 200,
          data: '<script>var injectJson = {"config":[{"pConfig":{"publicKey":"pub-key","privateKey":["priv-key"]}}]};</script>'
        };
      }

      return {
        status: undefined,
        data: { data: { info: [] } }
      };
    },
    proxyUrlBuilder: url => url,
    getConfigHeaders: () => ({ Cookie: 'foo=bar' }),
    isResponseSuccessful: payload => Boolean(payload && payload.data),
    getFailureMessage: () => 'unexpected failure'
  });

  const result = await provider.signedGetJson(
    'https://api.example.com/v3/test?foo=bar',
    { foo: 'bar' },
    { Referer: 'https://ref.example.com/' },
    'Aiyifan'
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Cookie, 'foo=bar');
  assert.equal(calls[1].options.headers.Referer, 'https://ref.example.com/');
  assert.equal(result.signingConfig.publicKey, 'pub-key');
  assert.ok(calls[1].url.includes('pub=pub-key'));
  assert.ok(calls[1].url.includes('vv='));
});

test('AiyifanSigningProvider should prefer persistent cache before refreshing config page', async () => {
  const now = Date.now();
  const calls = [];
  const provider = new AiyifanSigningProvider({
    request: async (url, options = {}) => {
      calls.push({ url, options });
      return {
        status: 200,
        data: { data: { info: [] } }
      };
    },
    proxyUrlBuilder: url => url,
    getPersistentCache: async () => ({
      publicKey: 'cached-pub',
      privateKey: 'cached-priv',
      fetchedAt: now
    }),
    setPersistentCache: async () => {
      throw new Error('should not rewrite persistent cache when only reading it');
    },
    isResponseSuccessful: payload => Boolean(payload && payload.data),
    getFailureMessage: () => 'unexpected failure',
    now: () => now
  });

  const result = await provider.signedGetJson(
    'https://api.example.com/v3/test?foo=bar',
    { foo: 'bar' },
    {},
    'Aiyifan'
  );

  assert.equal(calls.length, 1);
  assert.equal(result.signingConfig.publicKey, 'cached-pub');
  assert.ok(calls[0].url.includes('pub=cached-pub'));
  assert.ok(calls[0].url.includes('vv='));
});

test('AiyifanSigningProvider should reuse stale config when refresh fails after a signed request error', async () => {
  const calls = [];
  const provider = new AiyifanSigningProvider({
    request: async (url, options = {}) => {
      calls.push({ url, options });

      if (url === 'https://config.example.com/') {
        throw new Error('cf blocked');
      }

      const apiCallCount = calls.filter(call => call.url.startsWith('https://api.example.com/')).length;
      if (apiCallCount === 1) {
        return {
          status: 200,
          data: { data: { code: 401, msg: 'signature expired' } }
        };
      }

      return {
        status: 200,
        data: { data: { code: 0, info: ['ok'] } }
      };
    },
    proxyUrlBuilder: url => url,
    configPageUrl: 'https://config.example.com/',
    isResponseSuccessful: payload => payload?.data?.code === 0,
    getFailureMessage: payload => payload?.data?.msg || 'unexpected failure'
  });

  provider.signingConfig = { publicKey: 'stale-pub', privateKey: 'stale-priv' };
  provider.signingConfigFetchedAt = Date.now();

  const result = await provider.signedGetJson(
    'https://api.example.com/v3/test?foo=bar',
    { foo: 'bar' },
    {},
    'Aiyifan'
  );

  const apiCalls = calls.filter(call => call.url.startsWith('https://api.example.com/'));
  assert.equal(apiCalls.length, 2);
  assert.ok(calls.some(call => call.url === 'https://config.example.com/'));
  assert.equal(result.signingConfig.publicKey, 'stale-pub');
  assert.ok(apiCalls[1].url.includes('pub=stale-pub'));
});

test('AiyifanSigningProvider should restore signing config from local file cache when node has no redis', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiyifan-file-cache-'));
  const fileCachePath = path.join(tempDir, 'aiyifanSigningConfig.json');
  fs.writeFileSync(fileCachePath, JSON.stringify({
    publicKey: 'file-pub',
    privateKey: 'file-priv',
    fetchedAt: Date.now()
  }), 'utf8');

  const originalDeployPlatform = globals.deployPlatform;
  const originalLocalRedisUrl = globals.localRedisUrl;
  const originalRedisUrl = globals.redisUrl;
  const originalRedisToken = globals.redisToken;
  const calls = [];

  globals.deployPlatform = 'node';
  globals.localRedisUrl = '';
  globals.redisUrl = '';
  globals.redisToken = '';

  try {
    const provider = new AiyifanSigningProvider({
      request: async (url, options = {}) => {
        calls.push({ url, options });
        return {
          status: 200,
          data: { data: { info: [] } }
        };
      },
      proxyUrlBuilder: url => url,
      fileCachePath,
      isResponseSuccessful: payload => Boolean(payload && payload.data),
      getFailureMessage: () => 'unexpected failure'
    });

    const result = await provider.signedGetJson(
      'https://api.example.com/v3/test?foo=bar',
      { foo: 'bar' },
      {},
      'Aiyifan'
    );

    assert.equal(calls.length, 1);
    assert.equal(result.signingConfig.publicKey, 'file-pub');
    assert.ok(calls[0].url.includes('pub=file-pub'));
  } finally {
    globals.deployPlatform = originalDeployPlatform;
    globals.localRedisUrl = originalLocalRedisUrl;
    globals.redisUrl = originalRedisUrl;
    globals.redisToken = originalRedisToken;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('AiyifanSigningProvider should write local file cache after refreshing config page when node has no redis', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiyifan-file-cache-write-'));
  const fileCachePath = path.join(tempDir, 'aiyifanSigningConfig.json');
  const originalDeployPlatform = globals.deployPlatform;
  const originalLocalRedisUrl = globals.localRedisUrl;
  const originalRedisUrl = globals.redisUrl;
  const originalRedisToken = globals.redisToken;

  globals.deployPlatform = 'node';
  globals.localRedisUrl = '';
  globals.redisUrl = '';
  globals.redisToken = '';

  try {
    const provider = new AiyifanSigningProvider({
      request: async (url) => {
        if (url === 'https://config.example.com/') {
          return {
            status: 200,
            data: '<script>var injectJson = {"config":[{"pConfig":{"publicKey":"fresh-file-pub","privateKey":["fresh-file-priv"]}}]};</script>'
          };
        }

        return {
          status: 200,
          data: { data: { code: 0, info: ['ok'] } }
        };
      },
      proxyUrlBuilder: url => url,
      configPageUrl: 'https://config.example.com/',
      fileCachePath,
      isResponseSuccessful: payload => payload?.data?.code === 0,
      getFailureMessage: payload => payload?.data?.msg || 'unexpected failure'
    });

    const result = await provider.signedGetJson(
      'https://api.example.com/v3/test?foo=bar',
      { foo: 'bar' },
      {},
      'Aiyifan'
    );

    assert.equal(result.signingConfig.publicKey, 'fresh-file-pub');
    assert.ok(fs.existsSync(fileCachePath));

    const fileCache = JSON.parse(fs.readFileSync(fileCachePath, 'utf8'));
    assert.equal(fileCache.publicKey, 'fresh-file-pub');
    assert.equal(fileCache.privateKey, 'fresh-file-priv');
    assert.ok(Number(fileCache.fetchedAt) > 0);
  } finally {
    globals.deployPlatform = originalDeployPlatform;
    globals.localRedisUrl = originalLocalRedisUrl;
    globals.redisUrl = originalRedisUrl;
    globals.redisToken = originalRedisToken;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Douban search should carry configured cookie,使用搜索页 Referer，并在 403 时重试', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  Globals.init({ DOUBAN_COOKIE: 'bid=test-bid; ll="118282"' });

  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url,
      headers: { ...(options.headers || {}) }
    });

    return {
      ok: false,
      status: 403,
      headers: {
        entries() {
          return [];
        }
      },
      async text() {
        return JSON.stringify({ msg: 'forbidden' });
      }
    };
  };

  try {
    const result = await searchDoubanTitles('绿野仙踪');

    assert.equal(result, null);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].headers.Cookie, 'bid=test-bid; ll="118282"');
    assert.equal(
      calls[0].headers.Referer,
      'https://m.douban.com/search/?query=%E7%BB%BF%E9%87%8E%E4%BB%99%E8%B8%AA'
    );
  } finally {
    globalThis.fetch = originalFetch;
    Globals.init({});
  }
});

test('DoubanSource.search should fallback to public api when rexxar search is empty', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const source = new DoubanSource(null, null, null, null, null);
  Globals.init({});

  globalThis.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: String(url), method });

    if (String(url).startsWith('https://m.douban.com/rexxar/api/v2/search?')) {
      return createFetchResponse({ subjects: { items: [] }, smart_box: [] });
    }

    if (String(url) === 'https://api.douban.com/v2/movie/search' && method === 'POST') {
      return createFetchResponse({
        subjects: [{
          id: '1291561',
          title: '公开兜底测试',
          subtype: 'tv',
          year: '2024',
          genres: ['剧情'],
          directors: [{ name: '导演甲' }],
          casts: [{ name: '演员甲' }],
          collect_count: 321,
          rating: { average: 8.6, max: 10, stars: '40' },
          images: {
            large: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2887095203.jpg'
          }
        }]
      });
    }

    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await source.search('公开兜底测试');

    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, 'GET');
    assert.equal(calls[1].method, 'POST');
    assert.equal(result.length, 1);
    assert.equal(result[0].layout, 'subject');
    assert.equal(result[0].type_name, '电视剧');
    assert.equal(result[0].target_id, '1291561');
    assert.equal(result[0].target.title, '公开兜底测试');
    assert.match(result[0].target.cover_url, /p2887095203/);
    assert.match(result[0].target.card_subtitle, /2024/);
  } finally {
    globalThis.fetch = originalFetch;
    Globals.init({});
  }
});

test('alignSourceTimelines should fall back to text consensus offsets when dandan related data is unavailable', () => {
  const results = [
    [
      { m: '同步弹幕', p: '10.00,1,16777215,[dandan]', t: 10, progress: 10000 },
      { m: '第二条', p: '20.00,1,16777215,[dandan]', t: 20, progress: 20000 }
    ],
    [
      { m: '同步弹幕', p: '15.00,1,16777215,[youku]', t: 15, progress: 15000 },
      { m: '第二条', p: '25.00,1,16777215,[youku]', t: 25, progress: 25000 }
    ]
  ];

  alignSourceTimelines(results, ['dandan', 'youku'], ['dandan-1', 'youku-1']);

  assert.equal(results[1][0].t, 10);
  assert.equal(results[1][1].t, 20);
  assert.equal(results[1][0].progress, 10000);
  assert.equal(results[1][1].progress, 20000);
  assert.match(results[1][0].p, /^10\.00,/);
  assert.match(results[1][1].p, /^20\.00,/);
});
test('runtime info and version check should allow public read access on custom-token deployments', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function(url) {
    if (String(url).startsWith('https://img.shields.io/docker/v/')) {
      return {
        ok: true,
        status: 200,
        async text() {
          return '<svg><text>version</text><text>v9.9.9</text></svg>';
        }
      };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  try {
    const env = { TOKEN: 'user-token', ADMIN_TOKEN: 'admin-token', VERSION: '1.18.2' };

    const infoReq = new MockRequest(urlPrefix + '/api/runtime/info', { method: 'GET' });
    const infoRes = await handleRequest(infoReq, env, 'vercel');
    const infoBody = await parseResponse(infoRes);

    assert.equal(infoRes.status, 200);
    assert.equal(infoBody.success, true);
    assert.equal(infoBody.runtimeType, 'cloud');
    assert.equal(infoBody.service.platformLabel, 'Vercel');
    assert.equal(infoBody.auth.isAdmin, false);

    const checkReq = new MockRequest(urlPrefix + '/api/runtime/check-update', { method: 'POST' });
    const checkRes = await handleRequest(checkReq, env, 'vercel');
    const checkBody = await parseResponse(checkRes);

    assert.equal(checkRes.status, 200);
    assert.equal(checkBody.success, true);
    assert.equal(checkBody.version.latest, 'v9.9.9');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime update should still require admin token after public runtime read access is enabled', async () => {
  const env = { TOKEN: 'user-token', ADMIN_TOKEN: 'admin-token', ENABLE_RUNTIME_CONTROL: 'true' };
  const req = new MockRequest(urlPrefix + '/user-token/api/runtime/update', { method: 'POST' });
  const res = await handleRequest(req, env, 'docker');
  const body = await parseResponse(res);

  assert.equal(res.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.errorMessage, 'Admin token required');
});

test('worker.js API endpoints', async (t) => {
  const renrenSource = new RenrenSource();
  const hanjutvSource = new HanjutvSource();
  const bahamutSource = new BahamutSource();
  const tencentSource = new TencentSource();
  const iqiyiSource = new IqiyiSource();
  const mangoSource = new MangoSource();
  const bilibiliSource = new BilibiliSource();
  const youkuSource = new YoukuSource();
  const miguSource = new MiguSource();
  const sohuSource = new SohuSource();
  const leshiSource = new LeshiSource();
  const xiguaSource = new XiguaSource();
  const maiduiduiSource = new MaiduiduiSource();
  const animekoSource = new AnimekoSource();
  const otherSource = new OtherSource();

  await t.test('GET / should return welcome message', async () => {
    const req = new MockRequest(urlPrefix, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
  });

  // 测试标题解析
  await t.test('PARSE TitleSeasonEpisode', async () => {
    let title, season, episode;
    ({title, season, episode} = await extractTitleSeasonEpisode("生万物 S02E08"));
    assert(title === "生万物" && season == 2 && episode == 8, `Expected title === "生万物" && season == 2 && episode == 8, but got ${title} ${season} ${episode}`);

    ({title, season, episode} = await extractTitleSeasonEpisode("无忧渡.S02E08.2160p.WEB-DL.H265.DDP.5.1"));
    assert(title === "无忧渡" && season == 2 && episode == 8, `Expected title === "无忧渡" && season == 2 && episode == 8, but got ${title} ${season} ${episode}`);

    // ({title, season, episode} = await extractTitleSeasonEpisode("Blood.River.S02E08"));
    // assert(title === "暗河传" && season == 2 && episode == 8, `Expected title === "暗河传" && season == 2 && episode == 8, but got ${title} ${season} ${episode}`);

    ({title, season, episode} = await extractTitleSeasonEpisode("爱情公寓.ipartment.2009.S02E08.H.265.25fps.mkv"));
    assert(title === "爱情公寓" && season == 2 && episode == 8, `Expected title === "爱情公寓" && season == 2 && episode == 8, but got ${title} ${season} ${episode}`);

    ({title, season, episode} = await extractTitleSeasonEpisode("亲爱的X S02E08"));
    assert(title === "亲爱的X" && season == 2 && episode == 8, `Expected title === "亲爱的X" && season == 2 && episode == 8, but got ${title} ${season} ${episode}`);

    ({title, season, episode} = await extractTitleSeasonEpisode("宇宙Marry Me? S02E08"));
    assert(title === "宇宙Marry Me?" && season == 2 && episode == 8, `Expected title === "宇宙Marry Me?" && season == 2 && episode == 8, but got ${title} ${season} ${episode}`);
  });


  await t.test('GET /api/v2/comment/:id/duration should return segment duration without cache', async () => {
    Globals.init({ DANMU_OFFSET: '偏移测试/S01/E01@hanjutv:20' });
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const originalTencentGetComments = TencentSource.prototype.getComments;
    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(segmentFlag, true);
      return {
        type: 'qq',
        segmentList: [
          { type: 'qq', segment_start: 0, segment_end: 60, url: 'mock-1' },
          { type: 'qq', segment_start: 60, segment_end: 2760, url: 'mock-2' }
        ]
      };
    };

    try {
      const episode = addEpisode('https://v.qq.com/x/cover/a/b.html', '【qq】测试样例');
      const req = new MockRequest(urlPrefix + '/api/v2/comment/' + episode.id + '/duration', { method: 'GET' });
      const res = await handleRequest(req);
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.videoDuration, 2760);
      assert.equal(globals.commentCache.size, 0);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
    }
  });


  await t.test('GET /api/v2/comment/:id/duration should use merged max duration', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const originalTencentGetComments = TencentSource.prototype.getComments;
    const originalIqiyiGetComments = IqiyiSource.prototype.getComments;
    const originalYoukuGetComments = YoukuSource.prototype.getComments;

    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(segmentFlag, true);
      return {
        type: 'qq',
        segmentList: [
          { type: 'qq', segment_start: 0, segment_end: 2760, url: 'mock-qq' }
        ]
      };
    };

    IqiyiSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(segmentFlag, true);
      return {
        type: 'qiyi',
        segmentList: [
          { type: 'qiyi', segment_start: 0, segment_end: 1200, url: 'mock-qiyi-1' },
          { type: 'qiyi', segment_start: 1200, segment_end: 2682, url: 'mock-qiyi-2' }
        ]
      };
    };

    YoukuSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(segmentFlag, true);
      return {
        type: 'youku',
        segmentList: [
          { type: 'youku', segment_start: 0, segment_end: 1800, url: 'mock-youku-1' },
          { type: 'youku', segment_start: 1800, segment_end: 3000, url: 'mock-youku-2' }
        ]
      };
    };

    try {
      const episode = addEpisode(
        'tencent:https://v.qq.com/x/cover/a/b.html$$$iqiyi:https://www.iqiyi.com/v_test.html$$$youku:https://v.youku.com/v_show/id_test.html',
        '【qq＆qiyi＆youku】合并测试'
      );
      const req = new MockRequest(urlPrefix + '/api/v2/comment/' + episode.id + '/duration', { method: 'GET' });
      const res = await handleRequest(req);
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.videoDuration, 3000);
      assert.equal(globals.commentCache.size, 0);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      IqiyiSource.prototype.getComments = originalIqiyiGetComments;
      YoukuSource.prototype.getComments = originalYoukuGetComments;
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id/duration should prefer explicit duration field', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const originalBilibiliGetComments = BilibiliSource.prototype.getComments;
    BilibiliSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(segmentFlag, true);
      return new SegmentListResponse({
        type: 'bilibili1',
        duration: 1312.76,
        segmentList: [
          { type: 'bilibili1', segment_start: 0, segment_end: 360, url: 'mock-bili-1' },
          { type: 'bilibili1', segment_start: 360, segment_end: 720, url: 'mock-bili-2' },
          { type: 'bilibili1', segment_start: 720, segment_end: 1080, url: 'mock-bili-3' },
          { type: 'bilibili1', segment_start: 1080, segment_end: 1440, url: 'mock-bili-4' }
        ]
      });
    };

    try {
      const episode = addEpisode('https://www.bilibili.com/bangumi/play/ep_test.html', '【bilibili】测试样例');
      const req = new MockRequest(urlPrefix + '/api/v2/comment/' + episode.id + '/duration', { method: 'GET' });
      const res = await handleRequest(req, { DANMU_OFFSET: '偏移测试/S01/E01@hanjutv:20' });
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.videoDuration, 1312.76);
      assert.equal(globals.commentCache.size, 0);
    } finally {
      BilibiliSource.prototype.getComments = originalBilibiliGetComments;
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id/duration should read acfun duration from url', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const episode = addEpisode('acfun://video/36122087?durationMs=720410&bangumiId=6002918', '【acfun】测试样例');
    const req = new MockRequest(urlPrefix + '/api/v2/comment/' + episode.id + '/duration', { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert(Math.abs(body.videoDuration - 720.41) < 0.001, `Expected 720.41, but got ${body.videoDuration}`);
    assert.equal(globals.commentCache.size, 0);
  });

  await t.test('GET /api/v2/comment/:id should support DANMU_OFFSET percent mode on single source comments', async () => {
    Globals.init({ DANMU_OFFSET: '百分比偏移测试/S01/E01@tencent%:10' });
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const episode = addEpisode('https://v.qq.com/x/cover/a/b.html', '【qq】第1集');
    Globals.animes.push({
      animeId: 950001,
      bangumiId: '950001',
      animeTitle: '百分比偏移测试 S01',
      type: '动漫',
      typeDescription: '动漫',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 9.5,
      isFavorited: true,
      source: 'tencent',
      links: [episode]
    });

    const originalTencentGetComments = TencentSource.prototype.getComments;
    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      if (segmentFlag) {
        return {
          type: 'qq',
          segmentList: [
            { type: 'qq', segment_start: 0, segment_end: 100, url: 'mock-qq-1' }
          ]
        };
      }

      return [
        { p: '10.00,1,16777215,[qq]', m: '腾讯弹幕' }
      ];
    };

    try {
      const req = new MockRequest(urlPrefix + `/api/v2/comment/${episode.id}?format=json`, { method: 'GET' });
      const res = await handleRequest(req, { DANMU_OFFSET: '百分比偏移测试/S01/E01@tencent%:10' });
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.equal(body.comments[0].m, '腾讯弹幕');
      assert.match(body.comments[0].p, /^11\.00,/);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id should apply DANMU_OFFSET percent mode with per-source durations while returning merged max duration', async () => {
    Globals.init({ DANMU_OFFSET: '百分比偏移测试/S01/E01@tencent&iqiyi%:10' });
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const episode = addEpisode(
      'tencent:https://v.qq.com/x/cover/a/b.html$$$iqiyi:https://www.iqiyi.com/v_test.html',
      '【qq＆qiyi】第1集'
    );
    Globals.animes.push({
      animeId: 950002,
      bangumiId: '950002',
      animeTitle: '百分比偏移测试 S01',
      type: '动漫',
      typeDescription: '动漫',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 9.5,
      isFavorited: true,
      source: 'tencent',
      links: [episode]
    });

    const originalTencentGetComments = TencentSource.prototype.getComments;
    const originalIqiyiGetComments = IqiyiSource.prototype.getComments;
    const originalTencentGetEpisodeDanmu = TencentSource.prototype.getEpisodeDanmu;
    const originalIqiyiGetEpisodeDanmu = IqiyiSource.prototype.getEpisodeDanmu;
    const originalTencentFormatComments = TencentSource.prototype.formatComments;
    const originalIqiyiFormatComments = IqiyiSource.prototype.formatComments;

    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      if (segmentFlag) {
        return {
          type: 'qq',
          segmentList: [
            { type: 'qq', segment_start: 0, segment_end: 100, url: 'mock-qq-1' }
          ]
        };
      }

      return [
        { p: '10.00,1,16777215,[qq]', m: '腾讯弹幕' }
      ];
    };

    TencentSource.prototype.getEpisodeDanmu = async function() {
      return [
        { p: '10.00,1,16777215,[qq]', m: '腾讯弹幕' }
      ];
    };

    TencentSource.prototype.formatComments = function(raw) {
      return raw;
    };

    IqiyiSource.prototype.getComments = async function(url, plat, segmentFlag) {
      if (segmentFlag) {
        return {
          type: 'qiyi',
          segmentList: [
            { type: 'qiyi', segment_start: 0, segment_end: 200, url: 'mock-qiyi-1' }
          ]
        };
      }

      return [
        { p: '10.00,1,16777215,[qiyi]', m: '爱奇艺弹幕' }
      ];
    };

    IqiyiSource.prototype.getEpisodeDanmu = async function() {
      return [
        { p: '10.00,1,16777215,[qiyi]', m: '爱奇艺弹幕' }
      ];
    };

    IqiyiSource.prototype.formatComments = function(raw) {
      return raw;
    };

    try {
      const req = new MockRequest(urlPrefix + `/api/v2/comment/${episode.id}?format=json&duration=true`, { method: 'GET' });
      const res = await handleRequest(req, { DANMU_OFFSET: '百分比偏移测试/S01/E01@tencent&iqiyi%:10' });
      const body = await parseResponse(res);
      const tencentDanmu = body.comments.find(item => item.m === '腾讯弹幕');
      const iqiyiDanmu = body.comments.find(item => item.m === '爱奇艺弹幕');

      assert.equal(res.status, 200);
      assert.equal(body.videoDuration, 200);
      assert.ok(tencentDanmu);
      assert.ok(iqiyiDanmu);
      assert.match(tencentDanmu.p, /^11\.00,/);
      assert.match(iqiyiDanmu.p, /^10\.50,/);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      IqiyiSource.prototype.getComments = originalIqiyiGetComments;
      TencentSource.prototype.getEpisodeDanmu = originalTencentGetEpisodeDanmu;
      IqiyiSource.prototype.getEpisodeDanmu = originalIqiyiGetEpisodeDanmu;
      TencentSource.prototype.formatComments = originalTencentFormatComments;
      IqiyiSource.prototype.formatComments = originalIqiyiFormatComments;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id should warn and skip DANMU_OFFSET percent mode when duration is unavailable', async () => {
    Globals.init({ DANMU_OFFSET: '无时长百分比测试/S01/E01@tencent%:10' });
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();
    Globals.logBuffer = [];

    const episode = addEpisode('https://v.qq.com/x/cover/a/zero-duration.html', '【qq】第1集');
    Globals.animes.push({
      animeId: 950003,
      bangumiId: '950003',
      animeTitle: '无时长百分比测试 S01',
      type: '动漫',
      typeDescription: '动漫',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 9.5,
      isFavorited: true,
      source: 'tencent',
      links: [episode]
    });

    const originalTencentGetComments = TencentSource.prototype.getComments;
    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      if (segmentFlag) {
        return {
          type: 'qq',
          segmentList: []
        };
      }

      return [
        { p: '10.00,1,16777215,[qq]', m: '腾讯弹幕' }
      ];
    };

    try {
      const req = new MockRequest(urlPrefix + `/api/v2/comment/${episode.id}?format=json`, { method: 'GET' });
      const res = await handleRequest(req, { DANMU_OFFSET: '无时长百分比测试/S01/E01@tencent%:10' });
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.equal(body.comments[0].m, '腾讯弹幕');
      assert.match(body.comments[0].p, /^10\.00,/);
      assert.ok(
        Globals.logBuffer.some(entry => entry.level === 'warn' && entry.message.includes('跳过百分比偏移') && entry.message.includes('未获取到有效时长')),
        'Expected a warn log when percent offset duration is unavailable'
      );
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
      Globals.logBuffer = [];
    }
  });

  await t.test('GET /api/v2/comment?url should reject merged url with a clear error', async () => {
    Globals.init({});
    Globals.requestHistory = new Map();
    Globals.envs.rateLimitMaxRequests = 0;

    const mergedUrl = encodeURIComponent('tencent:https://v.qq.com/x/cover/a/b.html$$$iqiyi:https://www.iqiyi.com/v_test.html');
    const req = new MockRequest(urlPrefix + `/api/v2/comment?url=${mergedUrl}&format=json`, { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.errorMessage, 'Merged url is not supported in url parameter, please provide a single video url');
  });

  await t.test('GET /api/v2/comment/:id?format=json&duration=true should return comments and duration in one request', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const originalTencentGetComments = TencentSource.prototype.getComments;
    let commentRequestCount = 0;
    let durationRequestCount = 0;

    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(url, 'https://v.qq.com/x/cover/a/b.html');
      assert.equal(plat, 'qq');

      if (segmentFlag) {
        durationRequestCount++;
        return {
          type: 'qq',
          segmentList: [
            { type: 'qq', segment_start: 0, segment_end: 60, url: 'mock-1' },
            { type: 'qq', segment_start: 60, segment_end: 2760, url: 'mock-2' }
          ]
        };
      }

      commentRequestCount++;
      return [
        { p: '12.3,1,16777215,qq', m: '测试弹幕1' },
        { p: '45.6,1,16777215,qq', m: '测试弹幕2' }
      ];
    };

    try {
      const episode = addEpisode('https://v.qq.com/x/cover/a/b.html', '【qq】测试样例');
      const req = new MockRequest(urlPrefix + '/api/v2/comment/' + episode.id + '?format=json&duration=true', { method: 'GET' });
      const res = await handleRequest(req, {}, 'vercel');
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.videoDuration, 2760);
      assert.equal(body.count, 2);
      assert.equal(body.comments.length, 2);
      assert.equal(commentRequestCount, 1);
      assert.equal(durationRequestCount, 1);
      assert.equal(Globals.commentCache.size, 1);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id should ignore stale lastSearch from another episode', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();
    Globals.lastSelectMap = new Map();

    const originalTencentGetComments = TencentSource.prototype.getComments;
    TencentSource.prototype.getComments = async function() {
      return [
        {
          cid: 1,
          p: '1.00,1,25,16777215,[qq]',
          m: '回归测试弹幕',
          t: 1,
          like: 0
        }
      ];
    };

    try {
      addAnime({
        animeId: 501,
        bangumiId: 'race-501',
        animeTitle: '竞态回归测试剧',
        type: 'tvseries',
        typeDescription: 'TV',
        imageUrl: '',
        startDate: '2024-01-01T00:00:00.000Z',
        episodeCount: 1,
        rating: 0,
        isFavorited: false,
        source: 'tencent',
        links: [
          {
            url: 'https://v.qq.com/x/cover/race/test.html',
            title: '【qq】第5集'
          }
        ]
      });

      storeAnimeIdsToMap(globals.animes, '竞态回归测试剧');
      const commentId = globals.animes[0].links[0].id;
      setLastSearch('test-last-search-ip', {
        title: '竞态回归测试剧',
        season: 1,
        episode: 6,
        episodeId: commentId + 1
      });

      const res = await getComment(`/api/v2/comment/${commentId}`, 'json', false, 'test-last-search-ip');
      const body = await parseResponse(res);
      const preferState = globals.lastSelectMap.get('竞态回归测试剧');

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.deepEqual(preferState?.preferBySeason || {}, {});
      assert.deepEqual(preferState?.offsets || {}, {});
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
      Globals.lastSelectMap = new Map();
    }
  });

  await t.test('cloud platforms should preserve transient runtime search cache for follow-up comment lookups', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.requestHistory = new Map();

    const cachedAnime = {
      animeId: 500002,
      bangumiId: '500002',
      animeTitle: '缓存弹幕番剧',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: 'https://example.com/poster2.jpg',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: true,
      source: 'tencent',
      links: [
        { id: 31001, url: 'https://v.qq.com/x/cover/cache/comment-ep1.html', title: '【qq】 第1集' }
      ]
    };
    Globals.searchCache.set('缓存弹幕番剧', {
      results: [
        {
          animeId: cachedAnime.animeId,
          bangumiId: cachedAnime.bangumiId,
          animeTitle: cachedAnime.animeTitle,
          type: cachedAnime.type,
          typeDescription: cachedAnime.typeDescription,
          imageUrl: cachedAnime.imageUrl,
          startDate: cachedAnime.startDate,
          episodeCount: cachedAnime.episodeCount,
          rating: cachedAnime.rating,
          isFavorited: cachedAnime.isFavorited,
          source: cachedAnime.source
        }
      ],
      details: [cachedAnime],
      timestamp: Date.now()
    });

    const originalTencentGetComments = TencentSource.prototype.getComments;
    let requestCount = 0;
    TencentSource.prototype.getComments = async function(url, plat, segmentFlag) {
      requestCount++;
      assert.equal(url, cachedAnime.links[0].url);
      assert.equal(plat, 'qq');
      assert.equal(segmentFlag, false);
      return [
        { p: '12.3,1,16777215,qq', m: '缓存弹幕命中' }
      ];
    };

    try {
      const req = new MockRequest(urlPrefix + '/api/v2/comment/' + cachedAnime.links[0].id + '?format=json', { method: 'GET' });
      const res = await handleRequest(req, {}, 'vercel');
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.equal(body.comments[0].m, '缓存弹幕命中');
      assert.equal(requestCount, 1);
      assert.equal(Globals.searchCache.size, 1);
      assert.equal(Globals.commentCache.size, 1);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.searchCache = new Map();
      Globals.commentCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id should reuse transient runtime comment cache on cloud platforms', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [
      { id: 43011, url: 'https://v.qq.com/x/cover/a/cloud-test.html', title: '【qq】云平台缓存测试' }
    ];
    Globals.episodeNum = 43012;
    Globals.commentCache = new Map([
      ['https://v.qq.com/x/cover/a/cloud-test.html', { comments: [{ m: 'cached-comment' }], timestamp: Date.now() }]
    ]);
    Globals.requestHistory = new Map();

    const originalTencentGetComments = TencentSource.prototype.getComments;
    TencentSource.prototype.getComments = async function() {
      throw new Error('comment cache should have been reused before hitting source');
    };

    try {
      const req = new MockRequest(urlPrefix + '/api/v2/comment/43011', { method: 'GET' });
      const res = await handleRequest(req, {}, 'vercel');
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.equal(body.comments[0].m, 'cached-comment');
      assert.equal(Globals.commentCache.size, 1);
    } finally {
      TencentSource.prototype.getComments = originalTencentGetComments;
      Globals.commentCache = new Map();
    }
  });

  await t.test('legacy hanjutv cache urls should be migrated from xw prefix', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();

    const legacyAnime = {
      animeId: 930001,
      bangumiId: 'hanju-legacy',
      animeTitle: '韩剧TV旧缓存样例',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'hanjutv',
      links: [
        { id: 43001, url: 'xw:legacy-eid', title: '【hanjutv】 第1集' }
      ]
    };

    Globals.animes = [legacyAnime];
    Globals.episodeIds = [
      { id: 43001, url: 'xw:legacy-eid', title: '【hanjutv】 第1集' }
    ];
    Globals.animeDetailsCache = new Map([
      ['anime:hanjutv:930001', { anime: legacyAnime, timestamp: Date.now() }]
    ]);
    Globals.episodeDetailsCache = new Map([
      ['43001', { anime: legacyAnime, link: legacyAnime.links[0], linkIndex: 0, timestamp: Date.now() }]
    ]);
    Globals.searchCache = new Map([
      ['韩剧TV旧缓存样例', {
        results: [
          {
            animeId: legacyAnime.animeId,
            bangumiId: legacyAnime.bangumiId,
            animeTitle: legacyAnime.animeTitle,
            source: legacyAnime.source
          }
        ],
        details: [legacyAnime],
        timestamp: Date.now()
      }]
    ]);

    const migrated = migrateLegacyRuntimeCaches();

    assert.equal(migrated, true);
    assert.equal(Globals.animes[0].links[0].url, 'tv:legacy-eid');
    assert.equal(Globals.episodeIds[0].url, 'tv:legacy-eid');
    assert.equal(Globals.animeDetailsCache.get('anime:hanjutv:930001').anime.links[0].url, 'tv:legacy-eid');
    assert.equal(Globals.episodeDetailsCache.get('43001').link.url, 'tv:legacy-eid');
    assert.equal(Globals.searchCache.get('韩剧TV旧缓存样例').details[0].links[0].url, 'tv:legacy-eid');
  });

  await t.test('hanjutv should support legacy xw episode ids when fetching danmu', async () => {
    const source = new HanjutvSource();
    const originalFetch = globalThis.fetch;
    const originalTvGet = source.tvGet;
    let unexpectedFetch = false;

    globalThis.fetch = async (url) => {
      unexpectedFetch = true;
      throw new Error(`unexpected fetch: ${url}`);
    };

    source.tvGet = async (path) => {
      assert(path.includes('eid=legacy-eid'), `Expected TV danmu path to include legacy-eid, but got ${path}`);
      return {
        bulletchats: [{ did: 1, t: 1000, tp: 1, sc: 16777215, con: 'legacy-ok', lc: 0 }],
        more: 0,
        nextAxis: 100000000,
        lastId: 0,
      };
    };

    try {
      const danmus = await source.getEpisodeDanmu('xw:legacy-eid');
      assert.equal(unexpectedFetch, false, 'Expected legacy xw url to bypass old Web danmu endpoint');
      assert.equal(danmus.length, 1);
      assert.equal(danmus[0].con, 'legacy-ok');
    } finally {
      source.tvGet = originalTvGet;
      if (originalFetch === undefined) {
        delete globalThis.fetch;
      } else {
        globalThis.fetch = originalFetch;
      }
    }
  });

  await t.test('hanjutv tv danmu pagination should fetch full episode timeline and reset prevId after more=0', async () => {
    const source = new HanjutvSource();
    const originalTvGet = source.tvGet;
    const calls = [];

    source.tvGet = async (path) => {
      calls.push(path);
      if (calls.length === 1) {
        return {
          bulletchats: [{ did: 1, t: 0, tp: 1, sc: 16777215, con: 'page-1', lc: 0 }],
          more: 1,
          nextAxis: 12002,
          lastId: 111,
        };
      }

      if (calls.length === 2) {
        return {
          bulletchats: [{ did: 2, t: 12002, tp: 1, sc: 16777215, con: 'page-2', lc: 0 }],
          more: 0,
          nextAxis: 60000,
          lastId: 222,
        };
      }

      if (calls.length === 3) {
        return {
          bulletchats: [{ did: 3, t: 61000, tp: 1, sc: 16777215, con: 'page-3', lc: 0 }],
          more: 0,
          nextAxis: 120000,
          lastId: 333,
        };
      }

      return {
        bulletchats: [],
        more: 0,
        nextAxis: 100000000,
        lastId: 333,
      };
    };

    try {
      const danmus = await source.getEpisodeDanmu('xw:legacy-eid');
      assert.equal(danmus.length, 3);
      assert.deepEqual(calls, [
        '/api/v1/bulletchat/episode/get?eid=legacy-eid&prevId=0&fromAxis=0&toAxis=100000000&offset=0',
        '/api/v1/bulletchat/episode/get?eid=legacy-eid&prevId=111&fromAxis=12002&toAxis=100000000&offset=0',
        '/api/v1/bulletchat/episode/get?eid=legacy-eid&prevId=0&fromAxis=60000&toAxis=100000000&offset=0',
        '/api/v1/bulletchat/episode/get?eid=legacy-eid&prevId=0&fromAxis=120000&toAxis=100000000&offset=0',
      ]);
    } finally {
      source.tvGet = originalTvGet;
    }
  });

  await t.test('hanjutv hxq danmu pagination should keep window fixed within a page chain and advance after more=0', async () => {
    const source = new HanjutvSource();
    const originalFetch = globalThis.fetch;
    const calls = [];

    const mockJsonResponse = (data, url) => ({
      ok: true,
      status: 200,
      url,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(data),
    });

    globalThis.fetch = async (url, options = {}) => {
      const targetUrl = String(url);
      const headers = options?.headers || {};
      calls.push({ url: targetUrl, headers });

      if (targetUrl.includes('/api/danmu/playItem/list?')) {
        assert.equal('uk' in headers, false, 'Expected danmu list request not to include uk header');
        assert.equal('sign' in headers, false, 'Expected danmu list request not to include sign header');
        assert.equal('auth-token' in headers, false, 'Expected danmu list request not to include auth-token header');
        assert.equal('auth-uid' in headers, false, 'Expected danmu list request not to include auth-uid header');

        const pageIndex = calls.filter((call) => call.url.includes('/api/danmu/playItem/list?')).length;
        if (pageIndex === 1) {
          return mockJsonResponse({
            danmus: [{ did: 11, t: 0, tp: 1, sc: 16777215, con: 'hxq-page-1', lc: 0 }],
            more: 1,
            nextAxis: 12345,
            lastId: 111,
          }, targetUrl);
        }

        if (pageIndex === 2) {
          return mockJsonResponse({
            danmus: [{ did: 12, t: 12345, tp: 1, sc: 16777215, con: 'hxq-page-2', lc: 0 }],
            more: 0,
            nextAxis: 60000,
            lastId: 222,
          }, targetUrl);
        }

        if (pageIndex === 3) {
          return mockJsonResponse({
            danmus: [{ did: 13, t: 61000, tp: 1, sc: 16777215, con: 'hxq-page-3', lc: 0 }],
            more: 0,
            nextAxis: 120000,
            lastId: 333,
          }, targetUrl);
        }

        return mockJsonResponse({
          danmus: [],
          more: 0,
          nextAxis: 180000,
          lastId: 333,
        }, targetUrl);
      }

      throw new Error(`unexpected fetch: ${targetUrl}`);
    };

    try {
      const danmus = await source.getEpisodeDanmu('play-1');
      const listCalls = calls.filter((call) => call.url.includes('/api/danmu/playItem/list?')).map((call) => call.url);

      assert.equal(danmus.length, 3);
      assert.deepEqual(listCalls, [
        'https://hxqapi.hiyun.tv/api/danmu/playItem/list?pid=play-1&prevId=0&fromAxis=0&toAxis=60000&offset=0',
        'https://hxqapi.hiyun.tv/api/danmu/playItem/list?pid=play-1&prevId=111&fromAxis=12345&toAxis=60000&offset=0',
        'https://hxqapi.hiyun.tv/api/danmu/playItem/list?pid=play-1&prevId=222&fromAxis=60000&toAxis=120000&offset=0',
        'https://hxqapi.hiyun.tv/api/danmu/playItem/list?pid=play-1&prevId=333&fromAxis=120000&toAxis=180000&offset=0',
      ]);
    } finally {
      if (originalFetch === undefined) {
        delete globalThis.fetch;
      } else {
        globalThis.fetch = originalFetch;
      }
    }
  });

  await t.test('hanjutv hxq danmu should fallback to zmdcq host when hiyun host fails', async () => {
    const source = new HanjutvSource();
    const originalFetch = globalThis.fetch;
    const calls = [];

    const mockJsonResponse = (data, url) => ({
      ok: true,
      status: 200,
      url,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(data),
    });

    globalThis.fetch = async (url, options = {}) => {
      const targetUrl = String(url);
      calls.push(targetUrl);

      if (targetUrl.startsWith('https://hxqapi.hiyun.tv/api/danmu/playItem/list?')) {
        throw new Error('primary host down');
      }

      if (targetUrl === 'https://hxqapi.zmdcq.com/api/danmu/playItem/list?pid=play-2&prevId=0&fromAxis=0&toAxis=60000&offset=0') {
        const headers = options?.headers || {};
        assert.equal('uk' in headers, false, 'Expected fallback danmu request not to include uk header');
        assert.equal('sign' in headers, false, 'Expected fallback danmu request not to include sign header');
        return mockJsonResponse({
          danmus: [{ did: 21, t: 0, tp: 1, sc: 16777215, con: 'fallback-ok', lc: 0 }],
          more: 0,
          nextAxis: 60000,
          lastId: 21,
        }, targetUrl);
      }

      if (targetUrl === 'https://hxqapi.zmdcq.com/api/danmu/playItem/list?pid=play-2&prevId=21&fromAxis=60000&toAxis=120000&offset=0') {
        return mockJsonResponse({
          danmus: [],
          more: 0,
          nextAxis: 120000,
          lastId: 21,
        }, targetUrl);
      }

      throw new Error(`unexpected fetch: ${targetUrl}`);
    };

    try {
      const danmus = await source.getEpisodeDanmu('play-2');

      assert.equal(danmus.length, 1);
      assert.equal(danmus[0].con, 'fallback-ok');
      assert.equal(calls[0], 'https://hxqapi.hiyun.tv/api/danmu/playItem/list?pid=play-2&prevId=0&fromAxis=0&toAxis=60000&offset=0');
      assert.equal(calls.at(-1), 'https://hxqapi.zmdcq.com/api/danmu/playItem/list?pid=play-2&prevId=21&fromAxis=60000&toAxis=120000&offset=0');
      assert.equal(
        calls.filter((url) => url === 'https://hxqapi.hiyun.tv/api/danmu/playItem/list?pid=play-2&prevId=0&fromAxis=0&toAxis=60000&offset=0').length,
        2,
      );
    } finally {
      if (originalFetch === undefined) {
        delete globalThis.fetch;
      } else {
        globalThis.fetch = originalFetch;
      }
    }
  });

  await t.test('hanjutv getHxqEpisodes should skip dead series2 fallback and query programs_v2 directly after empty detail', async () => {
    const source = new HanjutvSource();
    const originalFetch = globalThis.fetch;
    const calls = [];

    const mockJsonResponse = (data, url) => ({
      ok: true,
      status: 200,
      url,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(data),
    });

    globalThis.fetch = async (url) => {
      const targetUrl = String(url);
      calls.push(targetUrl);

      if (targetUrl === 'https://hxqapi.hiyun.tv/api/series/detail?sid=hxq-sid-fallback') {
        return mockJsonResponse({ rescode: 0, playItems: [] }, targetUrl);
      }

      if (targetUrl === 'https://hxqapi.hiyun.tv/api/series/programs_v2?sid=hxq-sid-fallback') {
        return mockJsonResponse({
          rescode: 0,
          programs: [{ pid: 'pid-fallback-1', serialNo: 1, title: '第1集' }],
        }, targetUrl);
      }

      throw new Error(`unexpected fetch: ${targetUrl}`);
    };

    try {
      const episodes = await source.getHxqEpisodes('hxq-sid-fallback');
      assert.equal(episodes.length, 1);
      assert.equal(episodes[0].pid, 'pid-fallback-1');
      assert.deepEqual(calls, [
        'https://hxqapi.hiyun.tv/api/series/detail?sid=hxq-sid-fallback',
        'https://hxqapi.hiyun.tv/api/series/programs_v2?sid=hxq-sid-fallback',
      ]);
    } finally {
      if (originalFetch === undefined) {
        delete globalThis.fetch;
      } else {
        globalThis.fetch = originalFetch;
      }
    }
  });

  await t.test('hanjutv segment list should expose a full-episode fallback segment without faking duration', async () => {
    const source = new HanjutvSource();
    const segments = await source.getComments('play-1', 'hanjutv', true);

    assert.equal(segments.duration, 0);
    assert.equal(Array.isArray(segments.segmentList), true);
    assert.equal(segments.segmentList.length, 1);
    assert.equal(segments.segmentList[0].type, 'hanjutv');
    assert.equal(segments.segmentList[0].segment_start, 0);
    assert.equal(segments.segmentList[0].segment_end, 100000000);
    assert.equal(segments.segmentList[0].url, 'play-1');
    assert.equal(segments.segmentList[0].data, HANJUTV_FULL_EPISODE_FALLBACK_SEGMENT_DATA);
  });

  await t.test('hanjutv fallback segment should remain fetchable via segmentcomment flow', async () => {
    const source = new HanjutvSource();
    const originalGetEpisodeDanmu = HanjutvSource.prototype.getEpisodeDanmu;
    HanjutvSource.prototype.getEpisodeDanmu = async function(id) {
      assert.equal(id, 'play-1');
      return [{ did: 1, t: 1000, tp: 1, sc: 25, con: 'segment-ok', lc: 0 }];
    };

    try {
      const segments = await source.getComments('play-1', 'hanjutv', true);
      const comments = await source.getSegmentComments(segments.segmentList[0]);

      assert.equal(Array.isArray(comments), true);
      assert.equal(comments.length, 1);
      assert.equal(comments[0].m, 'segment-ok');
    } finally {
      HanjutvSource.prototype.getEpisodeDanmu = originalGetEpisodeDanmu;
    }
  });

  await t.test('GET /api/v2/comment/:id/duration should keep hanjutv fallback segment duration at 0', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.commentCache = new Map();

    const episode = addEpisode('hanjutv:hxq:pid-1$$$hanjutv:tv:eid-1', '【hanjutv】测试样例');
    const req = new MockRequest(urlPrefix + '/api/v2/comment/' + episode.id + '/duration', { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.videoDuration, 0);
  });

  await t.test('hanjutv s5 search should warm up identity before issuing the search request', async () => {
    const source = new HanjutvSource();
    const originalFetch = globalThis.fetch;
    const calls = [];

    const mockJsonResponse = (data, url) => ({
      ok: true,
      status: 200,
      url,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify(data),
    });

    globalThis.fetch = async (url) => {
      const targetUrl = String(url);
      calls.push(targetUrl);

      if (targetUrl === 'https://hxqapi.hiyun.tv/api/common/configs') {
        return mockJsonResponse({ ok: true }, targetUrl);
      }

      if (targetUrl.includes('/api/search/s5?')) {
        return mockJsonResponse({
          seriesList: [
            { sid: 'hxq-sid-1', name: '信号 第2季', image: { thumb: 'https://img/a.jpg' } },
          ]
        }, targetUrl);
      }

      throw new Error(`unexpected fetch: ${targetUrl}`);
    };

    try {
      const result = await source.searchWithS5Api('信号 第2季');
      assert.equal(result.length, 1);
      assert.equal(calls[0], 'https://hxqapi.hiyun.tv/api/common/configs');
      assert.match(calls[1], /\/api\/search\/s5\?/);
    } finally {
      if (originalFetch === undefined) {
        delete globalThis.fetch;
      } else {
        globalThis.fetch = originalFetch;
      }
    }
  });

  await t.test('hanjutv search should drop zero-match fallback recommendations', async () => {
    const source = new HanjutvSource();
    const originalS5 = source.searchWithS5Api;
    const originalTv = source.searchWithTvApi;

    source.searchWithS5Api = async () => ([
      { sid: 'sid-1', name: '有点敏感也没关系' },
      { sid: 'sid-2', name: '不是机器人啊' },
    ]);
    source.searchWithTvApi = async () => ([]);

    try {
      const result = await source.search('不存在的关键字');
      assert.deepEqual(result, []);
    } finally {
      source.searchWithS5Api = originalS5;
      source.searchWithTvApi = originalTv;
    }
  });

  await t.test('hanjutv search should merge hxq and tv hits into one composite candidate', async () => {
    const source = new HanjutvSource();
    const originalS5 = source.searchWithS5Api;
    const originalTv = source.searchWithTvApi;

    source.searchWithS5Api = async () => ([
      { sid: 'hxq-sid-1', name: '信号 第2季', image: { thumb: 'https://img/a.jpg' } },
    ]);
    source.searchWithTvApi = async () => ([
      { sid: 'tv-sid-1', name: '信号 第2季', image: { thumb: 'https://img/b.jpg' } },
    ]);

    try {
      const result = await source.search('信号 第2季');
      assert.equal(result.length, 1);
      assert.equal(result[0]._variant, 'merged');
      assert.equal(result[0].sid, 'hxq-sid-1');
      assert.equal(result[0].tvSid, 'tv-sid-1');
      assert.equal(result[0].animeId, convertToAsciiSum('hxq:hxq-sid-1|tv:tv-sid-1'));
    } finally {
      source.searchWithS5Api = originalS5;
      source.searchWithTvApi = originalTv;
    }
  });

  await t.test('hanjutv search should keep unmatched fallback candidates after matched hits', async () => {
    const source = new HanjutvSource();
    const originalS5 = source.searchWithS5Api;
    const originalTv = source.searchWithTvApi;

    source.searchWithS5Api = async () => ([
      { sid: 'hxq-sid-1', name: '信号 第2季', image: { thumb: 'https://img/a.jpg' } },
      { sid: 'hxq-sid-2', name: '信号 特辑', image: { thumb: 'https://img/b.jpg' } },
    ]);
    source.searchWithTvApi = async () => ([
      { sid: 'tv-sid-1', name: '信号 第2季', image: { thumb: 'https://img/c.jpg' } },
    ]);

    try {
      const result = await source.search('信号 第2季');
      assert.equal(result.length, 2);
      assert.equal(result[0]._variant, 'merged');
      assert.equal(result[0].animeId, convertToAsciiSum('hxq:hxq-sid-1|tv:tv-sid-1'));
      assert.equal(result[1]._variant, 'hxq');
      assert.equal(result[1].sid, 'hxq-sid-2');
    } finally {
      source.searchWithS5Api = originalS5;
      source.searchWithTvApi = originalTv;
    }
  });

  await t.test('hanjutv handleAnimes should build merged urls with a dedicated composite identity', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();

    const source = new HanjutvSource();
    const originalGetHxqDetail = source.getHxqDetail;
    const originalGetHxqEpisodes = source.getHxqEpisodes;
    const originalGetTvDetail = source.getTvDetail;
    const originalGetTvEpisodes = source.getTvEpisodes;

    source.getHxqDetail = async () => ({ category: 1, rank: 9.5 });
    source.getHxqEpisodes = async () => ([
      { pid: 'pid-1', serialNo: 1, title: '第一集' },
      { pid: 'pid-2', serialNo: 2, title: '第二集' },
    ]);
    source.getTvDetail = async () => ({ category: 1, rank: 8.8 });
    source.getTvEpisodes = async () => ([
      { eid: 'eid-1', serialNo: 1, title: '第一集' },
      { eid: 'eid-3', serialNo: 3, title: '第三集' },
    ]);

    try {
      const curAnimes = [];
      await source.handleAnimes([
        {
          sid: 'hxq-sid-1',
          tvSid: 'tv-sid-1',
          name: '偏移测试',
          image: { thumb: 'https://img/a.jpg' },
          updateTime: '2024-01-01T00:00:00.000Z',
          _variant: 'merged',
        }
      ], '偏移测试', curAnimes, new Map());

      assert.equal(curAnimes.length, 1);
      assert.equal(Globals.animes.length, 1);
      assert.equal(curAnimes[0].animeId, convertToAsciiSum('hxq:hxq-sid-1|tv:tv-sid-1'));
      assert.equal(curAnimes[0].bangumiId, String(curAnimes[0].animeId));
      assert.deepEqual(Globals.animes[0].links.map(item => item.url), [
        'hanjutv:hxq:pid-1$$$hanjutv:tv:eid-1',
        'hxq:pid-2',
        'tv:eid-3',
      ]);
    } finally {
      source.getHxqDetail = originalGetHxqDetail;
      source.getHxqEpisodes = originalGetHxqEpisodes;
      source.getTvDetail = originalGetTvDetail;
      source.getTvEpisodes = originalGetTvEpisodes;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.searchCache = new Map();
      Globals.commentCache = new Map();
      Globals.animeDetailsCache = new Map();
      Globals.episodeDetailsCache = new Map();
    }
  });

  await t.test('hanjutv merged anime identity should stay stable when one variant temporarily falls back', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();

    const source = new HanjutvSource();
    const compositeAnimeId = convertToAsciiSum('hxq:hxq-sid-1|tv:tv-sid-1');
    const originalGetHxqDetail = source.getHxqDetail;
    const originalGetHxqEpisodes = source.getHxqEpisodes;
    const originalGetTvDetail = source.getTvDetail;
    const originalGetTvEpisodes = source.getTvEpisodes;

    source.getHxqDetail = async () => ({ category: 1, rank: 9.5 });
    source.getHxqEpisodes = async () => ([
      { pid: 'pid-1', serialNo: 1, title: '第一集' },
    ]);
    source.getTvDetail = async () => ({ category: 1, rank: 8.8 });
    source.getTvEpisodes = async () => ([
      { eid: 'eid-1', serialNo: 1, title: '第一集' },
    ]);

    try {
      const firstBatch = [];
      await source.handleAnimes([
        {
          sid: 'hxq-sid-1',
          tvSid: 'tv-sid-1',
          animeId: compositeAnimeId,
          name: '稳定ID测试',
          image: { thumb: 'https://img/a.jpg' },
          _variant: 'merged',
        }
      ], '稳定ID测试', firstBatch, new Map());

      source.getTvEpisodes = async () => ([]);

      const secondBatch = [];
      await source.handleAnimes([
        {
          sid: 'hxq-sid-1',
          tvSid: 'tv-sid-1',
          animeId: compositeAnimeId,
          name: '稳定ID测试',
          image: { thumb: 'https://img/a.jpg' },
          _variant: 'merged',
        }
      ], '稳定ID测试', secondBatch, new Map());

      assert.equal(firstBatch[0].animeId, compositeAnimeId);
      assert.equal(secondBatch[0].animeId, compositeAnimeId);
      assert.equal(Globals.animes.length, 1);
      assert.equal(Globals.animes[0].animeId, compositeAnimeId);
      assert.deepEqual(Globals.animes[0].links.map(item => item.url), ['hxq:pid-1']);
    } finally {
      source.getHxqDetail = originalGetHxqDetail;
      source.getHxqEpisodes = originalGetHxqEpisodes;
      source.getTvDetail = originalGetTvDetail;
      source.getTvEpisodes = originalGetTvEpisodes;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.searchCache = new Map();
      Globals.commentCache = new Map();
      Globals.animeDetailsCache = new Map();
      Globals.episodeDetailsCache = new Map();
    }
  });


  await t.test('GET /api/v2/comment/:id should auto-migrate legacy hanjutv xw cache before fetching danmu', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [
      { id: 43001, url: 'xw:legacy-eid', title: '【hanjutv】 第1集' }
    ];
    Globals.episodeNum = 43002;
    Globals.commentCache = new Map();
    Globals.searchCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();

    const originalHanjutvGetComments = HanjutvSource.prototype.getComments;
    HanjutvSource.prototype.getComments = async function(url, plat, segmentFlag) {
      assert.equal(url, 'tv:legacy-eid');
      assert.equal(plat, 'hanjutv');
      assert.equal(segmentFlag, false);
      return [
        { p: '1.00,1,16777215,[hanjutv]', m: 'legacy-ok' }
      ];
    };

    try {
      const req = new MockRequest(urlPrefix + '/api/v2/comment/43001', { method: 'GET' });
      const res = await handleRequest(req);
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.equal(body.comments[0].m, 'legacy-ok');
      assert.equal(Globals.episodeIds[0].url, 'tv:legacy-eid');
    } finally {
      HanjutvSource.prototype.getComments = originalHanjutvGetComments;
      Globals.commentCache = new Map();
      Globals.searchCache = new Map();
      Globals.animeDetailsCache = new Map();
      Globals.episodeDetailsCache = new Map();
    }
  });

  await t.test('GET /api/v2/comment/:id should apply hanjutv offsets to both merged variants before deduping', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 43010;
    Globals.commentCache = new Map();
    Globals.searchCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();

    const episode = addEpisode('hanjutv:hxq:pid-1$$$hanjutv:tv:eid-1', '【hanjutv】 第1集');
    Globals.animes.push({
      animeId: 930010,
      bangumiId: '930010',
      animeTitle: '偏移测试(2024)【韩剧】from hanjutv',
      type: '韩剧',
      typeDescription: '韩剧',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 9.5,
      isFavorited: true,
      source: 'hanjutv',
      links: [episode]
    });

    const originalGetEpisodeDanmu = HanjutvSource.prototype.getEpisodeDanmu;
    HanjutvSource.prototype.getEpisodeDanmu = async function(id) {
      if (id === 'hxq:pid-1') {
        return [{ did: 1, t: 1000, tp: 1, sc: 16777215, con: '双端同步', lc: 0 }];
      }
      if (id === 'tv:eid-1') {
        return [{ did: 2, t: 1000, tp: 1, sc: 16777215, con: '双端同步', lc: 0 }];
      }
      throw new Error(`unexpected hanjutv id: ${id}`);
    };

    try {
      const req = new MockRequest(urlPrefix + `/api/v2/comment/${episode.id}`, { method: 'GET' });
      const res = await handleRequest(req, { DANMU_OFFSET: '偏移测试/S01/E01@hanjutv:20' });
      const body = await parseResponse(res);

      assert.equal(res.status, 200);
      assert.equal(body.count, 1);
      assert.match(body.comments[0].p, /^21\.00,1,16777215,\[韩小圈＆极速版\]$/);
      assert.equal(body.comments[0].m, '双端同步');
    } finally {
      HanjutvSource.prototype.getEpisodeDanmu = originalGetEpisodeDanmu;
      Globals.animes = [];
      Globals.episodeIds = [];
      Globals.commentCache = new Map();
      Globals.searchCache = new Map();
      Globals.animeDetailsCache = new Map();
      Globals.episodeDetailsCache = new Map();
    }
  });

  await t.test('hanjutv variant labels should keep low-threshold like display behavior', async () => {
    Globals.init({});
    Globals.likeSwitch = true;

    const likedDanmus = handleDanmusLike([
      { p: '1.00,1,16777215,[hanjutv]', m: '旧标签', like: 150 },
      { p: '1.00,1,16777215,[韩小圈]', m: '韩小圈标签', like: 150 },
      { p: '1.00,1,16777215,[极速版]', m: '极速版标签', like: 150 },
      { p: '1.00,1,16777215,[韩小圈＆极速版]', m: '双链路标签', like: 150 },
    ]);

    assert.match(likedDanmus[0].m, /🔥150$/);
    assert.match(likedDanmus[1].m, /🔥150$/);
    assert.match(likedDanmus[2].m, /🔥150$/);
    assert.match(likedDanmus[3].m, /🔥150$/);
  });

  await t.test('GET /api/v2/search/episodes should keep same-id cached details separated by source', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.envs.rateLimitMaxRequests = 0;

    const sourceAAnime = {
      animeId: 900001,
      bangumiId: 'shared-source-id',
      animeTitle: '同ID番剧A',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: 'https://example.com/a.jpg',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: true,
      source: 'tencent',
      links: [
        { id: 41001, url: 'https://v.qq.com/x/cover/source-a/ep1.html', title: '【qq】 A第1集' }
      ]
    };

    const sourceBAnime = {
      animeId: 900001,
      bangumiId: 'shared-source-id',
      animeTitle: '同ID番剧B',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: 'https://example.com/b.jpg',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: true,
      source: 'iqiyi',
      links: [
        { id: 41002, url: 'https://www.iqiyi.com/v_source_b.html', title: '【qiyi】 B第1集' }
      ]
    };

    Globals.searchCache.set('同ID测试', {
      results: [
        {
          animeId: sourceAAnime.animeId,
          bangumiId: sourceAAnime.bangumiId,
          animeTitle: sourceAAnime.animeTitle,
          type: sourceAAnime.type,
          typeDescription: sourceAAnime.typeDescription,
          imageUrl: sourceAAnime.imageUrl,
          startDate: sourceAAnime.startDate,
          episodeCount: sourceAAnime.episodeCount,
          rating: sourceAAnime.rating,
          isFavorited: sourceAAnime.isFavorited,
          source: sourceAAnime.source
        },
        {
          animeId: sourceBAnime.animeId,
          bangumiId: sourceBAnime.bangumiId,
          animeTitle: sourceBAnime.animeTitle,
          type: sourceBAnime.type,
          typeDescription: sourceBAnime.typeDescription,
          imageUrl: sourceBAnime.imageUrl,
          startDate: sourceBAnime.startDate,
          episodeCount: sourceBAnime.episodeCount,
          rating: sourceBAnime.rating,
          isFavorited: sourceBAnime.isFavorited,
          source: sourceBAnime.source
        }
      ],
      details: [sourceAAnime, sourceBAnime],
      timestamp: Date.now()
    });

    const req = new MockRequest(urlPrefix + '/api/v2/search/episodes?anime=' + encodeURIComponent('同ID测试'), { method: 'GET' });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.animes.length, 2);

    const sourceAResult = body.animes.find(item => item.animeTitle === sourceAAnime.animeTitle);
    const sourceBResult = body.animes.find(item => item.animeTitle === sourceBAnime.animeTitle);

    assert.ok(sourceAResult);
    assert.ok(sourceBResult);
    assert.equal(sourceAResult.episodes[0].episodeId, sourceAAnime.links[0].id);
    assert.equal(sourceAResult.episodes[0].episodeTitle, sourceAAnime.links[0].title);
    assert.equal(sourceBResult.episodes[0].episodeId, sourceBAnime.links[0].id);
    assert.equal(sourceBResult.episodes[0].episodeTitle, sourceBAnime.links[0].title);
  });



  await t.test('GET /api/v2/search/anime should not leak request detail store across requests', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.MAX_ANIMES = 1;
    Globals.envs.rateLimitMaxRequests = 0;

    const leakedDetailStore = new Map();
    addAnime({
      animeId: 201,
      bangumiId: 'leak-201',
      animeTitle: '旧请求番剧',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'tencent',
      links: [{ url: 'https://example.com/leak-1', title: '【qq】旧请求第1集' }]
    }, leakedDetailStore);

    const freshUrl = new URL('/api/v2/search/anime?keyword=' + encodeURIComponent('不存在的关键字'), urlPrefix);
    const res = await searchAnime(freshUrl);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.animes, []);
  });

  await t.test('GET /api/v2/search/anime should not drop early results after runtime eviction', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.MAX_ANIMES = 2;
    Globals.envs.rateLimitMaxRequests = 0;

    const keyword = '你好';
    const detailA = {
      animeId: 101,
      bangumiId: 'a-101',
      animeTitle: '你好A',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'tencent',
      links: [{ id: 51001, url: 'https://example.com/a1', title: '【qq】A1' }]
    };
    const detailB = {
      animeId: 102,
      bangumiId: 'b-102',
      animeTitle: '你好B',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'iqiyi',
      links: [{ id: 51002, url: 'https://example.com/b1', title: '【qiyi】B1' }]
    };
    const detailC = {
      animeId: 103,
      bangumiId: 'c-103',
      animeTitle: '你好C',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'youku',
      links: [{ id: 51003, url: 'https://example.com/c1', title: '【youku】C1' }]
    };

    const detailStore = new Map();
    addAnime(detailA, detailStore);
    addAnime(detailB, detailStore);
    addAnime(detailC, detailStore);

    const results = [
      { animeId: detailA.animeId, bangumiId: detailA.bangumiId, animeTitle: detailA.animeTitle, source: detailA.source },
      { animeId: detailB.animeId, bangumiId: detailB.bangumiId, animeTitle: detailB.animeTitle, source: detailB.source },
      { animeId: detailC.animeId, bangumiId: detailC.bangumiId, animeTitle: detailC.animeTitle, source: detailC.source }
    ];

    setSearchCache(keyword, results, detailStore);

    const searchUrl = new URL('/api/v2/search/anime?keyword=' + encodeURIComponent(keyword), urlPrefix);
    const res = await searchAnime(searchUrl, null, null, new Map());
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.animes.length, 3);
    assert.deepEqual(body.animes.map(item => item.animeTitle), ['你好A', '你好B', '你好C']);
  });

  await t.test('POST /api/v2/match should prefer request detail snapshot over polluted runtime cache', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '太平年';
    const animeId = 4201;
    const bangumiId = 'tpn-4201';
    const source = 'iqiyi';
    const baseAnime = {
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 42,
      rating: 0,
      isFavorited: false,
      source
    };
    const freshLinks = Array.from({ length: 42 }, (_, index) => ({
      url: `https://fresh.example.com/${index + 1}`,
      title: `【qiyi】 ${title}第${index + 1}集`
    }));
    const pollutedLinks = Array.from({ length: 42 }, (_, index) => ({
      url: `https://stale.example.com/${index + 1}`,
      title: index === 41 ? `【qiyi】 ${title}第45集 金陵落日` : `【qiyi】 ${title}第${index + 1}集`
    }));
    const searchResults = [{
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 42,
      rating: 0,
      isFavorited: false,
      source
    }];

    const detailStore = new Map();
    addAnime({ ...baseAnime, links: freshLinks }, detailStore);
    setSearchCache(title, searchResults, detailStore);

    // 模拟全局运行时详情被后续请求污染：同一 anime/source，但第 42 个槽位标题已经错到第 45 集。
    addAnime({ ...baseAnime, links: pollutedLinks });

    const req = new MockRequest(urlPrefix + '/api/v2/match', {
      method: 'POST',
      body: {
        fileName: `${title} S01E42`,
        fileHash: 'hash',
        fileSize: 0,
        videoDuration: 0,
        matchMode: 'fileNameOnly'
      }
    });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, true);
    assert.equal(body.matches.length, 1);
    assert.equal(body.matches[0].animeId, animeId);
    assert.equal(body.matches[0].episodeTitle, `【qiyi】 ${title}第42集`);
  });

  await t.test('POST /api/v2/match fast path should keep remembered season offset while ignoring polluted runtime cache', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.logBuffer = [];
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '太平年';
    const animeId = 5201;
    const bangumiId = 'tpn-5201';
    const source = 'iqiyi';
    const baseAnime = {
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 10,
      rating: 0,
      isFavorited: false,
      source
    };
    const freshLinks = Array.from({ length: 10 }, (_, index) => ({
      url: `https://fast-fresh.example.com/${index + 1}`,
      title: `【qiyi】 ${title}第${index + 1}集`
    }));
    const pollutedLinks = Array.from({ length: 10 }, (_, index) => ({
      url: `https://fast-stale.example.com/${index + 1}`,
      title: index === 4 ? `【qiyi】 ${title}第8集 错乱` : `【qiyi】 ${title}第${index + 1}集`
    }));
    const searchResults = [{
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 10,
      rating: 0,
      isFavorited: false,
      source
    }];

    const detailStore = new Map();
    addAnime({ ...baseAnime, links: freshLinks }, detailStore);
    setSearchCache(title, searchResults, detailStore);

    // 污染全局运行时详情；如果 fast path 继续吃全局缓存，这里会把偏移后的目标集带偏。
    addAnime({ ...baseAnime, links: pollutedLinks });

    Globals.lastSelectMap.set(title, {
      animeIds: [animeId],
      preferBySeason: { '1': animeId },
      sourceBySeason: { '1': source },
      offsets: { '1': `1:【qiyi】 ${title}第4集` }
    });

    const req = new MockRequest(urlPrefix + '/api/v2/match', {
      method: 'POST',
      body: {
        fileName: `${title} S01E2`,
        fileHash: 'hash',
        fileSize: 0,
        videoDuration: 0,
        matchMode: 'fileNameOnly'
      }
    });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, true);
    assert.equal(body.matches.length, 1);
    assert.equal(body.matches[0].animeId, animeId);
    assert.equal(body.matches[0].episodeTitle, `【qiyi】 ${title}第5集`);
    assert.ok(
      Globals.logBuffer.some(entry => entry.message.includes('[FastMatch] 使用偏好缓存命中')),
      'Expected fast match path to be used'
    );
  });

  await t.test('POST /api/v2/match should prefer offset array index over misleading episode title numbers in fast path', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.logBuffer = [];
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '偏移优先测试';
    const animeId = 5202;
    const bangumiId = 'offset-priority-5202';
    const source = 'iqiyi';
    const baseAnime = {
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 10,
      rating: 0,
      isFavorited: false,
      source
    };
    const links = [
      { url: 'https://offset-priority.example.com/1', title: `【qiyi】 ${title}第1集` },
      { url: 'https://offset-priority.example.com/2', title: `【qiyi】 ${title}第2集` },
      { url: 'https://offset-priority.example.com/3', title: `【qiyi】 ${title}第3集` },
      { url: 'https://offset-priority.example.com/4', title: `【qiyi】 ${title}第4集` },
      { url: 'https://offset-priority.example.com/5', title: `【qiyi】 ${title}第9集 错位` },
      { url: 'https://offset-priority.example.com/6', title: `【qiyi】 ${title}第5集` },
      { url: 'https://offset-priority.example.com/7', title: `【qiyi】 ${title}第6集` }
    ];
    const searchResults = [{
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: links.length,
      rating: 0,
      isFavorited: false,
      source
    }];

    const detailStore = new Map();
    addAnime({ ...baseAnime, links }, detailStore);
    setSearchCache(title, searchResults, detailStore);

    Globals.lastSelectMap.set(title, {
      animeIds: [animeId],
      preferBySeason: { '1': animeId },
      sourceBySeason: { '1': source },
      offsets: { '1': `1:【qiyi】 ${title}第4集` }
    });

    const req = new MockRequest(urlPrefix + '/api/v2/match', {
      method: 'POST',
      body: {
        fileName: `${title} S01E2`,
        fileHash: 'hash-offset-priority',
        fileSize: 0,
        videoDuration: 0,
        matchMode: 'fileNameOnly'
      }
    });
    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, true);
    assert.equal(body.matches.length, 1);
    assert.equal(body.matches[0].animeId, animeId);
    assert.equal(body.matches[0].episodeTitle, `【qiyi】 ${title}第9集 错位`);
  });

  await t.test('POST /api/v2/match?debug=1 should preserve legacy response and append first-version debug payload', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.logBuffer = [];
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '调试版太平年';
    const animeId = 6201;
    const bangumiId = 'debug-6201';
    const source = 'iqiyi';
    const baseAnime = {
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 3,
      rating: 0,
      isFavorited: false,
      source
    };
    const links = Array.from({ length: 3 }, (_, index) => ({
      url: `https://debug-match.example.com/${index + 1}`,
      title: `【qiyi】 ${title}第${index + 1}集`
    }));
    const detailStore = new Map();
    addAnime({ ...baseAnime, links }, detailStore);
    setSearchCache(title, [{
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 3,
      rating: 0,
      isFavorited: false,
      source
    }], detailStore);

    const req = new MockRequest(urlPrefix + '/api/v2/match?debug=1', {
      method: 'POST',
      body: {
        fileName: `${title} S01E2`,
        matchMode: 'fileNameOnly'
      }
    });

    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, true);
    assert.equal(body.matches.length, 1);
    assert.equal(body.matches[0].animeId, animeId);
    assert.ok(body.debug, 'Expected debug payload when debug=1');
    assert.equal(body.debug.version, 1);
    assert.equal(body.debug.input.fileName, `${title} S01E2`);
    assert.equal(body.debug.input.preferredPlatform, '');
    assert.equal(body.debug.normalized.title, title);
    assert.equal(body.debug.normalized.season, 1);
    assert.equal(body.debug.normalized.episode, 2);
    assert.equal(body.debug.search.candidateCount, 1);
    assert.equal(body.debug.final.matched, true);
  });

  await t.test('POST /api/v2/match?debug=1 should expose first-version failure reason when search has no candidates', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.logBuffer = [];
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '完全搜不到的调试片';
    setSearchCache(title, [], new Map());

    const req = new MockRequest(urlPrefix + '/api/v2/match?debug=1', {
      method: 'POST',
      body: {
        fileName: `${title} S01E1`,
        matchMode: 'fileNameOnly'
      }
    });

    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, false);
    assert.deepEqual(body.matches, []);
    assert.ok(body.debug, 'Expected debug payload when debug=1');
  assert.equal(body.debug.search.candidateCount, 0);
  assert.equal(body.debug.final.matched, false);
  assert.equal(body.debug.final.reasonCode, 'search_empty');
  });

  await t.test('POST /api/v2/match?debug=1 should record candidate rejection reason when year mismatches', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.logBuffer = [];
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '年份冲突测试';
    const animeId = 6301;
    const bangumiId = 'debug-year-6301';
    const source = 'iqiyi';
    const detailStore = new Map();
    addAnime({
      animeId,
      bangumiId,
      animeTitle: `${title}(2023)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2023-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source,
      links: [{ url: 'https://debug-year.example.com/1', title: `【qiyi】 ${title}第1集` }]
    }, detailStore);
    setSearchCache(title, [{
      animeId,
      bangumiId,
      animeTitle: `${title}(2023)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2023-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source
    }], detailStore);

    const req = new MockRequest(urlPrefix + '/api/v2/match?debug=1', {
      method: 'POST',
      body: {
        fileName: `${title}.2024.S01E1`,
        matchMode: 'fileNameOnly'
      }
    });

    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, false);
    assert.ok(Array.isArray(body.debug.attempts));
    assert.ok(body.debug.attempts.length > 0, 'Expected detailed attempts in second version');
    assert.equal(body.debug.attempts[0].candidates[0].reasonCode, 'year_miss');
    assert.equal(body.debug.final.reasonCode, 'year_miss');
  });

  await t.test('POST /api/v2/match?debug=1 should record episode_not_found when anime matches but target episode is missing', async () => {
    Globals.init({});
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();
    Globals.lastSelectMap = new Map();
    Globals.logBuffer = [];
    Globals.envs.rateLimitMaxRequests = 0;

    const title = '缺集测试';
    const animeId = 6401;
    const bangumiId = 'debug-episode-6401';
    const source = 'iqiyi';
    const detailStore = new Map();
    addAnime({
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 2,
      rating: 0,
      isFavorited: false,
      source,
      links: [
        { url: 'https://debug-episode.example.com/1', title: `【qiyi】 ${title}第1集` },
        { url: 'https://debug-episode.example.com/2', title: `【qiyi】 ${title}第2集` }
      ]
    }, detailStore);
    setSearchCache(title, [{
      animeId,
      bangumiId,
      animeTitle: `${title}(2024)`,
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 2,
      rating: 0,
      isFavorited: false,
      source
    }], detailStore);

    const req = new MockRequest(urlPrefix + '/api/v2/match?debug=1', {
      method: 'POST',
      body: {
        fileName: `${title} S01E9`,
        matchMode: 'fileNameOnly'
      }
    });

    const res = await handleRequest(req);
    const body = await parseResponse(res);

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.isMatched, false);
    assert.ok(Array.isArray(body.debug.attempts));
    assert.ok(body.debug.attempts.length > 0, 'Expected detailed attempts in second version');
    assert.equal(body.debug.attempts[0].candidates[0].reasonCode, 'episode_not_found');
    assert.equal(body.debug.final.reasonCode, 'episode_not_found');
  });

  await t.test('applyMergeLogic should merge multi-secondary matches without ReferenceError', async () => {
    Globals.init({ MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku' });
    Globals.MAX_ANIMES = 100;
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();

    addAnime({
      animeId: 201,
      bangumiId: 'merge-201',
      animeTitle: '完美世界(2024)【动漫】from tencent',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'tencent',
      links: [{ id: 61001, url: 'https://example.com/tencent-1', title: '【qq】第1集' }]
    });
    addAnime({
      animeId: 202,
      bangumiId: 'merge-202',
      animeTitle: '完美世界(2024)【动漫】from iqiyi',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'iqiyi',
      links: [{ id: 61002, url: 'https://example.com/iqiyi-1', title: '【qiyi】第1集' }]
    });
    addAnime({
      animeId: 203,
      bangumiId: 'merge-203',
      animeTitle: '完美世界(2024)【动漫】from youku',
      type: 'tvseries',
      typeDescription: 'TV',
      imageUrl: '',
      startDate: '2024-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'youku',
      links: [{ id: 61003, url: 'https://example.com/youku-1', title: '【youku】第1集' }]
    });

    const curAnimes = globals.animes.map(anime => ({
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      animeTitle: anime.animeTitle,
      type: anime.type,
      typeDescription: anime.typeDescription,
      imageUrl: anime.imageUrl,
      startDate: anime.startDate,
      episodeCount: anime.episodeCount,
      rating: anime.rating,
      isFavorited: anime.isFavorited,
      source: anime.source,
      links: anime.links.map(link => ({ ...link }))
    }));

    await assert.doesNotReject(async () => {
      await applyMergeLogic(curAnimes);
    });

    assert.equal(curAnimes.length, 1);
    const [mergedAnime] = curAnimes;
    assert.ok(mergedAnime, 'Expected merged anime to be retained as the only result');
    assert.equal(mergedAnime.source, 'tencent');
    assert.ok(mergedAnime.animeTitle.includes('from tencent&iqiyi&youku'));
    assert.equal(mergedAnime.links.length, 1);
    assert.ok(mergedAnime.links[0].url.includes(`tencent:https://example.com/tencent-1${MERGE_DELIMITER}iqiyi:https://example.com/iqiyi-1`));
    assert.ok(mergedAnime.links[0].url.includes(`${MERGE_DELIMITER}youku:https://example.com/youku-1`));
  });

  await t.test('findSecondaryMatches should reject Detective Dee spinoff titles with different strict bases', async () => {
    const createAnime = (animeId, source, animeTitle, year = '2024-01-01T00:00:00.000Z') => ({
      animeId,
      source,
      animeTitle,
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: year,
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      links: [{ id: animeId * 100, url: `https://example.com/${animeId}`, title: '【mock】 第1集' }]
    });

    const primary = createAnime(701, 'iqiyi', '少年神探狄仁杰(N/A)【电视剧】from iqiyi', null);
    const secondaries = [
      createAnime(702, 'youku', '神探狄仁杰 第一部(2004)【电视剧】from youku', '2004-01-01T00:00:00.000Z'),
      createAnime(703, 'youku', '神探狄仁杰 第二部(2006)【电视剧】from youku', '2006-01-01T00:00:00.000Z'),
      createAnime(704, 'youku', '神探狄仁杰 第三部(2008)【电视剧】from youku', '2008-01-01T00:00:00.000Z')
    ];

    const matches = findSecondaryMatches(primary, secondaries);
    assert.deepEqual(matches.map(item => item.animeTitle), []);
  });

  await t.test('findSecondaryMatches should treat 第2部 and 第二部 as the same season marker', async () => {
    const createAnime = (animeId, source, animeTitle) => ({
      animeId,
      source,
      animeTitle,
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2006-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      links: [{ id: animeId * 100, url: `https://example.com/${animeId}`, title: '【mock】 第1集' }]
    });

    const primary = createAnime(705, 'youku', '神探狄仁杰 第2部(2006)【电视剧】from youku');
    const secondaries = [
      createAnime(706, 'iqiyi', '神探狄仁杰 第二部(2006)【电视剧】from iqiyi')
    ];

    const matches = findSecondaryMatches(primary, secondaries);
    assert.deepEqual(matches.map(item => item.animeTitle), ['神探狄仁杰 第二部(2006)【电视剧】from iqiyi']);
  });

  await t.test('findSecondaryMatches should treat 第3部 and 第三部 as the same season marker', async () => {
    const createAnime = (animeId, source, animeTitle) => ({
      animeId,
      source,
      animeTitle,
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2008-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      links: [{ id: animeId * 100, url: `https://example.com/${animeId}`, title: '【mock】 第1集' }]
    });

    const primary = createAnime(707, 'youku', '神探狄仁杰 第3部(2008)【电视剧】from youku');
    const secondaries = [
      createAnime(708, 'iqiyi', '神探狄仁杰 第三部(2008)【电视剧】from iqiyi')
    ];

    const matches = findSecondaryMatches(primary, secondaries);
    assert.deepEqual(matches.map(item => item.animeTitle), ['神探狄仁杰 第三部(2008)【电视剧】from iqiyi']);
  });

  await t.test('applyMergeLogic should not merge 少年神探狄仁杰 into numbered 神探狄仁杰 parts when only core words overlap', async () => {
    Globals.init({ MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku' });
    Globals.MAX_ANIMES = 100;
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();

    addAnime({
      animeId: 711,
      bangumiId: 'merge-711',
      animeTitle: '少年神探狄仁杰(N/A)【电视剧】from iqiyi',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: 'N/A',
      episodeCount: 36,
      rating: 0,
      isFavorited: false,
      source: 'iqiyi',
      links: Array.from({ length: 36 }, (_, i) => ({
        id: 71101 + i,
        url: `https://example.com/shaonian-${i + 1}`,
        title: `【qiyi】 少年神探狄仁杰第${i + 1}集`
      }))
    });
    addAnime({
      animeId: 712,
      bangumiId: 'merge-712',
      animeTitle: '神探狄仁杰 第一部(2004)【电视剧】from youku',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2004-01-01T00:00:00.000Z',
      episodeCount: 27,
      rating: 0,
      isFavorited: false,
      source: 'youku',
      links: Array.from({ length: 27 }, (_, i) => ({
        id: 71201 + i,
        url: `https://example.com/part1-${i + 1}`,
        title: `【youku】 第${i + 1}集 神探狄仁杰 第一部 ${String(i + 1).padStart(2, '0')}`
      }))
    });
    addAnime({
      animeId: 713,
      bangumiId: 'merge-713',
      animeTitle: '神探狄仁杰 第二部(2006)【电视剧】from youku',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2006-01-01T00:00:00.000Z',
      episodeCount: 40,
      rating: 0,
      isFavorited: false,
      source: 'youku',
      links: Array.from({ length: 40 }, (_, i) => ({
        id: 71301 + i,
        url: `https://example.com/part2-${i + 1}`,
        title: `【youku】 第${i + 1}集 神探狄仁杰 第二部 ${String(i + 1).padStart(2, '0')}`
      }))
    });
    addAnime({
      animeId: 714,
      bangumiId: 'merge-714',
      animeTitle: '神探狄仁杰 第三部(2008)【电视剧】from youku',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2008-01-01T00:00:00.000Z',
      episodeCount: 48,
      rating: 0,
      isFavorited: false,
      source: 'youku',
      links: Array.from({ length: 48 }, (_, i) => ({
        id: 71401 + i,
        url: `https://example.com/part3-${i + 1}`,
        title: `【youku】 第${i + 1}集 神探狄仁杰 第三部 ${String(i + 1).padStart(2, '0')}`
      }))
    });

    const curAnimes = globals.animes.map(anime => ({
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      animeTitle: anime.animeTitle,
      type: anime.type,
      typeDescription: anime.typeDescription,
      imageUrl: anime.imageUrl,
      startDate: anime.startDate,
      episodeCount: anime.episodeCount,
      rating: anime.rating,
      isFavorited: anime.isFavorited,
      source: anime.source,
      links: anime.links.map(link => ({ ...link }))
    }));

    await applyMergeLogic(curAnimes);

    assert.equal(curAnimes.length, 4);
    assert.equal(curAnimes.some(anime => anime.animeTitle.includes('from iqiyi&youku')), false);
    assert.deepEqual(
      curAnimes.map(anime => anime.animeTitle).sort(),
      [
        '少年神探狄仁杰(N/A)【电视剧】from iqiyi',
        '神探狄仁杰 第一部(2004)【电视剧】from youku',
        '神探狄仁杰 第二部(2006)【电视剧】from youku',
        '神探狄仁杰 第三部(2008)【电视剧】from youku'
      ].sort()
    );
  });

  await t.test('applyMergeLogic should treat 中文第X部 markers as different seasons instead of merging them together', async () => {
    Globals.init({ MERGE_SOURCE_PAIRS: 'iqiyi&youku' });
    Globals.MAX_ANIMES = 100;
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();

    addAnime({
      animeId: 715,
      bangumiId: 'merge-715',
      animeTitle: '神探狄仁杰 第一部(2004)【电视剧】from iqiyi',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2004-01-01T00:00:00.000Z',
      episodeCount: 2,
      rating: 0,
      isFavorited: false,
      source: 'iqiyi',
      links: [
        { id: 71501, url: 'https://example.com/cn-part-1-1', title: '【qiyi】 神探狄仁杰 第一部 第1集' },
        { id: 71502, url: 'https://example.com/cn-part-1-2', title: '【qiyi】 神探狄仁杰 第一部 第2集' }
      ]
    });
    addAnime({
      animeId: 716,
      bangumiId: 'merge-716',
      animeTitle: '神探狄仁杰 第二部(2006)【电视剧】from youku',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2006-01-01T00:00:00.000Z',
      episodeCount: 2,
      rating: 0,
      isFavorited: false,
      source: 'youku',
      links: [
        { id: 71601, url: 'https://example.com/cn-part-2-1', title: '【youku】 神探狄仁杰 第二部 第1集' },
        { id: 71602, url: 'https://example.com/cn-part-2-2', title: '【youku】 神探狄仁杰 第二部 第2集' }
      ]
    });

    const curAnimes = globals.animes.map(anime => ({
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      animeTitle: anime.animeTitle,
      type: anime.type,
      typeDescription: anime.typeDescription,
      imageUrl: anime.imageUrl,
      startDate: anime.startDate,
      episodeCount: anime.episodeCount,
      rating: anime.rating,
      isFavorited: anime.isFavorited,
      source: anime.source,
      links: anime.links.map(link => ({ ...link }))
    }));

    await applyMergeLogic(curAnimes);

    assert.equal(curAnimes.length, 2);
    assert.equal(curAnimes.some(anime => anime.animeTitle.includes('from iqiyi&youku')), false);
  });

  await t.test('applyMergeLogic should preserve hanjutv tv variant when multi-source aggregation rewrites merged urls', async () => {
    Globals.init({ MERGE_SOURCE_PAIRS: 'renren&hanjutv&aiyifan' });
    Globals.MAX_ANIMES = 100;
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();

    addAnime({
      animeId: 301,
      bangumiId: 'merge-301',
      animeTitle: '爱情怎么翻译？(2026)【电视剧】from renren',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2026-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'renren',
      links: [{ id: 62001, url: '55176-377624', title: '【renren】 第01集' }]
    });
    addAnime({
      animeId: 302,
      bangumiId: 'merge-302',
      animeTitle: '爱情怎么翻译?(2026)【韩剧】from hanjutv',
      type: 'tvseries',
      typeDescription: '韩剧',
      imageUrl: '',
      startDate: '2026-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'hanjutv',
      links: [{ id: 62002, url: 'hanjutv:hxq:pid-1$$$hanjutv:tv:eid-1', title: '【hanjutv】 第1集：帮帮我，Papago先生' }]
    });
    addAnime({
      animeId: 303,
      bangumiId: 'merge-303',
      animeTitle: '爱情怎么翻译(2026)【电视剧】from aiyifan',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2026-01-01T00:00:00.000Z',
      episodeCount: 1,
      rating: 0,
      isFavorited: false,
      source: 'aiyifan',
      links: [{ id: 62003, url: 'https://www.yfsp.tv/play/oQBP0ycKY24?id=1whgqbhXdn6', title: '【aiyifan】 01' }]
    });

    const curAnimes = globals.animes.map(anime => ({
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      animeTitle: anime.animeTitle,
      type: anime.type,
      typeDescription: anime.typeDescription,
      imageUrl: anime.imageUrl,
      startDate: anime.startDate,
      episodeCount: anime.episodeCount,
      rating: anime.rating,
      isFavorited: anime.isFavorited,
      source: anime.source,
      links: anime.links.map(link => ({ ...link }))
    }));

    await assert.doesNotReject(async () => {
      await applyMergeLogic(curAnimes);
    });

    assert.equal(curAnimes.length, 1);
    const [mergedAnime] = curAnimes;
    assert.ok(mergedAnime, 'Expected merged anime to be retained as the only result');
    assert.equal(mergedAnime.source, 'renren');
    assert.ok(mergedAnime.animeTitle.includes('from renren&hanjutv&aiyifan'));
    assert.equal(mergedAnime.links.length, 1);
    assert.equal(
      mergedAnime.links[0].url,
      `renren:55176-377624${MERGE_DELIMITER}hanjutv:hxq:pid-1${MERGE_DELIMITER}hanjutv:tv:eid-1${MERGE_DELIMITER}aiyifan:https://www.yfsp.tv/play/oQBP0ycKY24?id=1whgqbhXdn6`
    );
  });

  await t.test('applyMergeLogic should normalize segmented aiyifan episode labels before offset matching', async () => {
    Globals.init({ MERGE_SOURCE_PAIRS: 'renren&aiyifan' });
    Globals.MAX_ANIMES = 100;
    Globals.animes = [];
    Globals.episodeIds = [];
    Globals.episodeNum = 10001;
    Globals.searchCache = new Map();
    Globals.commentCache = new Map();
    Globals.animeDetailsCache = new Map();
    Globals.episodeDetailsCache = new Map();
    Globals.requestHistory = new Map();

    addAnime({
      animeId: 401,
      bangumiId: 'merge-401',
      animeTitle: '春夜(2019)【电视剧】from renren',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2019-01-01T00:00:00.000Z',
      episodeCount: 16,
      rating: 0,
      isFavorited: false,
      source: 'renren',
      links: Array.from({ length: 16 }, (_, i) => ({
        id: 63001 + i,
        url: `renren-${i + 1}`,
        title: `【renren】 第${String(i + 1).padStart(2, '0')}集`
      }))
    });
    addAnime({
      animeId: 402,
      bangumiId: 'merge-402',
      animeTitle: '春夜(2019)【电视剧】from aiyifan',
      type: 'tvseries',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2019-01-01T00:00:00.000Z',
      episodeCount: 16,
      rating: 0,
      isFavorited: false,
      source: 'aiyifan',
      links: Array.from({ length: 16 }, (_, i) => ({
        id: 64001 + i,
        url: `aiyifan-${i + 1}`,
        title: `【aiyifan】 ${String((i * 2) + 1).padStart(2, '0')}-${String((i * 2) + 2).padStart(2, '0')}`
      }))
    });

    const curAnimes = globals.animes.map(anime => ({
      animeId: anime.animeId,
      bangumiId: anime.bangumiId,
      animeTitle: anime.animeTitle,
      type: anime.type,
      typeDescription: anime.typeDescription,
      imageUrl: anime.imageUrl,
      startDate: anime.startDate,
      episodeCount: anime.episodeCount,
      rating: anime.rating,
      isFavorited: anime.isFavorited,
      source: anime.source,
      links: anime.links.map(link => ({ ...link }))
    }));

    await assert.doesNotReject(async () => {
      await applyMergeLogic(curAnimes);
    });

    assert.equal(curAnimes.length, 1);
    const [mergedAnime] = curAnimes;
    assert.ok(mergedAnime, 'Expected merged anime to be retained as the only result');
    assert.equal(mergedAnime.source, 'renren');
    assert.ok(mergedAnime.animeTitle.includes('from renren&aiyifan'));
    assert.equal(mergedAnime.links.length, 16);
    assert.equal(
      mergedAnime.links.filter(link => String(link.url).includes(MERGE_DELIMITER)).length,
      16
    );
    assert.equal(
      mergedAnime.links[0].url,
      `renren:renren-1${MERGE_DELIMITER}aiyifan:aiyifan-1`
    );
    assert.equal(
      mergedAnime.links[15].url,
      `renren:renren-16${MERGE_DELIMITER}aiyifan:aiyifan-16`
    );
  });

  // await t.test('Test ai cilent', async () => {
  //   const ai = new AIClient({
  //     apiKey: 'xxxxxxxxxxxxxxxxxxxxx',
  //     baseURL: 'https://open.bigmodel.cn/api/paas/v4', // 换成任意兼容 OpenAI 协议的地址
  //     model: 'GLM-4.7-FlashX',
  //     systemPrompt: '回答尽量简洁',
  //   })

  //   // const answer = await ai.ask('你好')
  //   // console.log(answer);

  //   const status = await ai.verify()
  //   if (status.ok) {
  //     console.log('连接正常:', status)
  //   } else {
  //     console.log('连接失败:', status.error)
  //   }
  // });

  // await t.test('GET tencent danmu', async () => {
  //   const res = await tencentSource.getComments("http://v.qq.com/x/cover/rjae621myqca41h/j0032ubhl9s.html", "qq");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET tencent danmu segments', async () => {
  //   const res = await tencentSource.getComments("http://v.qq.com/x/cover/rjae621myqca41h/j0032ubhl9s.html", "qq", true);
  //   assert(res.type === "qq", `Expected res.type === "qq", but got ${res.type === "qq"}`);
  //   assert(res.segmentList.length > 2, `Expected res.segmentList.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET tencent segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "qq",
  //     "segment_start": 0,
  //     "segment_end": 60,
  //     "url": "https://dm.video.qq.com/barrage/segment/j0032ubhl9s/t/v1/30000/60000"
  //   });
  //   const res = await tencentSource.getSegmentComments(segment);
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET iqiyi danmu', async () => {
  //   const res = await iqiyiSource.getComments("https://www.iqiyi.com/v_1ftv9n1m3bg.html", "qiyi");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET iqiyi danmu segments', async () => {
  //   const res = await iqiyiSource.getComments("https://www.iqiyi.com/v_1ftv9n1m3bg.html", "qiyi", true);
  //   assert(res.type === "qiyi", `Expected res.type === "qiyi", but got ${res.type === "qiyi"}`);
  //   assert(res.segmentList.length > 2, `Expected res.segmentList.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET iqiyi segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "qiyi",
  //     "segment_start": 0,
  //     "segment_end": 60,
  //     "url": "https://cmts.iqiyi.com/bullet/80/00/5284367795028000_300_4.z?rn=0.0123456789123456&business=danmu&is_iqiyi=true&is_video_page=true&tvid=5284367795028000&albumid=2524115110632101&categoryid=2&qypid=010102101000000000"
  //   });
  //   const res = await iqiyiSource.getSegmentComments(segment);
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET mango danmu', async () => {
  //   const res = await mangoSource.getComments("https://www.mgtv.com/b/771610/23300622.html", "imgo");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET mango danmu segments', async () => {
  //   const res = await mangoSource.getComments("https://www.mgtv.com/b/771610/23300622.html", "imgo", true);
  //   assert(res.type === "imgo", `Expected res.type === "imgo", but got ${res.type}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET mango segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "imgo",
  //     "segment_start": 0,
  //     "segment_end": 60,
  //     "url": "https://bullet-ali.hitv.com/bullet/tx/2025/12/14/011640/23300622/23.json"
  //   });
  //   const res = await mangoSource.getSegmentComments(segment);
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET bilibili danmu', async () => {
  //   const res = await bilibiliSource.getComments("https://www.bilibili.com/bangumi/play/ep1231564", "bilibili1");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET bilibili danmu segments', async () => {
  //   const res = await bilibiliSource.getComments("https://www.bilibili.com/bangumi/play/ep1231564", "bilibili1", true);
  //   assert(res.type === "bilibili1", `Expected res.type === "bilibili1", but got ${res.type}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET bilibili segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "bilibili1",
  //     "segment_start": 0,
  //     "segment_end": 60,
  //     "url": "https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=32131450212&segment_index=2"
  //   });
  //   const res = await bilibiliSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET youku danmu', async () => {
  //   const res = await youkuSource.getComments("https://v.youku.com/v_show/id_XNjQ3ODMyNjU3Mg==.html");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET youku danmu segments', async () => {
  //   const res = await youkuSource.getComments("https://v.youku.com/v_show/id_XNjQ3ODMyNjU3Mg==.html", "youku", true);
  //   assert(res.type === "youku", `Expected res.type === "youku", but got ${res.type === "youku"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET youku segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "youku",
  //     "segment_start": 0,
  //     "segment_end": 60,
  //     "url": "https://acs.youku.com/h5/mopen.youku.danmu.list/1.0/?jsv=2.5.6&appKey=24679788&t=1765980205381&sign=355caad7d41ec0bf445cce48fce4d93e&api=mopen.youku.danmu.list&v=1.0&type=originaljson&dataType=jsonp&timeout=20000&jsonpIncPrefix=utility",
  //     "data": "{\"ctime\":1765980205380,\"ctype\":10004,\"cver\":\"v1.0\",\"guid\":\"JqbJIT/Q0XMCAXPAGpb9gBcg\",\"mat\":0,\"mcount\":1,\"pid\":0,\"sver\":\"3.1.0\",\"type\":1,\"vid\":\"XNjQ3ODMyNjU3Mg==\",\"msg\":\"eyJjdGltZSI6MTc2NTk4MDIwNTM4MCwiY3R5cGUiOjEwMDA0LCJjdmVyIjoidjEuMCIsImd1aWQiOiJKcWJKSVQvUTBYTUNBWFBBR3BiOWdCY2ciLCJtYXQiOjAsIm1jb3VudCI6MSwicGlkIjowLCJzdmVyIjoiMy4xLjAiLCJ0eXBlIjoxLCJ2aWQiOiJYTmpRM09ETXlOalUzTWc9PSJ9\",\"sign\":\"b94e1d2cf6dc1ffcf80845b0ea82b7ef\"}",
  //     "_m_h5_tk": "d12df59d06f2830de1c681e04285a895_1765985058907",
  //     "_m_h5_tk_enc": "082c6cbbad97b5b48b7798a51933bbfa"
  //   });
  //   const res = await youkuSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET migu danmu', async () => {
  //   const res = await miguSource.getComments("https://www.miguvideo.com/p/detail/725117610", "migu");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET migu danmu segments', async () => {
  //   const res = await miguSource.getComments("https://www.miguvideo.com/p/detail/725117610", "migu", true);
  //   console.log(res.segmentList);
  //   assert(res.type === "migu", `Expected res.type === "migu", but got ${res.type === "migu"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET migu segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     type: 'migu',
  //     segment_start: 0,
  //     segment_end: 300,
  //     url: 'https://webapi.miguvideo.com/gateway/live_barrage/videox/barrage/v2/list/760834922/760835542/0/30/020',
  //   });
  //   const res = await miguSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET sohu danmu', async () => {
  //   const res = await sohuSource.getComments("https://film.sohu.com/album/8345543.html");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET sohu danmu segments', async () => {
  //   const res = await sohuSource.getComments("https://film.sohu.com/album/8345543.html", "sohu", true);
  //   assert(res.type === "sohu", `Expected res.type === "sohu", but got ${res.type === "sohu"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET sohu segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     type: 'sohu',
  //     segment_start: 3000,
  //     segment_end: 3300,
  //     url: 'https://api.danmu.tv.sohu.com/dmh5/dmListAll?act=dmlist_v2&vid=2547437&aid=8345543&pct=2&time_begin=3000&time_end=3300&dct=1&request_from=h5_js',
  //   });
  //   const res = await sohuSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET leshi danmu', async () => {
  //   const res = await leshiSource.getComments("https://www.le.com/ptv/vplay/1578861.html");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET leshi danmu segments', async () => {
  //   const res = await leshiSource.getComments("https://www.le.com/ptv/vplay/1578861.html", "leshi", true);
  //   assert(res.type === "leshi", `Expected res.type === "leshi", but got ${res.type === "leshi"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET leshi segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     type: 'leshi',
  //     segment_start: 1800,
  //     segment_end: 2100,
  //     url: 'https://hd-my.le.com/danmu/list?vid=1578861&start=1800&end=2100&callback=vjs_1768494351290',
  //   });
  //   const res = await leshiSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET xigua danmu', async () => {
  //   const res = await xiguaSource.getComments("https://m.ixigua.com/video/6551333775337325060", "xigua");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET xigua danmu segments', async () => {
  //   const res = await xiguaSource.getComments("https://m.ixigua.com/video/6551333775341519368", "xigua", true);
  //   assert(res.type === "xigua", `Expected res.type === "xigua", but got ${res.type === "xigua"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET xigua segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     type: 'xigua',
  //     segment_start: 1200000,
  //     segment_end: 1500000,
  //     url: 'https://ib.snssdk.com/vapp/danmaku/list/v1/?item_id=6551333775341519368&start_time=1200000&end_time=1500000&format=json'
  //   });
  //   const res = await xiguaSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET maiduidui danmu', async () => {
  //   const res = await maiduiduiSource.getComments("https://www.mddcloud.com.cn/video/ff8080817410d5a5017490f5f4d311de.html?num=2&uuid=ff8080817410d5a5017490f5f4d311e0", "maiduidui");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET maiduidui danmu segments', async () => {
  //   const res = await maiduiduiSource.getComments("https://www.mddcloud.com.cn/video/ff8080817410d5a5017490f5f4d311de.html?num=2&uuid=ff8080817410d5a5017490f5f4d311e0", "maiduidui", true);
  //   console.log(res.segmentList);
  //   assert(res.type === "maiduidui", `Expected res.type === "maiduidui", but got ${res.type === "maiduidui"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET maiduidui segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     type: 'maiduidui',
  //     segment_start: 120,
  //     segment_end: 180,
  //     url: 'https://www.mddcloud.com.cn/video/ff8080817410d5a5017490f5f4d311de.html?num=2&uuid=ff8080817410d5a5017490f5f4d311e0'
  //   });
  //   const res = await maiduiduiSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET other_server danmu', async () => {
  //   const res = await otherSource.getComments("https://www.bilibili.com/bangumi/play/ep1231564");
  //   assert(res.length > 2, `Expected res.length > 2, but got ${res.length}`);
  // });

  // await t.test('GET hanjutv search', async () => {
  //   const res = await hanjutvSource.search("犯罪现场Zero");
  //   assert(res.length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET hanjutv detail', async () => {
  //   const res = await hanjutvSource.getDetail("Tc9lkfijFSDQ8SiUCB6T");
  //   // assert(res.length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET hanjutv episodes', async () => {
  //   const res = await hanjutvSource.getEpisodes("4EuRcD6T6y8XEQePtDsf");
  //   assert(res.length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET hanjutv danmu', async () => {
  //   const res = await hanjutvSource.getEpisodeDanmu("12tY0Ktjzu5TCBrfTolNO");
  //   assert(res.length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET hanjutv danmu segments', async () => {
  //   const res = await hanjutvSource.getComments("12tY0Ktjzu5TCBrfTolNO", "hanjutv", true);
  //   console.log(res);
  //   assert(res.type === "hanjutv", `Expected res.type === "hanjutv", but got ${res.type === "hanjutv"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET hanjutv segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "hanjutv",
  //     "segment_start": 0,
  //     "segment_end": 30000,
  //     "url": "12tY0Ktjzu5TCBrfTolNO"
  //   });
  //   const res = await hanjutvSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // await t.test('GET bahamut search', async () => {
  //   const res = await bahamutSource.search("胆大党");
  //   assert(res.length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET bahamut episodes', async () => {
  //   const res = await bahamutSource.getEpisodes("44243");
  //   assert(res.anime.episodes[0].length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET bahamut danmu', async () => {
  //   const res = await bahamutSource.getComments("44453");
  //   assert(res.length > 0, `Expected res.length > 0, but got ${res.length}`);
  // });

  // await t.test('GET bahamut danmu segments', async () => {
  //   const res = await bahamutSource.getComments("44453", "bahamut", true);
  //   console.log(res);
  //   assert(res.type === "bahamut", `Expected res.type === "bahamut", but got ${res.type === "bahamut"}`);
  //   assert(res.segmentList.length >= 0, `Expected res.segmentList.length >= 0, but got ${res.segmentList.length}`);
  // });

  // await t.test('GET bahamut segment danmu', async () => {
  //   const segment = Segment.fromJson({
  //     "type": "bahamut",
  //     "segment_start": 0,
  //     "segment_end": 30000,
  //     "url": "44453"
  //   });
  //   const res = await bahamutSource.getSegmentComments(segment);
  //   assert(res.length >= 0, `Expected res.length >= 0, but got ${res.length}`);
  // });

  // // 测试Animeko源
  // await t.test('Animeko Source Search', async () => {
  //   const source = new AnimekoSource();
  //   const result = await source.search("我们不可能成为恋人！绝对不行。 (※似乎可行？)");
  //   console.log(JSON.stringify(result, null, 2));
  //   assert(result.length > 0);
  //
  //   const curAnimes = []; 
  //   await source.handleAnimes(result, "我们不可能成为恋人！绝对不行。 (※似乎可行？)", curAnimes);
  //   assert(curAnimes.length > 0);
  //   
  //   const animeId = result[0].id;
  //   const episodes = await source.getEpisodes(animeId);
  //   
  //   if (episodes && episodes.length > 0) {
  //       const firstEp = episodes.find(e => e.type === 0) || episodes[0];
  //       const testId = firstEp.id;
  //       
  //       console.log(`Testing getSegmentComments with ID: ${testId}`);
  //       
  //       const segment = { 
  //           url: String(testId),
  //           type: 'animeko'
  //       };
  //       
  //       const danmu = await source.getSegmentComments(segment);
  //       
  //       console.log("Danmu count:", danmu ? danmu.length : 0);
  //       assert(Array.isArray(danmu));
  //       
  //       if (danmu.length > 0) {
  //           assert(danmu[0].p !== undefined);
  //           assert(danmu[0].m !== undefined);
  //       }
  //   }
  // });

  // await t.test('GET realistic danmu', async () => {
  //   // tencent
  //   // const keyword = "子夜归";
  //   // iqiyi
  //   // const keyword = "赴山海";
  //   // mango
  //   // const keyword = "锦月如歌";
  //   // bilibili
  //   // const keyword = "国王排名";
  //   // youku
  //   // const keyword = "黑白局";
  //   // renren
  //   // const keyword = "瑞克和莫蒂";
  //   // hanjutv
  //   // const keyword = "请回答1988";
  //   // bahamut
  //   const keyword = "胆大党";
  //
  //   const searchUrl = new URL(`${urlPrefix}/${token}/api/v2/search/anime?keyword=${keyword}`);
  //   const searchRes = await searchAnime(searchUrl);
  //   const searchData = await searchRes.json();
  //   assert(searchData.animes.length > 0, `Expected searchData.animes.length > 0, but got ${searchData.animes.length}`);
  //
  //   const bangumiUrl = new URL(`${urlPrefix}/${token}/api/v2/bangumi/${searchData.animes[0].animeId}`);
  //   const bangumiRes = await getBangumi(bangumiUrl.pathname);
  //   const bangumiData = await bangumiRes.json();
  //   assert(bangumiData.bangumi.episodes.length > 0, `Expected bangumiData.bangumi.episodes.length > 0, but got ${bangumiData.bangumi.episodes.length}`);
  //
  //   const commentUrl = new URL(`${urlPrefix}/${token}/api/v2/comment/${bangumiData.bangumi.episodes[0].episodeId}?withRelated=true&chConvert=1`);
  //   const commentRes = await getComment(commentUrl.pathname);
  //   const commentData = await commentRes.json();
  //   assert(commentData.count > 0, `Expected commentData.count > 0, but got ${commentData.count}`);
  // });

  // // 测试 POST /api/v2/match 接口
  // await t.test('POST /api/v2/match for matching anime', async () => {
  //   // 构造请求体
  //   const requestBody = {
  //     "fileName": "生万物 S01E28",
  //     "fileHash": "1234567890",
  //     "fileSize": 0,
  //     "videoDuration": 0,
  //     "matchMode": "fileNameOnly"
  //   };
  //
  //   // 模拟 POST 请求
  //   const matchUrl = `${urlPrefix}/${token}/api/v2/match`;  // 注意路径与 handleRequest 中匹配
  //   const req = new MockRequest(matchUrl, { method: 'POST', body: requestBody });
  //
  //   // 调用 handleRequest 来处理 POST 请求
  //   const res = await handleRequest(req);
  //
  //   // 解析响应
  //   const responseBody = await parseResponse(res);
  //   console.log(responseBody);
  //
  //   // 验证响应状态
  //   assert.equal(res.status, 200);
  //   assert.deepEqual(responseBody.success, true);
  // });

  // // 测试 GET /api/v2/search/episodes 接口
  // await t.test('GET /api/v2/search/episodes for search episodes', async () => {
  //   // 构造请求体
  //   const requestBody = {
  //     "fileName": "生万物 S01E28",
  //     "fileHash": "1234567890",
  //     "fileSize": 0,
  //     "videoDuration": 0,
  //     "matchMode": "fileNameOnly"
  //   };
  //
  //   const matchUrl = `${urlPrefix}/${token}/api/v2/search/episodes?anime=子夜归`;
  //   const req = new MockRequest(matchUrl, { method: 'GET' });
  //
  //   const res = await handleRequest(req);
  //
  //   // 解析响应
  //   const responseBody = await parseResponse(res);
  //   console.log(responseBody);
  //
  //   // 验证响应状态
  //   assert.equal(res.status, 200);
  //   assert.deepEqual(responseBody.success, true);
  // });

  // 测试upstash redis
  // await t.test('GET redis pingRedis', async () => {
  //   const res = await pingRedis();
  //   assert(res.result === "PONG", `Expected res.result === "PONG", but got ${res.result}`);
  // });
  //
  // await t.test('SET redis setRedisKey', async () => {
  //   const res = await setRedisKey('mykey', 'Hello World');
  //   assert(res.result === "OK", `Expected res.result === "OK", but got ${res.result}`);
  // });
  //
  // await t.test('GET redis getRedisKey', async () => {
  //   const res = await getRedisKey('mykey');
  //   assert(res.result.toString() === "\"Hello World\"", `Expected res.result === "\"Hello World\"", but got ${res.result}`);
  // });
  //
  // await t.test('SET redis setRedisKeyWithExpiry', async () => {
  //   const res = await setRedisKeyWithExpiry('expkey', 'Temporary Value', 10);
  //   assert(res.result === "OK", `Expected res.result === "OK", but got ${res.result}`);
  // });

  // // 测试imdb接口
  // await t.test('GET IMDB episodes', async () => {
  //   const res = await getImdbepisodes("tt2703720");
  //   assert(res.data.episodes.length > 10, `Expected res.data.episodes.length > 10, but got ${res.episodes.length}`);
  // });

  // // 测试tmdb接口
  // await t.test('GET TMDB titles', async () => {
  //   const res = await searchImdbTitles("卧虎藏龙");
  //   assert(res.data.total_results > 4, `Expected res.data.total_results > 4, but got ${res.total_results}`);
  // });

  // // 测试tmdb获取日语详情接口
  // await t.test('GET TMDB JP detail', async () => {
  //   const res = await getTmdbJpDetail("tv", 95396);
  //   assert(res.data.original_name === "Severance", `Expected res.data.Severance === "Severance", but got ${res.data.original_name}`);
  // });

  // // 测试douban获取titles
  // await t.test('GET DOUBAN titles', async () => {
  //   const res = await searchDoubanTitles("卧虎藏龙");
  //   assert(res.data.subjects.items.length > 3, `Expected res.data.subjects.items.length > 3, but got ${res.data.subjects.items.length}`);
  // });

  // // 测试douban获取detail
  // await t.test('GET DOUBAN detail', async () => {
  //   const res = await getDoubanDetail(36448279);
  //   assert(res.data.title === "罗小黑战记2", `Expected res.data.title === "罗小黑战记2", but got ${res.data.title}`);
  // });

  // // 测试douban从imdbId获取doubanInfo
  // await t.test('GET DOUBAN doubanInfo by imdbId', async () => {
  //   const res = await getDoubanInfoByImdbId("tt0071562");
  //   const doubanId = res.data?.id?.split("/")?.pop();
  //   assert(doubanId === "1299131", `Expected doubanId === 1299131, but got ${doubanId}`);
  // });

  // // 测试tmdb获取中文标题
  // await t.test('GET TMDB Chinese title', async () => {
  //   const res = await getTMDBChineseTitle("Blood River", 1, 4);
  //   assert(res === "暗河传", `Expected res === "暗河传", but got ${res}`);
  // });

  // // 测试获取全部环境变量
  // await t.test('Config getAllEnv', async () => {
  //   const handler = new NodeHandler();
  //   const res = handler.getAllEnv();
  //   assert(Number(res.DANMU_LIMIT) === 0, `Expected Number(res.DANMU_LIMIT) === 0, but got ${Number(res.DANMU_LIMIT)}`);
  // });

  // // 测试获取某个环境变量
  // await t.test('Config getEnv', async () => {
  //   const handler = new NodeHandler();
  //   const res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 0, `Expected Number(res) === 0, but got ${Number(res)}`);
  // });

  // // 测试Node设置环境变量
  // await t.test('Node Config setEnv', async () => {
  //   const handler = new NodeHandler();
  //   let res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 0, `Expected Number(res) === 0, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 1);
  //   res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 1, `Expected Number(res) === 1, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 0);
  // });
  //
  // // 测试Node添加和删除环境变量
  // await t.test('Node Config addEnv and del Env', async () => {
  //   const handler = new NodeHandler();
  //   await handler.addEnv("UPSTASH_REDIS_REST_TOKEN", "xxxx");
  //   let res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "xxxx", `Expected res === "xxxx", but got ${res}`);
  //   await handler.delEnv("UPSTASH_REDIS_REST_TOKEN");
  //   res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "", `Expected res === "", but got ${res}`);
  // });

  // // 测试Vercel设置环境变量
  // await t.test('Vercel Config setEnv', async () => {
  //   const handler = new VercelHandler();
  //   let res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 0, `Expected Number(res) === 0, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 1);
  //   res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 1, `Expected Number(res) === 1, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 0);
  // });
  //
  // // 测试Vercel添加和删除环境变量
  // await t.test('Vercel Config addEnv and del Env', async () => {
  //   const handler = new VercelHandler();
  //   await handler.addEnv("UPSTASH_REDIS_REST_TOKEN", "xxxx");
  //   let res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "xxxx", `Expected res === "xxxx", but got ${res}`);
  //   await handler.delEnv("UPSTASH_REDIS_REST_TOKEN");
  //   res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "", `Expected res === "", but got ${res}`);
  // });

  // // 测试Vercel项目变量是否生效
  // await t.test('Vercel Check Params', async () => {
  //   const handler = new VercelHandler();
  //   const res = await handler.checkParams("", "", "");
  //   assert(res, `Expected res is true, but got ${res}`);
  // });

  // // 测试Vercel触发部署
  // await t.test('Vercel deploy', async () => {
  //   const handler = new VercelHandler();
  //   const res = await handler.deploy();
  //   assert(res, `Expected res is true, but got ${res}`);
  // });

  // // 测试Netlify设置环境变量
  // await t.test('Netlify Config setEnv', async () => {
  //   const handler = new NetlifyHandler();
  //   let res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 0, `Expected Number(res) === 0, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 1);
  //   res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 1, `Expected Number(res) === 1, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 0);
  // });
  //
  // // 测试Netlify添加和删除环境变量
  // await t.test('Netlify Config addEnv and del Env', async () => {
  //   const handler = new NetlifyHandler();
  //   await handler.addEnv("UPSTASH_REDIS_REST_TOKEN", "xxxx");
  //   let res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "xxxx", `Expected res === "xxxx", but got ${res}`);
  //   await handler.delEnv("UPSTASH_REDIS_REST_TOKEN");
  //   res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "", `Expected res === "", but got ${res}`);
  // });

  // // 测试Netlify项目变量是否生效
  // await t.test('Netlify Check Params', async () => {
  //   const handler = new NetlifyHandler();
  //   const res = await handler.checkParams("", "", "");
  //   assert(res, `Expected res is true, but got ${res}`);
  // });

  // // 测试Netlify触发部署
  // await t.test('Netlify deploy', async () => {
  //   const handler = new NetlifyHandler();
  //   const res = await handler.deploy();
  //   assert(res, `Expected res is true, but got ${res}`);
  // });

  // // 测试Cloudflare设置环境变量
  // await t.test('Cloudflare Config setEnv', async () => {
  //   const handler = new CloudflareHandler();
  //   let res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 0, `Expected Number(res) === 0, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 1);
  //   res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 1, `Expected Number(res) === 1, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 0);
  // });

  // // 测试Cloudflare添加和删除环境变量
  // await t.test('Cloudflare Config addEnv and del Env', async () => {
  //   const handler = new CloudflareHandler();
  //   await handler.addEnv("UPSTASH_REDIS_REST_TOKEN", "xxxx");
  //   let res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "xxxx", `Expected res === "xxxx", but got ${res}`);
  //   await handler.delEnv("UPSTASH_REDIS_REST_TOKEN");
  //   res = handler.getEnv("UPSTASH_REDIS_REST_TOKEN");
  //   assert(res === "", `Expected res === "", but got ${res}`);
  // });

  // // 测试Cloudflare项目变量是否生效
  // await t.test('Cloudflare Check Params', async () => {
  //   const handler = new CloudflareHandler();
  //   const res = await handler.checkParams("", "", "");
  //   assert(res, `Expected res is true, but got ${res}`);
  // });

  // // 测试Edgeone设置环境变量
  // await t.test('Edgeone Config setEnv', async () => {
  //   const handler = new EdgeoneHandler();
  //   let res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 0, `Expected Number(res) === 0, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 1);
  //   res = handler.getEnv("DANMU_LIMIT");
  //   assert(Number(res) === 1, `Expected Number(res) === 1, but got ${Number(res)}`);
  //   await handler.setEnv("DANMU_LIMIT", 0);
  // });

  // // 测试Edgeone添加和删除环境变量
  // await t.test('Edgeone Config addEnv and del Env', async () => {
  //   const handler = new EdgeoneHandler();
  //   await handler.addEnv("PROXY_URL", "xxxx");
  //   let res = handler.getEnv("PROXY_URL");
  //   assert(res === "xxxx", `Expected res === "xxxx", but got ${res}`);
  //   await handler.delEnv("PROXY_URL");
  //   res = handler.getEnv("PROXY_URL");
  //   assert(res === "", `Expected res === "", but got ${res}`);
  // });

  // // 测试Edgeone项目变量是否生效
  // await t.test('Edgeone Check Params', async () => {
  //   const handler = new EdgeoneHandler();
  //   const res = await handler.checkParams("", "", "");
  //   assert(res, `Expected res is true, but got ${res}`);
  // });

  // // 测试Edgeone触发部署
  // await t.test('Edgeone deploy', async () => {
  //   const handler = new EdgeoneHandler();
  //   const res = await handler.deploy();
  //   assert(res, `Expected res is true, but got ${res}`);
  // });
});

// // 测试本地 Redis 功能
// test('local-redis functions', async (t) => {
//   // 测试设置和获取本地 Redis 键值
//   await t.test('setLocalRedisKey and getLocalRedisKey', async () => {
//     try {
//       const testKey = 'test_key_local_redis';
//       const testValue = 'Hello Local Redis';

//       // 设置键值
//       const setResult = await setLocalRedisKey(testKey, testValue);
//       // 验证设置结果
//       assert.ok(setResult.result === 'OK' || setResult.result === 'ERROR', 
//         `setLocalRedisKey returned valid result: ${JSON.stringify(setResult)}`);

//       // 获取键值
//       const getResult = await getLocalRedisKey(testKey);
//       // 验证获取结果（如果 Redis 不可用，可能返回 null）
//       if (getResult !== null) {
//         // 如果返回了结果，验证它是否是我们设置的值（可能是序列化的）
//         assert.ok(typeof getResult === 'string' || getResult === null, 
//           `getLocalRedisKey returned expected type: ${typeof getResult}`);
//       } else {
//         // 如果返回 null，也是可以接受的（表示 Redis 不可用）
//         assert.strictEqual(getResult, null, 'getLocalRedisKey returned null when Redis is not available');
//       }
//     } catch (error) {
//       assert.ok(true, `setLocalRedisKey/getLocalRedisKey handled error gracefully: ${error.message}`);
//     }
//   });

//   // 测试设置带过期时间的本地 Redis 键值
//   await t.test('setLocalRedisKeyWithExpiry', async () => {
//     try {
//       const testKey = 'test_expiry_key_local_redis';
//       const testValue = 'Temporary Value';
//       const expirySeconds = 2; // 2秒过期

//       const setResult = await setLocalRedisKeyWithExpiry(testKey, testValue, expirySeconds);
//       // 验证设置结果
//       assert.ok(setResult.result === 'OK' || setResult.result === 'ERROR', 
//         `setLocalRedisKeyWithExpiry returned valid result: ${JSON.stringify(setResult)}`);
//     } catch (error) {
//       assert.ok(true, `setLocalRedisKeyWithExpiry handled error gracefully: ${error.message}`);
//     }
//   });
// });
