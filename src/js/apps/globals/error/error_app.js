import { bind, contains } from 'underscore';
import Radio from 'backbone.radio';

import RouterApp from 'js/base/routerapp';

import getRootRoute from 'js/utils/root-route';

import { ErrorView } from 'js/apps/globals/error/error_views';

const legacyRoots = [
  'worklist',
  'patient',
  'patient-action',
  'flow',
  'schedule',
  'clinicians',
  'dashboards',
  'form',
  'program',
  'programs',
  'program-flow',
];

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
    const rootRoute = getRootRoute();
    if (contains(legacyRoots, rootRoute)) {
      const workspace = Radio.request('workspace', 'current');
      this.replaceUrl(`/${ workspace.get('slug') }${ location.pathname }`);
      return;
    }

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
