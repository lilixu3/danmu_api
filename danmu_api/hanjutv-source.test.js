import test from "node:test";
import assert from "node:assert/strict";
import HanjutvSource from "./sources/hanjutv.js";
import Hanjutv2Source from "./sources/hanjutv2.js";
import { globals } from "./configs/globals.js";

test("getEpisodeDanmuByLite 使用全量轴分页并在窗口结束后继续拉取", async () => {
  const source = new Hanjutv2Source();
  const calls = [];
  const pages = [
    { bulletchats: [{ id: 1, con: "a" }], more: 1, nextAxis: 12002, lastId: 6196941 },
    { bulletchats: [{ id: 2, con: "b" }], more: "1", nextAxis: 26951, lastId: 7914194 },
    { bulletchats: [{ id: 3, con: "c" }], more: 0, nextAxis: 60000, lastId: 9114607 },
    { bulletchats: [{ id: 4, con: "d" }], more: 1, nextAxis: 72015, lastId: 100 },
    { bulletchats: [{ id: 5, con: "e" }], more: 0, nextAxis: 90000, lastId: 101 },
  ];

  source.getDanmuMaxPages = () => 20;
  source.getDanmuMaxAxis = () => 100000000;
  source.createLiteSession = async () => ({ uid: "R4VRuaXvhTDZ8g9oOiSd", headers: {} });
  source.requestLiteApi = async (pathname, query) => {
    calls.push({ pathname, query: { ...query } });
    const index = calls.length - 1;
    return pages[index] || { bulletchats: [], more: 0, nextAxis: query.fromAxis, lastId: query.prevId };
  };

  const danmus = await source.getEpisodeDanmuByLite("E123");

  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => call.pathname === "/api/v1/bulletchat/episode/get"));
  assert.deepEqual(calls.map((call) => call.query.eid), ["E123", "E123", "E123", "E123", "E123", "E123"]);
  assert.deepEqual(calls.map((call) => call.query.toAxis), [100000000, 100000000, 100000000, 100000000, 100000000, 100000000]);
  assert.deepEqual(calls.map((call) => call.query.fromAxis), [0, 12002, 26951, 60000, 72015, 90000]);
  assert.deepEqual(calls.map((call) => call.query.prevId), [0, 6196941, 7914194, 0, 100, 0]);
  assert.equal(danmus.length, 5);
  assert.deepEqual(danmus.map((item) => item.id), [1, 2, 3, 4, 5]);
});

test("hanjutv 在主链路无分集时不调用 xiawen", async () => {
  const source = new HanjutvSource();
  const oldAnimes = globals.animes;
  globals.animes = [];

  let liteCalled = false;
  source.sortAndPushAnimesByYear = () => {};
  source.searchWithLiteApi = async () => {
    liteCalled = true;
    return [{ sid: "xw_sid", name: "模范出租车", chain: "xiawen", image: { thumb: "xw.jpg" } }];
  };

  source.getDetail = async () => ({});
  source.getEpisodes = async () => [];

  try {
    const curAnimes = [];
    const sourceAnimes = [
      { animeId: 9527, sid: "hxq_sid", name: "模范出租车", chain: "hxq", image: { thumb: "hxq.jpg" } },
    ];

    await source.handleAnimes(sourceAnimes, "模范出租车", curAnimes);

    assert.equal(globals.animes.length, 0);
    assert.equal(liteCalled, false);
  } finally {
    globals.animes = oldAnimes;
  }
});

test("hanjutv 搜索仅走 s5 链路，零命中直接返回空", async () => {
  const source = new HanjutvSource();

  let liteCalled = false;
  source.searchWithS5Api = async () => [
    { sid: "s5_non_hit", name: "模范出租车", chain: "hxq" },
  ];
  source.searchWithLiteApi = async () => {
    liteCalled = true;
    return [{ sid: "xw_hit", name: "双轨", chain: "xiawen" }];
  };

  const result = await source.search("双轨");
  assert.equal(result.length, 0);
  assert.equal(liteCalled, false);
});

test("hanjutv2 搜索仅走 xiawen 链路，零命中直接返回空", async () => {
  const source = new Hanjutv2Source();

  let s5Called = false;
  source.searchWithS5Api = async () => {
    s5Called = true;
    return [{ sid: "s5_hit", name: "海岸村恰恰恰", chain: "hxq" }];
  };
  source.searchWithLiteApi = async () => [
    { sid: "xw_non_hit", name: "模范出租车", chain: "xiawen" },
  ];

  const result = await source.search("双轨");
  assert.equal(result.length, 0);
  assert.equal(s5Called, false);
});

test("hanjutv 与 hanjutv2 同名剧生成不同 animeId，避免互相覆盖", async () => {
  const s1 = new HanjutvSource();
  const s2 = new Hanjutv2Source();

  s1.searchWithS5Api = async () => [
    { sid: "s5_same", name: "海岸村恰恰恰", chain: "hxq" },
  ];
  s2.searchWithLiteApi = async () => [
    { sid: "xw_same", name: "海岸村恰恰恰", chain: "xiawen" },
  ];

  const r1 = await s1.search("海岸村恰恰恰");
  const r2 = await s2.search("海岸村恰恰恰");

  assert.equal(r1.length, 1);
  assert.equal(r2.length, 1);
  assert.notEqual(r1[0].animeId, r2[0].animeId);
});

test("hanjutv2 handleAnimes 可返回同名季", async () => {
  const source = new Hanjutv2Source();
  const oldAnimes = globals.animes;
  globals.animes = [];

  try {
    source.getDetail = async () => ({ category: 1, rank: 8.8 });
    source.getEpisodes = async (sid, chain) => [{ pid: sid + "_ep1", serialNo: 1, title: "", chain: chain || "xiawen" }];

    const sourceAnimes = [
      { animeId: 1001, sid: "xw_s1", name: "模范出租车", chain: "xiawen", image: { thumb: "a1.jpg" } },
      { animeId: 1002, sid: "xw_s2", name: "模范出租车2", chain: "xiawen", image: { thumb: "a2.jpg" } },
      { animeId: 1003, sid: "xw_s3", name: "模范出租车3", chain: "xiawen", image: { thumb: "a3.jpg" } },
    ];

    const curAnimes = [];
    await source.handleAnimes(sourceAnimes, "模范出租车", curAnimes);

    assert.equal(globals.animes.length, 3);
    assert.deepEqual(
      globals.animes.map((item) => item.animeTitle.split("(")[0]).sort(),
      ["模范出租车", "模范出租车2", "模范出租车3"]
    );
    assert.ok(globals.animes.every((item) => item.source === "hanjutv2"));
  } finally {
    globals.animes = oldAnimes;
  }
});

test("hanjutv2 handleAnimes 复用同一个会话", async () => {
  const source = new Hanjutv2Source();
  const oldAnimes = globals.animes;
  globals.animes = [];

  try {
    let createLiteSessionCount = 0;

    source.createLiteSession = async () => {
      createLiteSessionCount += 1;
      return { uid: "shared_uid", headers: {} };
    };

    source.requestLiteApi = async (pathname, query, session) => {
      assert.equal(session?.uid, "shared_uid");
      if (pathname === "/api/v1/series/detail/query") {
        return {
          series: { category: 1, rank: 9.2 },
          episodes: [{ pid: String(query.sid) + "_ep1", serialNo: 1, title: "" }],
        };
      }
      if (pathname === "/api/v1/series/program/query") {
        return { programs: [] };
      }
      return {};
    };

    const curAnimes = [];
    const sourceAnimes = [
      { animeId: 4001, sid: "xw_h1", name: "海岸村恰恰恰", chain: "xiawen", image: { thumb: "1.jpg" } },
      { animeId: 4002, sid: "xw_h2", name: "海岸村恰恰恰2", chain: "xiawen", image: { thumb: "2.jpg" } },
    ];

    await source.handleAnimes(sourceAnimes, "海岸村恰恰恰", curAnimes);

    assert.equal(createLiteSessionCount, 1);
    assert.equal(globals.animes.length, 2);
  } finally {
    globals.animes = oldAnimes;
  }
});
