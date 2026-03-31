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
      return new Promise((resolve, reject) => {
        let settled = false;
        let buffer = '';
        let responseText = '';
        let inactivityTimer = null;

        function cleanup() {
          if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimer = null;
          }
        }

        function finish(fn, value, req, res) {
          if (settled) return;
          settled = true;
          cleanup();
          if (res && !res.destroyed) {
            res.destroy();
          }
          if (req && !req.destroyed) {
            req.destroy();
          }
          fn(value);
        }

        function refreshTimeout(req, res) {
          cleanup();
          inactivityTimer = setTimeout(() => {
            finish(reject, new Error(`docker image pull timeout for ${imageName}`), req, res);
          }, 120000);
        }

        const req = http.request({
          method: 'POST',
          socketPath,
          path: `/images/create?fromImage=${encodeURIComponent(imageName)}`
        }, (res) => {
          refreshTimeout(req, res);

          res.on('data', (chunk) => {
            refreshTimeout(req, res);
            const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
            responseText += text;
            buffer += text;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;

              let payload;
              try {
                payload = JSON.parse(line);
              } catch (_) {
                continue;
              }

              if (payload.error || payload.errorDetail?.message) {
                finish(reject, new Error(payload.errorDetail?.message || payload.error), req, res);
                return;
              }

              const status = String(payload.status || '');
              if (
                status.startsWith('Status: Downloaded newer image') ||
                status.startsWith('Status: Image is up to date')
              ) {
                finish(resolve, responseText, req, res);
                return;
              }
            }
          });

          res.on('end', () => {
            if ((res.statusCode || 500) >= 400) {
              finish(reject, new Error(`docker api POST /images/create failed: HTTP ${res.statusCode} ${responseText}`), req, res);
              return;
            }
            finish(resolve, responseText, req, res);
          });

          res.on('error', (error) => finish(reject, error, req, res));
        });

        req.on('error', (error) => finish(reject, error, req, null));
        req.end();
      });
    }
  };
}
