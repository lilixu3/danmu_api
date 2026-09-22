/**
 * 请求链路追踪（trace）
 *
 * 设计目标：
 *   * 单请求一条 trace，按时间顺序记录匹配/搜索/聚合的每个阶段；
 *   * 通过 AsyncLocalStorage 把 trace 透传到任意深度的异步调用链，
 *     sources 下的各源文件无需感知（框架级打点即可覆盖全部来源）；
 *   * 只对请求记录覆盖的接口启用，内部轮询接口永不追踪，避免自激；
 *   * 内存里保留最近 MAX_TRACES 条，容量固定，可随本地缓存/Redis 持久化。
 *
 * 兼容性：
 *   * Node / Vercel / Netlify / EdgeOne / 手机内嵌宿主都有 AsyncLocalStorage；
 *   * Forward widget 运行时只有同步 stub，因此额外提供
 *     setFallbackTrace / clearFallbackTrace 作为显式上下文兜底。
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { globals } from '../configs/globals.js';

export const TRACE_SCHEMA = 1;

const DEFAULT_MAX_TRACES = 100;
const MAX_STAGES = 120;
const MAX_LOGS = 120;
const MAX_LOG_MESSAGE = 400;
const MAX_DETAIL_DEPTH = 3;
const MAX_DETAIL_ARRAY = 5;
const MAX_DETAIL_KEYS = 30;
const MAX_DETAIL_STRING = 300;
const MAX_STAGE_ERROR = 300;
const SENSITIVE_KEY = /(cookie|token|api.?key|authorization|password|secret|signature)/i;

let asyncStorage = null;
try {
  asyncStorage = new AsyncLocalStorage();
} catch (_) {
  asyncStorage = null;
}

let fallbackTrace = null;
let traceSeq = 0;

function nowMs() {
  return Date.now();
}

/** 当前请求的 trace（主线程用 ALS；Forward 等无 ALS 环境用显式兜底） */
export function currentTrace() {
  try {
    const active = asyncStorage?.getStore();
    if (active) return active;
  } catch (_) {
    // 忽略运行时差异
  }
  return fallbackTrace;
}

/** Forward widget 等无异步 ALS 的环境：显式挂上当前 trace */
export function setFallbackTrace(trace) {
  fallbackTrace = trace || null;
  return fallbackTrace;
}

export function clearFallbackTrace(trace) {
  if (!trace || fallbackTrace === trace) fallbackTrace = null;
}

/** 在 trace 上下文中执行；无 ALS 时退化为显式上下文（并发假设单请求） */
export function runWithTrace(trace, fn) {
  if (asyncStorage) return asyncStorage.run(trace, fn);
  fallbackTrace = trace || null;
  try {
    return fn();
  } finally {
    clearFallbackTrace(trace);
  }
}

export function newTraceId() {
  traceSeq = (traceSeq + 1) % 1000000000;
  return `t_${nowMs().toString(36)}_${traceSeq.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createTrace({ method = '', path = '', deployPlatform = '', clientIp = '' } = {}) {
  return {
    traceSchema: TRACE_SCHEMA,
    id: newTraceId(),
    origin: { kind: 'http', deploy: deployPlatform || '' },
    request: {
      method: method || '',
      path: path || '',
      clientIp: clientIp || '',
      tokenRole: 'user',
    },
    startedAt: nowMs(),
    endedAt: 0,
    durationMs: 0,
    httpStatus: 0,
    status: 'pending',
    enabled: false,
    finished: false,
    seq: 0,
    stages: [],
    logs: [],
    droppedLogs: 0,
    truncated: false,
    summary: null,
    error: '',
    record: null,
  };
}

export function enableTrace(trace, info = {}) {
  if (!trace || trace.finished) return trace;
  trace.enabled = true;
  trace.status = 'running';
  if (info.method) trace.request.method = String(info.method);
  if (info.path) trace.request.path = String(info.path);
  if (info.clientIp) trace.request.clientIp = String(info.clientIp);
  if (info.tokenRole) trace.request.tokenRole = String(info.tokenRole);
  return trace;
}

function readLimits() {
  let maxTraces = DEFAULT_MAX_TRACES;
  let enabled = true;
  let logCapture = true;
  try {
    const configured = Number(globals.MAX_TRACES);
    if (Number.isFinite(configured) && configured > 0) {
      maxTraces = Math.min(1000, Math.max(10, Math.floor(configured)));
    }
    enabled = globals.traceEnabled !== false;
    logCapture = globals.traceLogCapture !== false;
  } catch (_) {
    // envs 未初始化时用默认值
  }
  return { maxTraces, enabled, logCapture };
}

export function tracesEnabled() {
  return readLimits().enabled;
}

function sanitizeValue(value, depth = 0, key = '') {
  if (value === null || value === undefined) return value;
  if (key && SENSITIVE_KEY.test(key)) {
    return value ? '[REDACTED]' : value;
  }
  if (typeof value === 'string') {
    return value.length > MAX_DETAIL_STRING ? `${value.slice(0, MAX_DETAIL_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'function') return '[function]';
  if (value instanceof Map) return sanitizeValue(Object.fromEntries(value), depth, key);
  if (value instanceof Set) return sanitizeValue([...value], depth, key);
  if (depth >= MAX_DETAIL_DEPTH) return '[max-depth]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_DETAIL_ARRAY).map((item) => sanitizeValue(item, depth + 1, key));
    if (value.length > MAX_DETAIL_ARRAY) items.push(`[+${value.length - MAX_DETAIL_ARRAY}]`);
    return items;
  }
  if (typeof value === 'object') {
    const output = {};
    for (const childKey of Object.keys(value).slice(0, MAX_DETAIL_KEYS)) {
      output[childKey] = sanitizeValue(value[childKey], depth + 1, childKey);
    }
    return output;
  }
  return String(value);
}

export function sanitizeTraceDetail(detail) {
  return sanitizeValue(detail, 0, '');
}

function pushStage(trace, stage) {
  if (!trace || !trace.enabled || trace.finished) return null;
  if (trace.stages.length >= MAX_STAGES) {
    trace.truncated = true;
    return null;
  }
  trace.stages.push(stage);
  return stage;
}

/** 一次性阶段：已知结果的打点 */
export function traceStage(key, options = {}) {
  const trace = currentTrace();
  if (!trace || !trace.enabled || trace.finished) return null;
  return pushStage(trace, {
    id: `s${++trace.seq}`,
    key: String(key || 'stage'),
    label: String(options.label || key || ''),
    status: String(options.status || 'ok'),
    at: nowMs(),
    durationMs: Number.isFinite(options.durationMs) ? Math.max(0, Number(options.durationMs)) : 0,
    parent: options.parent ? String(options.parent) : '',
    source: options.source ? String(options.source) : '',
    detail: options.detail ? sanitizeTraceDetail(options.detail) : null,
    error: options.error ? String(options.error).slice(0, MAX_STAGE_ERROR) : '',
  });
}

/** 可展开的阶段（带子阶段）：用于 per-source 这类先占位后补结果的场景 */
export function traceOpen(key, options = {}) {
  const noop = {
    id: '',
    stage: null,
    setDetail() {},
    finish() {},
  };
  const trace = currentTrace();
  if (!trace || !trace.enabled || trace.finished) return noop;
  const stage = {
    id: `s${++trace.seq}`,
    key: String(key || 'stage'),
    label: String(options.label || key || ''),
    status: 'pending',
    at: nowMs(),
    durationMs: 0,
    parent: options.parent ? String(options.parent) : '',
    source: options.source ? String(options.source) : '',
    detail: options.detail ? sanitizeTraceDetail(options.detail) : null,
    error: '',
  };
  if (!pushStage(trace, stage)) return noop;
  return {
    id: stage.id,
    stage,
    setDetail(detail) {
      if (detail) stage.detail = { ...(stage.detail || {}), ...sanitizeTraceDetail(detail) };
    },
    finish(status = 'ok', extra = {}) {
      stage.status = String(status || 'ok');
      if (extra.detail) stage.detail = { ...(stage.detail || {}), ...sanitizeTraceDetail(extra.detail) };
      if (extra.error) stage.error = String(extra.error).slice(0, MAX_STAGE_ERROR);
      stage.durationMs = Math.max(0, nowMs() - stage.at);
    },
  };
}

/** 包裹一段异步逻辑自动计时；异常时标记 error 并原样抛出 */
export async function traceSpan(key, options, fn) {
  const span = traceOpen(key, options);
  try {
    const result = await fn();
    span.finish(options?.status || 'ok');
    return result;
  } catch (error) {
    span.finish('error', { error: error?.message || String(error) });
    throw error;
  }
}

/** 汇总信息：列表页不展开 trace 也能看到匹配到了什么 */
export function traceSummary(summary) {
  const trace = currentTrace();
  if (!trace || !trace.enabled || trace.finished) return;
  trace.summary = sanitizeTraceDetail(summary);
}

/** log() 调用时顺带把日志挂进当前 trace（容量固定） */
export function traceLog(entry = {}) {
  const trace = currentTrace();
  if (!trace || !trace.enabled || trace.finished) return;
  if (!readLimits().logCapture) return;
  if (trace.logs.length >= MAX_LOGS) {
    trace.droppedLogs += 1;
    trace.truncated = true;
    return;
  }
  const message = String(entry.message ?? '');
  trace.logs.push({
    at: Number(entry.at) || nowMs(),
    level: String(entry.level || 'info'),
    message: message.length > MAX_LOG_MESSAGE ? `${message.slice(0, MAX_LOG_MESSAGE)}…` : message,
  });
}

export function finishTrace(trace, { httpStatus = 0, status = '', error = '' } = {}) {
  if (!trace || trace.finished) return trace;
  trace.endedAt = nowMs();
  trace.durationMs = Math.max(0, trace.endedAt - trace.startedAt);
  trace.httpStatus = Number(httpStatus) || 0;
  const stageError = trace.stages.some((stage) => stage.status === 'error');
  trace.status = status || (error || stageError || trace.httpStatus >= 400 ? 'error' : 'ok');
  if (error) trace.error = String(error).slice(0, 500);
  trace.finished = true;
  if (trace.enabled && trace.stages.length < MAX_STAGES) {
    trace.stages.push({
      id: `s${++trace.seq}`,
      key: 'request.finish',
      label: '完成',
      status: trace.status,
      at: trace.endedAt,
      durationMs: 0,
      parent: '',
      source: '',
      detail: { httpStatus: trace.httpStatus },
      error: '',
    });
  }
  return trace;
}

/** 写入 ring buffer；只有启用的 trace 才入库 */
export function storeTrace(trace) {
  if (!trace || !trace.enabled) return null;
  try {
    let store = globals.reqTraces;
    if (!(store instanceof Map)) {
      store = new Map();
      globals.reqTraces = store;
    }
    const { maxTraces } = readLimits();
    store.set(trace.id, trace);
    while (store.size > maxTraces) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  } catch (_) {
    // 存储失败不影响主流程
  }
  return trace;
}

export function getTrace(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  try {
    const store = globals.reqTraces;
    if (store instanceof Map) return store.get(key) || null;
  } catch (_) {
    // 忽略
  }
  return null;
}

export function clearTraces() {
  try {
    globals.reqTraces = new Map();
  } catch (_) {
    // 忽略
  }
}

/** 持久化用：Map → 数组（按时间顺序） */
export function tracesToArray(traces) {
  if (traces instanceof Map) return [...traces.values()].map((trace) => trace);
  if (Array.isArray(traces)) return traces;
  return [];
}

/** 持久化恢复用：数组 → Map */
export function tracesFromArray(value) {
  const map = new Map();
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray(value.traces)
      ? value.traces
      : [];
  for (const trace of list) {
    if (trace && typeof trace === 'object' && trace.id) map.set(String(trace.id), trace);
  }
  return map;
}
