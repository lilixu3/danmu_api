import test from "node:test";
import assert from "node:assert/strict";
import HanjutvSource from "./sources/hanjutv.js";

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
