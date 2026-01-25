// utils/node-response-util.js
// Node.js 运行时适配：
// 1) 将 Web 标准的 Response 以“流式”的方式写回 Node 的 res（避免 arrayBuffer 全量缓冲导致的延迟/内存峰值）
// 2) 按客户端 Accept-Encoding 协商 gzip 压缩（可显著降低弹幕 JSON/XML 体积，提升客户端加载速度）
//
// ⚠️ 注意：该文件仅应被 Node 运行时入口（server.js / vercel.js 等）引用。

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';

import { parseBoolean } from './common-util.js';

// hop-by-hop 头不应转发（RFC 2616 / 7230）
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function getReqHeader(req, name) {
  if (!req) return '';
  const n = String(name || '').toLowerCase();
  const h = req.headers;
  if (!h) return '';

  // fetch/Headers-like
  if (typeof h.get === 'function') {
    return h.get(n) || h.get(name) || '';
  }

  // Node IncomingMessage headers object
  return h[n] ?? h[name] ?? '';
}

function appendVary(current, value) {
  const v = String(value || '').trim();
  if (!v) return current;
  const cur = String(current || '').trim();
  if (!cur) return v;

  const parts = cur.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (parts.includes(v.toLowerCase())) return cur;
  return `${cur}, ${v}`;
}

function isCompressibleContentType(contentType) {
  if (!contentType) return false;
  const ct = String(contentType).toLowerCase();

  // 典型弹幕/文本资源
  if (ct.startsWith('text/')) return true;
  if (ct.includes('json')) return true;
  if (ct.includes('xml')) return true;
  if (ct.includes('javascript')) return true;
  if (ct.includes('svg')) return true;
  if (ct.includes('x-www-form-urlencoded')) return true;
  return false;
}

function parseNumberHeader(v) {
  const n = Number.parseInt(String(v || '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function shouldGzip(req, webResponse, env) {
  const enabled = parseBoolean(env?.RESPONSE_GZIP, true);
  if (!enabled) return false;

  // 请求方不支持 gzip
  const ae = String(getReqHeader(req, 'accept-encoding') || '');
  if (!/\bgzip\b/i.test(ae)) return false;

  // 这些状态码没有 body
  const status = Number(webResponse?.status || 0);
  if (status === 204 || status === 304) return false;

  // HEAD 不应返回 body
  const method = String(req?.method || '').toUpperCase();
  if (method === 'HEAD') return false;

  // 若已存在 Content-Encoding，则认为上游已处理（避免二次压缩）
  const existingCE = webResponse?.headers?.get?.('content-encoding');
  if (existingCE && String(existingCE).trim() && String(existingCE).toLowerCase() !== 'identity') {
    return false;
  }

  // Cache-Control: no-transform 时不做内容变换
  const cacheControl = webResponse?.headers?.get?.('cache-control');
  if (cacheControl && /no-transform/i.test(cacheControl)) {
    return false;
  }

  // 仅压缩可压缩的类型（避免无意义 CPU 开销）
  const contentType = webResponse?.headers?.get?.('content-type') || '';
  if (!isCompressibleContentType(contentType)) return false;

  // 小响应不压缩（优先用 Content-Length 判断；没有则压缩）
  const minBytes = parseNumberHeader(env?.RESPONSE_GZIP_MIN_BYTES) ?? 1024;
  const contentLength = parseNumberHeader(webResponse?.headers?.get?.('content-length'));
  if (contentLength !== null && contentLength >= 0 && contentLength < minBytes) return false;

  // 确保有 body
  if (!webResponse?.body) return false;

  return true;
}

function getGzipLevel(env) {
  const raw = env?.RESPONSE_GZIP_LEVEL ?? env?.GZIP_LEVEL;
  const n = parseNumberHeader(raw);
  if (n === null) return 6;
  // zlib level: 0-9
  return Math.max(0, Math.min(9, n));
}

/**
 * 将 Web Response 写回 Node.js res。
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Response} webResponse
 * @param {Record<string, any>} [env]
 */
export async function sendWebResponseToNode(req, res, webResponse, env = process.env) {
  const useGzip = shouldGzip(req, webResponse, env);

  // status
  res.statusCode = webResponse.status;

  // headers
  webResponse.headers.forEach((value, key) => {
    const k = String(key || '').toLowerCase();
    if (!k || HOP_BY_HOP_HEADERS.has(k)) return;

    // gzip 时需要移除/覆盖部分头
    if (useGzip) {
      if (k === 'content-length') return;
      if (k === 'content-encoding') return;
    }

    try {
      res.setHeader(key, value);
    } catch {
      // 某些平台/运行时可能对个别头有限制，忽略即可
    }
  });

  if (useGzip) {
    // Vary: Accept-Encoding
    const vary = res.getHeader('vary');
    res.setHeader('Vary', appendVary(vary, 'Accept-Encoding'));

    // 标记 gzip
    res.setHeader('Content-Encoding', 'gzip');
  }

  // 无 body 或 HEAD
  const method = String(req?.method || '').toUpperCase();
  if (method === 'HEAD' || !webResponse.body) {
    res.end();
    return;
  }

  // 先 flush headers，尽量降低首包等待
  if (typeof res.flushHeaders === 'function') {
    try { res.flushHeaders(); } catch {}
  }

  const bodyStream = Readable.fromWeb(webResponse.body);

  if (useGzip) {
    const level = getGzipLevel(env);
    const gzip = zlib.createGzip({
      level,
      // 让数据更“及时”地被 flush 到客户端（减少缓冲引入的额外等待）
      flush: zlib.constants.Z_SYNC_FLUSH,
    });

    await pipeline(bodyStream, gzip, res);
    return;
  }

  await pipeline(bodyStream, res);
}
