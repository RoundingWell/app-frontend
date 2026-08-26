import Radio from 'backbone.radio';

import { getEmbeddingContext } from '@roundingwell/care-ops-quicksight';

import App from 'js/base/app';
import { LayoutView, ContextTrailView, IframeView, isSupersetDashboard } from 'js/apps/dashboards/dashboard/dashboard_views';

import intl from 'js/i18n';

export default App.extend({
  onBeforeStart() {
    this.showView(new LayoutView());
    this.getRegion('dashboard').startPreloader();
  },
  beforeStart({ dashboardId }) {
    return Radio.request('entities', 'fetch:dashboards:model', dashboardId)
      .then(dashboard => {
        if (isSupersetDashboard(dashboard)) {
          return dashboard;
        }

        return getEmbeddingContext().then(() => dashboard);
      });
  },
  onStart(options, dashboard) {
    this.showChildView('contextTrail', new ContextTrailView({
      model: dashboard,
    }));

    this.showChildView('dashboard', new IframeView({
      model: dashboard,
    }));
  },
  onFail() {
    Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
    Radio.trigger('event-router', 'dashboards:all');
    this.stop();
  },
});
