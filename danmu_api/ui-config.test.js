import test from 'node:test';
import assert from 'node:assert';

import { Globals } from './configs/globals.js';
import { Envs } from './configs/envs.js';
import { apitestJsContent } from './ui/js/apitest.js';
import { systemSettingsJsContent } from './ui/js/systemsettings.js';
import { HTML_TEMPLATE } from './ui/template.js';
import { convertToDanmakuJson } from './utils/danmu-util.js';

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

  assert.equal(config.envVarConfig.CUSTOM_MERGE_RULES.type, 'custom-merge-rules');
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

test('CUSTOM_MERGE_RULES system settings should expose a visual custom merge rules editor', () => {
  assert.match(systemSettingsJsContent, /custom-merge-rules-panel/);
  assert.match(systemSettingsJsContent, /function\s+renderCustomMergeRulesEditor/);
  assert.match(systemSettingsJsContent, /function\s+addCustomMergeRuleItem/);
  assert.match(systemSettingsJsContent, /function\s+collectCustomMergeRuleValue/);
  assert.match(systemSettingsJsContent, /副源剧名/);
  assert.match(systemSettingsJsContent, /主源剧名/);
  assert.match(systemSettingsJsContent, /集数路由/);
  assert.match(HTML_TEMPLATE, /<option value="custom-merge-rules">自定义合并规则<\/option>/);
});

test('system settings embedded script content should be valid JavaScript', () => {
  assert.doesNotThrow(() => new Function(systemSettingsJsContent));
});

function loadRecentDataHelper(helperName) {
  const start = systemSettingsJsContent.indexOf('function toJsStringLiteral');
  const end = systemSettingsJsContent.indexOf('function renderAnimeCachePanel');
  assert.ok(start >= 0 && end > start, 'recent data helper block should exist');
  const helperSource = systemSettingsJsContent.slice(start, end);
  return new Function(`${helperSource}; return ${helperName};`)();
}

function decodeHtmlAttr(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

test('recent anime cache action buttons should build safe inline handlers for quoted titles', () => {
  const buildAnimeCacheButtons = loadRecentDataHelper('buildAnimeCacheButtons');
  const html = buildAnimeCacheButtons(`A'B "<>&`, `qiyi'source`, 'CUSTOM_MERGE_RULES');
  const handlerAttrs = [...html.matchAll(/onclick="([^"]+)"/g)].map(match => decodeHtmlAttr(match[1]));

  assert.equal(handlerAttrs.length, 2);
  for (const handler of handlerAttrs) {
    assert.doesNotThrow(() => new Function('fillMergeEntity', handler));
  }
  assert.match(handlerAttrs[0], /fillMergeEntity\("sec", "A'B \\"<>&", "qiyi'source"\)/);
});

test('upstream COLOR_POOL env should stay available as a rich color-list compatibility variable', () => {
  const config = Globals.init({ COLOR_POOL: '16777215,16744319' });

  assert.equal(config.envVarConfig.COLOR_POOL.type, 'color-list');
  assert.equal(config.colorPool, '16777215,16744319');
});

test('CONVERT_COLOR=color should use upstream COLOR_POOL when provided', () => {
  Globals.init({
    CONVERT_COLOR: 'color',
    COLOR_POOL: '16744319',
    GROUP_MINUTE: '0',
    BLOCKED_WORDS: '',
  });

  const [converted] = convertToDanmakuJson([
    { timepoint: 1000, ct: 1, color: 16777215, content: 'hello' }
  ], 'dandan');

  assert.equal(converted.p.split(',')[2], '16744319');
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

test('system settings should expose recent anime cache panel for merge and offset helpers', () => {
  assert.match(systemSettingsJsContent, /fetchAndShowRecentData/);
  assert.match(systemSettingsJsContent, /\/api\/cache\/animes/);
  assert.match(systemSettingsJsContent, /recent-data-panel/);
  assert.match(systemSettingsJsContent, /renderAnimeCachePanel/);
  assert.match(systemSettingsJsContent, /fillMergeEntity/);
  assert.match(systemSettingsJsContent, /fillOffsetEntity/);
  assert.match(systemSettingsJsContent, /MERGE_SOURCE_PAIRS[\s\S]*?查看最近数据/);
});

test('AI API Key connection test should send current AI_BASE_URL and AI_MODEL values from the UI', () => {
  assert.match(systemSettingsJsContent, /function\s+getEnvVariableValue\(key\)/);
  assert.match(systemSettingsJsContent, /const\s+verifyPayload\s*=\s*\{\}/);
  assert.match(systemSettingsJsContent, /getEnvVariableValue\('AI_BASE_URL'\)/);
  assert.match(systemSettingsJsContent, /getEnvVariableValue\('AI_MODEL'\)/);
  assert.match(systemSettingsJsContent, /verifyPayload\.aiBaseUrl\s*=\s*currentAiBaseUrl/);
  assert.match(systemSettingsJsContent, /verifyPayload\.aiModel\s*=\s*currentAiModel/);
  assert.match(systemSettingsJsContent, /verifyPayload\.aiApiKey\s*=\s*apiKey/);
  assert.match(systemSettingsJsContent, /body:\s*JSON\.stringify\(verifyPayload\)/);
});
