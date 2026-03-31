function normalizeRuntimeMode(globals) {
  const explicitMode = String(globals?.runtimeMode || '').trim().toLowerCase();
  if (explicitMode === 'docker' || explicitMode === 'node' || explicitMode === 'cloud') {
    return explicitMode;
  }

  const deployPlatform = String(globals?.deployPlatform || '').trim().toLowerCase();
  if (deployPlatform && deployPlatform !== 'node' && deployPlatform !== 'docker' && deployPlatform !== 'nodejs') {
    return 'cloud';
  }

  if (String(globals?.dockerContainerName || '').trim() || String(globals?.dockerSocketPath || '').trim() || globals?.enableRuntimeControl) {
    return 'docker';
  }

  return 'node';
}

export async function createRuntimeHandler(globals) {
  const runtimeMode = normalizeRuntimeMode(globals);

  if (runtimeMode === 'docker') {
    const { DockerRuntimeHandler } = await import('./docker-runtime-handler.js');
    return new DockerRuntimeHandler(globals);
  }

  if (runtimeMode === 'node') {
    const { NodeRuntimeHandler } = await import('./node-runtime-handler.js');
    return new NodeRuntimeHandler(globals);
  }

  const { CloudRuntimeHandler } = await import('./cloud-runtime-handler.js');
  return new CloudRuntimeHandler(globals);
}
