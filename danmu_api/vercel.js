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
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // 统一按二进制回写，避免 text() 丢失非 UTF-8/压缩/图片等场景
    const ab = await webResponse.arrayBuffer();
    res.end(Buffer.from(ab));
  } catch (err) {
    console.error('[vercel] handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
