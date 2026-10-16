import path from 'node:path';
import { readFileSync } from 'node:fs';

import { compile } from 'sass';

export default function startupLogo() {
  const logoPath = path.resolve('public/rwell-logo.svg');
  const visualPath = path.resolve('src/js/apps/globals/app-frame/startup-visual.scss');

  return {
    name: 'startup-logo',
    buildStart() {
      this.addWatchFile(logoPath);
      this.addWatchFile(visualPath);
      this.addWatchFile(path.resolve('src/scss/modules/ambient-glow.scss'));
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const logo = readFileSync(logoPath, 'utf8').trim()
          .replace('<svg ', '<svg class="startup__logo startup-shell__logo" aria-hidden="true" ');

        const visual = compile(visualPath, { style: 'compressed' }).css;

        return html.replace('<!-- startup-logo -->', logo)
          .replace('/* startup-visual */', visual);
      },
    },
  };
}
