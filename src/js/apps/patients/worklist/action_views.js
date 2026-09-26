import { some } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/card-list.scss';

import intl from 'js/i18n';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import { CheckView, StateComponent, CardOwnerComponent, CardDueView, CardTimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';
import ActionItemTemplate from './action-item.hbs';
import CopyTemplate from './action-copy.hbs';
import MetaTemplate from './action-meta.hbs';

import 'scss/domain/work-card.scss';
import 'scss/domain/action-card.scss';
import './worklist-list.scss';

const ActionEmptyView = View.extend({
  className: 'card-list__empty',
  attributes: {
    role: 'listitem',
  },
  template: hbs`<h2>{{ @intl.patients.worklist.actionViews.actionEmptyView }}</h2>`,
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
  regions: {
    form: '[data-form-region]',
    details: '[data-details-region]',
  },
  onRender() {
    this.showForm();
    this.showDetailsTooltip();
  },
  showForm() {
    if (!this.model.getForm()) {
      this.getRegion('form').empty();
      return;
    }

    this.showChildView('form', new FormButton({ model: this.model }));
  },
  showDetailsTooltip() {
    if (!this.model.get('details')) {
      this.getRegion('details').empty();
      return;
    }

    this.showChildView('details', new DetailsTooltip({ model: this.model }));
  },
});

const ActionItemView = View.extend({
  className: 'work-card action-card worklist-list__item worklist-list__action-item',
  attributes: {
    role: 'listitem',
  },
  template: ActionItemTemplate,
  regions: {
    copy: { el: '[data-copy-region]', replaceElement: true },
    meta: { el: '[data-meta-region]', replaceElement: true },
    check: '[data-check-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
  },
  templateContext() {
    const state = this.model.getState();

    return {
      isOverdue: this.model.isOverdue(),
      state: state.get('name'),
      stateOptions: state.get('options'),
      flowName: this.flow && this.flow.get('name'),
      patient: this.model.getPatient().attributes,
      owner: this.model.getOwner().get('name'),
      attachmentCount: this.model.getFiles().length,
      commentCount: this.model.commentCount(),
    };
  },
  initialize({ state, selectedPatientId }) {
    this.state = state;
    this.flow = this.model.getFlow();
    this.selectedPatientId = selectedPatientId;
    this.bindRelatedModels();

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });
  },
  modelEvents: {
    'change': 'onModelChange',
  },
  events: {
    'click .js-patient': 'onClickPatient',
    'click .js-flow': 'onClickFlow',
    'click .js-primary': 'onClickPrimary',
    'click .js-attachments': 'onClickAttachments',
    'click .js-comments': 'onClickComments',
    'click .js-no-click': stopEventPropagation,
    'click .js-action-surface': 'onClickSurface',
  },
  navigateToAction(entryTarget) {
    if (this.flow) {
      Radio.trigger('event-router', 'patient:flow:action', this.model.getPatient().id, this.flow.id, this.model.id, entryTarget);
      return;
    }

    Radio.trigger('event-router', 'patient:action', this.model.getPatient().id, this.model.id, entryTarget);
  },
  onClickSurface() {
    this.navigateToAction();
  },
  onClickPatient(event) {
    event.stopImmediatePropagation();
    this.trigger('click:patient', this.model.getPatient(), this);
  },
  onClickFlow(event) {
    event.stopImmediatePropagation();
    Radio.trigger('event-router', 'patient:flow', this.model.getPatient().id, this.flow.id);
  },
  onClickPrimary(event) {
    event.stopImmediatePropagation();
    this.navigateToAction();
  },
  onClickAttachments(event) {
    event.stopImmediatePropagation();
    this.navigateToActionSection('attachments');
  },
  onClickComments(event) {
    event.stopImmediatePropagation();
    this.navigateToActionSection('comments');
  },
  navigateToActionSection(section) {
    this.navigateToAction({ section });
  },
  onRender() {
    this.showChildView('copy', new CopyView({
      model: this.model,
      templateContext: () => this.templateContext(),
    }));
    this.showChildView('meta', new View({
      className: 'work-card__meta action-card__meta',
      model: this.model,
      template: MetaTemplate,
      templateContext: () => this.templateContext(),
    }));
    this.setPatientSelected(this.selectedPatientId);

    const canEdit = this.canEdit;
    this.canEdit = !this.model.isFlowDone() && this.model.canEdit();

    this.showCheck();
    this.showState();
    this.showOwner();
    this.showDueDate();
    this.showDueTime();

    if (canEdit !== this.canEdit) {
      if (!this.canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
  },
  bindRelatedModels() {
    if (this.patient) this.stopListening(this.patient);
    this.patient = this.model.getPatient();
    this.listenTo(this.patient, 'change:first_name change:last_name change:segment', this.updateCopy);
    if (this.flow) this.stopListening(this.flow);
    this.flow = this.model.getFlow();
    if (this.flow) {
      this.listenTo(this.flow, 'change:name', this.updateCopy);
      this.listenTo(this.flow, 'change:_state', this.onModelChange);
    }
  },
  updateCopy() {
    this.getChildView('copy').render();
    this.setPatientSelected(this.selectedPatientId);
    this.triggerMethod('content:change', this);
  },
  onModelChange() {
    const changed = (...attributes) => some(attributes, attr => this.model.hasChanged(attr));
    const canEdit = !this.model.isFlowDone() && this.model.canEdit();
    const permissionChanged = canEdit !== this.canEdit;
    this.canEdit = canEdit;
    if (changed('_patient', '_flow')) this.bindRelatedModels();
    if (changed('name', '_patient', '_flow', 'details', '_form')) {
      this.flow = this.model.getFlow();
      this.updateCopy();
    }
    if (changed('created_at', 'updated_at', '_files', '_comments')) this.getChildView('meta').render();
    if (permissionChanged) {
      this.showCheck();
      if (!canEdit) this.toggleSelected(false);
      this.triggerMethod('change:canEdit');
    }
    this.updateControls(permissionChanged);
    this.triggerMethod('content:change', this);
  },
  updateControls(permissionChanged) {
    const changed = (...attributes) => permissionChanged || some(attributes, attr => this.model.hasChanged(attr));
    if (changed('_state')) this.showState();
    if (changed('_owner', '_program', '_state')) this.showOwner();
    if (changed('due_date', '_state')) this.showDueDate();
    if (changed('due_time', 'due_date', '_state')) this.showDueTime();
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
      deselectLabel: intl.patients.shared.actionsViews.deselectAction,
      selectLabel: intl.patients.shared.actionsViews.selectAction,
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
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    this.stateComponent = new StateComponent({ stateId: this.model.getState().id });

    this.listenTo(this.stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', this.stateComponent);
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
  showDueDate() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueDateView({ model: this.model });
      this.showChildView('dueDate', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    const dueDateView = new CardDueView({
      date: this.model.get('due_date'),

      isDisabled,
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(dueDateView, 'change:due', date => {
      this.model.saveDueDate(date);
    });

    this.showChildView('dueDate', dueDateView);
  },
  showDueTime() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueTimeView({ model: this.model });
      this.showChildView('dueTime', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone() || !this.model.get('due_date');
    this.dueTimeComponent = new CardTimeComponent({
      time: this.model.get('due_time'),

      stateOptions: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(this.dueTimeComponent, 'change:time', time => {
      this.model.saveDueTime(time);
    });

    this.showChildView('dueTime', this.dueTimeComponent);
  },

});

export {
  ActionEmptyView,
  ActionItemView,
};
