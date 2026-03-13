import test from 'node:test';
import assert from 'node:assert/strict';
import { globals } from './configs/globals.js';
import { addEpisode } from './utils/cache-util.js';
import { Anime } from './models/dandan-model.js';

function backupState() {
  return {
    episodeIds: globals.episodeIds,
    episodeNum: globals.episodeNum,
  };
}

function restoreState(snapshot) {
  globals.episodeIds = snapshot.episodeIds;
  globals.episodeNum = snapshot.episodeNum;
}

test('Link 缺省 id 时由 addEpisode 统一分配唯一自增 id', () => {
  const snapshot = backupState();
  globals.episodeIds = [];
  globals.episodeNum = 10001;

  try {
    const anime = Anime.fromJson({
      animeId: 9527001,
      bangumiId: 'mango-test',
      animeTitle: '测试剧(2026)【电视剧】from imgo',
      type: '电视剧',
      typeDescription: '电视剧',
      imageUrl: '',
      startDate: '2026-01-01',
      episodeCount: 2,
      rating: 0,
      isFavorited: true,
      source: 'imgo',
      links: [
        { name: '1', url: 'https://www.mgtv.com/b/391344/14295360.html', title: '【imgo】 第1集' },
        { name: '12', url: 'https://www.mgtv.com/b/391344/14294678.html', title: '【imgo】 第12集' }
      ]
    });

    const first = addEpisode(anime.links[0].toJson());
    const second = addEpisode(anime.links[1].toJson());

    assert.equal(first.id, 10002);
    assert.equal(second.id, 10003);
    assert.notEqual(first.id, second.id);
  } finally {
    restoreState(snapshot);
  }
});
