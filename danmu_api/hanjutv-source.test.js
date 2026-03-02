import test from "node:test";
import assert from "node:assert/strict";
import HanjutvSource from "./sources/hanjutv.js";
import { globals } from "./configs/globals.js";

test("getEpisodeDanmuByLite 使用全量轴分页并在窗口结束后继续拉取", async () => {
  const source = new HanjutvSource();
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

test("handleAnimes 在 s5 主链路无分集时切换 xiawen 兜底", async () => {
  const source = new HanjutvSource();
  const oldAnimes = globals.animes;
  globals.animes = [];

  source.sortAndPushAnimesByYear = () => {};
  source.searchWithLiteApi = async () => [
    { sid: "xw_sid", name: "模范出租车", chain: "xiawen", image: { thumb: "xw.jpg" } },
  ];

  source.getDetail = async (sid, chain) => {
    if (chain === "hxq") return {};
    return { sid, category: 1, rank: 9 };
  };

  source.getEpisodes = async (sid, chain) => {
    if (chain === "hxq") return [];
    return [{ pid: "ep1", serialNo: 1, title: "", chain: "xiawen" }];
  };

  const curAnimes = [];
  const sourceAnimes = [
    { animeId: 9527, sid: "hxq_sid", name: "模范出租车", chain: "hxq", image: { thumb: "hxq.jpg" } },
  ];

  await source.handleAnimes(sourceAnimes, "模范出租车", curAnimes);

  assert.equal(globals.animes.length, 1);
  assert.ok(Number(globals.animes[0].animeId) > 0);
  assert.equal(globals.animes[0].links.length, 1);
  assert.ok(String(globals.animes[0].links[0].url).startsWith("xw:"));

  globals.animes = oldAnimes;
});

test("handleAnimes 并发触发 xiawen 兜底时不会漏掉同名季", async () => {
  const source = new HanjutvSource();
  const oldAnimes = globals.animes;
  globals.animes = [];

  try {
    let liteSearchCount = 0;
    source.searchWithLiteApi = async () => {
      liteSearchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [
        { sid: "xw_s1", name: "模范出租车", chain: "xiawen", image: { thumb: "s1.jpg" } },
        { sid: "xw_s2", name: "模范出租车2", chain: "xiawen", image: { thumb: "s2.jpg" } },
        { sid: "xw_s3", name: "模范出租车3", chain: "xiawen", image: { thumb: "s3.jpg" } },
      ];
    };

    source.getDetail = async () => ({ category: 1, rank: 8.8 });
    source.getEpisodes = async (sid, chain) => {
      if (chain === "hxq") return [];
      return [{ pid: sid + "_ep1", serialNo: 1, title: "", chain: "xiawen" }];
    };

    const sourceAnimes = [
      { animeId: 1001, sid: "hxq_s1", name: "模范出租车", chain: "hxq", image: { thumb: "a1.jpg" } },
      { animeId: 1002, sid: "hxq_s2", name: "模范出租车2", chain: "hxq", image: { thumb: "a2.jpg" } },
      { animeId: 1003, sid: "hxq_s3", name: "模范出租车3", chain: "hxq", image: { thumb: "a3.jpg" } },
    ];

    const curAnimes = [];
    await source.handleAnimes(sourceAnimes, "模范出租车", curAnimes);

    assert.equal(liteSearchCount, 1);
    assert.equal(globals.animes.length, 3);
    assert.deepEqual(
      globals.animes.map((item) => item.animeTitle.split("(")[0]).sort(),
      ["模范出租车", "模范出租车2", "模范出租车3"]
    );
  } finally {
    globals.animes = oldAnimes;
  }
});

test("handleAnimes 触发降级后直接返回 xiawen 全量兜底结果", async () => {
  const source = new HanjutvSource();
  const oldAnimes = globals.animes;
  globals.animes = [];

  try {
    let liteSearchCount = 0;
    source.searchWithLiteApi = async () => {
      liteSearchCount += 1;
      return [
        { sid: "xw_s1", name: "模范出租车", chain: "xiawen", image: { thumb: "s1.jpg" } },
        { sid: "xw_s2", name: "模范出租车2", chain: "xiawen", image: { thumb: "s2.jpg" } },
        { sid: "xw_s3", name: "模范出租车3", chain: "xiawen", image: { thumb: "s3.jpg" } },
      ];
    };

    source.getDetail = async () => ({ category: 1, rank: 8.8 });
    source.getEpisodes = async (sid, chain) => {
      if (chain === "hxq") return [];
      return [{ pid: sid + "_ep1", serialNo: 1, title: "", chain: "xiawen" }];
    };

    const sourceAnimes = [
      { animeId: 3003, sid: "hxq_s3", name: "模范出租车3", chain: "hxq", image: { thumb: "a3.jpg" } },
    ];

    const curAnimes = [];
    await source.handleAnimes(sourceAnimes, "模范出租车", curAnimes);

    assert.equal(liteSearchCount, 1);
    assert.deepEqual(
      globals.animes.map((item) => item.animeTitle.split("(")[0]).sort(),
      ["模范出租车", "模范出租车2", "模范出租车3"]
    );
  } finally {
    globals.animes = oldAnimes;
  }
});

test("search 同名剧在 s5 与 xiawen 链路生成稳定 animeId", async () => {
  const source = new HanjutvSource();
  source.searchHedgeDelayMs = 100000;

  source.searchWithS5Api = async () => [
    { sid: "s5_same", name: "海岸村恰恰恰", chain: "hxq" },
  ];
  source.searchWithLiteApi = async () => [
    { sid: "xw_same", name: "海岸村恰恰恰", chain: "xiawen" },
  ];

  const s5Result = await source.search("海岸村恰恰恰");
  assert.equal(s5Result.length, 1);
  const stableId = s5Result[0].animeId;

  source.searchWithS5Api = async () => {
    throw new Error("mock s5 fail");
  };

  const liteResult = await source.search("海岸村恰恰恰");
  assert.equal(liteResult.length, 1);
  assert.equal(liteResult[0].animeId, stableId);
});

test("handleAnimes 全量兜底时复用同一个 xiawen 会话", async () => {
  const source = new HanjutvSource();
  const oldAnimes = globals.animes;
  globals.animes = [];

  try {
    let createLiteSessionCount = 0;
    const originalGetEpisodes = source.getEpisodes.bind(source);
    const originalGetDetail = source.getDetail.bind(source);

    source.getEpisodes = async (sid, chain, options = {}) => {
      if (chain === "hxq") return [];
      return originalGetEpisodes(sid, chain, options);
    };
    source.getDetail = async (sid, chain, options = {}) => {
      if (chain === "hxq") return {};
      return originalGetDetail(sid, chain, options);
    };

    source.searchWithLiteApi = async () => [
      { sid: "xw_h1", name: "海岸村恰恰恰", chain: "xiawen", image: { thumb: "1.jpg" } },
      { sid: "xw_h2", name: "海岸村恰恰恰2", chain: "xiawen", image: { thumb: "2.jpg" } },
    ];

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
      { animeId: 4001, sid: "hxq_trigger", name: "海岸村恰恰恰", chain: "hxq", image: { thumb: "h.jpg" } },
    ];

    await source.handleAnimes(sourceAnimes, "海岸村恰恰恰", curAnimes);

    assert.equal(createLiteSessionCount, 1);
    assert.equal(globals.animes.length, 2);
  } finally {
    globals.animes = oldAnimes;
  }
});
