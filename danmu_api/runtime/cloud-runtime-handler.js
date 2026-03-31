import BaseRuntimeHandler from './base-runtime-handler.js';

function getPlatformLabel(platform) {
  const value = String(platform || 'cloud').toLowerCase();
  const map = {
    vercel: 'Vercel',
    netlify: 'Netlify',
    cloudflare: 'Cloudflare',
    edgeone: 'EdgeOne',
    zeabur: 'Zeabur'
  };
  return map[value] || platform || 'Cloud';
}

export class CloudRuntimeHandler extends BaseRuntimeHandler {
  getRuntimeType() {
    return 'cloud';
  }

  getCapabilities() {
    return {
      runtimeType: this.getRuntimeType(),
      supportsMetrics: false,
      supportsOnlineUpdate: false,
      supportsRedeploy: true
    };
  }

  async collectRuntimeDetails() {
    const platform = this.globals?.deployPlatform || 'cloud';
    return {
      status: {
        state: 'running',
        text: '运行中'
      },
      service: {
        name: 'danmu-api',
        platform,
        platformLabel: getPlatformLabel(platform)
      },
      metrics: {
        cpuPercent: null,
        memoryUsed: null,
        memoryLimit: null,
        networkRx: null,
        networkTx: null,
        cpuText: '云平台不可用',
        memoryText: '云平台不可用',
        networkRxText: '云平台不可用',
        networkTxText: '云平台不可用'
      }
    };
  }
}
