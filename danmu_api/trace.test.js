// 请求链路追踪（trace）专项测试
import test from 'node:test';
import assert from 'node:assert';
import { handleRequest } from './worker.js';
import { handleClearCache, handleReqRecords } from './apis/system-api.js';
import { handleForwardTrace } from './apis/forward-trace-api.js';
import { Globals, globals } from './configs/globals.js';
import { tracesEnabled } from './utils/trace-util.js';

function baseEnv(extra = {}) {
  return {
    SOURCE_ORDER: 'local',
    LOG_LEVEL: 'error',
    TOKEN: '87654321',
    ADMIN_TOKEN: 'admin123',
    ...extra,
  };
}

function resetTraceState(env = baseEnv()) {
  Globals.init(env);
  Globals.reqRecords = [];
  Globals.reqTraces = new Map();
  Globals.todayReqNum = 0;
  Globals.localCacheValid = false;
  Globals.redisValid = false;
  Globals.localRedisValid = false;
  Globals.animes = [];
  Globals.episodeIds = [];
  Globals.episodeNum = 10001;
  Globals.searchCache = new Map();
  Globals.commentCache = new Map();
  Globals.requestHistory = new Map();
}

async function request(path, env, method = 'GET') {
  const res = await handleRequest(
    new Request(`http://127.0.0.1:9321${path}`, { method }),
    env,
    'node',
    '127.0.0.1'
  );
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { res, body };
}

test('trace: 搜索请求生成 trace、完成态字段与响应头', async () => {
  const env = baseEnv();
  resetTraceState(env);
  assert.equal(tracesEnabled(), true);

  const { res, body } = await request('/87654321/api/v2/search/anime?keyword=%E6%B5%8B%E8%AF%95', env);
  assert.equal(res.status, 200);
  assert.equal(body.animes.length, 0);
  const traceId = res.headers.get('X-Danmu-Trace-Id');
  assert.ok(traceId && traceId.startsWith('t_'));

  const record = Globals.reqRecords[0];
  assert.equal(record.traceId, traceId);
  assert.equal(record.statusCode, 200);
  assert.equal(record.success, true);
  assert.ok(record.durationMs >= 0);
  assert.equal(record.summary.title, '测试');

  const trace = Globals.reqTraces.get(traceId);
  const keys = trace.stages.map((stage) => stage.key);
  assert.ok(keys.includes('request.receive'));
  assert.ok(keys.includes('query.clean'));
  assert.ok(keys.includes('cache.search'));
  assert.ok(keys.includes('request.finish'));
  assert.equal(trace.httpStatus, 200);
});

test('trace: 详情接口返回全量，普通 token 脱敏，缺失/未知 id 有明确错误', async () => {
  const env = baseEnv();
  resetTraceState(env);
  const { res } = await request('/87654321/api/v2/search/anime?keyword=%E8%84%B1%E6%95%8F', env);
  const traceId = res.headers.get('X-Danmu-Trace-Id');

  const admin = await request(`/admin123/api/reqrecords/trace?id=${traceId}`, env);
  assert.equal(admin.res.status, 200);
  assert.equal(admin.body.success, true);
  assert.equal(admin.body.trace.summary.title, '脱敏');
  assert.equal(admin.body.trace.request.clientIp, '127.0.0.1');

  const masked = await request(`/87654321/api/reqrecords/trace?id=${traceId}`, env);
  assert.equal(masked.res.status, 200);
  assert.equal(masked.body.trace.summary.title, '***');
  assert.equal(masked.body.trace.request.clientIp, '***.*.*.*');

  const missing = await request('/admin123/api/reqrecords/trace', env);
  assert.equal(missing.res.status, 400);
  const unknown = await request('/admin123/api/reqrecords/trace?id=t_nope', env);
  assert.equal(unknown.res.status, 404);
});

test('trace: 并发请求互不串线', async () => {
  const env = baseEnv();
  resetTraceState(env);

  const [a, b] = await Promise.all([
    request('/87654321/api/v2/search/anime?keyword=%E5%B9%B6%E5%8F%91%E7%94%B2', env),
    request('/87654321/api/v2/search/anime?keyword=%E5%B9%B6%E5%8F%91%E4%B9%99', env),
  ]);
  const traceA = Globals.reqTraces.get(a.res.headers.get('X-Danmu-Trace-Id'));
  const traceB = Globals.reqTraces.get(b.res.headers.get('X-Danmu-Trace-Id'));
  assert.ok(traceA && traceB && traceA.id !== traceB.id);
  assert.ok(traceA.request.path.includes(encodeURIComponent('并发甲')));
  assert.ok(!traceA.request.path.includes(encodeURIComponent('并发乙')));
  assert.ok(traceB.request.path.includes(encodeURIComponent('并发乙')));
  assert.ok(!traceB.request.path.includes(encodeURIComponent('并发甲')));
  assert.equal(traceA.summary.title, '并发甲');
  assert.equal(traceB.summary.title, '并发乙');
});

test('trace: 容量按 MAX_TRACES 滚动，只保留最新', async () => {
  const env = baseEnv({ MAX_TRACES: '10' });
  resetTraceState(env);
  for (let i = 0; i < 12; i += 1) {
    await request(`/87654321/api/v2/search/anime?keyword=cap${i}`, env);
  }
  assert.equal(Globals.reqTraces.size, 10);
  const ids = [...Globals.reqTraces.keys()];
  assert.ok(!ids.includes(Globals.reqRecords[0].traceId), '最旧的 trace 应已被淘汰');
});

test('trace: TRACE_ENABLED=false 时只补完成态，不产生 trace', async () => {
  const env = baseEnv({ TRACE_ENABLED: 'false' });
  resetTraceState(env);
  const { res } = await request('/87654321/api/v2/search/anime?keyword=off', env);
  assert.equal(res.headers.get('X-Danmu-Trace-Id'), null);
  assert.equal(Globals.reqTraces.size, 0);
  assert.equal(Globals.reqRecords[0].statusCode, 200);
  assert.equal(Globals.reqRecords[0].traceId, undefined);
});

test('trace: 清理请求记录时一并清空 trace', async () => {
  const env = baseEnv();
  resetTraceState(env);
  await request('/87654321/api/v2/search/anime?keyword=clear', env);
  assert.ok(Globals.reqTraces.size > 0);

  const clearRes = await handleClearCache(new Request('http://127.0.0.1/api/cache/clear', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: ['requestHistory'] }),
  }));
  assert.equal(clearRes.status, 200);
  assert.equal(Globals.reqTraces.size, 0);
  assert.equal(Globals.reqRecords.length, 0);

  const recordsRes = handleReqRecords();
  const recordsBody = await recordsRes.json();
  assert.equal(recordsBody.todayReqNum, 0);
});

test('trace: forward 回传的事件进入 trace 与请求记录', async () => {
  const env = baseEnv();
  resetTraceState(env);
  const payload = {
    eventType: 'trace',
    widgetId: 'forward.auto.danmu2',
    handler: 'searchDanmu',
    status: 'ok',
    trace: {
      id: 't_forward_test',
      traceSchema: 1,
      request: { method: 'FORWARD', path: 'forward://searchDanmu' },
      startedAt: Date.now() - 25,
      durationMs: 25,
      status: 'ok',
      stages: [{ id: 's1', key: 'source.search', label: '来源搜索', status: 'ok', durationMs: 10 }],
      logs: [],
    },
  };
  const res = await handleForwardTrace(new Request('http://127.0.0.1/api/debug/forward-trace', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }));
  assert.equal(res.status, 202);
  const trace = Globals.reqTraces.get('t_forward_test');
  assert.ok(trace);
  assert.equal(trace.origin.kind, 'forward');
  assert.equal(trace.origin.handler, 'searchDanmu');
  const record = Globals.reqRecords[Globals.reqRecords.length - 1];
  assert.equal(record.method, 'FORWARD');
  assert.equal(record.traceId, 't_forward_test');
  assert.equal(record.success, true);
});
