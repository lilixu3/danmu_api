function normalizeImageRef(imageRef) {
  return String(imageRef || '').trim();
}

export function parseDockerImageReference(imageRef) {
  const reference = normalizeImageRef(imageRef);
  if (!reference) {
    return {
      reference: '',
      repository: '',
      tag: '',
      digest: ''
    };
  }

  const [namePart, digest = ''] = reference.split('@', 2);
  const lastSlashIndex = namePart.lastIndexOf('/');
  const lastColonIndex = namePart.lastIndexOf(':');
  const hasTag = lastColonIndex > lastSlashIndex;
  const repository = hasTag ? namePart.slice(0, lastColonIndex) : namePart;
  const tag = hasTag ? namePart.slice(lastColonIndex + 1) : '';

  return {
    reference,
    repository,
    tag,
    digest
  };
}

export function resolveDockerVersionLookupImage(configuredImageRef = '', runningImageRef = '', defaultRepository = 'lilixu3/danmu-api') {
  const configuredRepository = parseDockerImageReference(configuredImageRef).repository;
  if (configuredRepository) {
    return configuredRepository;
  }

  const runningRepository = parseDockerImageReference(runningImageRef).repository;
  if (runningRepository) {
    return runningRepository;
  }

  return parseDockerImageReference(defaultRepository).repository || 'lilixu3/danmu-api';
}

function hasExplicitReferenceVersion(imageRef = '') {
  const parsed = parseDockerImageReference(imageRef);
  return Boolean(parsed.tag || parsed.digest);
}

function normalizeRepoTags(repoTags = []) {
  if (!Array.isArray(repoTags)) return [];
  return repoTags
    .map(normalizeImageRef)
    .filter(Boolean);
}

function findRepositoryTags(repoTags = [], repository = '') {
  const targetRepository = normalizeImageRef(repository);
  if (!targetRepository) return [];
  return normalizeRepoTags(repoTags).filter((ref) => parseDockerImageReference(ref).repository === targetRepository);
}

export function resolveDockerRuntimeImageTargets({
  configuredImageRef = '',
  containerImageRef = '',
  imageRepoTags = [],
  defaultRepository = 'lilixu3/danmu-api'
} = {}) {
  const versionLookupImage = resolveDockerVersionLookupImage(
    configuredImageRef,
    containerImageRef,
    defaultRepository
  );

  const configuredReference = normalizeImageRef(configuredImageRef);
  if (hasExplicitReferenceVersion(configuredReference)) {
    return {
      versionLookupImage,
      updateImageRef: configuredReference
    };
  }

  const repositoryTags = findRepositoryTags(imageRepoTags, versionLookupImage);
  const latestTagRef = repositoryTags.find((ref) => parseDockerImageReference(ref).tag === 'latest');
  if (latestTagRef) {
    return {
      versionLookupImage,
      updateImageRef: latestTagRef
    };
  }

  const containerReference = normalizeImageRef(containerImageRef);
  if (hasExplicitReferenceVersion(containerReference)) {
    return {
      versionLookupImage,
      updateImageRef: containerReference
    };
  }

  if (repositoryTags.length === 1) {
    return {
      versionLookupImage,
      updateImageRef: repositoryTags[0]
    };
  }

  if (!versionLookupImage) {
    throw new Error('未能从当前容器解析出可用于更新的镜像引用');
  }

  throw new Error(`未能为仓库 ${versionLookupImage} 解析出可用于更新的精确镜像引用`);
}
