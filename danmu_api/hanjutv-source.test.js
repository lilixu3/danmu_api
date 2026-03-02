import test from "node:test";
import assert from "node:assert/strict";
import HanjutvSource from "./sources/hanjutv.js";

test("getEpisodeDanmuByLite 使用固定 toAxis 并正确推进分页游标", async () => {
  const source = new HanjutvSource();
  const calls = [];
  const pages = [
    { bulletchats: [{ id: 1, con: "a" }], more: 1, nextAxis: 12002, lastId: 6196941 },
    { bulletchats: [{ id: 2, con: "b" }], more: "1", nextAxis: 26951, lastId: 7914194 },
    { bulletchats: [{ id: 3, con: "c" }], more: 0, nextAxis: 60000, lastId: 8000000 },
  ];

  source.getDanmuMaxPages = () => 10;
  source.createLiteSession = async () => ({ uid: "R4VRuaXvhTDZ8g9oOiSd", headers: {} });
  source.requestLiteApi = async (pathname, query) => {
    calls.push({ pathname, query: { ...query } });
    const index = calls.length - 1;
    return pages[index] || { bulletchats: [], more: 0, nextAxis: query.fromAxis, lastId: query.prevId };
  };

  const danmus = await source.getEpisodeDanmuByLite("E123");

  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.pathname === "/api/v1/bulletchat/episode/get"));
  assert.deepEqual(calls.map((call) => call.query.eid), ["E123", "E123", "E123"]);
  assert.deepEqual(calls.map((call) => call.query.toAxis), [60000, 60000, 60000]);
  assert.deepEqual(calls.map((call) => call.query.fromAxis), [0, 12002, 26951]);
  assert.deepEqual(calls.map((call) => call.query.prevId), [0, 6196941, 7914194]);
  assert.equal(danmus.length, 3);
  assert.deepEqual(danmus.map((item) => item.id), [1, 2, 3]);
});
