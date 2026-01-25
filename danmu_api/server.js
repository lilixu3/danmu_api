// server.js - Node 本地/Docker 启动入口（ESM）
// 目标：
// 1) Node >= 18 直接使用内置 fetch/Request/Response，移除 node-fetch + 兼容 shim
// 2) .env 自动生成 + 热加载，但不会误删系统环境变量
// 3) 9321 主服务 + 5321 简单代理服务（用于正向代理/调试）

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import chokidar from 'chokidar';
import { HttpsProxyAgent } from 'https-proxy-agent';

import { handleRequest } from './worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 保存系统环境变量的副本，确保它们具有最高优先级
const systemEnvBackup = { ...process.env };

// =============== 出口 GZIP 压缩（Node 本地/Docker） ===============
// 说明：
// - 仅在客户端声明支持 gzip（Accept-Encoding 包含 gzip）时启用
// - 仅对文本类响应（json/xml/text 等）启用，避免对二进制/图片等做无意义压缩
// - 仅对超过阈值的响应启用，避免小包负优化
//
// ⚠️ 这里不引入额外环境变量，保持“开箱即用 + 不显得乱”。
const GZIP_MIN_BYTES = 1024;     // 小于此大小不压缩（避免 gzip 头开销）
const GZIP_LEVEL = 6;           // 0-9，默认 6 在压缩率与 CPU 之间较均衡
const gzipAsync = promisify(gzipCb);

// 配置文件路径在项目根目录（server.js 的上一级目录）
const projectRoot = path.join(__dirname, '..');
const configDir = path.join(projectRoot, 'config');
const envPath = path.join(configDir, '.env');
const envExamplePath = path.join(configDir, '.env.example');

// 仅追踪由 dotenv 写入到 process.env 的键（用于热更新时安全清理）
let dotenvKeys = new Set();

// =============== 配置文件自动生成 ===============
function checkAndCopyConfigFiles() {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (fs.existsSync(envPath)) {
      console.log('[server] Configuration file exists, skipping auto-copy');
      return;
    }

    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('[server] Copied .env.example to .env successfully');
      return;
    }

    console.log('[server] .env.example not found, cannot auto-copy');
  } catch (err) {
    console.log('[server] Error during config auto-copy:', err?.message || err);
  }
}

// =============== 环境变量加载（系统 env 优先） ===============
function loadEnv() {
  // 先清理旧的 dotenvKeys（只清理 dotenv 写入的，不碰系统变量）
  for (const k of dotenvKeys) {
    if (!(k in systemEnvBackup)) {
      delete process.env[k];
    }
  }
  dotenvKeys = new Set();

  if (!fs.existsSync(envPath)) {
    // 恢复系统环境变量的值，确保它们具有最高优先级
    Object.assign(process.env, systemEnvBackup);
    console.log('[server] .env not found, using system environment variables only');
    return;
  }

  // dotenv 解析（不自动写入），避免覆盖系统 env
  const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (!(k in systemEnvBackup)) {
      process.env[k] = v;
      dotenvKeys.add(k);
    }
  }

  // 最后恢复系统环境变量，确保最高优先级
  Object.assign(process.env, systemEnvBackup);

  console.log('[server] .env loaded successfully');
}

// =============== .env 热更新 ===============
let envWatcher = null;
let reloadTimer = null;
let mainServer = null;
let proxyServer = null;

function setupEnvWatcher() {
  if (!fs.existsSync(envPath)) {
    console.log('[server] .env not found, skipping file watcher');
    return;
  }

  envWatcher = chokidar.watch([envPath], {
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100,
    },
  });

  envWatcher.on('change', (changedPath) => {
    if (reloadTimer) clearTimeout(reloadTimer);

    reloadTimer = setTimeout(() => {
      console.log(`[server] ${path.basename(changedPath)} changed, reloading environment variables...`);
      try {
        loadEnv();
        console.log('[server] Environment variables reloaded successfully');
        console.log('[server] dotenv keys:', Array.from(dotenvKeys).join(', '));
      } catch (err) {
        console.log('[server] Error reloading .env:', err?.message || err);
      } finally {
        reloadTimer = null;
      }
    }, 200);
  });

  envWatcher.on('error', (error) => {
    console.log('[server] File watcher error:', error?.message || error);
  });

  console.log('[server] Configuration file watcher started for: .env');
}

function cleanupWatcher() {
  if (envWatcher) {
    console.log('[server] Closing file watcher...');
    envWatcher.close();
    envWatcher = null;
  }
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  if (mainServer) {
    console.log('[server] Closing main server...');
    mainServer.close(() => console.log('[server] Main server closed'));
  }
  if (proxyServer) {
    console.log('[server] Closing proxy server...');
    proxyServer.close(() => console.log('[server] Proxy server closed'));
  }

  setTimeout(() => {
    console.log('[server] Exit complete.');
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', cleanupWatcher);
process.on('SIGINT', cleanupWatcher);

// =============== 工具：Header 规范化 ===============
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
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0].trim();
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    const ip = String(realIp);
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  }
  const ip = req.socket?.remoteAddress || 'unknown';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

// =============== 工具：GZIP 决策与日志 ===============
function clientAcceptsGzip(req) {
  const ae = req.headers?.['accept-encoding'];
  if (!ae) return false;
  const v = Array.isArray(ae) ? ae.join(',') : String(ae);
  return v.toLowerCase().includes('gzip');
}

function isCompressibleContentType(contentType = '') {
  const ct = String(contentType).toLowerCase();
  if (!ct) return false;

  // 常见文本类
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
  if (!lower.includes(value.toLowerCase())) {
    parts.push(value);
  }
  return parts.join(', ');
}

function shouldLogGzip(req) {
  // 仅在弹幕相关接口上强制打印 gzip 决策，避免日志过于吵
  // 你如果希望所有接口都打印，可以把这里改为：return true;
  const u = req?.url || '';
  return u.includes('/api/v2/comment') || u.includes('/api/v2/segmentcomment');
}

function logGzipDecision({ enabled, req, contentType, rawBytes, gzBytes, reason }) {
  const url = req?.url || '';
  const method = req?.method || 'GET';
  const ct = contentType ? String(contentType) : '';

  if (enabled) {
    const ratio = rawBytes > 0 ? ((gzBytes / rawBytes) * 100).toFixed(1) : '0.0';
    console.log(`[GZIP] on  ${method} ${url} | ${rawBytes}B -> ${gzBytes}B (${ratio}%) | ${ct}`);
  } else {
    // 仅在弹幕接口，或客户端声明支持 gzip 时打印关闭原因
    if (shouldLogGzip(req) || clientAcceptsGzip(req)) {
      console.log(`[GZIP] off ${method} ${url} | ${rawBytes}B | ${ct}${reason ? ` | reason=${reason}` : ''}`);
    }
  }
}

// =============== 主业务服务器（9321） ===============
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const fullUrl = `http://${req.headers.host}${req.url}`;
      const clientIp = getClientIp(req);

      const method = req.method || 'GET';
      const body = (method === 'POST' || method === 'PUT' || method === 'PATCH') ? await readBody(req) : undefined;

      const webRequest = new Request(fullUrl, {
        method,
        headers: normalizeHeaders(req.headers),
        body: body && body.length ? body : undefined,
      });

      const webResponse = await handleRequest(webRequest, process.env, 'node', clientIp);

      res.statusCode = webResponse.status;

      // Header 透传：移除与传输编码相关的字段（我们会在出口统一处理）
      // 避免出现：body 已是解压后的数据，但 header 仍残留 Content-Encoding 导致客户端解析异常
      webResponse.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'content-encoding' || lowerKey === 'content-length') return;
        res.setHeader(key, value);
      });

      const contentType = webResponse.headers.get('content-type') || '';
      const alreadyEncoded = Boolean(webResponse.headers.get('content-encoding'));

      // 统一按二进制读取
      const ab = await webResponse.arrayBuffer();
      let buffer = Buffer.from(ab);

      // [优化] 出口 gzip：仅在条件满足时启用
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
          logGzipDecision({
            enabled: true,
            req,
            contentType,
            rawBytes: buffer.length,
            gzBytes: compressed.length,
          });
          buffer = compressed;
        } catch (err) {
          // 压缩失败时直接回退原始数据
          logGzipDecision({
            enabled: false,
            req,
            contentType,
            rawBytes: buffer.length,
            reason: `compress-failed:${err?.message || err}`
          });
        }
      } else {
        // 打印“未启用 gzip”的原因（便于你快速确认到底有没有生效）
        let reason = '';
        if (alreadyEncoded) reason = 'already-encoded';
        else if (!clientAcceptsGzip(req)) reason = 'client-no-gzip';
        else if (!isCompressibleContentType(contentType)) reason = 'non-text-type';
        else if (buffer.length < GZIP_MIN_BYTES) reason = `too-small(<${GZIP_MIN_BYTES})`;
        else if (method === 'HEAD') reason = 'HEAD';
        else if (webResponse.status === 204 || webResponse.status === 304) reason = `status-${webResponse.status}`;
        logGzipDecision({ enabled: false, req, contentType, rawBytes: buffer.length, reason });
      }

      // Node 在 res.end(Buffer) 时通常会自动补 Content-Length，
      // 但我们在 gzip 分支会明确设置；这里再兜底一次，确保日志/客户端一致。
      if (!res.hasHeader('Content-Length')) {
        res.setHeader('Content-Length', buffer.length);
      }

      res.end(buffer);
    } catch (error) {
      console.error('[server] Server error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
}

// =============== 代理服务器（5321） ===============
function createProxyServer() {
  return http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url, 'http://localhost');

      // 仅提供 /proxy 入口，避免误用为通用 HTTP 服务
      if (urlObj.pathname !== '/proxy') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      // 可选：为本地代理增加额外鉴权（防止将端口暴露公网后变成开放代理）
      const proxyToken = process.env.LOCAL_PROXY_TOKEN;
      if (proxyToken) {
        const provided = req.headers['x-proxy-token'];
        if (provided !== proxyToken) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Forbidden');
          return;
        }
      }

      const target = urlObj.searchParams.get('url');

      if (!target) {
        res.statusCode = 400;
        res.end('Bad Request: Missing url parameter');
        return;
      }

      // 只允许 http/https
      let targetUrl;
      try {
        targetUrl = new URL(target);
      } catch (e) {
        res.statusCode = 400;
        res.end('Bad Request: Invalid url format');
        return;
      }
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        res.statusCode = 400;
        res.end('Bad Request: Only http/https are allowed');
        return;
      }

      // 解析 PROXY_URL（仅取第一个正向代理配置；忽略反代/万能反代规则）
      const proxyConfig = (process.env.PROXY_URL || '').split(',').map(s => s.trim()).filter(Boolean);
      const forwardProxy = proxyConfig.find(c => c && !/^@/.test(c) && !/^[\w-]+@http/i.test(c)) || null;

      const protocol = targetUrl.protocol === 'https:' ? https : http;
      const method = req.method || 'GET';
      const body = (method === 'POST' || method === 'PUT' || method === 'PATCH') ? await readBody(req) : undefined;

      const headers = normalizeHeaders(req.headers);
      delete headers.host; // 让上游自动填充

      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method,
        headers,
        agent: forwardProxy ? new HttpsProxyAgent(forwardProxy) : undefined,
      };

      const proxyReq = protocol.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      req.on('close', () => {
        if (!res.writableEnded) {
          proxyReq.destroy();
        }
      });

      proxyReq.on('error', (err) => {
        if (req.destroyed || req.aborted || err.code === 'ECONNRESET' || err.message === 'socket hang up') {
          if (!res.writableEnded) {
            console.log('[Proxy Server] Upstream connection closed (expected behavior due to client interrupt).');
          }
          return;
        }
        console.error('[Proxy Server] Proxy request error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Proxy Error: ' + err.message);
        }
      });

      if (body && body.length) proxyReq.write(body);
      proxyReq.end();
    } catch (err) {
      console.error('[Proxy Server] Error:', err);
      if (!res.headersSent) res.statusCode = 500;
      res.end('Proxy Error');
    }
  });
}



function hasForwardProxyConfig() {
  const proxyConfig = (process.env.PROXY_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  return proxyConfig.some(c => c && !/^@/.test(c) && !/^[\w-]+@http/i.test(c));
}

// =============== 启动 ===============
checkAndCopyConfigFiles();
loadEnv();
setupEnvWatcher();

mainServer = createServer();
mainServer.listen(9321, '0.0.0.0', () => {
  console.log('Server running on http://0.0.0.0:9321');
});

if (hasForwardProxyConfig()) {
  proxyServer = createProxyServer();
  const bindHost = process.env.LOCAL_PROXY_BIND || '127.0.0.1';
  proxyServer.listen(5321, bindHost, () => {
    console.log(`Proxy server running on http://${bindHost}:5321 (local forward proxy helper)`);
    if (bindHost !== '127.0.0.1' && !process.env.LOCAL_PROXY_TOKEN) {
      console.warn('[proxy] Warning: LOCAL_PROXY_BIND is not 127.0.0.1 but LOCAL_PROXY_TOKEN is not set. This may expose an open proxy.');
    }
  });
} else {
  console.log('Proxy server disabled (no forward proxy configured in PROXY_URL).');
}
