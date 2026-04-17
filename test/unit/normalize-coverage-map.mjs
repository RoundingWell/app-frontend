import path from 'path';

const REPO_ROOT = process.cwd();

function toRepoRelativeKey(filePath) {
  if (!path.isAbsolute(filePath)) return filePath.split(path.sep).join(path.posix.sep);

  const relativePath = path.relative(REPO_ROOT, filePath);

  if (!relativePath || relativePath.startsWith('..')) return filePath.split(path.sep).join(path.posix.sep);

  return relativePath.split(path.sep).join(path.posix.sep);
}

export function normalizeCoverageMap(coverageMap) {
  return Object.entries(coverageMap).reduce((normalizedMap, [filePath, fileCoverage]) => {
    const normalizedKey = toRepoRelativeKey(filePath);
    const sourceCoverage = fileCoverage?.data ? fileCoverage.data : fileCoverage;
    const normalizedCoverage = {
      ...sourceCoverage,
      path: normalizedKey,
    };

    if (normalizedMap[normalizedKey]) {
      throw new Error(`Duplicate normalized coverage key: ${ normalizedKey }`);
    }

    normalizedMap[normalizedKey] = normalizedCoverage;
    return normalizedMap;
  }, {});
}
