import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/card-list.scss';
import 'scss/modules/progress-bar.scss';

import stopEventPropagation from 'js/utils/stop-event-propagation';

import { CheckComponent, FlowStateComponent, OwnerComponent } from 'js/apps/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView } from 'js/apps/patients/shared/read-only_views';
import { getSelectionLabels, selectInSelectionMode, syncSelectionCheck, syncSelectionMode } from 'js/apps/patients/shared/selection-mode';

import FlowItemTemplate from './flow-item.hbs';

import 'js/apps/patients/shared/action-state.scss';
import 'scss/domain/work-card.scss';
import 'scss/domain/flow-card.scss';
import './worklist-list.scss';

const FlowEmptyView = View.extend({
  className: 'card-list__empty',
  attributes: {
    role: 'listitem',
  },
  template: hbs`<h2>{{ @intl.patients.worklist.flowViews.flowEmptyView }}</h2>`,
});

const FlowItemView = View.extend({
  className: 'work-card flow-card worklist-list__item worklist-list__flow-item',
  attributes: {
    role: 'listitem',
  },
  template: FlowItemTemplate,
  regions: {
    check: '[data-check-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
  },
  templateContext() {
    return {
      patient: this.model.getPatient().attributes,
      owner: this.model.getOwner().get('name'),
      state: this.model.getState().get('name'),
    };
  },
  modelEvents: {
    'change': 'render',
  },
  triggers: {
    'click': 'click',
  },
  events: {
    'click .js-no-click': stopEventPropagation,
    'click .js-patient': 'onClickPatient',
    'click .js-primary': 'onClickPrimary',
  },
  ui: {
    patient: '.js-patient',
  },
  initialize({ state, selectedPatientId }) {
    this.state = state;
    this.selectedPatientId = selectedPatientId;

    this.listenTo(state, {
      'change:flowsSelected': this.syncCheck,
      'change:isSelectionMode': this.updateSelectionMode,
    });
  },
  onClick(event, domEvent) {
    if (selectInSelectionMode(this, event, domEvent)) return;

    this.navigateToFlow();
  },
  navigateToFlow() {
    Radio.trigger('event-router', 'patient:flow', this.model.getPatient().id, this.model.id);
  },
  onClickPatient(event) {
    if (selectInSelectionMode(this, event)) return;

    event.stopPropagation();
    this.trigger('click:patient', this.model.getPatient(), event.currentTarget);
  },
  onClickPrimary(event) {
    if (selectInSelectionMode(this, event)) return;

    event.stopPropagation();
    this.navigateToFlow();
  },
  onRender() {
    this.setPatientSelected(this.selectedPatientId);
    const canEdit = this.canEdit;
    this.canEdit = this.model.canEdit();

    this.showCheck();
    this.showState();
    this.showOwner();
    this.updateSelectionMode();

    if (canEdit !== this.canEdit) {
      if (!this.canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  toggleSelected(isSelected) {
    this.$el.toggleClass('is-selected', isSelected);
  },
  updateSelectionMode() {
    syncSelectionMode(this);
  },
  syncCheck() {
    syncSelectionCheck(this);
  },
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    const isSelected = this.model.getPatient().id === patientId;
    this.ui.patient
      .toggleClass('patient-list__patient--selected', isSelected)
      .attr('aria-expanded', String(isSelected));
  },
  showCheck() {
    if (!this.canEdit) return;

    const isSelected = this.state.isSelected(this.model);
    this.toggleSelected(isSelected);
    this.checkComponent = new CheckComponent({
      ...getSelectionLabels(this.model, 'flow'),
      state: { isSelected },
    });

    this.listenTo(this.checkComponent, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', this.checkComponent);
  },
  showState() {
    if (!this.model.isDone() || !this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    const stateComponent = new FlowStateComponent({
      stateId: this.model.getState().id,
      isCompact: true,
    });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model });
      this.showChildView('owner', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    const program = this.model.getProgram();
    this.ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
      state: { isDisabled },
    });

    this.listenTo(this.ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', this.ownerComponent);
  },
});

export {
  FlowEmptyView,
  FlowItemView,
};
