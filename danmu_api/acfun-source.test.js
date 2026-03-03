import test from "node:test";
import assert from "node:assert/strict";
import AcfunSource from "./sources/acfun.js";

test("acfun search 仅保留番剧结果并规范字段", async () => {
  const source = new AcfunSource();

  source.requestGet = async () => ({
    data: {
      result: 0,
      itemList: [
        {
          itemType: 5,
          id: 5019739,
          bgmTitle: "<em>罗小黑战记</em>",
          description: "2011 番剧 国产",
          year: 2011,
          coverImageH: "https://img.example/h.jpg",
          videoIdList: [1, 2, 3]
        },
        {
          itemType: 2,
          id: 999,
          title: "不应命中"
        }
      ]
    }
  });

  const result = await source.search("罗小黑战记");
  assert.equal(result.length, 1);
  assert.equal(result[0].mediaId, "5019739");
  assert.equal(result[0].title, "罗小黑战记");
  assert.equal(result[0].type, "番剧");
  assert.equal(result[0].episodeCount, 3);
});

test("acfun getEpisodes 按 itemId 排序并提取时长", async () => {
  const source = new AcfunSource();

  source.requestPost = async () => ({
    data: {
      result: 0,
      items: [
        {
          itemId: 2,
          videoId: 2002,
          title: "第二话",
          episodeName: "第2话",
          currentVideoInfo: { durationMillis: 450000 },
          updateTime: 200
        },
        {
          itemId: 1,
          videoId: 2001,
          title: "第一话",
          episodeName: "第1话",
          currentVideoInfo: { durationMillis: 300000 },
          updateTime: 100
        }
      ]
    }
  });

  const episodes = await source.getEpisodes("5019739");
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].videoId, "2001");
  assert.equal(episodes[1].videoId, "2002");
  assert.equal(episodes[0].durationMillis, 300000);
});

test("acfun getEpisodeDanmu 已知时长时按全量分段拉取", async () => {
  const source = new AcfunSource();
  const calls = [];

  source.getEpisodeSegmentDanmu = async (segment) => {
    calls.push({ start: segment.segment_start, end: segment.segment_end });
    return [{
      danmakuId: calls.length,
      position: segment.segment_start * 1000,
      body: `弹幕${calls.length}`,
      color: 16777215,
      mode: 1
    }];
  };

  const comments = await source.getEpisodeDanmu("acfun://video/5724377?durationMs=25000");

  assert.equal(calls.length, 3);
  assert.deepEqual(calls, [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
    { start: 20, end: 25 }
  ]);
  assert.equal(comments.length, 3);
});

test("acfun getEpisodeDanmu 未知时长时不会只拉取首个窗口", async () => {
  const source = new AcfunSource();
  const calls = [];

  source.maxProbeDurationMs = 70000;
  source.emptyProbeThreshold = 2;
  source.pollDanmuWindow = async (_videoId, from, to) => {
    calls.push({ from, to });
    if (from === 20000) {
      return [{
        danmakuId: 999,
        position: 20000,
        body: "探测到弹幕",
        color: 16777215,
        mode: 1
      }];
    }
    return [];
  };

  const comments = await source.getEpisodeDanmu("acfun://video/5724377");

  assert.equal(comments.length, 1);
  assert.equal(calls.length, 7);
  assert.deepEqual(calls[0], { from: 0, to: 10000 });
  assert.deepEqual(calls[1], { from: 10000, to: 20000 });
  assert.deepEqual(calls[2], { from: 20000, to: 30000 });
});

test("acfun formatComments 输出统一弹幕结构", () => {
  const source = new AcfunSource();

  const formatted = source.formatComments([
    { danmakuId: 1, position: 1234, mode: 1, color: 12345, body: "普通", likeCount: 2 },
    { danmakuId: 2, position: 2000, mode: 4, color: 22222, body: "底部" },
    { danmakuId: 3, position: 3000, mode: 5, color: 33333, body: "顶部" }
  ]);

  assert.equal(formatted.length, 3);
  assert.equal(formatted[0].p, "1.23,1,12345,[acfun]");
  assert.equal(formatted[1].p, "2.00,4,22222,[acfun]");
  assert.equal(formatted[2].p, "3.00,5,33333,[acfun]");
  assert.equal(formatted[0].m, "普通");
  assert.equal(formatted[0].like, 2);
});
