import process from 'node:process';

import { createDockerEngineClient } from './docker-engine-client.js';

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
  const inspectData = await docker.inspectContainer(target);
  const containerName = String(inspectData.Name || '').replace(/^\//, '') || target;
  const imageName = requestedImage || inspectData.Config?.Image;
  if (!imageName) {
    throw new Error('target image could not be resolved');
  }

  await docker.pullImage(imageName);

  const backupName = `${containerName}-backup-${Date.now()}`;
  const createPayload = sanitizeCreatePayload(inspectData, imageName);

  await docker.stopContainer(containerName, 20);
  await docker.renameContainer(containerName, backupName);

  let createdContainerId = '';
  try {
    const created = await docker.createContainer(createPayload, containerName);
    createdContainerId = created.Id;
    await docker.startContainer(createdContainerId);

    if (!keepBackup) {
      await docker.removeContainer(backupName, true);
    }
  } catch (error) {
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
    } catch (_) {
      // ignore rollback failure, the original error is more important
    }
    throw error;
  }
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('[runtime-update-runner] failed:', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
