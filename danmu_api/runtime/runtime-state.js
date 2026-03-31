import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultState = {
  latestVersion: '',
  latestCheckedAt: 0,
  latestError: '',
  update: {
    state: 'idle',
    message: '',
    startedAt: '',
    endedAt: '',
    targetVersion: '',
    helperContainerId: '',
    logs: []
  }
};

const globalKey = '__LOGVAR_DANMU_RUNTIME_STATE__';
const stateFilePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '.cache',
  'runtime-state.json'
);
let diskStateWritable = true;

function createState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function getMemoryState() {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = createState();
  }
  return normalizeState(globalThis[globalKey]);
}

function normalizeLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs
    .map((item) => ({
      time: item?.time ? String(item.time) : '',
      message: item?.message ? String(item.message) : ''
    }))
    .filter((item) => item.message)
    .slice(-40);
}

function normalizeState(rawState = {}) {
  const state = createState();
  state.latestVersion = rawState?.latestVersion ? String(rawState.latestVersion) : '';
  state.latestCheckedAt = rawState?.latestCheckedAt ? String(rawState.latestCheckedAt) : 0;
  state.latestError = rawState?.latestError ? String(rawState.latestError) : '';
  state.update = {
    ...state.update,
    ...(rawState?.update || {}),
    state: rawState?.update?.state ? String(rawState.update.state) : 'idle',
    message: rawState?.update?.message ? String(rawState.update.message) : '',
    startedAt: rawState?.update?.startedAt ? String(rawState.update.startedAt) : '',
    endedAt: rawState?.update?.endedAt ? String(rawState.update.endedAt) : '',
    targetVersion: rawState?.update?.targetVersion ? String(rawState.update.targetVersion) : '',
    helperContainerId: rawState?.update?.helperContainerId ? String(rawState.update.helperContainerId) : '',
    logs: normalizeLogs(rawState?.update?.logs)
  };
  return state;
}

function readStateFromDisk() {
  try {
    if (!diskStateWritable) {
      return getMemoryState();
    }
    if (!fs.existsSync(stateFilePath)) {
      return getMemoryState();
    }
    const rawText = fs.readFileSync(stateFilePath, 'utf8');
    if (!rawText.trim()) {
      return getMemoryState();
    }
    const normalized = normalizeState(JSON.parse(rawText));
    globalThis[globalKey] = normalized;
    return normalized;
  } catch (error) {
    return getMemoryState();
  }
}

function writeStateToDisk(state) {
  const normalized = normalizeState(state);
  globalThis[globalKey] = normalized;
  if (!diskStateWritable) {
    return normalized;
  }

  try {
    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
    const tempFilePath = `${stateFilePath}.tmp`;
    fs.writeFileSync(tempFilePath, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tempFilePath, stateFilePath);
  } catch (error) {
    diskStateWritable = false;
  }

  return normalized;
}

function mutateState(mutator) {
  const state = readStateFromDisk();
  const result = mutator(state) || state;
  writeStateToDisk(state);
  return result;
}

export function getRuntimeState() {
  const state = readStateFromDisk();
  globalThis[globalKey] = state;
  return state;
}

export function recordLatestVersion(latestVersion, checkedAt = new Date(), error = '') {
  return mutateState((state) => {
    state.latestVersion = latestVersion || '';
    state.latestCheckedAt = checkedAt instanceof Date ? checkedAt.toISOString() : String(checkedAt || '');
    state.latestError = error || '';
    return state;
  });
}

export function startRuntimeUpdate(message, targetVersion = '') {
  return mutateState((state) => {
    state.update = {
      state: 'queued',
      message: message || '更新任务已进入队列',
      startedAt: new Date().toISOString(),
      endedAt: '',
      targetVersion: targetVersion || '',
      helperContainerId: '',
      logs: []
    };
    return state.update;
  });
}

export function setRuntimeUpdateState(nextState, message = '', targetVersion = '') {
  return mutateState((state) => {
    state.update.state = nextState || state.update.state || 'queued';
    if (!state.update.startedAt) {
      state.update.startedAt = new Date().toISOString();
    }
    state.update.endedAt = '';
    if (message) {
      state.update.message = message;
    }
    if (targetVersion) {
      state.update.targetVersion = targetVersion;
    }
    return state.update;
  });
}

export function pushRuntimeUpdateLog(message) {
  const text = String(message || '').trim();
  if (!text) return getRuntimeState().update;
  return mutateState((state) => {
    state.update.logs.push({
      time: new Date().toISOString(),
      message: text
    });
    state.update.logs = state.update.logs.slice(-40);
    return state.update;
  });
}

export function setRuntimeUpdateHelperContainer(helperContainerId) {
  return mutateState((state) => {
    state.update.helperContainerId = helperContainerId || '';
    return state.update;
  });
}

export function finishRuntimeUpdate(success, message, targetVersion = '') {
  return mutateState((state) => {
    state.update.state = success ? 'success' : 'failed';
    state.update.message = message || (success ? '更新完成' : '更新失败');
    state.update.endedAt = new Date().toISOString();
    if (targetVersion) {
      state.update.targetVersion = targetVersion;
    }
    return state.update;
  });
}
