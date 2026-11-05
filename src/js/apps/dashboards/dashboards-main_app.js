import { Radio } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

import { addError } from 'js/datadog';
import intl from 'js/i18n';

import DashboardsAllApp from 'js/apps/dashboards/dashboards-all/dashboards-all_app';
import DashboardApp from 'js/apps/dashboards/dashboard/dashboard_app';

const PAGES = {
  'dashboards:all': 'dashboardsAll',
  'dashboard': 'dashboard',
};

export default ChildAppSwitcher.extend({
  childApps: {
    dashboardsAll: DashboardsAllApp,
    dashboard: DashboardApp,
  },
  onCleanupError: addError,
  showRoute(match) {
    return this.switchTo(PAGES[match.name], {
      signal: match.signal,
      reconstruct: true,
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
