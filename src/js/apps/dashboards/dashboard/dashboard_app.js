import { Radio } from 'marionette';

import { getEmbeddingContext } from '@roundingwell/care-ops-quicksight';

import App from 'js/base/app';
import { LayoutView, ContextTrailView, getEmbedView } from 'js/apps/dashboards/dashboard/dashboard_views';

export default App.extend({
  onBeforeStart() {
    const view = this.setView(new LayoutView());

    view.render();
    view.getRegion('dashboard').startPreloader({ variant: 'generic' });
    this.showView();
  },
  prepareStart({ dashboardId }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:dashboards:model', dashboardId, { signal }),
      getEmbeddingContext(),
    ]);
  },
  onStart(app, options, [dashboard]) {
    this.getView().showChildView('contextTrail', new ContextTrailView({
      model: dashboard,
    }));

    this.getView().showChildView('dashboard', getEmbedView(dashboard));
  },
});
