import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchSearchUrl } from './apis/dandan-api.js';

test('buildMatchSearchUrl should preserve special characters and not leak match debug params', () => {
  const matchUrl = new URL('https://example.test/api/v2/match?debug=1&other=ignored');
  const searchUrl = buildMatchSearchUrl(matchUrl, 'Tom & Jerry #1? S02E01');

  assert.equal(searchUrl.origin, 'https://example.test');
  assert.equal(searchUrl.pathname, '/api/v2/search/anime');
  assert.equal(searchUrl.searchParams.get('keyword'), 'Tom & Jerry #1? S02E01');
  assert.equal(searchUrl.searchParams.has('debug'), false);
  assert.equal(searchUrl.searchParams.has('other'), false);
});

test('buildMatchSearchUrl should append valid season context only when present', () => {
  const matchUrl = new URL('https://example.test/api/v2/match?debug=1');

  const withSeason = buildMatchSearchUrl(matchUrl, '葬送的芙莉莲', 2);
  assert.equal(withSeason.searchParams.get('keyword'), '葬送的芙莉莲');
  assert.equal(withSeason.searchParams.get('season'), '2');

  const withSeasonAndEpisode = buildMatchSearchUrl(matchUrl, '葬送的芙莉莲', 2, 13);
  assert.equal(withSeasonAndEpisode.searchParams.get('season'), '2');
  assert.equal(withSeasonAndEpisode.searchParams.get('episode'), '13');

  const withoutSeason = buildMatchSearchUrl(matchUrl, '葬送的芙莉莲', null);
  assert.equal(withoutSeason.searchParams.get('keyword'), '葬送的芙莉莲');
  assert.equal(withoutSeason.searchParams.has('season'), false);
  assert.equal(withoutSeason.searchParams.has('episode'), false);
});
