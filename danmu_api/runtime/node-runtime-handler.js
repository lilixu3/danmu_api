import os from 'node:os';
import process from 'node:process';

import BaseRuntimeHandler, { formatBytes } from './base-runtime-handler.js';

const sampleKey = '__LOGVAR_DANMU_NODE_CPU_SAMPLE__';

function readCpuSample() {
  const previous = globalThis[sampleKey];
  const now = Date.now();
  const usage = process.cpuUsage();
  globalThis[sampleKey] = { now, usage };

  if (!previous) {
    return null;
  }

  const elapsedMicros = (now - previous.now) * 1000;
  if (!elapsedMicros) {
    return 0;
  }

  const cpuDelta = (usage.user - previous.usage.user) + (usage.system - previous.usage.system);
  const cpuPercent = (cpuDelta / elapsedMicros) * 100 / Math.max(os.cpus().length, 1);
  return Math.max(0, Math.min(cpuPercent, 100));
}

export class NodeRuntimeHandler extends BaseRuntimeHandler {
  getRuntimeType() {
    return 'node';
  }

  getCapabilities() {
    return {
      runtimeType: this.getRuntimeType(),
      supportsMetrics: true,
      supportsOnlineUpdate: false,
      supportsRedeploy: false
    };
  }

  async collectRuntimeDetails() {
    const memoryUsage = process.memoryUsage();
    const cpuPercent = readCpuSample();
    const totalMemory = os.totalmem();
    const platform = `${os.platform()} ${os.release()}`;
    const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));

    return {
      status: {
        state: 'running',
        text: '运行中'
      },
      service: {
        name: 'danmu-api',
        platform,
        processId: process.pid,
        nodeVersion: process.version,
        uptimeSeconds
      },
      metrics: {
        cpuPercent,
        memoryUsed: memoryUsage.rss,
        memoryLimit: totalMemory,
        networkRx: null,
        networkTx: null,
        cpuText: cpuPercent == null ? '采样中' : `${cpuPercent.toFixed(1)}%`,
        memoryText: `${formatBytes(memoryUsage.rss)} / ${formatBytes(totalMemory)}`,
        networkRxText: '本地模式未统计',
        networkTxText: '本地模式未统计'
      }
    };
  }
}
