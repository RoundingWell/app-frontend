import path from 'node:path';
import { readFileSync } from 'node:fs';

import getIconSymbols from '@roundingwell/care-ops-fontawesome';

const ICON_MANIFEST_PATH = 'packages/care-ops-fontawesome/manifest.json';
const SHARED_ICON_SCRIPT_PATH = '/icons/icons.js';

function readManifest(rootDir, manifestPath) {
  return JSON.parse(readFileSync(path.resolve(rootDir, manifestPath), 'utf8'));
}

function fontawesome(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const manifestPath = options.manifestPath || ICON_MANIFEST_PATH;

  function getSymbols() {
    return getIconSymbols(readManifest(rootDir, manifestPath));
  }

  return {
    name: 'fontawesome',

    buildStart() {
      this.addWatchFile(path.resolve(rootDir, manifestPath));
    },

    transformIndexHtml() {
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'modulepreload',
            href: SHARED_ICON_SCRIPT_PATH,
          },
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: {
            type: 'module',
          },
          children: `import('${ SHARED_ICON_SCRIPT_PATH }').catch(() => {});`,
          injectTo: 'body-prepend',
        },
        {
          tag: 'div',
          attrs: {
            'data-care-ops-fontawesome-symbols': '',
            style: 'display: none',
          },
          children: getSymbols(),
          injectTo: 'body-prepend',
        },
      ];
    },
  };
}

export default fontawesome;
