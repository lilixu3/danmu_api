import test from 'node:test';
import assert from 'node:assert';

import {
  parseDockerImageReference,
  resolveDockerRuntimeImageTargets,
  resolveDockerVersionLookupImage
} from './runtime/docker-image-ref.js';

test('explicit tagged config keeps update reference exact while version lookup strips the tag', () => {
  const runningImage = 'lilixu3/danmu-api:latest';
  const configuredImage = 'lilixu3/danmu-api:beta';
  const targets = resolveDockerRuntimeImageTargets({
    configuredImageRef: configuredImage,
    containerImageRef: runningImage,
    imageRepoTags: ['lilixu3/danmu-api:latest', 'lilixu3/danmu-api:beta']
  });

  assert.equal(resolveDockerVersionLookupImage(configuredImage, runningImage), 'lilixu3/danmu-api');
  assert.equal(targets.updateImageRef, 'lilixu3/danmu-api:beta');
  assert.equal(targets.versionLookupImage, 'lilixu3/danmu-api');
});

test('runtime update resolves latest tag from RepoTags when container Config.Image omits the default tag', () => {
  const targets = resolveDockerRuntimeImageTargets({
    configuredImageRef: '',
    containerImageRef: 'lilixu3/danmu-api',
    imageRepoTags: ['lilixu3/danmu-api:1.18.4', 'lilixu3/danmu-api:latest']
  });

  assert.equal(targets.versionLookupImage, 'lilixu3/danmu-api');
  assert.equal(targets.updateImageRef, 'lilixu3/danmu-api:latest');
});

test('parseDockerImageReference keeps registry port and only strips the real tag', () => {
  const parsed = parseDockerImageReference('registry.example.com:5000/team/danmu-api:beta');
  const targets = resolveDockerRuntimeImageTargets({
    configuredImageRef: '',
    containerImageRef: 'registry.example.com:5000/team/danmu-api',
    imageRepoTags: ['registry.example.com:5000/team/danmu-api:beta', 'registry.example.com:5000/team/danmu-api:latest']
  });

  assert.equal(parsed.repository, 'registry.example.com:5000/team/danmu-api');
  assert.equal(parsed.tag, 'beta');
  assert.equal(resolveDockerVersionLookupImage('', 'registry.example.com:5000/team/danmu-api:beta'), 'registry.example.com:5000/team/danmu-api');
  assert.equal(targets.updateImageRef, 'registry.example.com:5000/team/danmu-api:latest');
});

test('parseDockerImageReference strips digest for version lookup and prefers latest RepoTag for updates', () => {
  const runningImage = 'ghcr.io/acme/danmu-api@sha256:abcdef';
  const parsed = parseDockerImageReference(runningImage);
  const targets = resolveDockerRuntimeImageTargets({
    configuredImageRef: '',
    containerImageRef: runningImage,
    imageRepoTags: ['ghcr.io/acme/danmu-api:1.18.4', 'ghcr.io/acme/danmu-api:latest']
  });

  assert.equal(parsed.repository, 'ghcr.io/acme/danmu-api');
  assert.equal(parsed.digest, 'sha256:abcdef');
  assert.equal(resolveDockerVersionLookupImage('', runningImage), 'ghcr.io/acme/danmu-api');
  assert.equal(targets.updateImageRef, 'ghcr.io/acme/danmu-api:latest');
});

test('runtime update fails instead of guessing latest when no exact pullable image reference exists', () => {
  assert.throws(() => resolveDockerRuntimeImageTargets({
    configuredImageRef: '',
    containerImageRef: 'lilixu3/danmu-api',
    imageRepoTags: []
  }), /未能为仓库 lilixu3\/danmu-api 解析出可用于更新的精确镜像引用/);
});
