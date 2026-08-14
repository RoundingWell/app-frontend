import Radio from 'backbone.radio';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import ContextTrailTemplate from './context-trail.hbs';
import LayoutTemplate from './layout.hbs';

import './patient.scss';

export const intl = i18n.patients.patient.patientViews;

const PATIENT_SIDEBAR_DRAWER_QUERY = '(width <= 720px)';

const ContextTrailView = View.extend({
  tagName: 'nav',
  className: 'patient__context-trail',
  attributes: {
    'aria-label': intl.contextTrailLabel,
  },
  template: ContextTrailTemplate,
  triggers: {
    'click .js-back': 'click:back',
    'click .js-patient': 'click:patient',
    'click .js-flow': 'click:flow',
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
  templateContext() {
    const context = this.contextTrail.get('context') || {};
    const { flowName, actionName, formName } = context;

    return {
      hasLatestList: Radio.request('history', 'has:latestList'),
      isPatientCurrent: !flowName && !actionName && !formName,
      isFlowCurrent: !!flowName && !actionName && !formName,
      ...context,
    };
  },
});

const LayoutView = View.extend({
  className() {
    const layoutState = this.getOption('layoutState');
    const isSidebarHidden = layoutState.get('sidebarHidden') || this.isSidebarDrawer();
    const stateClasses = [
      isSidebarHidden && 'patient__frame--sidebar-hidden',
      layoutState.get('formExpanded') && 'patient__frame--form-expanded',
    ].filter(Boolean).join(' ');

    return `patient__frame${ stateClasses ? ` ${ stateClasses }` : '' }`;
  },
  events: {
    'keydown': 'onPatientFrameKeydown',
  },
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
  initialize() {
    this.layoutState = this.getOption('layoutState');
    this._isSidebarDrawer = this.isSidebarDrawer();
    if (this._isSidebarDrawer) this.layoutState.set('sidebarHidden', true, { silent: true });

    this.listenTo(this.layoutState, {
      'change:formExpanded': this.renderFormExpandedState,
      'change:sidebarHidden': this.renderSidebarState,
    });
    this.listenTo(Radio.channel('user-activity'), 'window:resize', this.onPatientWindowResize);
  },
  onRender() {
    this.renderSidebarState();
    this.renderFormExpandedState();
    this.showChildView('contextTrail', new ContextTrailView({
      model: this.model,
      contextTrail: this.getOption('contextTrail'),
    }));
  },
  renderSidebarState() {
    const isHidden = this.isSidebarHidden();

    this.$el.toggleClass('patient__frame--sidebar-hidden', isHidden);
    this.ui.sidebarButton.toggleClass('is-selected', !isHidden).attr('aria-expanded', String(!isHidden));
  },
  isSidebarHidden() {
    return this.layoutState.get('sidebarHidden');
  },
  isSidebarDrawer() {
    return window.matchMedia(PATIENT_SIDEBAR_DRAWER_QUERY).matches;
  },
  focusSidebarToggle() {
    this.ui.sidebarButton.trigger('focus');
  },
  onPatientFrameKeydown(event) {
    if (event.key !== 'Escape' || !this.isSidebarDrawer() || this.isSidebarHidden()) return;

    event.preventDefault();
    this.triggerMethod('close:sidebar-drawer');
  },
  onPatientWindowResize() {
    const isSidebarDrawer = this.isSidebarDrawer();

    if (isSidebarDrawer === this._isSidebarDrawer) return;

    this._isSidebarDrawer = isSidebarDrawer;
    this.triggerMethod('change:sidebar-drawer', isSidebarDrawer);
  },
  triggers: {
    'click @ui.sidebarButton': 'click:sidebarButton',
  },
  ui: {
    sidebarButton: '.js-sidebar-button',
  },
  renderFormExpandedState() {
    this.$el.toggleClass('patient__frame--form-expanded', this.layoutState.get('formExpanded'));
  },
  templateContext() {
    const sidebarHidden = this.layoutState.get('sidebarHidden');

    return {
      sidebarExpanded: String(!sidebarHidden),
      sidebarHidden,
    };
  },
});

export {
  LayoutView,
};
