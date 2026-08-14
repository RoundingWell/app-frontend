import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import PreloadRegion from 'js/regions/preload_region';

import LayoutTemplate from './layout.hbs';

import 'js/apps/programs/shared/program-page.scss';

const ContextTrailView = View.extend({
  modelEvents: {
    'change:name': 'render',
  },
  className: 'program-page__context-trail',
  template: hbs`
    {{#if hasLatestList}}
      <button class="js-back program-page__context-link" type="button">
        {{fas "chevron-left"}}{{ @intl.programs.program.programViews.contextBackBtn }}
      </button>
      {{fas "chevron-right"}}
    {{/if}}{{ name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
  },
  onClickBack() {
    Radio.request('history', 'go:latestList');
  },
  templateContext() {
    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
    };
  },
});

const LayoutView = View.extend({
  className: 'program-page__frame',
  template: LayoutTemplate,
  regions: {
    contextTrail: {
      el: '[data-context-trail-region]',
      replaceElement: true,
    },
    sidebar: '[data-sidebar-region]',
    content: {
      el: '[data-content-region]',
      regionClass: PreloadRegion,
      replaceElement: true,
    },
  },
  onRender() {
    this.showChildView('contextTrail', new ContextTrailView({ model: this.model }));
  },
});

export {
  LayoutView,
};
