import test from 'node:test';
import assert from 'node:assert/strict';

import { Globals } from './configs/globals.js';
import {
  createDynamicPlatformOrder,
  extractAnimeTitle,
  extractSeasonNumberFromAnimeTitle,
  extractYear,
  parseFileName,
} from './utils/common-util.js';
import {
  getPreferAnimeId,
  getSearchCache,
  setSearchCache,
  storeAnimeIdsToMap,
} from './utils/cache-util.js';
import { extractTitleSeasonEpisode } from './apis/dandan-api.js';

function resetRuntimeCaches() {
  Globals.init({});
  Globals.searchCache = new Map();
  Globals.lastSelectMap = new Map();
  Globals.MAX_LAST_SELECT_MAP = 100;
}

resetRuntimeCaches();

test('extractTitleSeasonEpisode should handle unicode separators before SxxExx tokens', async () => {
  for (const separator of ['\u200B', '\u3000', '\u00A0', '\u202F', '']) {
    const parsed = await extractTitleSeasonEpisode(`太平年${separator}S01E02`);
    assert.equal(parsed.title, '太平年', `separator ${JSON.stringify(separator)} should preserve clean title`);
    assert.equal(parsed.season, 1, `separator ${JSON.stringify(separator)} should preserve season`);
    assert.equal(parsed.episode, 2, `separator ${JSON.stringify(separator)} should preserve episode`);
  }
});

test('anime title helpers should strip leading tags and full-width year wrappers', () => {
  assert.equal(extractAnimeTitle('爱情怎么翻译？（2026）'), '爱情怎么翻译？');
  assert.equal(extractYear('爱情怎么翻译？（2026）'), 2026);
  assert.equal(extractAnimeTitle('【简中】药屋少女的呢喃　(2023)'), '药屋少女的呢喃');
});

test('extractSeasonNumberFromAnimeTitle should avoid treating title suffix digits as season numbers', () => {
  assert.deepEqual(
    extractSeasonNumberFromAnimeTitle('机动战士高达00　(2007)'),
    { season: null, baseTitle: '机动战士高达00' }
  );

  assert.deepEqual(
    extractSeasonNumberFromAnimeTitle('我推的孩子2　(2024)'),
    { season: 2, baseTitle: '我推的孩子' }
  );
});

test('parseFileName should normalize unicode separators around season/episode and platform suffixes', () => {
  for (const separator of ['\u200B', '\u3000', '']) {
    assert.deepEqual(
      parseFileName(`太平年${separator}S01E02@qiyi`),
      { cleanFileName: '太平年 S01E02', preferredPlatform: 'qiyi' }
    );
  }
});

test('runtime caches should normalize title keys across unicode whitespace variants', () => {
  resetRuntimeCaches();

  const results = [{ animeId: 1, animeTitle: '太平年', links: [] }];
  setSearchCache('太平年', results);

  assert.deepEqual(getSearchCache('太平年\u3000'), results);
  assert.deepEqual(getSearchCache('太平年\u00A0'), results);

  storeAnimeIdsToMap([{ animeId: 123 }], '太平年');
  const storedKey = [...Globals.lastSelectMap.keys()][0];
  Globals.lastSelectMap.set(storedKey, {
    animeIds: [123],
    preferBySeason: { default: 123, 1: 123 },
    sourceBySeason: { default: 'qiyi', 1: 'qiyi' },
  });

  assert.deepEqual(getPreferAnimeId('太平年\u3000', 1), [123, 'qiyi', null]);

  storeAnimeIdsToMap([{ animeId: 123 }], '太平年\u3000');
  assert.equal(Globals.lastSelectMap.size, 1);
  assert.deepEqual(getPreferAnimeId('太平年', 1), [123, 'qiyi', null]);
});

test('MATCH_PLATFORM_RULES should apply title and season scoped platform preferences', () => {
  Globals.init({
    PLATFORM_ORDER: 'qq',
    MATCH_PLATFORM_RULES: '葬送的芙莉莲->dandan;葬送的芙莉莲/S01->bilibili1,animeko'
  });

  assert.deepEqual(
    createDynamicPlatformOrder('', '葬送的芙莉莲', 1),
    ['bilibili1', 'animeko', 'qq', null]
  );
  assert.deepEqual(
    createDynamicPlatformOrder('', '葬送的芙莉莲', 2),
    ['dandan', 'qq', null]
  );
  assert.deepEqual(
    createDynamicPlatformOrder('qiyi', '葬送的芙莉莲', 1),
    ['qiyi', 'bilibili1', 'animeko', 'qq', null]
  );
  assert.deepEqual(
    createDynamicPlatformOrder('bad', '葬送的芙莉莲', 1),
    ['bilibili1', 'animeko', 'qq', null]
  );
});

test('MATCH_PLATFORM_RULES should fall back to PLATFORM_ORDER when absent or unmatched', () => {
  Globals.init({ PLATFORM_ORDER: 'qq,qiyi' });
  assert.deepEqual(createDynamicPlatformOrder('', '任意标题', 1), ['qq', 'qiyi', null]);

  Globals.init({
    PLATFORM_ORDER: 'qq,qiyi',
    MATCH_PLATFORM_RULES: '另一个标题->dandan'
  });
  assert.deepEqual(createDynamicPlatformOrder('', '任意标题', 1), ['qq', 'qiyi', null]);
});

test('MATCH_PLATFORM_RULES should match original and mapped title candidates', () => {
  Globals.init({
    PLATFORM_ORDER: 'qq',
    MATCH_PLATFORM_RULES: "Frieren: Beyond Journey's End/S01->dandan"
  });

  assert.deepEqual(
    createDynamicPlatformOrder('', ['葬送的芙莉莲', "Frieren: Beyond Journey's End"], 1),
    ['dandan', 'qq', null]
  );
});
