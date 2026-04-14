import path from 'path';
import { defineConfig } from 'vitest/config';
import { nodeResolve } from '@rollup/plugin-node-resolve';

import { COVER_INCLUDE, COVER_EXCLUDE } from './config/coverage.cjs';
import yaml from './config/vite-plugin-yaml.js';
import handlebars from './config/vite-plugin-handlebars-loader.js';
import inlineHbsCompile from './config/vite-plugin-inline-handlebars.js';

export default defineConfig({
  define: {
    '_PRODUCTION_': JSON.stringify(false),
    '_DEVELOP_': JSON.stringify(false),
    '_TEST_': JSON.stringify(true),
    '_NOW_': JSON.stringify(Date.now()),
  },
  resolve: {
    alias: {
      'fixtures': path.resolve('./test/fixtures'),
      'helpers': path.resolve('./test/helpers'),
      'js': path.resolve('./src/js'),
      'scss': path.resolve('./src/scss'),
      'support': path.resolve('./test/support'),
      'marionette': 'backbone.marionette',
      'store': 'store/dist/store.modern',
    },
    mainFields: ['module', 'main', 'browser'],
  },
  plugins: [
    inlineHbsCompile(),
    handlebars(),
    yaml(),
    nodeResolve({
      modulePaths: [
        path.resolve('./node_modules'),
        path.resolve('./src'),
        path.resolve('./test'),
      ],
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'test/unit/**/*.test.js'],
    setupFiles: ['./test/unit/setup.js'],
    coverage: {
      provider: 'istanbul',
      all: false,
      include: COVER_INCLUDE,
      exclude: COVER_EXCLUDE,
      reporter: ['json'],
      reportsDirectory: '.nyc_output',
    },
  },
});
