import { bind } from 'underscore';

import RouterApp from 'js/base/routerapp';

import { ErrorView } from 'js/apps/globals/error/error_views';

export default RouterApp.extend({
  eventRoutes: {
    'notFound': {
      action: 'show404',
      route: '404',
      root: true,
    },
    'unknownError': {
      action: 'showError',
      route: 'unknown-error',
      root: true,
    },
  },

  initialize() {
    this.router.route('*unknown', '404', bind(this.handleUnknown, this));
  },

  viewEvents: {
    'click:back': 'stop',
  },

  onBeforeStop() {
    this.getRegion().empty();
  },

  handleUnknown() {
    this.start();
    this.show404();
  },
  show404() {
    this.showView(new ErrorView({ is404: true }));
  },
  showError(status) {
    this.showView(new ErrorView({ status }));
  },
});
