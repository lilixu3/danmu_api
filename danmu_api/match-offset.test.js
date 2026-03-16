import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTargetEpisode, findEpisodeByNumber } from './apis/dandan-api.js';

const episodes = [
  {
    episodeId: 1001,
    episodeTitle: '【qq】 她的轨迹_02',
    episodeNumber: '1',
    parsedEpisodeNumber: 1,
    titleMeta: { episodeNumber: 1 },
    name: '1'
  },
  {
    episodeId: 1002,
    episodeTitle: '【qq】 会员彩蛋',
    episodeNumber: '99',
    parsedEpisodeNumber: 99,
    titleMeta: { episodeNumber: 99 },
    name: '99'
  },
  {
    episodeId: 1003,
    episodeTitle: '【qq】 她的轨迹_03',
    episodeNumber: '2',
    parsedEpisodeNumber: 2,
    titleMeta: { episodeNumber: 2 },
    name: '2'
  },
  {
    episodeId: 1004,
    episodeTitle: '【qq】 她的轨迹_04',
    episodeNumber: '3',
    parsedEpisodeNumber: 3,
    titleMeta: { episodeNumber: 3 },
    name: '3'
  }
];

test('findEpisodeByNumber 优先使用规范化集号，避免特殊集插队', () => {
  const matched = findEpisodeByNumber(episodes, 2);
  assert.equal(matched?.episodeId, 1003);
  assert.equal(matched?.episodeTitle, '【qq】 她的轨迹_03');
});

test('computeTargetEpisode 兼容旧偏移格式时按规范化集号计算', () => {
  const resolved = computeTargetEpisode({ '1': '2:【qq】 她的轨迹_03' }, 1, 3, episodes, 3);
  assert.equal(resolved, 3);
});

test('computeTargetEpisode 优先使用新偏移格式里的源集序号', () => {
  const resolved = computeTargetEpisode({ '1': '2:2|【qq】 她的轨迹_03' }, 1, 3, episodes, 3);
  assert.equal(resolved, 3);
});
