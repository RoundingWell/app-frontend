import path from 'path';

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
import fontawesome from './config/vite-plugin-fontawesome.js';

dayjs.extend(utcPlugin);

const resolve = {
  alias: {
    'marionette': 'backbone.marionette',
    'store': 'store/dist/store.modern',
  },
  mainFields: ['module', 'main', 'browser'],
};

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

function modulePreloadEntryPlugin(moduleIds) {
  const normalizedModuleIds = moduleIds.map(moduleId => moduleId.replace(/^\//, ''));

  return {
    name: 'module-preload-entry-plugin',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;

        const tags = Object.values(bundle)
          .filter(chunk => {
            if (chunk.type !== 'chunk') return false;
            const chunkModuleIds = [chunk.facadeModuleId, ...chunk.moduleIds]
              .filter(Boolean)
              .map(chunkModuleId => path.relative(process.cwd(), chunkModuleId).split(path.sep).join('/'));

            return normalizedModuleIds.some(moduleId => {
              return chunkModuleIds.includes(moduleId);
            });
          })
          .map(chunk => ({
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              crossorigin: true,
              href: `/${ chunk.fileName }`,
            },
            injectTo: 'head',
          }));

        return tags;
      },
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
      sharedRuntimeDevPlugin(),
      modulePreloadEntryPlugin([
        '/src/js/auth.js',
        '/src/js/app.js',
        '/src/js/apps/globals/app-frame/app-frame_app.js',
        '/packages/care-ops-auth/AuthProvider.js',
        '/packages/care-ops-auth/providers/workos.js',
      ]),
      fontawesome(),
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
          rollupFormat: 'iife',
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
        ...(env.VITE_DEV_API_URL && {
          '/icons': {
            target: env.VITE_DEV_API_URL,
            changeOrigin: true,
            secure: true,
          },
        }),
        ...(!isTest && env.VITE_DEV_API_URL && {
          '/forms': {
            target: env.VITE_DEV_API_URL,
            changeOrigin: true,
            secure: true,
          },
        }),
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
