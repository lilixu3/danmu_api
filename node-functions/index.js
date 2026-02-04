import { handleRequest } from '../danmu_api/worker.js';

/**
 * EdgeOne Pages Functions 入口
 *
 * 注意：这里运行在 Fetch API 语义下（Request/Response/Headers）。
 * 原文件里把 Headers 当成普通对象去取值、并对 request.body 做 JSON.stringify，
 * 会导致：
 * 1) 客户端 IP 永远取不到；
 * 2) POST/PUT 等请求体被破坏（body 变成 "{}" 或字符串化后的错误格式）。
 *
 * 本实现：
 * - 使用 headers.get(...) 读取请求头
 * - 使用 new Request(fullUrl, request) 直接克隆原始请求（保留 method/headers/body）
 */
export const onRequest = async (context) => {
  const { request, env } = context;

  // EdgeOne 的 rewrite 规则可能把 / 重写到 /node-functions/index.js，
  // 或把任意路径重写到 /node-functions/[[...path]].js。
  // handleRequest 主要依赖 pathname/searchParams，因此我们尽量还原真实 pathname。
  const fallbackBase = 'https://localhost';

  let fullUrl;
  try {
    const u = new URL(request?.url || '/', fallbackBase);
    let pathname = u.pathname;

    // 将内部函数路径映射回根路径
    if (pathname === '/node-functions/index.js') {
      pathname = '/';
    }

    // 兼容 EdgeOne rewrite 到动态文件名的情况（如果平台提供 params，则优先使用）
    if (pathname === '/node-functions/[[...path]].js' || pathname === '/node-functions/[[...path]]..js') {
      const p = context?.params?.path;
      if (Array.isArray(p)) {
        pathname = '/' + p.join('/');
      } else if (typeof p === 'string' && p) {
        pathname = '/' + p;
      } else {
        // 无 params 时无法还原，至少保证不报错
        pathname = '/';
      }
    }

    fullUrl = new URL(pathname + u.search, u.origin || fallbackBase).toString();
  } catch (error) {
    console.error('[edgeone] URL Construction Error:', error);
    return new Response('Invalid URL', { status: 400 });
  }

  // 克隆原始 request，但替换 URL
  let modifiedRequest;
  try {
    modifiedRequest = new Request(fullUrl, request);
  } catch (error) {
    console.error('[edgeone] Request Clone Error:', error);
    return new Response('Invalid Request', { status: 400 });
  }

  // 获取客户端 IP（优先 EdgeOne 注入的头；其次走常见反代头；最后兜底 context.ip）
  const eoIp = request.headers?.get?.('eo-connecting-ip');
  const xRealIp = request.headers?.get?.('x-real-ip');
  const forwardedFor = request.headers?.get?.('x-forwarded-for');

  let clientIp = eoIp || xRealIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '') || context.ip || 'unknown';
  if (typeof clientIp === 'string' && clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.slice(7);
  }

  return await handleRequest(modifiedRequest, env, 'edgeone', clientIp);
};
