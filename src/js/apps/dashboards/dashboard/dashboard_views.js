import { Radio, View } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import { embedDashboard as embedQuicksightDashboard } from '@roundingwell/care-ops-quicksight';
import { embedDashboard as embedSupersetDashboard } from '@roundingwell/care-ops-superset';

import PreloadRegion from 'js/regions/preload_region';

import './dashboard.scss';

const ContextTrailView = View.extend({
  className: 'dashboard__context-trail',
  template: hbs`
    <button class="js-back dashboard__context-link" type="button">
      {{fas "chevron-left"}}{{ @intl.dashboards.dashboardViews.contextTrailView.contextBackBtn }}
    </button>
    {{fas "chevron-right"}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
  },
  onClickBack() {
    Radio.trigger('event-router', 'dashboards:all');
  },
});

const QuicksightEmbedView = View.extend({
  className: 'flex-grow',
  template: false,
  initialize() {
    embedQuicksightDashboard({
      url: this.model.get('embed_url'),
      container: this.el,
      height: '100%',
      width: '100%',
    });
  },
});

const SupersetEmbedView = View.extend({
  className: 'flex-grow',
  template: false,
  initialize() {
    const { domain, dashboard_uuid: dashboardUuid } = this.model.get('embed_config');

    // The dashboard fetch mints the first token, so only refreshes cost a request.
    this.guestToken = this.model.get('guest_token');

    this.embed = embedSupersetDashboard({
      id: dashboardUuid,
      domain,
      container: this.el,
      fetchGuestToken: this.fetchGuestToken.bind(this),
    });
  },
  fetchGuestToken() {
    const guestToken = this.guestToken;

    if (guestToken) {
      this.guestToken = null;

      return Promise.resolve(guestToken);
    }

    return Radio.request('entities', 'fetch:dashboards:guest-token', this.model.id);
  },
  onDestroy() {
    this.embed.destroy();
  },
});

const embedViews = {
  quicksight: QuicksightEmbedView,
  superset: SupersetEmbedView,
};

function getEmbedView(model) {
  const EmbedView = embedViews[model.get('provider')];

  return new EmbedView({ model });
}

const LayoutView = View.extend({
  className: 'dashboard__frame',
  template: hbs`
  <div class="dashboard__layout">
    <div data-context-trail-region></div>
    <div class="dashboard__iframe flex" data-dashboard-region></div>
  </div>
  `,
  regions: {
    contextTrail: {
      el: '[data-context-trail-region]',
      replaceElement: true,
    },
    dashboard: {
      el: '[data-dashboard-region]',
      regionClass: PreloadRegion,
    },
  },
});

export {
  LayoutView,
  ContextTrailView,
  getEmbedView,
};
