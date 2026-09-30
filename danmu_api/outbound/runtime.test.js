import test from 'node:test';
import assert from 'node:assert/strict';
import { Globals, globals } from '../configs/globals.js';
import { httpGet, httpPost, runWithHttpCache } from '../utils/http-util.js';
import { handleConfig } from '../apis/system-api.js';
import { readOutboundConfig, registerOutbound, outboundStatus, usesEnhancedOutbound, fetchWithOutbound } from './runtime.js';
import { createOutboundManager } from './node-runtime.js';

function setup(env = {}, implementation = async () => new Response('{}')) {
  Globals.init({ LOG_LEVEL: 'error', OUTBOUND_MODE: 'auto', ...env });
  globals.deployPlatform = 'node';
  registerOutbound(implementation, { supported: true, status: 'ready', reason: '' });
}

test('enhanced outbound configuration and exact target selection', () => {
  assert.deepEqual(readOutboundConfig().sources, ['bahamut', 'tmdb']);
  assert.equal(readOutboundConfig().mode, 'off');
  for (const env of [{ OUTBOUND_MODE: 'on' }, { OUTBOUND_HTTP_VERSION: 'h1' }, { OUTBOUND_SOURCES: 'other' }, { OUTBOUND_DOH_URL: 'http://example.test/dns-query' }, { OUTBOUND_CONNECT_TIMEOUT_MS: 'NaN' }]) assert.throws(() => readOutboundConfig(env));
  setup();
  for (const url of ['https://api.gamer.com.tw/x', 'https://api.tmdb.org/3/x']) assert.equal(usesEnhancedOutbound(url, globals), true);
  for (const url of ['https://api.gamer.com.tw.evil.test/x', 'https://api.tmdb.org:444/x', 'http://api.tmdb.org/x', 'https://user:pass@api.tmdb.org/x']) assert.equal(usesEnhancedOutbound(url, globals), false);
  setup({ OUTBOUND_SOURCES: 'bahamut' });
  assert.equal(usesEnhancedOutbound('https://api.tmdb.org/x', globals), false);
});

test('existing proxy precedence excludes enhanced direct, including same-host reverse proxy', () => {
  for (const [proxy, kind] of [['bahamut@https://proxy.test,prefix', 'specific'], ['@https://proxy.test,http://127.0.0.1:8080', 'universal'], ['http://127.0.0.1:8080', 'forward'], ['bahamut@https://api.gamer.com.tw', 'specific']]) {
    setup({ PROXY_URL: proxy });
    assert.equal(globals.getProxyRoute('https://api.gamer.com.tw/x').kind, kind);
    assert.equal(usesEnhancedOutbound('https://api.gamer.com.tw/x', globals), false);
    assert.equal(usesEnhancedOutbound(globals.makeProxyUrl('https://api.gamer.com.tw/x'), globals), false);
  }
});

test('cloud platforms and widget keep ordinary transport and show unsupported status', async () => {
  const manager = createOutboundManager();
  for (const platform of ['cloudflare', 'vercel', 'netlify', 'edgeone', 'huggingface']) {
    setup();
    await manager.configure(globals.env, platform);
    assert.equal(usesEnhancedOutbound('https://api.gamer.com.tw/x', globals), false);
    assert.equal(outboundStatus(globals.env, platform).status, 'unsupported');
    globals.deployPlatform = platform;
    const config = await handleConfig(true).json();
    assert.equal(config.outbound.enabled, false);
    assert.match(config.envs.outboundStatus, /不支持/);
  }
  setup();
  globalThis.__FORWARD_WIDGET__ = true;
  try { assert.equal(usesEnhancedOutbound('https://api.tmdb.org/x', globals), false); } finally { delete globalThis.__FORWARD_WIDGET__; }
});

test('GET cache, JSON, binary and manual redirect semantics survive enhanced transport', async () => {
  let calls = 0;
  setup({}, async () => { calls++; return new Response('{"ok":true}', { headers: { 'x-test': 'yes' } }); });
  await runWithHttpCache(async () => {
    const first = await httpGet('https://api.tmdb.org/x');
    first.data.ok = false;
    const second = await httpGet('https://api.tmdb.org/x');
    assert.equal(second.data.ok, true);
    assert.equal(second.headers['x-test'], 'yes');
    assert.equal(calls, 1);
  });
  setup({}, async () => new Response(Uint8Array.from([0, 255, 128])));
  assert.equal((await httpGet('https://api.tmdb.org/x', { base64Data: true })).data, 'AP+A');
  setup({}, async () => new Response(null, { status: 302, headers: { location: 'https://api.tmdb.org/next' } }));
  assert.equal((await httpGet('https://api.tmdb.org/x', { allow_redirects: false, validStatusCodes: [302] })).status, 302);
});

test('cross-origin redirects reselect transport and remove credentials', async () => {
  setup({}, async () => new Response(null, { status: 302, headers: { location: 'https://other.test/final' } }));
  let ordinaryCalls = 0;
  const response = await fetchWithOutbound('https://api.gamer.com.tw/x', { method: 'GET', headers: { authorization: 'secret', cookie: 'secret' } }, globals, async (url, init) => {
    ordinaryCalls++;
    assert.equal(url, 'https://other.test/final');
    assert.equal(init.headers.has('authorization'), false);
    assert.equal(init.headers.has('cookie'), false);
    return new Response('done');
  }, Date.now() + 1000);
  assert.equal(await response.text(), 'done');
  assert.equal(ordinaryCalls, 1);
});

test('GET retries and retry delay share one deadline; cancellation stops promptly', async () => {
  let calls = 0;
  setup({}, async () => { calls++; throw new Error('handshake failed'); });
  const started = Date.now();
  await assert.rejects(httpGet('https://api.tmdb.org/x', { timeout: 80, retries: 3 }), { name: 'TimeoutError' });
  assert.equal(calls, 1);
  assert.ok(Date.now() - started < 400);
  const controller = new AbortController();
  setup({}, async (_url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
  }));
  const pending = httpGet('https://api.tmdb.org/x', { signal: controller.signal, timeout: 1000, retries: 3 });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('total deadline includes response body, and enhanced POST is never replayed', async () => {
  setup({}, async (_url, init) => new Response(new ReadableStream({ start(controller) { init.signal.addEventListener('abort', () => controller.error(new DOMException('timeout', 'AbortError')), { once: true }); } })));
  await assert.rejects(httpGet('https://api.tmdb.org/x', { timeout: 50 }), { name: 'AbortError' });
  let calls = 0;
  setup({}, async () => { calls++; throw new Error('request failed after send'); });
  await assert.rejects(httpPost('https://api.tmdb.org/x', 'payload', { retries: 3 }));
  assert.equal(calls, 1);
});

test('missing helper stays failed instead of silently falling back', async () => {
  const manager = createOutboundManager();
  const env = { OUTBOUND_MODE: 'auto', OUTBOUND_HELPER_PATH: '/nonexistent/danmu-outbound' };
  Globals.init({ ...env, LOG_LEVEL: 'error' });
  await manager.configure(env);
  assert.equal(outboundStatus(env, 'node').status, 'failed');
  await assert.rejects(httpGet('https://api.tmdb.org/x', { timeout: 1000 }), /无法启动/);
  await manager.stop();
  registerOutbound(null, { supported: false, status: 'unsupported' });
});

test('Node manager preserves binary/POST headers and cancels helper requests; configuration stops child', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'danmu-outbound-manager-'));
  const helper = join(directory, 'helper');
  await writeFile(helper, `#!${process.execPath}
import http from 'node:http';
const server = http.createServer(async (req, res) => {
  const chunks=[]; for await (const chunk of req) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks));
  if (req.headers.authorization !== 'Bearer ' + process.env.DANMU_OUTBOUND_TOKEN) {res.writeHead(401).end('{}');return;}
  if (input.url.endsWith('/slow')) return;
  res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({status:200,headers:[['X-Method',input.method],['X-Content-Type',(input.headers.find(([name])=>name.toLowerCase()==='content-type')||[])[1]||''],['Set-Cookie','a=1'],['Set-Cookie','b=2']],body:input.body || Buffer.from([0,255,128]).toString('base64')}));
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({ready:true,url:'http://127.0.0.1:'+server.address().port})+'\\n'));
process.stdin.resume();process.stdin.on('end',()=>process.exit());
process.on('SIGTERM',()=>process.exit());
`, { mode: 0o700 });
  const manager = createOutboundManager();
  const env = { OUTBOUND_MODE: 'auto', OUTBOUND_HELPER_PATH: helper, LOG_LEVEL: 'error' };
  try {
    Globals.init(env);
    await manager.configure(env);
    assert.equal(outboundStatus(env, 'node').status, 'ready');
    const post = await httpPost('https://api.tmdb.org/post', 'hello');
    assert.equal(post.data, 'hello');
    assert.equal(post.headers['x-method'], 'POST');
    assert.match(post.headers['set-cookie'], /a=1/);
    assert.match(post.headers['set-cookie'], /b=2/);
    assert.equal((await httpGet('https://api.tmdb.org/binary', { base64Data: true })).data, 'AP+A');
    const encoded = await httpPost('https://api.tmdb.org/post', new URLSearchParams({ name: '测试' }));
    assert.match(encoded.headers['x-content-type'], /^application\/x-www-form-urlencoded/);
    assert.match(encoded.data, /name=%/);
    const form = new FormData(); form.set('name', 'test');
    const multipart = await httpPost('https://api.tmdb.org/post', form);
    const boundary = /boundary=(.+)/.exec(multipart.headers['x-content-type'])?.[1];
    assert.ok(boundary);
    assert.ok(multipart.data.includes('--' + boundary));
    const explicit = await httpPost('https://api.tmdb.org/post', 'hello', { headers: { 'Content-Type': 'application/custom' } });
    assert.equal(explicit.headers['x-content-type'], 'application/custom');
    let bodyCancelled = false;
    const stream = new ReadableStream({ cancel() { bodyCancelled = true; } });
    const bodyStarted = Date.now();
    await assert.rejects(httpPost('https://api.tmdb.org/post', stream, { timeout: 50 }));
    assert.equal(bodyCancelled, true);
    assert.ok(Date.now() - bodyStarted < 600);
    let sizeCancelled = false;
    const large = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)); }, cancel() { sizeCancelled = true; } });
    await assert.rejects(httpPost('https://api.tmdb.org/post', large), /超过 32 MiB/);
    assert.equal(sizeCancelled, true);

    const controller = new AbortController();
    const started = Date.now();
    const pending = httpGet('https://api.tmdb.org/slow', { timeout: 2000, signal: controller.signal });
    setTimeout(() => controller.abort(), 40);
    await assert.rejects(pending);
    assert.ok(Date.now() - started < 600);
    await manager.configure({ ...env, OUTBOUND_MODE: 'off' });
    assert.equal(outboundStatus({ ...env, OUTBOUND_MODE: 'off' }, 'node').status, 'off');
  } finally { await manager.stop(); await rm(directory, { recursive: true, force: true }); }
});

test('stopping a helper during startup settles configure without hanging', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'danmu-outbound-startup-'));
  const helper = join(directory, 'helper');
  await writeFile(helper, `#!${process.execPath}\nsetInterval(()=>{},1000);process.on('SIGTERM',()=>process.exit());\n`, { mode: 0o700 });
  const manager = createOutboundManager();
  try {
    const configure = manager.configure({ OUTBOUND_MODE: 'auto', OUTBOUND_HELPER_PATH: helper });
    await new Promise(resolve => setTimeout(resolve, 50));
    await manager.stop();
    await Promise.race([configure, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('configure hung after stop')), 1000); timer.unref(); })]);
  } finally { await manager.stop(); await rm(directory, { recursive: true, force: true }); registerOutbound(null, { supported: false, status: 'unsupported' }); }
});

test('cloud bundle and browser transport registry exclude Node helper and child_process', async () => {
  const { build } = await import('esbuild');
  const cloud = await build({ entryPoints: ['danmu_api/worker.js'], bundle: true, platform: 'node', packages: 'external', write: false, metafile: true, logLevel: 'silent' });
  assert.equal(Object.keys(cloud.metafile.inputs).some(file => file.endsWith('/node-runtime.js')), false);
  assert.equal(cloud.outputFiles.some(file => /node:child_process|DANMU_OUTBOUND_TOKEN/.test(file.text)), false);
  const browser = await build({ entryPoints: ['danmu_api/outbound/runtime.js'], bundle: true, platform: 'browser', write: false, metafile: true, logLevel: 'silent' });
  assert.deepEqual(Object.keys(browser.metafile.inputs), ['danmu_api/outbound/runtime.js']);
});

test('Node without required cancellation API reports unsupported before starting helper', async () => {
  const original = AbortSignal.any;
  const manager = createOutboundManager();
  try {
    AbortSignal.any = undefined;
    await manager.configure({ OUTBOUND_MODE: 'auto' });
    const status = outboundStatus({ OUTBOUND_MODE: 'auto' }, 'node');
    assert.equal(status.status, 'unsupported');
    assert.match(status.reason, /Node 20.19/);
  } finally { AbortSignal.any = original; await manager.stop(); registerOutbound(null, { supported: false, status: 'unsupported', reason: '仅支持独立 Node / Docker / Termux 部署' }); }
});

test('invalid dedicated proxy and TMDB long alias still exclude enhanced direct', () => {
  setup({ PROXY_URL: 'bahamut@invalid-url' });
  assert.equal(globals.getProxyRoute('https://api.gamer.com.tw/x').kind, 'specific');
  assert.equal(usesEnhancedOutbound('https://api.gamer.com.tw/x', globals), false);
  setup({ PROXY_URL: 'tmdb@https://proxy.test' });
  const route = globals.getProxyRoute('https://api.themoviedb.org/x');
  assert.equal(route.kind, 'specific');
  assert.equal(route.url, 'https://proxy.test/x');
  assert.equal(usesEnhancedOutbound('https://api.themoviedb.org/x', globals), false);
  registerOutbound(null, { supported: false, status: 'unsupported' });
});

test('enhanced URL handling normalizes hostname and discards fragments like fetch', async () => {
  setup({}, async url => {
    assert.equal(url, 'https://api.tmdb.org/x');
    return new Response('{}');
  });
  assert.equal((await httpGet('https://API.TMDB.ORG/x#ignored')).status, 200);
  registerOutbound(null, { supported: false, status: 'unsupported' });
});
