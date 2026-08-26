import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';

import { View } from 'marionette';

import { embedDashboard as embedQuicksightDashboard } from '@roundingwell/care-ops-quicksight';
import { embedDashboard as embedSupersetDashboard } from '@roundingwell/care-ops-superset';

import PreloadRegion from 'js/regions/preload_region';

import './dashboard.scss';

function isSupersetDashboard(model) {
  return model.get('provider') === 'superset';
}

const ContextTrailView = View.extend({
  className: 'dashboard__context-trail',
  template: hbs`
    <a class="js-back dashboard__context-link">
      {{fas "chevron-left"}}{{ @intl.dashboards.dashboardViews.contextTrailView.contextBackBtn }}
    </a>
    {{fas "chevron-right"}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
  },
  onClickBack() {
    Radio.trigger('event-router', 'dashboards:all');
  },
});

const IframeView = View.extend({
  className: 'flex-grow',
  template: false,
  initialize() {
    if (isSupersetDashboard(this.model)) {
      const embedConfig = this.model.get('embed_config') || {};

      embedSupersetDashboard({
        id: embedConfig.dashboard_uuid,
        domain: embedConfig.domain,
        container: this.el,
        fetchGuestToken: () => Radio.request('entities', 'fetch:dashboards:guest-token', this.model.id),
      });

      return;
    }

    embedQuicksightDashboard({
      url: this.model.get('embed_url'),
      container: this.el,
      height: '100%',
      width: '100%',
    });
  },
});

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
  IframeView,
  isSupersetDashboard,
};
