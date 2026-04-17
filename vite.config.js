import path from 'path';
import { readFileSync } from 'fs';

import dayjs from 'dayjs';
import utcPlugin from 'dayjs/plugin/utc.js';

import { defineConfig, loadEnv } from 'vite';
import browserslistToEsbuild from 'browserslist-to-esbuild';

import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { VitePWA } from 'vite-plugin-pwa';
import { COVER_INCLUDE, COVER_EXCLUDE } from './config/coverage.cjs';
import {
  ROOT_SHARED_RUNTIME_MODULE_IDS,
  ROOT_SHARED_RUNTIME_MODULES,
  SHARED_RUNTIME_DEV_MODULES,
} from './config/shared-runtime.js';
import yaml from './config/vite-plugin-yaml.js';
import handlebars from './config/vite-plugin-handlebars-loader.js';
import inlineHbsCompile from './config/vite-plugin-inline-handlebars.js';

import getFaIconSymbols from '@roundingwell/care-ops-fontawesome';

dayjs.extend(utcPlugin);

const fontawesome = JSON.parse(readFileSync('./fontawesome.json', 'utf8'));
const faIconSymbols = getFaIconSymbols(fontawesome);

const resolve = {
  alias: {
    'marionette': 'backbone.marionette',
    'store': 'store/dist/store.modern',
  },
  mainFields: ['module', 'main', 'browser'],
};

export const testResolve = {
  alias: {
    ...resolve.alias,
    'fixtures': path.resolve('./test/fixtures'),
    'helpers': path.resolve('./test/helpers'),
    'js': path.resolve('./src/js'),
    'scss': path.resolve('./src/scss'),
    'support': path.resolve('./test/support'),
  },
  mainFields: resolve.mainFields,
};

export const testDefine = {
  '_PRODUCTION_': JSON.stringify(false),
  '_DEVELOP_': JSON.stringify(false),
  '_TEST_': JSON.stringify(true),
  '_NOW_': JSON.stringify(Date.now()),
};

export const APP_MODULE_PATHS = [
  path.resolve('./node_modules'),
  path.resolve('./src'),
];

export const TEST_MODULE_PATHS = [
  ...APP_MODULE_PATHS,
  path.resolve('./test'),
];

const SHARED_RUNTIME_PRECACHE_IGNORES = ['**/shared/**'];

function sharedRuntimeDevPlugin() {
  return {
    name: 'shared-runtime-dev-plugin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async(req, res, next) => {
        const requestPath = req.url ? req.url.split('?')[0] : '';
        const sourcePath = SHARED_RUNTIME_DEV_MODULES[requestPath];

        if (!sourcePath) {
          next();
          return;
        }

        try {
          const result = await server.transformRequest(sourcePath);

          if (!result) {
            next();
            return;
          }

          res.setHeader('Content-Type', 'application/javascript');
          res.end(result.code);
        } catch(error) {
          next(error);
        }
      });
    },
  };
}

const css = {
  preprocessorOptions: {
    scss: {
      additionalData: `
        @use "${ path.resolve('./src/scss/provider-variables.scss') }" as *;
      `,
    },
  },
};

const babelPlugin = babel({
  babelHelpers: 'bundled',

  plugins: [
    [
      'istanbul',
      {
        include: COVER_INCLUDE,
        exclude: COVER_EXCLUDE,
      },
    ],
  ],
  exclude: ['node_modules/**', 'test/**'],
  extensions: ['.js'],
  babelrc: false,
  configFile: false,
});

export function createTestPlugins({ instrumentCoverage = false, modulePaths = TEST_MODULE_PATHS } = {}) {
  return [
    instrumentCoverage && babelPlugin,
    inlineHbsCompile(),
    handlebars(),
    yaml(),
    nodeResolve({
      modulePaths,
    }),
  ].filter(Boolean);
}

export const cypressConfig = defineConfig({
  mode: 'test',
  define: testDefine,
  plugins: createTestPlugins({ instrumentCoverage: true }),
  resolve: testResolve,
  css,
  publicDir: false,
});

// https://vitejs.dev/config/
/* eslint-disable complexity */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  const isTest = mode === 'test' || process.env.NODE_ENV === 'test';
  const datePrefix = dayjs.utc().format('YYYYMMDD');

  if (isTest) {
    process.env.NODE_ENV = 'test';
  }

  const modulePaths = isTest ? TEST_MODULE_PATHS : APP_MODULE_PATHS;

  return {
    plugins: [
      sharedRuntimeDevPlugin(),
      ...createTestPlugins({ instrumentCoverage: isTest, modulePaths }),
      isProduction && VitePWA({
        strategies: 'injectManifest',
        manifest: false,
        injectRegister: false,
        srcDir: 'src/js',
        filename: 'sw.js',
        injectManifest: {
          globPatterns: [
            '**/*.{html,js,css,woff2,webmanifest}',
          ],
          globIgnores: [
            '**/*.map',
            '**/.DS_Store',
            ...SHARED_RUNTIME_PRECACHE_IGNORES,
          ],
        },
      }),
    ],
    optimizeDeps: {
      exclude: ['handlebars-inline-precompile'],
    },
    define: {
      'import.meta.env.faIconSymbols': JSON.stringify(faIconSymbols),
      '_PRODUCTION_': JSON.stringify(isProduction),
      '_DEVELOP_': JSON.stringify(mode === 'development'),
      '_TEST_': JSON.stringify(isTest),
      '_NOW_': JSON.stringify(Date.now()),
    },
    resolve,
    css,
    server: {
      open: !isTest,
      port: isTest ? 8090 : 8081,
      hmr: isTest ? false : undefined,
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: !!env.VITE_DEV_API_URL,
          ...(!env.VITE_DEV_API_URL && {
            rewrite: rewritePath => rewritePath.replace(/^\/api/, ''),
          }),
        },
      },
      watch: {
        ignored: ['**/.stylelintcache'],
      },
    },
    preview: {
      port: isTest ? 8090 : 8081,
    },
    build: {
      sourcemap: 'hidden',
      target: browserslistToEsbuild(),
      rollupOptions: {
        external: ROOT_SHARED_RUNTIME_MODULE_IDS,
        output: {
          paths: ROOT_SHARED_RUNTIME_MODULES,
          entryFileNames: `${ datePrefix }-[name]-[hash].js`,
          chunkFileNames: `${ datePrefix }-[name]-[hash].js`,
        },
      },
    },
  };
});
