// danmu_api/vercel.js
// Vercel (@vercel/node) 入口适配器
//
// 说明：Vercel Node Functions 期望默认导出为 (req, res) handler。
// 原仓库把 danmu_api/worker.js 直接作为 @vercel/node 入口，并且 default export 是
// Cloudflare Workers 风格的 { fetch() {} } 对象，容易导致部署后无法正确响应。
//
// 这里提供一个稳定的 Node 入口：把 Node 的 req/res 转成标准 Request，
// 调用核心 handleRequest，再把 Response 写回 res。

import { handleRequest } from './worker.js';
import { gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';

// =============== 出口 GZIP 压缩（Vercel Node Functions） ===============
// 不引入额外环境变量，保持简单：按客户端 Accept-Encoding 自动协商。
const GZIP_MIN_BYTES = 1024;
const GZIP_LEVEL = 6;
const gzipAsync = promisify(gzipCb);

function clientAcceptsGzip(req) {
  const ae = req.headers?.['accept-encoding'];
  if (!ae) return false;
  const v = Array.isArray(ae) ? ae.join(',') : String(ae);
  return v.toLowerCase().includes('gzip');
}

function isCompressibleContentType(contentType = '') {
  const ct = String(contentType).toLowerCase();
  if (!ct) return false;
  if (ct.startsWith('text/')) return true;
  if (ct.includes('json')) return true;
  if (ct.includes('xml')) return true;
  if (ct.includes('javascript')) return true;
  if (ct.includes('svg')) return true;
  return false;
}

function appendVary(existing, value) {
  if (!existing) return value;
  const current = Array.isArray(existing) ? existing.join(',') : String(existing);
  const parts = current.split(',').map(s => s.trim()).filter(Boolean);
  const lower = parts.map(s => s.toLowerCase());
  if (!lower.includes(value.toLowerCase())) parts.push(value);
  return parts.join(', ');
}

function shouldLogGzip(req) {
  const u = req?.url || '';
  return u.includes('/api/v2/comment') || u.includes('/api/v2/segmentcomment');
}

function logGzipDecision({ enabled, req, contentType, rawBytes, gzBytes, reason }) {
  // Vercel 的日志成本更敏感：仅在弹幕接口或客户端声明支持 gzip 时打印
  if (!shouldLogGzip(req) && !clientAcceptsGzip(req)) return;
  const url = req?.url || '';
  const method = req?.method || 'GET';
  const ct = contentType ? String(contentType) : '';

  if (enabled) {
    const ratio = rawBytes > 0 ? ((gzBytes / rawBytes) * 100).toFixed(1) : '0.0';
    console.log(`[GZIP][vercel] on  ${method} ${url} | ${rawBytes}B -> ${gzBytes}B (${ratio}%) | ${ct}`);
  } else {
    console.log(`[GZIP][vercel] off ${method} ${url} | ${rawBytes}B | ${ct}${reason ? ` | reason=${reason}` : ''}`);
  }
}

function normalizeHeaders(nodeHeaders) {
  const headers = {};
  for (const [k, v] of Object.entries(nodeHeaders || {})) {
    if (typeof v === 'undefined') continue;
    headers[k] = Array.isArray(v) ? v.join(',') : String(v);
  }
  return headers;
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getClientIp(req) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    const ip = String(forwardedFor).split(',')[0].trim();
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  }
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    const ip = String(realIp);
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  }
  const ip = req.socket?.remoteAddress || 'unknown';
  return typeof ip === 'string' && ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export default async function handler(req, res) {
  try {
    const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'localhost').split(',')[0].trim();
    const url = `${protocol}://${host}${req.url || '/'}`;

    const method = req.method || 'GET';

    // 兼容两种情况：
    // 1) req.body 已被上游解析（对象/字符串/Buffer）
    // 2) req.body 未解析（需要读取 stream）
    let body;
    if (!['GET', 'HEAD'].includes(method)) {
      if (typeof req.body !== 'undefined') {
        if (Buffer.isBuffer(req.body)) {
          body = req.body;
        } else if (typeof req.body === 'string') {
          body = Buffer.from(req.body);
        } else if (typeof req.body === 'object' && req.body !== null) {
          body = Buffer.from(JSON.stringify(req.body));
        } else {
          body = Buffer.from(String(req.body));
        }
      } else {
        body = await readBody(req);
      }
    }

    const webRequest = new Request(url, {
      method,
      headers: normalizeHeaders(req.headers),
      body: body && body.length ? body : undefined,
    });

    const webResponse = await handleRequest(webRequest, process.env, 'vercel', getClientIp(req));

    res.statusCode = webResponse.status;
    // Header 透传：移除与传输编码相关的字段（我们会在出口统一处理）
    webResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'content-encoding' || lowerKey === 'content-length') return;
      res.setHeader(key, value);
    });

    const contentType = webResponse.headers.get('content-type') || '';
    const alreadyEncoded = Boolean(webResponse.headers.get('content-encoding'));

    // 统一按二进制回写
    const ab = await webResponse.arrayBuffer();
    let buffer = Buffer.from(ab);

    const canGzip = (
      !alreadyEncoded &&
      (webResponse.status !== 204 && webResponse.status !== 304) &&
      (method !== 'HEAD') &&
      clientAcceptsGzip(req) &&
      isCompressibleContentType(contentType) &&
      buffer.length >= GZIP_MIN_BYTES
    );

    if (canGzip) {
      try {
        const compressed = await gzipAsync(buffer, { level: GZIP_LEVEL });
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', appendVary(res.getHeader('Vary'), 'Accept-Encoding'));
        res.setHeader('Content-Length', compressed.length);
        logGzipDecision({ enabled: true, req, contentType, rawBytes: buffer.length, gzBytes: compressed.length });
        buffer = compressed;
      } catch (err) {
        logGzipDecision({ enabled: false, req, contentType, rawBytes: buffer.length, reason: `compress-failed:${err?.message || err}` });
      }
    } else {
      let reason = '';
      if (alreadyEncoded) reason = 'already-encoded';
      else if (!clientAcceptsGzip(req)) reason = 'client-no-gzip';
      else if (!isCompressibleContentType(contentType)) reason = 'non-text-type';
      else if (buffer.length < GZIP_MIN_BYTES) reason = `too-small(<${GZIP_MIN_BYTES})`;
      else if (method === 'HEAD') reason = 'HEAD';
      else if (webResponse.status === 204 || webResponse.status === 304) reason = `status-${webResponse.status}`;
      logGzipDecision({ enabled: false, req, contentType, rawBytes: buffer.length, reason });
    }

    if (!res.hasHeader('Content-Length')) {
      res.setHeader('Content-Length', buffer.length);
    }

    res.end(buffer);
  } catch (err) {
    console.error('[vercel] handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
