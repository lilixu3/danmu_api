import http from 'node:http';

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export function createDockerEngineClient(socketPath = '/var/run/docker.sock') {
  async function request(method, requestPath, options = {}) {
    const body = options.body == null ? null : JSON.stringify(options.body);
    const headers = {
      ...(options.headers || {})
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    return new Promise((resolve, reject) => {
      const req = http.request({
        method,
        socketPath,
        path: requestPath,
        headers
      }, async (res) => {
        try {
          const text = await streamToString(res);
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`docker api ${method} ${requestPath} failed: HTTP ${res.statusCode} ${text}`));
            return;
          }

          if (options.raw) {
            resolve(text);
            return;
          }

          resolve(text ? JSON.parse(text) : {});
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  return {
    request,
    inspectContainer(containerIdOrName) {
      return request('GET', `/containers/${encodeURIComponent(containerIdOrName)}/json`);
    },
    containerStats(containerIdOrName) {
      return request('GET', `/containers/${encodeURIComponent(containerIdOrName)}/stats?stream=false`);
    },
    createContainer(payload, name) {
      const suffix = name ? `?name=${encodeURIComponent(name)}` : '';
      return request('POST', `/containers/create${suffix}`, { body: payload });
    },
    startContainer(containerId) {
      return request('POST', `/containers/${encodeURIComponent(containerId)}/start`, { raw: true });
    },
    stopContainer(containerId, timeoutSeconds = 10) {
      return request('POST', `/containers/${encodeURIComponent(containerId)}/stop?t=${timeoutSeconds}`, { raw: true });
    },
    renameContainer(containerId, newName) {
      return request('POST', `/containers/${encodeURIComponent(containerId)}/rename?name=${encodeURIComponent(newName)}`, { raw: true });
    },
    removeContainer(containerId, force = false) {
      return request('DELETE', `/containers/${encodeURIComponent(containerId)}?force=${force ? '1' : '0'}`, { raw: true });
    },
    async pullImage(imageName) {
      return request('POST', `/images/create?fromImage=${encodeURIComponent(imageName)}`, { raw: true });
    }
  };
}
