import path from 'node:path';
import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { SHARED_RUNTIME_BUILD_CONFIGS } from './config/shared-runtime.js';

const rootDir = process.cwd();
const publicDir = path.resolve(rootDir, 'public');
const sharedRuntimeDir = path.resolve(publicDir, 'shared');
const packageJson = JSON.parse(readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const target = browserslistToEsbuild(packageJson.browserslist);

export default defineConfig(({ mode }) => {
  const sharedRuntimeBuild = SHARED_RUNTIME_BUILD_CONFIGS[mode];

  if (!sharedRuntimeBuild) {
    throw new Error(`Unknown shared runtime build mode: ${ mode }`);
  }

  return {
    publicDir: false,
    build: {
      target,
      sourcemap: 'hidden',
      emptyOutDir: false,
      minify: 'esbuild',
      outDir: sharedRuntimeDir,
      lib: {
        entry: path.resolve(rootDir, sharedRuntimeBuild.entry),
        formats: ['es'],
        fileName: () => sharedRuntimeBuild.fileName.replace(/\.js$/, ''),
      },
      rollupOptions: {
        external: sharedRuntimeBuild.externalModules || [],
        output: {
          inlineDynamicImports: true,
          paths: sharedRuntimeBuild.paths || {},
          entryFileNames: sharedRuntimeBuild.fileName,
          chunkFileNames: sharedRuntimeBuild.fileName,
          assetFileNames: '[name][extname]',
        },
      },
    },
  };
});
