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
    {{/if}}
    <a class="js-patient patient__context-link">{{ first_name }} {{ last_name }}</a>
    {{#if flowName}}
      {{fas "chevron-right"}}
      <a class="js-flow patient__context-link">{{ flowName }}</a>
    {{/if}}
    {{#if actionName}}
      {{fas "chevron-right"}}
      <a class="js-action patient__context-link">{{ actionName }}</a>
    {{/if}}
    {{#if formName}}
      {{fas "chevron-right"}}
      {{ formName }}
    {{/if}}
  `,
  triggers: {
    'click .js-back': 'click:back',
    'click .js-patient': 'click:patient',
    'click .js-flow': 'click:flow',
    'click .js-action': 'click:action',
  },
  modelEvents: {
    'change:first_name change:last_name': 'render',
  },
  onClickBack() {
    Radio.request('history', 'go:latestList');
  },
  initialize({ contextTrail }) {
    this.contextTrail = contextTrail;
    this.listenTo(contextTrail, 'change:context', this.render);
  },
  onClickPatient() {
    Radio.trigger('event-router', 'patient:workflow', this.model.id);
  },
  onClickFlow() {
    const { flowId } = this.contextTrail.get('context');
    Radio.trigger('event-router', 'patient:flow', this.model.id, flowId);
  },
  onClickAction() {
    const { flowId, actionId } = this.contextTrail.get('context');
    const event = flowId ? 'patient:flow:action' : 'patient:action';
    const args = flowId ?
      [this.model.id, flowId, actionId] :
      [this.model.id, actionId];
    Radio.trigger('event-router', event, ...args);
  },
  templateContext() {
    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
      ...this.contextTrail.get('context'),
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
    this.showChildView('contextTrail', new ContextTrailView({
      model: this.model,
      contextTrail: this.getOption('contextTrail'),
    }));
  },
});

export {
  LayoutView,
};
