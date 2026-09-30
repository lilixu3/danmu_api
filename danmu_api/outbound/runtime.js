// Runtime-neutral registry. Only server.js installs the Node implementation.
// Workers, cloud functions and the Forward bundle never import node-runtime.js.
const hosts = new Map([
  ['api.gamer.com.tw', 'bahamut'],
  ['api.tmdb.org', 'tmdb'],
  ['api.themoviedb.org', 'tmdb'],
]);
let transport = null;
let state = { supported: false, status: 'unsupported', reason: '仅支持独立 Node / Docker / Termux 部署' };

export function readOutboundConfig(env = {}) {
  const mode = String(env.OUTBOUND_MODE ?? 'off').trim().toLowerCase();
  const version = String(env.OUTBOUND_HTTP_VERSION ?? 'auto').trim().toLowerCase();
  const sources = [...new Set(String(env.OUTBOUND_SOURCES ?? 'bahamut,tmdb').split(',').map(v => v.trim().toLowerCase()).filter(Boolean))];
  if (!['off', 'auto'].includes(mode)) throw new Error('OUTBOUND_MODE 必须为 off 或 auto');
  if (!['auto', 'h2', 'h3'].includes(version)) throw new Error('OUTBOUND_HTTP_VERSION 必须为 auto、h2 或 h3');
  if (sources.some(v => !['bahamut', 'tmdb'].includes(v))) throw new Error('OUTBOUND_SOURCES 仅支持 bahamut、tmdb');
  const connectTimeout = Number(env.OUTBOUND_CONNECT_TIMEOUT_MS ?? 3000);
  if (!Number.isInteger(connectTimeout) || connectTimeout <= 0 || connectTimeout > 60000) throw new Error('OUTBOUND_CONNECT_TIMEOUT_MS 必须为 1–60000 的整数');
  const dohUrl = String(env.OUTBOUND_DOH_URL ?? '').trim();
  if (dohUrl) {
    const u = new URL(dohUrl);
    if (u.protocol !== 'https:' || u.username || u.password || u.hash) throw new Error('OUTBOUND_DOH_URL 必须为不含凭据及片段的 HTTPS URL');
  }
  return { mode, version, sources, connectTimeout, dohUrl, helperPath: String(env.OUTBOUND_HELPER_PATH ?? '').trim() };
}

export function registerOutbound(fetchImpl, nextState) {
  transport = fetchImpl;
  state = { ...state, ...nextState };
}
export function updateOutboundState(nextState) { state = { ...state, ...nextState }; }
export function outboundStatus(env = {}, platform) {
  if (platform !== 'node' || !state.supported || globalThis.__FORWARD_WIDGET__ === true) {
    return {
      supported: false,
      requested: String(env.OUTBOUND_MODE ?? 'off').trim().toLowerCase() === 'auto',
      enabled: false,
      status: 'unsupported',
      reason: platform === 'node' && state.reason ? state.reason : '仅支持独立 Node / Docker / Termux 部署',
    };
  }
  let config;
  try { config = readOutboundConfig(env); } catch (error) {
    return { supported: true, requested: true, enabled: false, status: 'failed', reason: error.message };
  }
  return { ...state, requested: config.mode === 'auto', enabled: config.mode === 'auto' && state.status === 'ready', sources: config.sources, httpVersion: config.version };
}

export function usesEnhancedOutbound(url, globals) {
  if (!state.supported || !transport || globalThis.__FORWARD_WIDGET__ === true) return false;
  // Eligibility comes from server bootstrap, not a mutable per-request platform field.
  const u = new URL(url);
  const source = u.protocol === 'https:' && (!u.port || u.port === '443') && !u.username && !u.password ? hosts.get(u.hostname) : null;
  if (!source) return false;
  const config = readOutboundConfig(globals.env);
  return config.mode === 'auto' && config.sources.includes(source) && globals.getProxyRoute(url).kind === 'direct';
}

export async function fetchWithOutbound(url, init, globals, ordinaryFetch, deadline) {
  const initial = new URL(url);
  initial.hash = '';
  let current = initial.href;
  let request = { ...init, headers: new Headers(init.headers), redirect: 'manual' };
  for (let redirects = 0; redirects <= 10; redirects++) {
    request.signal?.throwIfAborted();
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new DOMException('增强直连请求总超时', 'TimeoutError');
    const route = globals.getProxyRoute(current);
    const response = usesEnhancedOutbound(current, globals)
      ? await transport(current, request, remaining)
      : await ordinaryFetch(route.url, request);
    const location = response.headers.get('location');
    if (init.redirect === 'manual' || !location || ![301, 302, 303, 307, 308].includes(response.status)) return response;
    await response.body?.cancel();
    if (redirects === 10) throw new Error('增强直连重定向次数超限');
    const next = new URL(location, current);
    if (!['http:', 'https:'].includes(next.protocol) || next.username || next.password) throw new Error('不支持的重定向 URL');
    if (next.origin !== new URL(current).origin) {
      request.headers.delete('authorization');
      request.headers.delete('cookie');
      request.headers.delete('proxy-authorization');
    }
    if ((response.status === 303 && request.method !== 'HEAD') || ([301, 302].includes(response.status) && request.method === 'POST')) {
      request = { ...request, method: 'GET', body: undefined };
      request.headers.delete('content-type');
      request.headers.delete('content-length');
    }
    next.hash = '';
    current = next.href;
  }
}
