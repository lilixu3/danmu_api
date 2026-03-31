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

function createState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function ensureState() {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = createState();
  }
  return globalThis[globalKey];
}

export function getRuntimeState() {
  return ensureState();
}

export function recordLatestVersion(latestVersion, checkedAt = new Date(), error = '') {
  const state = ensureState();
  state.latestVersion = latestVersion || '';
  state.latestCheckedAt = checkedAt instanceof Date ? checkedAt.toISOString() : String(checkedAt || '');
  state.latestError = error || '';
  return state;
}

export function startRuntimeUpdate(message, targetVersion = '') {
  const state = ensureState();
  state.update = {
    state: 'running',
    message: message || '更新进行中',
    startedAt: new Date().toISOString(),
    endedAt: '',
    targetVersion: targetVersion || '',
    helperContainerId: '',
    logs: []
  };
  return state.update;
}

export function pushRuntimeUpdateLog(message) {
  const state = ensureState();
  const text = String(message || '').trim();
  if (!text) return state.update;
  state.update.logs.push({
    time: new Date().toISOString(),
    message: text
  });
  state.update.logs = state.update.logs.slice(-40);
  return state.update;
}

export function setRuntimeUpdateHelperContainer(helperContainerId) {
  const state = ensureState();
  state.update.helperContainerId = helperContainerId || '';
  return state.update;
}

export function finishRuntimeUpdate(success, message, targetVersion = '') {
  const state = ensureState();
  state.update.state = success ? 'success' : 'failed';
  state.update.message = message || (success ? '更新完成' : '更新失败');
  state.update.endedAt = new Date().toISOString();
  if (targetVersion) {
    state.update.targetVersion = targetVersion;
  }
  return state.update;
}
