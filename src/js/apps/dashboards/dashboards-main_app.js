import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';
import intl from 'js/i18n';

import App from 'js/base/app';

import DashboardsAllApp from 'js/apps/dashboards/dashboards-all/dashboards-all_app';
import DashboardApp from 'js/apps/dashboards/dashboard/dashboard_app';

const PAGES = {
  'dashboards:all': 'dashboardsAll',
  'dashboard': 'dashboard',
};

export default App.extend({
  childApps: {
    dashboardsAll: DashboardsAllApp,
    dashboard: DashboardApp,
  },
  initialize() {
    this.pages = new RouteOutlet({ owner: this, onCleanupError: addError });
  },
  showRoute(match) {
    return this.pages.show(PAGES[match.name], {
      match,
      restart: true,
      options: { region: this.getRegion(), dashboardId: match.params.dashboardId },
    }).catch(error => {
      if (match.name === 'dashboard') {
        Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
        Radio.trigger('event-router', 'dashboards:all');
        return;
      }

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },
});
