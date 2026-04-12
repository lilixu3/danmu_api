import test from 'node:test';
import assert from 'node:assert';

import { Globals } from './configs/globals.js';
import { Envs } from './configs/envs.js';

test('DANMU_OFFSET UI config should expose quick timeline-offset editor metadata', () => {
  const config = Globals.init({});

  assert.equal(config.envVarConfig.DANMU_OFFSET.type, 'timeline-offset');
  assert.deepEqual(config.envVarConfig.DANMU_OFFSET.options, Envs.ALLOWED_SOURCES);
});
