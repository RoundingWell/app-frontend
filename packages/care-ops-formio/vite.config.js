// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

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
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/index-[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
});
