import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveCacheFilePathFromModuleUrl(moduleUrl, cacheKey, overridePath = '') {
  if (overridePath) {
    return overridePath;
  }

  return path.join(
    path.dirname(fileURLToPath(moduleUrl)),
    '..',
    '..',
    '.cache',
    `${cacheKey}.json`
  );
}

export function readJsonFileCache(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw || !raw.trim()) {
    return null;
  }

  return JSON.parse(raw);
}

export function writeJsonFileCache(filePath, payload) {
  if (!filePath) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempFilePath = `${filePath}.tmp`;
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tempFilePath, filePath);
}
