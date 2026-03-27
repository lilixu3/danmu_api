import test from 'node:test';
import assert from 'node:assert/strict';

import { Globals } from './configs/globals.js';
import BilibiliSource from './sources/bilibili.js';
import { alignSourceTimelines } from './utils/merge-util.js';

test('BilibiliSource.getEpisodeDanmuSegments supports combine urls from dandan related data', async () => {
  Globals.init({});

  const source = new BilibiliSource();
  const result = await source.getEpisodeDanmuSegments(
    'https://www.bilibili.com/combine?cid32908181970=0-583&cid32908250608=0-378&cid32908314947=0-440'
  );

  assert.equal(result.type, 'bilibili1');
  assert.equal(result.duration, 1401);
  assert.equal(result.segmentList.length, 6);
  assert.equal(
    result.segmentList[0].url,
    'https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=32908181970&segment_index=1#combine_start=0&combine_end=583&combine_offset=0'
  );
  assert.equal(
    result.segmentList[2].url,
    'https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=32908250608&segment_index=1#combine_start=0&combine_end=378&combine_offset=583'
  );
  assert.equal(
    result.segmentList[4].url,
    'https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=32908314947&segment_index=1#combine_start=0&combine_end=440&combine_offset=961'
  );
});

test('alignSourceTimelines keeps bilibili combine identifiers distinct when applying dandan shifts', () => {
  Globals.init({});

  const results = [
    [{ p: '1.00,1,25,16777215,0,0,0,0' }],
    [{ p: '10.00,1,25,16777215,0,0,0,0' }],
    [{ p: '20.00,1,25,16777215,0,0,0,0' }]
  ];
  const sourceNames = ['dandan', 'bilibili', 'bilibili'];
  const realIds = [
    'dandan:123',
    'https://www.bilibili.com/combine?cid100=0-583&cid200=0-378',
    'https://www.bilibili.com/combine?cid300=0-440&cid400=0-360'
  ];
  const dandanShifts = {
    'bilibili:bilibili.com/combine?cid100=0-583&cid200=0-378': 1,
    'bilibili:bilibili.com/combine?cid300=0-440&cid400=0-360': 5
  };

  alignSourceTimelines(results, sourceNames, realIds, dandanShifts);

  assert.equal(results[1][0].p, '11.00,1,25,16777215,0,0,0,0');
  assert.equal(results[2][0].p, '25.00,1,25,16777215,0,0,0,0');
});
