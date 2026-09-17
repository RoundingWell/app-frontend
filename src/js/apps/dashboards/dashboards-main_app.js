import { Radio } from 'marionette';

import intl from 'js/i18n';

import RouterApp from 'js/base/routerapp';

import DashboardsAllApp from 'js/apps/dashboards/dashboards-all/dashboards-all_app';
import DashboardApp from 'js/apps/dashboards/dashboard/dashboard_app';

export default RouterApp.extend({
  routerAppName: 'DashboardsApp',

  initialize() {
    const region = this.getRegion();

    this.addChildApp('dashboardsAll', new DashboardsAllApp({ region }));
    this.addChildApp('dashboard', new DashboardApp({ region }));
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
  async showDashboard(dashboardId) {
    const routeContext = this.getCurrentRoute();

    try {
      return await this.startCurrent('dashboard', { dashboardId });
    } catch {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
      Radio.trigger('event-router', 'dashboards:all');
    }
  },
});
