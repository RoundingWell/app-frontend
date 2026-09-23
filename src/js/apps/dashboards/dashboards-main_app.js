import { Radio } from 'marionette';

import intl from 'js/i18n';

import RouterApp from 'js/base/routerapp';

import DashboardsAllApp from 'js/apps/dashboards/dashboards-all/dashboards-all_app';
import DashboardApp from 'js/apps/dashboards/dashboard/dashboard_app';

export default RouterApp.extend({
  routerAppName: 'DashboardsApp',
  childApps: {
    dashboardsAll: DashboardsAllApp,
    dashboard: DashboardApp,
  },

  eventRoutes: {
    'dashboards:all': {
      action: 'showDashboardsAll',
      route: 'dashboards',
      meta: { isList: true },
    },
    'dashboard': {
      action: 'showDashboard',
      route: 'dashboards/:id',
    },
  },

  showDashboardsAll() {
    return this.startCurrent('dashboardsAll');
  },
  showDashboard(dashboardId) {
    return this.startCurrent('dashboard', { dashboardId });
  },
  onRouteError(error, { definition }) {
    if (definition.action === 'showDashboard') {
      Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
      Radio.trigger('event-router', 'dashboards:all');
      return;
    }

    Radio.trigger('event-router', 'unknownError', error?.response?.status);
  },
});
