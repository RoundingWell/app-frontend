// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

const SHARED_RUNTIME_MODULE_IDS = [
  '@roundingwell/care-ops-config',
  '@roundingwell/care-ops-datadog',
  '@roundingwell/care-ops-forms',
];

const SHARED_RUNTIME_MODULES = {
  '@roundingwell/care-ops-config': '/shared/config.js',
  '@roundingwell/care-ops-datadog': '/shared/datadog.js',
  '@roundingwell/care-ops-forms': '/shared/forms.js',
};

const css = {
  preprocessorOptions: {
    scss: {},
  },
};

export default defineConfig({
  root: '.',
  base: './',
  optimizeDeps: {
    include: ['@fortawesome/fontawesome-pro'],
  },
  resolve: {
    alias: {
      'js': resolve(__dirname, 'src/js'),
      'scss': resolve(__dirname, 'src/scss'),
    },
    mainFields: ['module', 'main', 'browser'],
  },
  css,
  build: {
    target: 'esnext',
    outDir: resolve(__dirname, '../../public/formapp'),
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
      external: SHARED_RUNTIME_MODULE_IDS,
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        paths: SHARED_RUNTIME_MODULES,
        entryFileNames: 'assets/index-[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
});
