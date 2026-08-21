import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/card-list.scss';

import intl from 'js/i18n';
import stopEventPropagation from 'js/utils/stop-event-propagation';

import { CheckComponent, StateComponent, OwnerComponent, DueComponent, TimeComponent, FormButton, DetailsTooltip } from 'js/apps/patients/shared/actions_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateView, ReadOnlyDueTimeView } from 'js/apps/patients/shared/read-only_views';
import ActionItemTemplate from './action-item.hbs';

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

const ActionItemView = View.extend({
  className: 'work-card action-card worklist-list__item worklist-list__action-item',
  attributes: {
    role: 'listitem',
  },
  template: ActionItemTemplate,
  regions: {
    check: '[data-check-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
    form: '[data-form-region]',
    details: '[data-details-region]',
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

    this.listenTo(state, {
      'select:multiple': this.showCheck,
      'select:none': this.showCheck,
    });
  },
  modelEvents: {
    'change': 'render',
  },
  events: {
    'click .js-action-surface': 'onClickSurface',
    'click .js-no-click': stopEventPropagation,
    'click .js-patient': 'onClickPatient',
    'click .js-flow': 'onClickFlow',
    'click .js-primary': 'onClickPrimary',
    'click .js-attachments': 'onClickAttachments',
    'click .js-comments': 'onClickComments',
  },
  ui: {
    patient: '.js-patient',
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
    event.stopPropagation();
    this.trigger('click:patient', this.model.getPatient(), event.currentTarget);
  },
  onClickFlow(event) {
    event.stopPropagation();
    Radio.trigger('event-router', 'patient:flow', this.model.getPatient().id, this.flow.id);
  },
  onClickPrimary(event) {
    event.stopPropagation();
    this.navigateToAction();
  },
  onClickAttachments(event) {
    event.stopPropagation();
    this.navigateToActionSection('attachments');
  },
  onClickComments(event) {
    event.stopPropagation();
    this.navigateToActionSection('comments');
  },
  navigateToActionSection(section) {
    this.navigateToAction({ section });
  },
  onRender() {
    this.setPatientSelected(this.selectedPatientId);
    this.showForm();
    this.showDetailsTooltip();

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
  toggleSelected(isSelected) {
    this.$el.toggleClass('is-selected', isSelected);
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
    const checkComponent = new CheckComponent({
      deselectLabel: intl.patients.shared.actionsViews.deselectAction,
      selectLabel: intl.patients.shared.actionsViews.selectAction,
      state: { isSelected },
    });

    this.listenTo(checkComponent, {
      'select'(domEvent) {
        this.triggerMethod('select', this, !!domEvent.shiftKey);
      },
      'change:isSelected': this.toggleSelected,
    });

    this.showChildView('check', checkComponent);
  },
  showState() {
    if (!this.canEdit) {
      const readOnlyStateView = new ReadOnlyStateView({ model: this.model });
      this.showChildView('state', readOnlyStateView);
      return;
    }

    this.stateComponent = new StateComponent({ stateId: this.model.getState().id, isCompact: true });

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
  showDueDate() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueDateView({ model: this.model });
      this.showChildView('dueDate', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone();
    this.dueDateComponent = new DueComponent({
      date: this.model.get('due_date'),
      isCompact: true,
      state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(this.dueDateComponent, 'change:due', date => {
      this.model.saveDueDate(date);
    });

    this.showChildView('dueDate', this.dueDateComponent);
  },
  showDueTime() {
    if (!this.canEdit) {
      const readOnlyOwnerView = new ReadOnlyDueTimeView({ model: this.model });
      this.showChildView('dueTime', readOnlyOwnerView);
      return;
    }

    const isDisabled = this.model.isDone() || !this.model.get('due_date');
    this.dueTimeComponent = new TimeComponent({
      time: this.model.get('due_time'),
      isCompact: true,
      state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(this.dueTimeComponent, 'change:time', time => {
      this.model.saveDueTime(time);
    });

    this.showChildView('dueTime', this.dueTimeComponent);
  },
  showForm() {
    if (!this.model.getForm()) return;

    this.showChildView('form', new FormButton({ model: this.model }));
  },
  showDetailsTooltip() {
    if (!this.model.get('details')) return;

    this.showChildView('details', new DetailsTooltip({ model: this.model }));
  },
});

export {
  ActionEmptyView,
  ActionItemView,
};
