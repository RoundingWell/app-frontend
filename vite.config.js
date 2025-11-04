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

export const cypressConfig = defineConfig({
  mode: 'test',
  plugins: [
    babelPlugin,
    inlineHbsCompile(),
    nodeResolve({
      modulePaths: [
        path.resolve('./node_modules'),
        path.resolve('./src'),
        path.resolve('./test'),
      ],
    }),
  ],
  exclude: ['public/formapp/assets/**'],
  resolve,
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

  const modulePaths = [
    path.resolve('./node_modules'),
    path.resolve('./src'),
  ];

  if (isTest) {
    process.env.NODE_ENV = 'test';
    modulePaths.push(path.resolve('./test'));
  }

  return {
    plugins: [
      isTest && babelPlugin,
      inlineHbsCompile(),
      handlebars(),
      yaml(),
      nodeResolve({
        modulePaths,
      }),
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
            '**/formapp/assets/**',
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
        ignored: ['**/packages/care-ops-formio/**', '**/.stylelintcache', '**/public/formapp/**'],
      },
    },
    preview: {
      port: isTest ? 8090 : 8081,
    },
    build: {
      sourcemap: 'hidden',
      target: browserslistToEsbuild(),
      rollupOptions: {
        output: {
          entryFileNames: `${ datePrefix }-[name]-[hash].js`,
          chunkFileNames: `${ datePrefix }-[name]-[hash].js`,
        },
      },
    },
  };
});
