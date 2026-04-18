import path from 'path';
import { transformAsync } from '@babel/core';
import istanbulPlugin from 'babel-plugin-istanbul';

function toPosixPath(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

export function istanbulRelativePaths({ root, include, exclude }) {
  const repoRoot = root || process.cwd();

  return {
    name: 'istanbul-relative-paths',
    enforce: 'post',
    async transform(code, id) {
      const cleanId = id.split('?')[0];
      const normalizedId = toPosixPath(cleanId);

      if (!cleanId.endsWith('.js')) return null;
      if (!normalizedId.includes('/src/js/')) return null;

      const relativeFilename = toPosixPath(path.relative(repoRoot, cleanId));

      if (!relativeFilename || relativeFilename.startsWith('..')) {
        return null;
      }

      const result = await transformAsync(code, {
        filename: relativeFilename,
        cwd: repoRoot,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        inputSourceMap: typeof this.getCombinedSourcemap === 'function' ? this.getCombinedSourcemap() : false,
        plugins: [
          [istanbulPlugin, { include, exclude, cwd: repoRoot }],
        ],
      });

      if (!result || !result.code) return null;

      return {
        code: result.code,
        map: result.map ?? null,
      };
    },
  };
}
