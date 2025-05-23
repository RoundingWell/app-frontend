import Radio from 'backbone.radio';
import * as QuicksightEmbedding from 'amazon-quicksight-embedding-sdk';

import App from 'js/base/app';
import { LayoutView, ContextTrailView, IframeView } from 'js/views/dashboards/dashboard_views';

import intl from 'js/i18n';

export default App.extend({
  getEmbedContext() {
    if (!this.embeddingContext) {
      this.embeddingContext = QuicksightEmbedding.createEmbeddingContext();
    }

    return this.embeddingContext;
  },
  onBeforeStart() {
    this.showView(new LayoutView());
    this.getRegion('dashboard').startPreloader();
  },
  beforeStart({ dashboardId }) {
    return [
      Radio.request('entities', 'fetch:dashboards:model', dashboardId),
      this.getEmbedContext(),
    ];
  },
  onStart(options, dashboard, embeddingContext) {
    this.showChildView('contextTrail', new ContextTrailView({
      model: dashboard,
    }));

    this.showChildView('dashboard', new IframeView({
      model: dashboard,
      embeddingContext,
    }));
  },
  onFail() {
    Radio.request('alert', 'show:error', intl.dashboards.dashboardApp.notFound);
    Radio.trigger('event-router', 'dashboards:all');
    this.stop();
  },
});
