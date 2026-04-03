import { resolveDockerVersionLookupImage } from './docker-image-ref.js';
import { getRuntimeState, recordLatestVersion } from './runtime-state.js';

const DEFAULT_CHECK_TTL_MS = 10 * 60 * 1000;

function normalizeVersionTag(version) {
  if (!version) return '';
  const text = String(version).trim();
  if (!text) return '';
  return text.startsWith('v') ? text : `v${text}`;
}

async function parseLatestVersionFromShields(imageName) {
  const image = String(imageName || '').trim();
  if (!image || !image.includes('/')) {
    throw new Error('invalid docker image name');
  }

  const response = await fetch(`https://img.shields.io/docker/v/${image}?sort=semver`);
  if (!response.ok) {
    throw new Error(`version lookup failed: HTTP ${response.status}`);
  }

  const svgContent = await response.text();
  const versionMatch = svgContent.match(/version<\/text><text.*?>(v?[\d.]+)/i);
  if (!versionMatch || !versionMatch[1]) {
    throw new Error('latest version not found');
  }

  return normalizeVersionTag(versionMatch[1]);
}

export function compareVersions(v1, v2) {
  const clean1 = normalizeVersionTag(v1).replace(/^v/, '');
  const clean2 = normalizeVersionTag(v2).replace(/^v/, '');
  const parts1 = clean1.split('.').map(part => Number.parseInt(part, 10) || 0);
  const parts2 = clean2.split('.').map(part => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i += 1) {
    const left = parts1[i] || 0;
    const right = parts2[i] || 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 100 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

export default class BaseRuntimeHandler {
  constructor(globals) {
    this.globals = globals;
  }

  get currentVersion() {
    return normalizeVersionTag(this.globals?.VERSION || this.globals?.version || '0.0.0');
  }

  get imageName() {
    return resolveDockerVersionLookupImage(this.globals?.dockerImageName || '', '', 'lilixu3/danmu-api');
  }

  getRuntimeType() {
    return 'unknown';
  }

  getCapabilities() {
    return {
      runtimeType: this.getRuntimeType(),
      supportsMetrics: false,
      supportsOnlineUpdate: false,
      supportsRedeploy: false
    };
  }

  async collectRuntimeDetails() {
    return {
      status: {
        state: 'unknown',
        text: '未知'
      },
      service: {},
      metrics: {}
    };
  }

  async resolveVersionLookupImage() {
    return this.imageName;
  }

  async fetchLatestVersion(force = false) {
    const state = getRuntimeState();
    const lastChecked = state.latestCheckedAt ? Date.parse(state.latestCheckedAt) : 0;
    const now = Date.now();

    if (!force && state.latestVersion && lastChecked && (now - lastChecked) < DEFAULT_CHECK_TTL_MS) {
      return {
        latestVersion: state.latestVersion,
        error: state.latestError || ''
      };
    }

    try {
      const latestVersion = await parseLatestVersionFromShields(await this.resolveVersionLookupImage());
      recordLatestVersion(latestVersion, new Date(), '');
      return { latestVersion, error: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'unknown error');
      recordLatestVersion(state.latestVersion || '', new Date(), message);
      return {
        latestVersion: state.latestVersion || '',
        error: message
      };
    }
  }

  buildVersionInfo(latestVersion, latestError = '') {
    const currentVersion = this.currentVersion;
    const normalizedLatest = normalizeVersionTag(latestVersion);
    const hasUpdate = normalizedLatest ? compareVersions(normalizedLatest, currentVersion) > 0 : false;

    return {
      current: currentVersion,
      latest: normalizedLatest,
      hasUpdate,
      error: latestError || ''
    };
  }

  async getInfo(options = {}) {
    const latest = await this.fetchLatestVersion(Boolean(options.forceLatest));
    const details = await this.collectRuntimeDetails();
    const state = getRuntimeState();

    return {
      ...this.getCapabilities(),
      ...details,
      version: this.buildVersionInfo(latest.latestVersion, latest.error),
      update: state.update
    };
  }

  async checkUpdate() {
    return this.getInfo({ forceLatest: true });
  }

  async triggerUpdate() {
    return {
      success: false,
      message: '当前部署形态不支持在线更新'
    };
  }
}
