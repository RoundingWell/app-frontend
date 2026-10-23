import path from 'node:path';
import { readFileSync } from 'node:fs';

import getIconSymbols from '@roundingwell/icons';

const ICON_MANIFEST_PATH = 'icons.json';
const SHARED_ICON_SCRIPT_PATH = '/icons/icons.js';
// Standard workflow states, clinician states, and success alerts for local dev.
const LOCAL_STATUS_ICONS = {
  fas: ['arrow-right-arrow-left', 'circle-check', 'circle-dot', 'circle-exclamation', 'circle-half-stroke'],
  far: ['circle-check', 'circle-minus', 'octagon-minus'],
};

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

    configureServer(server) {
      if (!options.localStatusIcons) return;

      const script = `
        const mount = document.createElement('div');
        mount.setAttribute('data-care-ops-local-status-symbols', '');
        mount.style.display = 'none';
        mount.innerHTML = ${ JSON.stringify(getIconSymbols(LOCAL_STATUS_ICONS)) };
        document.body.appendChild(mount);
      `;

      server.middlewares.use((req, res, next) => {
        const requestPath = req.url ? req.url.split('?')[0] : '';

        if (requestPath !== SHARED_ICON_SCRIPT_PATH) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.end(script);
      });
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
