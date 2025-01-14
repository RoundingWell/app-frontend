import path from 'path';
import dayjs from 'dayjs';
import utcPlugin from 'dayjs/plugin/utc.js';

import { defineConfig } from 'vite';
import browserslistToEsbuild from 'browserslist-to-esbuild';

import babel from 'vite-plugin-babel';
import eslint from 'vite-plugin-eslint';
import handlebars from './config/vite-plugin-handlebars-loader.js';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import stylelint from 'vite-plugin-stylelint';
import { VitePWA } from 'vite-plugin-pwa';
import yaml from './config/vite-plugin-yaml.js';

import getFaIconSymbols from './config/fontawesome.js';

dayjs.extend(utcPlugin);

const faIconSymbols = getFaIconSymbols();

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
      // remove this when we switch sass to use modern js api
      api: 'legacy',
      additionalData: `
        @import 'src/scss/provider-variables.scss';
      `,
    },
  },
};

const cypressConfig = defineConfig({
  mode: 'test',
  plugins: [
    babel(),
    nodeResolve({
      modulePaths: [
        path.resolve('./node_modules'),
        path.resolve('./src'),
        path.resolve('./test'),
      ],
    }),
  ],
  resolve,
  css,
  publicDir: false,
});

export {
  cypressConfig,
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isTest = mode === 'test' || process.env.NODE_ENV === 'test';
  const isCI = !!process.env.CI;
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
      babel({
        exclude: '**/formio.form.min*',
      }),
      eslint({
        failOnWarning: isCI,
        fix: !isCI,
      }),
      stylelint({
        emitWarningAsError: isCI,
        fix: !isCI,
      }),
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
          ],
        },
      }),
    ],
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
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          rewrite: rewritePath => rewritePath.replace(/^\/api/, ''),
        },
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
