import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import PreloadRegion from 'js/regions/preload_region';

import './program.scss';

const ContextTrailView = View.extend({
  modelEvents: {
    'change:name': 'render',
  },
  className: 'program__context-trail',
  template: hbs`
    {{#if hasLatestList}}
      <a class="js-back program__context-link">
        {{fas "chevron-left"}}{{ @intl.programs.program.programViews.contextBackBtn }}
      </a>
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
  className: 'program__frame',
  template: hbs`
    <div class="program__layout">
        <div data-context-trail-region></div>
        <div data-content-region></div>
    </div>
    <div class="program__sidebar" data-sidebar-region></div>
  `,
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
