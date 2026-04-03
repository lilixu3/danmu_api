import fs from 'node:fs';
import os from 'node:os';

import BaseRuntimeHandler, { formatBytes } from './base-runtime-handler.js';
import { createDockerEngineClient } from './docker-engine-client.js';
import {
  resolveDockerRuntimeImageTargets
} from './docker-image-ref.js';
import {
  finishRuntimeUpdate,
  getRuntimeState,
  pushRuntimeUpdateLog,
  setRuntimeUpdateState,
  setRuntimeUpdateHelperContainer,
  startRuntimeUpdate
} from './runtime-state.js';

function sumNetworkBytes(networks = {}, key) {
  return Object.values(networks).reduce((sum, network) => {
    const value = Number(network?.[key] || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function calcDockerCpuPercent(stats) {
  const currentUsage = Number(stats?.cpu_stats?.cpu_usage?.total_usage || 0);
  const previousUsage = Number(stats?.precpu_stats?.cpu_usage?.total_usage || 0);
  const currentSystem = Number(stats?.cpu_stats?.system_cpu_usage || 0);
  const previousSystem = Number(stats?.precpu_stats?.system_cpu_usage || 0);
  const cpuDelta = currentUsage - previousUsage;
  const systemDelta = currentSystem - previousSystem;
  const onlineCpus = Number(stats?.cpu_stats?.online_cpus || stats?.cpu_stats?.cpu_usage?.percpu_usage?.length || os.cpus().length || 1);

  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }

  return (cpuDelta / systemDelta) * onlineCpus * 100;
}

function detectCurrentContainerIdentifier(globals) {
  if (globals?.dockerContainerName) {
    return String(globals.dockerContainerName).trim();
  }

  try {
    const hostname = fs.readFileSync('/etc/hostname', 'utf8').trim();
    return hostname || '';
  } catch (_) {
    return '';
  }
}

function mergeBindsByTarget(existingBinds = [], requiredBinds = []) {
  const merged = [];
  const seenTargets = new Set();

  function append(bindText) {
    const bind = String(bindText || '').trim();
    if (!bind) return;
    const segments = bind.split(':');
    const target = segments.length >= 2 ? segments[1] : bind;
    if (!target || seenTargets.has(target)) return;
    seenTargets.add(target);
    merged.push(bind);
  }

  existingBinds.forEach(append);
  requiredBinds.forEach(append);
  return merged;
}

export class DockerRuntimeHandler extends BaseRuntimeHandler {
  constructor(globals) {
    super(globals);
    this.socketPath = String(globals?.dockerSocketPath || '/var/run/docker.sock').trim() || '/var/run/docker.sock';
    this.docker = createDockerEngineClient(this.socketPath);
  }

  getRuntimeType() {
    return 'docker';
  }

  getCapabilities() {
    const hasSocket = fs.existsSync(this.socketPath);
    const target = detectCurrentContainerIdentifier(this.globals);
    return {
      runtimeType: this.getRuntimeType(),
      supportsMetrics: hasSocket && Boolean(target),
      supportsOnlineUpdate: hasSocket && Boolean(target) && Boolean(this.globals?.enableRuntimeControl),
      supportsRedeploy: false
    };
  }

  async resolveTargetContainer() {
    const identifier = detectCurrentContainerIdentifier(this.globals);
    if (!identifier) {
      throw new Error('未配置 DOCKER_CONTAINER_NAME，且无法自动识别当前容器');
    }

    const inspectData = await this.docker.inspectContainer(identifier);
    const containerName = String(inspectData.Name || '').replace(/^\//, '') || identifier;
    const runningImage = String(inspectData.Config?.Image || '').trim();
    const imageDetails = inspectData.Image
      ? await this.docker.inspectImage(inspectData.Image).catch(() => null)
      : null;
    const { updateImageRef: imageName, versionLookupImage } = resolveDockerRuntimeImageTargets({
      configuredImageRef: this.globals?.dockerImageName || '',
      containerImageRef: runningImage,
      imageRepoTags: imageDetails?.RepoTags || [],
      defaultRepository: this.imageName
    });

    return { identifier, inspectData, containerName, imageName, versionLookupImage };
  }

  async resolveVersionLookupImage() {
    try {
      const { versionLookupImage } = await this.resolveTargetContainer();
      return versionLookupImage || this.imageName;
    } catch (_) {
      return this.imageName;
    }
  }

  async collectRuntimeDetails() {
    try {
      const { inspectData, containerName, imageName } = await this.resolveTargetContainer();
      const stats = await this.docker.containerStats(containerName);
      const cpuPercent = calcDockerCpuPercent(stats);
      const memoryUsed = Number(stats?.memory_stats?.usage || 0);
      const memoryLimit = Number(stats?.memory_stats?.limit || 0);
      const networkRx = sumNetworkBytes(stats?.networks || {}, 'rx_bytes');
      const networkTx = sumNetworkBytes(stats?.networks || {}, 'tx_bytes');
      const state = inspectData.State || {};

      return {
        status: {
          state: state.Status || 'unknown',
          text: state.Running ? '运行中' : (state.Status || '未知')
        },
        service: {
          name: 'danmu-api',
          containerName,
          image: imageName,
          startedAt: state.StartedAt || '',
          composeProject: inspectData.Config?.Labels?.['com.docker.compose.project'] || '',
          composeService: inspectData.Config?.Labels?.['com.docker.compose.service'] || ''
        },
        metrics: {
          cpuPercent,
          memoryUsed,
          memoryLimit,
          networkRx,
          networkTx,
          cpuText: `${cpuPercent.toFixed(1)}%`,
          memoryText: memoryLimit > 0 ? `${formatBytes(memoryUsed)} / ${formatBytes(memoryLimit)}` : formatBytes(memoryUsed),
          networkRxText: formatBytes(networkRx),
          networkTxText: formatBytes(networkTx)
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'unknown error');
      return {
        status: {
          state: 'unavailable',
          text: '不可用'
        },
        service: {
          name: 'danmu-api',
          containerName: detectCurrentContainerIdentifier(this.globals),
          image: this.globals?.dockerImageName || ''
        },
        metrics: {
          cpuPercent: null,
          memoryUsed: null,
          memoryLimit: null,
          networkRx: null,
          networkTx: null,
          cpuText: '不可用',
          memoryText: '不可用',
          networkRxText: '不可用',
          networkTxText: '不可用'
        },
        runtimeError: message
      };
    }
  }

  async triggerUpdate() {
    const capabilities = this.getCapabilities();
    if (!capabilities.supportsOnlineUpdate) {
      return {
        success: false,
        message: 'Docker 在线更新未启用，请确认已挂载 docker.sock 且设置 ENABLE_RUNTIME_CONTROL=true'
      };
    }

    try {
      const { containerName, imageName, inspectData } = await this.resolveTargetContainer();
      const state = getRuntimeState();
      if (['queued', 'pulling', 'recreating'].includes(String(state.update?.state || ''))) {
        return {
          success: false,
          message: '已有更新任务在执行中，请稍后再试'
        };
      }

      startRuntimeUpdate('更新任务已提交，等待后台容器接管', '');
      pushRuntimeUpdateLog(`准备更新容器 ${containerName}`);
      pushRuntimeUpdateLog(`目标镜像 ${imageName}`);

      const currentImage = imageName || this.globals?.dockerImageName || this.imageName;
      const helperCommand = [
        'node',
        'danmu_api/runtime/docker-self-update-runner.js'
      ];

      const helperPayload = {
        Image: currentImage,
        Cmd: helperCommand,
        Env: [
          `TARGET_CONTAINER=${containerName}`,
          `TARGET_IMAGE=${currentImage}`,
          `DOCKER_SOCKET_PATH=${this.socketPath}`,
          `KEEP_BACKUP=${this.globals?.dockerKeepBackup ? 'true' : 'false'}`
        ],
        HostConfig: {
          AutoRemove: true,
          Binds: mergeBindsByTarget(
            inspectData?.HostConfig?.Binds || [],
            [`${this.socketPath}:${this.socketPath}`]
          ),
          NetworkMode: 'bridge'
        }
      };

      const helperName = `danmu-api-updater-${Date.now()}`;
      const created = await this.docker.createContainer(helperPayload, helperName);
      await this.docker.startContainer(created.Id);
      setRuntimeUpdateHelperContainer(created.Id);
      pushRuntimeUpdateLog(`后台 helper 已启动: ${created.Id.slice(0, 12)}`);
      setRuntimeUpdateState('queued', '后台更新任务已启动，正在准备拉取镜像');

      return {
        success: true,
        message: '更新任务已启动，正在后台拉取镜像并准备重建容器',
        helperContainerId: created.Id
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'unknown error');
      pushRuntimeUpdateLog(`更新失败: ${message}`);
      finishRuntimeUpdate(false, message, '');
      return {
        success: false,
        message
      };
    }
  }
}
