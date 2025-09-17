import { createTimeline } from 'animejs';

import hbs from 'handlebars-inline-precompile';

import { Region, View } from 'marionette';

import 'scss/modules/loader.scss';

const LoadingTemplate = hbs`
  <div class="loader__bar js-progress-bar">
    <div class="loader__bar-progress--loop"></div>
  </div>
  <div class="loader__text js-loading">{{ @intl.regions.preload.loading }}</div>
`;

const LoadingView = View.extend({
  className: 'loader',
  template: LoadingTemplate,
  ui: {
    progressBar: '.js-progress-bar',
    loading: '.js-loading',
  },
  onRender() {
    const timeout = this.getOption('timeout');

    if (!timeout) {
      this.showLoader(0, 300);
      return;
    }

    this.showLoader(timeout / 2, timeout / 2 + 200);
  },
  showLoader(delay, duration) {
    const anim = createTimeline({
      defaults: {
        ease: 'inQuad',
        delay,
      },
    });

    anim
      .add(this.ui.progressBar[0], {
        opacity: { to: 1, duration },
      })
      .add(this.ui.loading[0], {
        opacity: { to: 1, duration: duration - 100 },
      }, 100);
  },
});

export default Region.extend({
  timeout: 500,
  startPreloader() {
    this.show(new LoadingView({ timeout: this.getOption('timeout') }));
  },
});
