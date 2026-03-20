import test from 'node:test';
import assert from 'node:assert/strict';
import { Globals, globals } from './configs/globals.js';
import { Anime } from './models/dandan-model.js';
import {
  addAnime,
  findAnimeByAnimeId,
  findAnimeByBangumiId,
  findAnimeById,
  findUrlById,
  getSearchCache,
  setSearchCache,
} from './utils/cache-util.js';

function resetGlobals(overrides = {}) {
  Globals.init({});
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.animeDetailsCache = new Map();
  Globals.episodeDetailsCache = new Map();
  Globals.lastSelectMap = new Map();
  Globals.requestHistory = new Map();
  Globals.searchCacheMinutes = 30;
  Globals.searchCacheMaxItems = 300;
  Globals.commentCacheMinutes = 30;
  Globals.commentCacheMaxItems = 300;
  Globals.animeDetailCacheMaxItems = 0;
  Globals.episodeDetailCacheMaxItems = 0;
  Globals.MAX_ANIMES = 100;
  Object.assign(Globals, overrides);
}

function buildAnime({ animeId, bangumiId, animeTitle, urls, source = 'test' }) {
  return Anime.fromJson({
    animeId,
    bangumiId,
    animeTitle,
    type: 'tv',
    typeDescription: 'TV',
    imageUrl: '',
    startDate: '2025-01-01',
    episodeCount: urls.length,
    rating: 0,
    isFavorited: false,
    source,
    links: urls.map((url, index) => ({
      url,
      title: `${animeTitle}-EP${index + 1}`,
    })),
  });
}

function buildAnimeSummary(anime) {
  return Anime.fromJson({
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
    links: [],
  });
}

test('explicit animeId and bangumiId lookup avoids numeric collisions', () => {
  resetGlobals();

  addAnime(buildAnime({
    animeId: 123,
    bangumiId: 'bg-real',
    animeTitle: 'Anime-ID-123',
    urls: ['https://example.com/anime-123'],
  }));
  addAnime(buildAnime({
    animeId: 456,
    bangumiId: '00123',
    animeTitle: 'Bangumi-00123',
    urls: ['https://example.com/bangumi-00123'],
  }));

  assert.equal(findAnimeByAnimeId('00123')?.animeTitle, 'Anime-ID-123');
  assert.equal(findAnimeByBangumiId('00123')?.animeTitle, 'Bangumi-00123');
  assert.equal(findAnimeById('123')?.animeTitle, 'Anime-ID-123');
  assert.equal(findAnimeById('00123')?.animeTitle, 'Bangumi-00123');
});

test('reading older search cache does not overwrite newer runtime detail', () => {
  resetGlobals();

  const oldAnime = buildAnime({
    animeId: 1,
    bangumiId: 'b1',
    animeTitle: 'Test Anime',
    urls: ['https://example.com/test-1'],
  });
  addAnime(oldAnime);
  setSearchCache('old-keyword', [buildAnimeSummary(oldAnime)]);

  const updatedAnime = buildAnime({
    animeId: 1,
    bangumiId: 'b1',
    animeTitle: 'Test Anime',
    urls: ['https://example.com/test-1', 'https://example.com/test-2'],
  });
  addAnime(updatedAnime);
  setSearchCache('new-keyword', [buildAnimeSummary(updatedAnime)]);

  getSearchCache('old-keyword');

  assert.equal(globals.animes[0]?.links?.length, 2);
  assert.equal(findAnimeByAnimeId(1)?.links?.length, 2);
  assert.equal(findAnimeByBangumiId('b1')?.links?.length, 2);
});

test('replacing anime removes obsolete episode ids', () => {
  resetGlobals();

  addAnime(buildAnime({
    animeId: 1,
    bangumiId: 'b1',
    animeTitle: 'Replace Me',
    urls: ['https://example.com/replace-1', 'https://example.com/replace-2'],
  }));
  const oldEpisodeIds = globals.animes[0].links.map(link => link.id);

  addAnime(buildAnime({
    animeId: 1,
    bangumiId: 'b1',
    animeTitle: 'Replace Me',
    urls: ['https://example.com/replace-1'],
  }));

  assert.equal(globals.episodeIds.length, 1);
  assert.equal(findUrlById(oldEpisodeIds[0]), 'https://example.com/replace-1');
  assert.equal(findUrlById(oldEpisodeIds[1]), null);
});

test('anime detail cache evicts whole anime entries instead of leaving orphan keys', () => {
  resetGlobals({ animeDetailCacheMaxItems: 3, episodeDetailCacheMaxItems: 100 });

  addAnime(buildAnime({
    animeId: 1,
    bangumiId: 'b1',
    animeTitle: 'Anime 1',
    urls: ['https://example.com/a1'],
  }));
  addAnime(buildAnime({
    animeId: 2,
    bangumiId: 'b2',
    animeTitle: 'Anime 2',
    urls: ['https://example.com/a2'],
  }));
  addAnime(buildAnime({
    animeId: 3,
    bangumiId: 'b3',
    animeTitle: 'Anime 3',
    urls: ['https://example.com/a3'],
  }));

  assert.deepEqual([...globals.animeDetailsCache.keys()].sort(), ['anime:test:3', 'bangumi:test:b3']);
  assert.equal(findAnimeByAnimeId(1)?.animeTitle, 'Anime 1');
  assert.deepEqual([...globals.animeDetailsCache.keys()].sort(), ['anime:test:1', 'bangumi:test:b1']);
});


test('same source-colliding ids stay isolated in runtime and detail cache', () => {
  resetGlobals();

  addAnime(buildAnime({
    animeId: 100,
    bangumiId: 'shared-id',
    animeTitle: 'Source A Anime',
    source: 'source-a',
    urls: ['https://example.com/source-a-1'],
  }));
  addAnime(buildAnime({
    animeId: 100,
    bangumiId: 'shared-id',
    animeTitle: 'Source B Anime',
    source: 'source-b',
    urls: ['https://example.com/source-b-1'],
  }));

  assert.equal(globals.animes.length, 2);
  assert.equal(findAnimeByAnimeId(100, 'source-a')?.animeTitle, 'Source A Anime');
  assert.equal(findAnimeByAnimeId(100, 'source-b')?.animeTitle, 'Source B Anime');
  assert.equal(findAnimeByBangumiId('shared-id', 'source-a')?.animeTitle, 'Source A Anime');
  assert.equal(findAnimeByBangumiId('shared-id', 'source-b')?.animeTitle, 'Source B Anime');
  assert.deepEqual([...globals.animeDetailsCache.keys()].sort(), [
    'anime:source-a:100',
    'anime:source-b:100',
    'bangumi:source-a:shared-id',
    'bangumi:source-b:shared-id'
  ]);
});
