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
