import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readOutboundConfig, registerOutbound, updateOutboundState } from './runtime.js';

function waitWithSignal(promise, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException('请求已取消', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readBody(stream, signal) {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  const cancel = reason => { reader.cancel(reason).catch(() => {}); };
  const abort = () => cancel(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const { value, done } = await waitWithSignal(reader.read(), signal);
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new TypeError('请求体流必须提供 Uint8Array');
      size += value.byteLength;
      if (size > 32 * 1024 * 1024) throw new Error('增强直连请求体超过 32 MiB');
      chunks.push(Buffer.from(value));
    }
    signal.throwIfAborted();
    return Buffer.concat(chunks, size);
  } catch (error) {
    cancel(error);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

export function createOutboundManager() {
  let child = null;
  let endpoint = '';
  let token = '';
  let fingerprint = '';
  let pending = null;
  let config;
  let stopped = false;
  let active = new Set();
  let configureQueue = Promise.resolve();

  async function stop() {
    stopped = true;
    for (const controller of active) controller.abort();
    endpoint = '';
    const previous = child;
    child = null;
    if (previous && previous.exitCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(() => { previous.kill('SIGKILL'); resolve(); }, 1500);
        previous.once('exit', () => { clearTimeout(timer); resolve(); });
        previous.kill('SIGTERM');
      });
    }
  }

  async function start() {
    if (endpoint && child?.exitCode === null) return;
    if (pending) return pending;
    if (stopped || config?.mode !== 'auto') throw new Error('增强直连组件未启用');
    pending = new Promise((resolve, reject) => {
      token = randomBytes(32).toString('hex');
      const helper = config.helperPath || fileURLToPath(new URL('../../outbound/bin/danmu-outbound' + (process.platform === 'win32' ? '.exe' : ''), import.meta.url));
      const instance = spawn(helper, ['--http-version', config.version, '--connect-timeout-ms', String(config.connectTimeout), '--doh-url', config.dohUrl], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DANMU_OUTBOUND_TOKEN: token },
      });
      child = instance;
      updateOutboundState({ status: 'starting', reason: '正在启动网络组件' });
      let output = '';
      let ready = false;
      const fail = message => {
        if (child === instance) {
          endpoint = '';
          updateOutboundState({ status: 'failed', reason: message });
        }
        // A stopped/replaced instance must still settle its startup promise.
        reject(new Error(message));
      };
      const timer = setTimeout(() => { fail('网络组件启动超时'); instance.kill('SIGTERM'); }, 5000);
      instance.stdout.on('data', chunk => {
        if (child !== instance) return;
        output += chunk.toString();
        if (output.length > 4096) { fail('网络组件启动响应异常'); instance.kill('SIGTERM'); return; }
        const line = output.split('\n')[0];
        if (!output.includes('\n') || ready) return;
        try {
          const result = JSON.parse(line);
          const address = new URL(result.url);
          if (result.ready !== true || address.protocol !== 'http:' || address.hostname !== '127.0.0.1' || !address.port) throw new Error();
          endpoint = address.origin;
          ready = true;
          clearTimeout(timer);
          updateOutboundState({ status: 'ready', reason: '' });
          resolve();
        } catch { fail('网络组件启动响应异常'); instance.kill('SIGTERM'); }
      });
      // The helper logs only host, protocol, ECH and phase; never request paths/headers.
      instance.stderr.on('data', chunk => console.error('[outbound]', chunk.toString().trim()));
      instance.once('error', error => { clearTimeout(timer); fail(`无法启动网络组件 (${error.code || 'spawn'})；请运行 npm run build:outbound 或设置 OUTBOUND_HELPER_PATH`); });
      instance.once('exit', () => { clearTimeout(timer); fail('网络组件已退出；请检查组件或重新加载配置'); if (child === instance) child = null; });
    }).finally(() => { pending = null; });
    return pending;
  }

  async function fetchEnhanced(url, init, timeoutMs) {
    const started = Date.now();
    const controller = new AbortController();
    active.add(controller);
    const signal = init.signal ? AbortSignal.any([init.signal, controller.signal, AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs)))]) : AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs)))]);
    try {
      signal.throwIfAborted();
      // Restart on a subsequent request, while preserving this request's total budget.
      await waitWithSignal(start(), signal);
      signal.throwIfAborted();
      // One Request supplies both serialized bytes and fetch's generated headers
      // (notably the same multipart boundary for FormData).
      const prepared = new Request(url, { ...init, signal, duplex: 'half' });
      const body = (await readBody(prepared.body, signal)).toString('base64');
      const headers = [...prepared.headers.entries()];
      signal.throwIfAborted();
      const response = await fetch(endpoint + '/request', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, signal,
        body: JSON.stringify({ url, method: init.method || 'GET', headers, body, timeoutMs: Math.max(1, Math.floor(timeoutMs - (Date.now() - started))) }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || '增强直连组件响应异常');
      const responseHeaders = new Headers();
      for (const [name, value] of result.headers) responseHeaders.append(name, value);
      const data = [204, 205, 304].includes(result.status) || init.method === 'HEAD' ? null : Buffer.from(result.body, 'base64');
      return new Response(data, { status: result.status, headers: responseHeaders });
    } finally { active.delete(controller); }
  }

  function configure(env, platform = 'node') {
    configureQueue = configureQueue.catch(() => {}).then(async () => {
      if (platform !== 'node') {
        await stop();
        registerOutbound(null, { supported: false, status: 'unsupported', reason: '当前平台不支持增强直连' });
        return;
      }
      let next;
      try { next = readOutboundConfig(env); } catch (error) {
        await stop();
        registerOutbound(fetchEnhanced, { supported: true, status: 'failed', reason: error.message });
        return;
      }
      if (next.mode === 'auto' && (typeof fetch !== 'function' || typeof Response !== 'function' || typeof AbortSignal.any !== 'function')) {
        await stop();
        registerOutbound(null, { supported: false, status: 'unsupported', reason: '当前 Node 缺少增强直连所需接口，请使用 Node 20.19+' });
        return;
      }
      const nextFingerprint = JSON.stringify(next);
      if (nextFingerprint === fingerprint && (next.mode === 'off' || endpoint)) return;
      await stop();
      config = next;
      fingerprint = nextFingerprint;
      stopped = false;
      registerOutbound(fetchEnhanced, { supported: true, status: next.mode === 'off' ? 'off' : 'starting', reason: '' });
      if (next.mode === 'auto') {
        try { await start(); } catch (error) { console.error('[outbound]', error.message); }
      }
    });
    return configureQueue;
  }
  return { configure, stop };
}
