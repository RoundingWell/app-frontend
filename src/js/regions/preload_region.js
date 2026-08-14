import { Region, View } from 'marionette';

import 'scss/modules/loader.scss';
import 'scss/modules/skeleton.scss';

import LoadingTemplate from './preload.hbs';

const LoadingView = View.extend({
  className: 'loader',
  attributes: {
    'aria-busy': 'true',
    'role': 'status',
  },
  template: LoadingTemplate,
  templateContext() {
    return {
      isGeneric: this.getOption('variant') === 'generic',
      items: new Array(3).fill(null),
      skeletonClass: [
        'skeleton-loading',
        this.getOption('variant') === 'generic' && 'skeleton-loading--generic',
        this.getOption('timeout') === 0 && 'skeleton-loading--immediate',
      ].filter(Boolean).join(' '),
    };
  },
});

export default Region.extend({
  timeout: 500,
  startPreloader(options = {}) {
    this.show(new LoadingView({
      ...options,
      timeout: this.getOption('timeout'),
    }));
  },
});
