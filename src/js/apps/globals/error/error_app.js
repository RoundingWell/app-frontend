import RouterApp from 'js/base/routerapp';

import { ErrorView } from 'js/apps/globals/error/error_views';

export default RouterApp.extend({
  eventRoutes: {
    'notFound': { action: 'show404' },
    'unknownError': { action: 'showError' },
  },

  viewEvents: {
    'click:back': 'stop',
  },

  show404() {
    this.showView(new ErrorView({ is404: true }));
  },
  showError(status) {
    this.showView(new ErrorView({ status }));
  },
});
