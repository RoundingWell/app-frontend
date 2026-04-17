import { defineConfig } from 'vitest/config';

import { COVER_INCLUDE, COVER_EXCLUDE } from './config/coverage.cjs';
import { createTestPlugins, testDefine, testResolve } from './vite.config.js';

export default defineConfig({
  define: testDefine,
  resolve: testResolve,
  plugins: createTestPlugins({ instrumentCoverage: process.env.VITEST_COVERAGE === '1' }),
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'test/unit/**/*.test.js'],
    setupFiles: ['./test/unit/setup.js'],
    coverage: {
      provider: 'custom',
      customProviderModule: './test/unit/vitest-babel-coverage/index.js',
      all: false,
      include: COVER_INCLUDE,
      exclude: COVER_EXCLUDE,
      reporter: ['json'],
      reportsDirectory: '.nyc_output',
    },
  },
});
