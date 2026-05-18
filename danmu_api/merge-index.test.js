import test from 'node:test';
import assert from 'node:assert/strict';

import { Globals, globals } from './configs/globals.js';
import { addAnime } from './utils/cache-util.js';
import { applyMergeLogic, findSecondaryMatches, MERGE_DELIMITER } from './utils/merge-util.js';

function resetRuntime(extraEnv = {}) {
  Globals.init({ LOG_LEVEL: 'error', ...extraEnv });
  Globals.MAX_ANIMES = 1000;
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.animeDetailsCache = new Map();
  Globals.episodeDetailsCache = new Map();
  Globals.requestHistory = new Map();
}

function createAnime({ animeId, source, title, startDate = '2024-01-01T00:00:00.000Z', episodeCount = 2, typeDescription = 'TV动画', links = null, aliases = [] }) {
  return {
    animeId,
    bangumiId: `merge-index-${animeId}`,
    animeTitle: `${title}(${startDate.slice(0, 4)})【动漫】from ${source}`,
    aliases,
    type: 'tvseries',
    typeDescription,
    imageUrl: '',
    startDate,
    episodeCount,
    rating: 0,
    isFavorited: false,
    source,
    links: links || Array.from({ length: episodeCount }, (_, idx) => ({
      id: animeId * 100 + idx + 1,
      url: `https://example.com/${source}/${animeId}/${idx + 1}`,
      title: `【${source}】第${idx + 1}集`
    }))
  };
}

function snapshotCurAnimes() {
  return globals.animes.map(anime => ({
    animeId: anime.animeId,
    bangumiId: anime.bangumiId,
    animeTitle: anime.animeTitle,
    aliases: anime.aliases,
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
}

test('applyMergeLogic should keep exact merge golden output with same-source distractors', async () => {
  resetRuntime({ MERGE_SOURCE_PAIRS: 'tencent&iqiyi&youku' });

  addAnime(createAnime({ animeId: 9101, source: 'tencent', title: '索引守护者' }));
  addAnime(createAnime({ animeId: 9102, source: 'iqiyi', title: '索引守护者' }));
  addAnime(createAnime({ animeId: 9103, source: 'youku', title: '索引守护者' }));
  addAnime(createAnime({ animeId: 9104, source: 'iqiyi', title: '索引守护者 第二季', startDate: '2025-01-01T00:00:00.000Z' }));
  addAnime(createAnime({ animeId: 9105, source: 'youku', title: '索引守护者 剧场版', typeDescription: '剧场版', episodeCount: 1 }));
  addAnime(createAnime({ animeId: 9106, source: 'mango', title: '索引守护者' }));

  const curAnimes = snapshotCurAnimes();
  await applyMergeLogic(curAnimes);

  assert.equal(curAnimes.length, 4);
  assert.deepEqual(curAnimes.map(item => item.source), ['tencent', 'iqiyi', 'youku', 'mango']);

  const mergedAnime = curAnimes.find(item => item.source === 'tencent');
  assert.ok(mergedAnime, 'expected merged tencent primary anime to remain');
  assert.match(mergedAnime.animeTitle, /from tencent&iqiyi&youku$/);
  assert.equal(mergedAnime.links.length, 2);

  assert.equal(
    mergedAnime.links[0].url,
    `tencent:https://example.com/tencent/9101/1${MERGE_DELIMITER}iqiyi:https://example.com/iqiyi/9102/1${MERGE_DELIMITER}youku:https://example.com/youku/9103/1`
  );
  assert.equal(
    mergedAnime.links[1].url,
    `tencent:https://example.com/tencent/9101/2${MERGE_DELIMITER}iqiyi:https://example.com/iqiyi/9102/2${MERGE_DELIMITER}youku:https://example.com/youku/9103/2`
  );

  assert.ok(curAnimes.some(item => item.animeId === 9104 && item.animeTitle.includes('第二季')));
  assert.ok(curAnimes.some(item => item.animeId === 9105 && item.animeTitle.includes('剧场版')));
  assert.ok(curAnimes.some(item => item.animeId === 9106 && item.source === 'mango'));
});

test('findSecondaryMatches should still match through secondary aliases', () => {
  const primary = createAnime({
    animeId: 9201,
    source: 'dandan',
    title: '银河猫冒险',
    aliases: []
  });
  const secondary = createAnime({
    animeId: 9202,
    source: 'animeko',
    title: 'Completely Different Display Name',
    aliases: ['银河猫冒险']
  });

  const matches = findSecondaryMatches(primary, [secondary]);
  assert.deepEqual(matches.map(item => item.animeId), [9202]);
});

test('applyMergeLogic should keep aliases from merged secondary sources', async () => {
  resetRuntime({ MERGE_SOURCE_PAIRS: 'tencent&iqiyi' });

  addAnime(createAnime({
    animeId: 9301,
    source: 'tencent',
    title: '别名合并守护者',
    aliases: ['主源别名']
  }));
  addAnime(createAnime({
    animeId: 9302,
    source: 'iqiyi',
    title: '别名合并守护者',
    aliases: ['副源别名', 'Alt Merge Guardian']
  }));

  const curAnimes = snapshotCurAnimes();
  await applyMergeLogic(curAnimes);

  const mergedAnime = curAnimes.find(item => item.source === 'tencent');
  assert.ok(mergedAnime, 'expected merged primary anime');
  assert.ok(mergedAnime.aliases.includes('主源别名'));
  assert.ok(mergedAnime.aliases.includes('副源别名'));
  assert.ok(mergedAnime.aliases.includes('Alt Merge Guardian'));
});

test('CUSTOM_MERGE_RULES should derive merge groups and force mapped dissimilar titles', async () => {
  resetRuntime({
    MERGE_SOURCE_PAIRS: '',
    CUSTOM_MERGE_RULES: '副源映射名@iqiyi -> 主源映射名@tencent | E1~E2>E1~E2'
  });

  addAnime(createAnime({ animeId: 9401, source: 'tencent', title: '主源映射名' }));
  addAnime(createAnime({ animeId: 9402, source: 'iqiyi', title: '副源映射名' }));

  const curAnimes = snapshotCurAnimes();
  await applyMergeLogic(curAnimes);

  const mergedAnime = curAnimes.find(item => item.source === 'tencent');
  assert.ok(mergedAnime, 'expected custom mapped primary anime');
  assert.match(mergedAnime.animeTitle, /from tencent&iqiyi$/);
  assert.equal(
    mergedAnime.links[0].url,
    `tencent:https://example.com/tencent/9401/1${MERGE_DELIMITER}iqiyi:https://example.com/iqiyi/9402/1`
  );
});

test('CUSTOM_MERGE_RULES block rule should override configured merge pair', async () => {
  resetRuntime({
    MERGE_SOURCE_PAIRS: 'tencent&iqiyi',
    CUSTOM_MERGE_RULES: '索引守护者@iqiyi × 索引守护者@tencent'
  });

  addAnime(createAnime({ animeId: 9501, source: 'tencent', title: '索引守护者' }));
  addAnime(createAnime({ animeId: 9502, source: 'iqiyi', title: '索引守护者' }));

  const curAnimes = snapshotCurAnimes();
  await applyMergeLogic(curAnimes);

  assert.equal(curAnimes.length, 2);
  assert.ok(curAnimes.every(item => !item.animeTitle.includes('tencent&iqiyi')));
});
