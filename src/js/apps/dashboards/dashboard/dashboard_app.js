import { Radio } from 'marionette';

import { getEmbeddingContext } from '@roundingwell/care-ops-quicksight';

import App from 'js/base/app';
import { LayoutView, ContextTrailView, getEmbedView } from 'js/apps/dashboards/dashboard/dashboard_views';

import intl from 'js/i18n';

export default App.extend({
  onBeforeStart() {
    this.showView(new LayoutView());
    this.getRegion('dashboard').startPreloader({ variant: 'generic' });
  },
  beforeStart({ dashboardId }) {
    return [
      Radio.request('entities', 'fetch:dashboards:model', dashboardId),
      getEmbeddingContext(),
    ];
  },
  onStart(options, dashboard) {
    this.showChildView('contextTrail', new ContextTrailView({
      model: dashboard,
    }));

    this.showChildView('dashboard', getEmbedView(dashboard));
  },
  onFail() {
    Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
    Radio.trigger('event-router', 'dashboards:all');
    this.stop();
  },
});
