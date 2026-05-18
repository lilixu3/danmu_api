import test from 'node:test';
import assert from 'node:assert';

import { Globals } from './configs/globals.js';
import { Envs } from './configs/envs.js';
import { apitestJsContent } from './ui/js/apitest.js';

test('DANMU_OFFSET UI config should expose quick timeline-offset editor metadata', () => {
  const config = Globals.init({});

  assert.equal(config.envVarConfig.DANMU_OFFSET.type, 'timeline-offset');
  assert.deepEqual(config.envVarConfig.DANMU_OFFSET.options, Envs.ALLOWED_SOURCES);
});

test('MATCH_PLATFORM_RULES config should parse valid platform order rules and ignore invalid values', () => {
  const config = Globals.init({
    MATCH_PLATFORM_RULES: 'A/S01->qq,bad,dandan&animeko;B->bad;C->qiyi;D->qiyi&;E->&qq;F->qiyi&&animeko'
  });

  assert.equal(config.envVarConfig.MATCH_PLATFORM_RULES.type, 'map');
  assert.deepEqual(config.matchPlatformRules, [
    { title: 'A', season: 1, platforms: ['qq', 'dandan&animeko'] },
    { title: 'C', season: null, platforms: ['qiyi'] }
  ]);
});

test('source detail concurrency should be configurable by environment variables', () => {
  const config = Globals.init({
    SOURCE_DETAIL_CONCURRENCY: '6',
    SOURCE_DETAIL_CONCURRENCY_BY_SOURCE: 'tencent:2,vod:3,bad,iqiyi:99,sohu:0,unknown:4'
  });

  assert.equal(config.sourceDetailConcurrency, 6);
  assert.deepEqual(config.sourceDetailConcurrencyBySource, {
    tencent: 2,
    vod: 3,
    iqiyi: 16
  });
  assert.equal(config.envVarConfig.SOURCE_DETAIL_CONCURRENCY.type, 'number');
  assert.equal(config.envVarConfig.SOURCE_DETAIL_CONCURRENCY_BY_SOURCE.type, 'text');
});

test('invalid source detail concurrency env values should fall back safely', () => {
  const config = Globals.init({
    SOURCE_DETAIL_CONCURRENCY: 'not-a-number',
    SOURCE_DETAIL_CONCURRENCY_BY_SOURCE: 'tencent:-1,vod:abc,iqiyi:0,youku:5'
  });

  assert.equal(config.sourceDetailConcurrency, 4);
  assert.deepEqual(config.sourceDetailConcurrencyBySource, { youku: 5 });
});

test('cache minutes UI config should allow 0 as disabled', () => {
  const config = Globals.init({});

  assert.equal(config.envVarConfig.SEARCH_CACHE_MINUTES.min, 0);
  assert.equal(config.envVarConfig.COMMENT_CACHE_MINUTES.min, 0);
});

test('CUSTOM_MERGE_RULES config should parse merge, route and block rules', () => {
  const config = Globals.init({
    CUSTOM_MERGE_RULES: '天气之子@bilibili -> 天气之子@dandan; 我推的孩子/S01@bahamut -> 我推的孩子/S03@dandan | E25~E35>E1~E11; A@iqiyi × B@tencent; bad@unknown -> B@tencent'
  });

  assert.equal(config.envVarConfig.CUSTOM_MERGE_RULES.type, 'text');
  assert.deepEqual(config.customMergeRules, [
    {
      action: 'merge',
      secondary: { title: '天气之子', season: null, source: 'bilibili' },
      primary: { title: '天气之子', season: null, source: 'dandan' },
      routes: [],
      hasRoutes: false
    },
    {
      action: 'merge',
      secondary: { title: '我推的孩子', season: 1, source: 'bahamut' },
      primary: { title: '我推的孩子', season: 3, source: 'dandan' },
      routes: [{ sec: { start: 25, end: 35 }, prim: { start: 1, end: 11 } }],
      hasRoutes: true
    },
    {
      action: 'block',
      secondary: { title: 'A', season: null, source: 'iqiyi' },
      primary: { title: 'B', season: null, source: 'tencent' },
      routes: [],
      hasRoutes: false
    }
  ]);
});

test('API test UI should expose a debug toggle for matchAnime', () => {
  assert.match(
    apitestJsContent,
    /matchAnime:\s*\{[\s\S]*?name:\s*'debug'[\s\S]*?label:\s*'调试模式'[\s\S]*?type:\s*'select'[\s\S]*?options:\s*\['1',\s*'0'\]/,
  );
});

test('API test UI should send matchAnime debug as query string instead of JSON body', () => {
  assert.match(
    apitestJsContent,
    /config\.method === 'POST' && apiKey === 'matchAnime'[\s\S]*queryParams\.debug = params\.debug[\s\S]*delete params\.debug/,
  );
});
