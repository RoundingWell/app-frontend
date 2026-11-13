import { Radio } from 'marionette';
import intl from 'js/i18n';

import RouteApp from 'js/base/route-app';

import DashboardsAllApp from 'js/apps/dashboards/dashboards-all/dashboards-all_app';
import DashboardApp from 'js/apps/dashboards/dashboard/dashboard_app';

export default RouteApp.extend({
  childApps: {
    dashboardsAll: DashboardsAllApp,
    dashboard: DashboardApp,
  },
  routes: {
    'dashboards': {
      name: 'dashboards:all',
      handler: 'showAll',
      meta: {
        isList: true,
      },
    },
    'dashboards/:dashboardId': {
      name: 'dashboard',
      handler: 'showDashboard',
    },
  },
  showAll(match) {
    return this.switchTo('dashboardsAll', {
      signal: match.signal,
      restart: true,
      options: {
        region: this.getRegion(),
      },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },
  showDashboard(match) {
    return this.switchTo('dashboard', {
      signal: match.signal,
      restart: true,
      options: {
        region: this.getRegion(),
        dashboardId: match.params.dashboardId,
      },
    }).catch(() => {
      Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
      Radio.trigger('event-router', 'dashboards:all');
    });
  },
});
