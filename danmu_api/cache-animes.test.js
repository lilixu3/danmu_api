import test from 'node:test';
import assert from 'node:assert';

import { Globals } from './configs/globals.js';
import { Anime } from './models/dandan-model.js';
import { handleCacheAnimes } from './apis/system-api.js';

function resetRuntime() {
  Globals.init({ LOG_LEVEL: 'error' });
  Globals.animes = [];
  Globals.episodeIds = [];
}

test('handleCacheAnimes should expose recent visible animes with merged child source links', async () => {
  resetRuntime();

  const parent = new Anime({
    animeId: 101,
    bangumiId: '101',
    animeTitle: '合并番剧 from tencent&iqiyi',
    source: 'tencent',
    imageUrl: 'https://example.test/cover.jpg',
    episodeCount: 2,
    links: [
      { id: 10001, title: '【tencent&iqiyi】第1集', url: 'tencent:tx-1$$$iqiyi:iq-1' },
      { id: 10002, title: '【tencent&iqiyi】第2集', url: 'tencent:tx-2$$$iqiyi:iq-2' },
    ],
    mergedChildren: [
      { animeId: 202, animeTitle: '合并番剧 爱奇艺', source: 'iqiyi', episodeCount: 2 }
    ]
  });

  const hiddenChild = new Anime({
    animeId: 202,
    bangumiId: '202',
    animeTitle: '合并番剧 爱奇艺',
    source: 'iqiyi',
    episodeCount: 2,
    isHiddenChild: true,
    links: [
      { id: 20001, title: '第1集', url: 'iq-1' },
      { id: 20002, title: '第2集', url: 'iq-2' },
    ]
  });

  Globals.animes.push(parent, hiddenChild);

  const response = handleCacheAnimes();
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].animeTitle, '合并番剧 from tencent&iqiyi');
  assert.equal(payload.data[0].episodes, 2);
  assert.equal(payload.data[0].mergedChildren.length, 1);
  assert.equal(payload.data[0].mergedChildren[0].source, 'iqiyi');
  assert.equal(payload.data[0].mergedChildren[0].links.length, 2);
  assert.equal(payload.data[0].mergedChildren[0].links[0].url, 'iq-1');
});
