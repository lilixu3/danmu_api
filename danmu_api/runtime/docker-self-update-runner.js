import process from 'node:process';

import { createDockerEngineClient } from './docker-engine-client.js';
import {
  finishRuntimeUpdate,
  pushRuntimeUpdateLog,
  setRuntimeUpdateState
} from './runtime-state.js';

function sanitizeCreatePayload(inspectData, imageName) {
  const config = inspectData.Config || {};
  const hostConfig = inspectData.HostConfig || {};
  const networkSettings = inspectData.NetworkSettings || {};
  const networks = networkSettings.Networks || {};

  const payload = {
    Image: imageName,
    Env: config.Env || [],
    Cmd: config.Cmd || null,
    Entrypoint: config.Entrypoint || null,
    WorkingDir: config.WorkingDir || '',
    Labels: config.Labels || {},
    ExposedPorts: config.ExposedPorts || {},
    User: config.User || '',
    Hostname: config.Hostname || '',
    StopSignal: config.StopSignal || '',
    Tty: Boolean(config.Tty),
    OpenStdin: Boolean(config.OpenStdin),
    AttachStdin: false,
    AttachStdout: false,
    AttachStderr: false,
    HostConfig: {
      Binds: hostConfig.Binds || [],
      PortBindings: hostConfig.PortBindings || {},
      RestartPolicy: hostConfig.RestartPolicy || {},
      NetworkMode: hostConfig.NetworkMode || 'default',
      LogConfig: hostConfig.LogConfig || {},
      PublishAllPorts: Boolean(hostConfig.PublishAllPorts),
      ExtraHosts: hostConfig.ExtraHosts || [],
      CapAdd: hostConfig.CapAdd || [],
      CapDrop: hostConfig.CapDrop || [],
      Privileged: Boolean(hostConfig.Privileged),
      ReadonlyRootfs: Boolean(hostConfig.ReadonlyRootfs),
      SecurityOpt: hostConfig.SecurityOpt || [],
      Tmpfs: hostConfig.Tmpfs || {},
      Ulimits: hostConfig.Ulimits || [],
      VolumesFrom: hostConfig.VolumesFrom || [],
      Mounts: hostConfig.Mounts || []
    }
  };

  const endpointNames = Object.keys(networks);
  if (endpointNames.length > 0) {
    payload.NetworkingConfig = {
      EndpointsConfig: {}
    };
    endpointNames.forEach((networkName) => {
      const network = networks[networkName] || {};
      payload.NetworkingConfig.EndpointsConfig[networkName] = {
        Aliases: network.Aliases || []
      };
    });
  }

  return payload;
}

async function main() {
  const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';
  const target = process.env.TARGET_CONTAINER;
  const requestedImage = process.env.TARGET_IMAGE;
  const keepBackup = ['1', 'true', 'yes'].includes(String(process.env.KEEP_BACKUP || 'true').toLowerCase());
  if (!target) {
    throw new Error('TARGET_CONTAINER is required');
  }

  const docker = createDockerEngineClient(socketPath);
  pushRuntimeUpdateLog(`helper 已接管更新流程: ${target}`);
  const inspectData = await docker.inspectContainer(target);
  const containerName = String(inspectData.Name || '').replace(/^\//, '') || target;
  const imageName = requestedImage || inspectData.Config?.Image;
  if (!imageName) {
    throw new Error('target image could not be resolved');
  }

  setRuntimeUpdateState('pulling', `正在拉取镜像 ${imageName}`);
  pushRuntimeUpdateLog(`开始拉取镜像 ${imageName}`);
  await docker.pullImage(imageName);
  pushRuntimeUpdateLog(`镜像拉取完成: ${imageName}`);

  const backupName = `${containerName}-backup-${Date.now()}`;
  const createPayload = sanitizeCreatePayload(inspectData, imageName);

  setRuntimeUpdateState('recreating', '镜像已就绪，开始重建容器');
  pushRuntimeUpdateLog(`停止旧容器 ${containerName}`);
  await docker.stopContainer(containerName, 20);
  pushRuntimeUpdateLog(`旧容器已停止，重命名为 ${backupName}`);
  await docker.renameContainer(containerName, backupName);

  let createdContainerId = '';
  try {
    pushRuntimeUpdateLog(`创建新容器 ${containerName}`);
    const created = await docker.createContainer(createPayload, containerName);
    createdContainerId = created.Id;
    pushRuntimeUpdateLog(`启动新容器 ${containerName}`);
    await docker.startContainer(createdContainerId);
    pushRuntimeUpdateLog(`新容器已启动: ${createdContainerId.slice(0, 12)}`);

    if (!keepBackup) {
      pushRuntimeUpdateLog(`删除旧容器备份 ${backupName}`);
      await docker.removeContainer(backupName, true);
    }
    finishRuntimeUpdate(true, '在线更新完成，服务已恢复可用');
  } catch (error) {
    pushRuntimeUpdateLog(`重建失败，开始回滚: ${error instanceof Error ? error.message : String(error || 'unknown error')}`);
    if (createdContainerId) {
      try {
        await docker.removeContainer(createdContainerId, true);
      } catch (_) {
        // ignore rollback cleanup failure
      }
    }

    try {
      await docker.renameContainer(backupName, containerName);
      await docker.startContainer(containerName);
      pushRuntimeUpdateLog('回滚完成，旧容器已恢复运行');
    } catch (_) {
      // ignore rollback failure, the original error is more important
    }
    throw error;
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  finishRuntimeUpdate(false, error instanceof Error ? error.message : String(error || 'unknown error'));
  console.error('[runtime-update-runner] failed:', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
