import { some } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import 'scss/modules/card-list.scss';
import 'scss/modules/progress-bar.scss';

import intl from 'js/i18n';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import { CardOwnerComponent } from 'js/apps/patients/shared/actions_views';
import { CheckView, FlowStateComponent } from 'js/apps/patients/shared/flows_views';
import { ReadOnlyStateView, ReadOnlyOwnerView } from 'js/apps/patients/shared/read-only_views';

import FlowItemTemplate from './flow-item.hbs';
import CopyTemplate from './flow-copy.hbs';
import MetaTemplate from './flow-meta.hbs';
import ProgressTemplate from './flow-progress.hbs';

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

const CopyView = View.extend({
  className: 'work-card__copy',
  template: CopyTemplate,
  ui: { patient: '.js-patient' },
  setPatientSelected(patientId) {
    const isSelected = this.model.getPatient().id === patientId;
    const [patient] = this.getUI('patient');
    patient.classList.toggle('patient-list__patient--selected', isSelected);
    patient.setAttribute('aria-expanded', String(isSelected));
  },
  focusPatient() {
    this.getUI('patient')[0].focus();
  },
});

const FlowItemView = View.extend({
  className: 'work-card flow-card worklist-list__item worklist-list__flow-item',
  attributes: {
    role: 'listitem',
  },
  template: FlowItemTemplate,
  regions: {
    copy: { el: '[data-copy-region]', replaceElement: true },
    meta: { el: '[data-meta-region]', replaceElement: true },
    progress: { el: '[data-progress-region]', replaceElement: true },
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
    'change': 'onModelChange',
  },
  triggers: {
    'click': 'click',
  },
  events: {
    'click .js-no-click': stopEventPropagation,
    'click .js-patient': 'onClickPatient',
    'click .js-primary': 'onClickPrimary',
  },
  initialize({ state, selectedPatientId }) {
    this.state = state;
    this.selectedPatientId = selectedPatientId;
    this.bindRelatedModels();

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });
  },
  onClick() {
    this.navigateToFlow();
  },
  navigateToFlow() {
    Radio.trigger('event-router', 'patient:flow', this.model.getPatient().id, this.model.id);
  },
  onClickPatient(event) {
    event.stopImmediatePropagation();
    this.trigger('click:patient', this.model.getPatient(), this);
  },
  onClickPrimary(event) {
    event.stopImmediatePropagation();
    this.navigateToFlow();
  },
  onRender() {
    this.showChildView('copy', new CopyView({
      model: this.model,
      templateContext: () => this.templateContext(),
    }));
    this.showChildView('meta', new View({
      className: 'work-card__meta',
      model: this.model,
      template: MetaTemplate,
      templateContext: () => this.templateContext(),
    }));
    this.showChildView('progress', new View({
      tagName: 'span',
      className: 'work-card__control flow-card__status patient-list__flow-progress',
      model: this.model,
      template: ProgressTemplate,
    }));
    this.setPatientSelected(this.selectedPatientId);
    const canEdit = this.canEdit;
    this.canEdit = this.model.canEdit();

    this.showCheck();
    this.showState();
    this.showOwner();

    if (canEdit !== this.canEdit) {
      if (!this.canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  bindRelatedModels() {
    if (this.patient) this.stopListening(this.patient);
    this.patient = this.model.getPatient();
    this.listenTo(this.patient, 'change:first_name change:last_name change:segment', this.updateCopy);
  },
  updateCopy() {
    this.getChildView('copy').render();
    this.setPatientSelected(this.selectedPatientId);
    this.triggerMethod('content:change', this);
  },
  onModelChange() {
    const changed = (...attributes) => some(attributes, attr => this.model.hasChanged(attr));
    const canEdit = this.model.canEdit();
    const permissionChanged = canEdit !== this.canEdit;
    this.canEdit = canEdit;
    if (changed('_patient')) this.bindRelatedModels();
    if (changed('name', '_patient')) {
      this.updateCopy();
    }
    if (changed('created_at', 'updated_at')) this.getChildView('meta').render();
    if (permissionChanged) {
      this.showCheck();
      if (!canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
    this.updateControls(permissionChanged);
    if (changed('_progress')) this.getChildView('progress').render();
    this.triggerMethod('content:change', this);
  },
  updateControls(permissionChanged) {
    const changed = (...attributes) => permissionChanged || some(attributes, attr => this.model.hasChanged(attr));
    if (changed('_state')) this.showState();
    if (changed('_owner', '_program', '_state')) this.showOwner();
  },
  toggleSelected(isSelected) {
    this.el.classList.toggle('is-selected', isSelected);
  },
  setPatientSelected(patientId) {
    this.selectedPatientId = patientId;
    this.getChildView('copy').setPatientSelected(patientId);
  },
  focusPatient() {
    this.getChildView('copy').focusPatient();
  },
  showCheck() {
    if (!this.canEdit) {
      this.getRegion('check').empty();
      return;
    }

    const isSelected = this.state.isSelected(this.model);
    this.toggleSelected(isSelected);
    const current = this.getChildView('check');
    if (current) {
      current.isSelected = isSelected;
      current.render();
      return;
    }
    const checkView = new CheckView({
      deselectLabel: intl.patients.shared.actionsViews.deselectFlow,
      selectLabel: intl.patients.shared.actionsViews.selectFlow,
      isSelected,
    });

    this.listenTo(checkView, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', checkView);
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
    this.ownerComponent = new CardOwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),

      stateOptions: { isDisabled },
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
