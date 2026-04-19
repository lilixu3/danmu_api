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
