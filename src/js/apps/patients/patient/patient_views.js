import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import i18n from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import './patient.scss';

export const intl = i18n.patients.patient.patientViews;

const ContextTrailView = View.extend({
  className: 'patient__context-trail',
  template: hbs`
    {{#if hasLatestList}}
      <a class="js-back patient__context-link">
        {{fas "chevron-left"}}{{ @intl.patients.patient.patientViews.contextBackBtn }}
      </a>
      {{fas "chevron-right"}}
    {{/if}}{{ first_name }} {{ last_name }}
  `,
  triggers: {
    'click .js-back': 'click:back',
  },
  modelEvents: {
    'change:first_name change:last_name': 'render',
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
  className: 'patient__frame',
  template: hbs`
    <div class="patient__layout">
        <div data-context-trail-region></div>
        <div data-content-region></div>
    </div>
    <div class="patient__sidebar" data-sidebar-region></div>
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
