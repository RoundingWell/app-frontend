import { get, some } from 'underscore';
import dayjs from 'dayjs';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl, { renderTemplate } from 'js/i18n';

import Droplist from 'js/components/droplist';

import { StateComponent, OwnerComponent, DueView, TimeComponent, DurationComponent } from 'js/apps/patients/shared/actions_views';

import BulkEditActionsInlineTemplate from './actions-inline.hbs';
import BulkEditFlowsInlineTemplate from './flows-inline.hbs';

import './bulk-edit.scss';

const i18n = intl.patients.shared.bulkEdit.bulkEditViews;

// User edits update their own control; derived values must update the displayed control.
function hasDerivedValueChanged(model, field) {
  return model.hasChanged(`${ field }Multi`)
    || (model.hasChanged(field) && !model.get(`${ field }Changed`));
}

function getIsOverdue(date, time) {
  if (!date) return false;

  const dueDateTime = dayjs(time ? `${ date } ${ time }` : date);

  return dueDateTime.isBefore(dayjs(), 'day') || dueDateTime.isBefore(dayjs(), 'minute');
}

const BulkStateTemplate = hbs`<span class="action-state action-state--{{ options.color }}">{{fa options.iconType options.icon}}<span>{{ name }}</span></span>`;
const MixedTimeTemplate = hbs`{{far "clock"}} <span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDueTimeDefaultText }}</span>`;
const MixedDurationTemplate = hbs`{{far "stopwatch"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDurationDefaultText }}</span>`;
const ActionsCountTemplate = hbs`{{formatMessage (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditButtonView.editActions") itemCount=itemCount}}`;
const FlowsCountTemplate = hbs`{{formatMessage (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditButtonView.editFlows") itemCount=itemCount}}`;

const BulkEditOwnerComponent = OwnerComponent.extend({
  className: `${ OwnerComponent.prototype.className } bulk-edit-inline__owner-button`,
});

const MixedOwnerComponent = BulkEditOwnerComponent.extend({
  className: 'owner-component owner-component--compact button button--compact bulk-edit-inline__owner-button',
  template: hbs`{{far "circle-user"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkOwnerDefaultText }}</span>`,
});

const BulkStateComponent = StateComponent.extend({
  className: 'button button--compact',
  template: BulkStateTemplate,
});

const MixedStateComponent = BulkStateComponent.extend({
  template: hbs`{{fas "circle-dot"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkStateDefaultText }}</span>`,
});

const MixedTimeComponent = TimeComponent.extend({
  className: 'button button--compact time-component',
  getTemplate() {
    return MixedTimeTemplate;
  },
});

const MixedDurationComponent = DurationComponent.extend({
  className: 'button button--compact',
  getTemplate() {
    return MixedDurationTemplate;
  },
});

const BulkDueDateView = DueView.extend({
  className: 'button button--compact due-component',
  template: hbs`{{far "calendar-days"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDueDateDefaultText }}</span>`,
});

const OwnerScopeComponent = Droplist.extend({
  align: 'right',
  popWidth: 184,
  className: 'button button--compact bulk-edit-inline__owner-scope',
  template: hbs`<span class="button__value">{{ text }}</span>{{far "angle-down"}}`,
  picklistOptions: {
    headingText: i18n.bulkEditButtonView.ownerScopeLabel,
    isCheckable: true,
  },
  initialize({ bulkEditModel, isForFlows }) {
    const labels = i18n.bulkEditButtonView;
    const options = isForFlows ?
      [
        { id: 'flows-only', text: labels.flowsOnly, applyOwner: false },
        { id: 'flows-and-actions', text: labels.flowsAndActions, applyOwner: true },
      ] :
      [
        { id: 'actions-only', text: labels.actionsOnly, applyOwner: false },
        { id: 'actions-and-flows', text: labels.actionsAndFlows, applyOwner: true },
      ];

    this.bulkEditModel = bulkEditModel;
    this.collection = new Backbone.Collection(options);

    this.syncSelected();
    this.syncDisabled();

    this.listenTo(this.bulkEditModel, 'change:applyOwner', this.syncSelected);
    this.listenTo(this.bulkEditModel, 'change:ownerMulti', this.syncDisabled);
    this.listenTo(this.bulkEditModel, 'change:isSaving', this.syncDisabled);
  },
  syncSelected() {
    const applyOwner = this.bulkEditModel.get('applyOwner') === true;

    this.getState().set('selected', this.collection.findWhere({
      applyOwner,
    }));
  },
  syncDisabled() {
    const isDisabled = !!(this.bulkEditModel.get('ownerMulti') || this.bulkEditModel.get('isSaving'));

    this.getState().set({ isDisabled });
    this.syncStateAttributes();
  },
  onChangeSelected(selected) {
    this.bulkEditModel.set('applyOwner', selected.get('applyOwner'));
  },
});

const FlowsStateComponent = StateComponent.extend({
  onPicklistSelect({ model }) {
    // Selected done
    if (model.isDone() && this.getOption('flows')) {
      this.shouldSelectDone(model);
      return;
    }

    this.setSelectedStatus(model);
  },
  shouldSelectDone(model) {
    const flows = this.getOption('flows');
    const flowsIncomplete = some(flows.invoke('isAllDone'), complete => !complete);

    if (!flowsIncomplete) {
      this.setSelectedStatus(model);
      return;
    }

    // We must hide the droplist before showing the modal
    this.popRegion.empty();

    if (Radio.request('settings', 'get', 'require_done_flow')) {
      Radio.request('modal', 'show:small', {
        bodyText: i18n.flowsStateComponent.requireDoneModal.bodyText,
        headingText: i18n.flowsStateComponent.requireDoneModal.headingText,
        submitText: i18n.flowsStateComponent.requireDoneModal.submitText,
        cancelText: false,
        buttonClass: 'button button--primary',
      });
      return;
    }

    const modal = Radio.request('modal', 'show:small', {
      bodyText: i18n.flowsStateComponent.doneModal.bodyText,
      headingText: i18n.flowsStateComponent.doneModal.headingText,
      submitText: i18n.flowsStateComponent.doneModal.submitText,
      onSubmit: () => {
        this.setSelectedStatus(model);
        modal.destroy();
      },
    });
  },
  setSelectedStatus(model) {
    this.getState().set('selected', model);
    this.popRegion.empty();
  },
});

const BulkFlowsStateComponent = FlowsStateComponent.extend({
  className: 'button button--compact',
  template: BulkStateTemplate,
});

const MixedFlowStateComponent = BulkFlowsStateComponent.extend({
  template: hbs`{{fas "circle-dot"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkStateDefaultText }}</span>`,
});

const BulkEditActionsBodyView = View.extend({
  modelEvents: {
    'change': 'onModelChange',
  },
  onModelChange() {
    if (this.model.hasChanged('collection')) return this.updateCollection();
    if (this.model.hasChanged('isSaving')) return this.render();

    if (hasDerivedValueChanged(this.model, 'state')) this.showState();
    if (hasDerivedValueChanged(this.model, 'owner')) this.showOwner();
    this.showChangedDueDateTime();
    if (hasDerivedValueChanged(this.model, 'duration')) this.showDuration();
  },
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
    duration: '[data-duration-region]',
    ownerScope: '[data-owner-scope-region]',
  },
  onRender() {
    this.isSaving = this.model.get('isSaving');

    this.showState();
    this.showOwner();
    this.showDueDateTime();
    this.showDuration();
    this.showOwnerScope();
  },
  getStateComponent() {
    const isDisabled = this.isSaving;

    if (this.model.get('stateMulti')) {
      return new MixedStateComponent({
        isCompact: true,
        stateOptions: { isDisabled },
      });
    }

    return new BulkStateComponent({
      isCompact: true,
      stateId: get(this.model.get('state'), 'id'),
      stateOptions: { isDisabled },
    });
  },
  getOwnerComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('ownerMulti')) {
      return new MixedOwnerComponent({
        stateOptions: { isDisabled },
      });
    }

    return new BulkEditOwnerComponent({
      isCompact: true,
      owner: this.model.get('owner'),
      workspaces: this.model.get('workspaces'),
      stateOptions: { isDisabled },
    });
  },
  getDueDateView() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('dateMulti')) {
      return new BulkDueDateView({
        isDisabled,
      });
    }

    const isOverdue = getIsOverdue(this.model.get('date'));

    return new DueView({
      date: this.model.get('date'),
      isDisabled,
      isOverdue,

      showLabel: !isDisabled,
    });
  },
  getDueTimeComponent() {
    if (this.model.get('timeMulti')) {
      return new MixedTimeComponent({
        stateOptions: {
          isDisabled: this.model.get('hasMissingDueDate') || this.model.someComplete() || this.isSaving,
        },
      });
    }

    const time = this.model.get('time');
    const hasNoDueDates = this.model.get('hasMissingDueDate')
      || (!this.model.get('dateMulti') && !this.model.get('date'));
    const isDisabled = hasNoDueDates || this.model.someComplete() || this.isSaving;
    const isOverdue = getIsOverdue(this.model.get('date'), time);

    return new TimeComponent({
      time,
      stateOptions: { isDisabled },
      isOverdue,

      showLabel: !isDisabled,
    });
  },
  getDurationComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('durationMulti')) {
      return new MixedDurationComponent({
        isCompact: true,
        stateOptions: { isDisabled },
      });
    }

    return new DurationComponent({
      duration: this.model.get('duration'),

      stateOptions: { isDisabled },
    });
  },
  showState() {
    const stateComponent = this.getStateComponent();

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.setState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    const ownerComponent = this.getOwnerComponent();

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.setOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showChangedDueDateTime() {
    if (this.model.hasChanged('dateMulti') || this.model.hasChanged('date')) {
      this.showDueDateTime();
    } else if (hasDerivedValueChanged(this.model, 'time')) {
      this.showDueTime();
    }
  },
  showDueDateTime() {
    this.showDueDate();
    this.showDueTime();
  },
  showDueDate() {
    const dueDateView = this.getDueDateView();

    this.listenTo(dueDateView, 'change:due', date => {
      this.model.setDueDate(date);
    });

    this.showChildView('dueDate', dueDateView);
  },
  showDueTime() {
    const dueTimeComponent = this.getDueTimeComponent();

    this.listenTo(dueTimeComponent, 'change:time', time => {
      this.model.setDueTime(time);
    });

    this.showChildView('dueTime', dueTimeComponent);
  },
  showDuration() {
    const durationComponent = this.getDurationComponent();

    this.listenTo(durationComponent, 'change:duration', duration => {
      this.model.setDuration(duration);
    });

    this.showChildView('duration', durationComponent);
  },
  showOwnerScope() {
    this.showChildView('ownerScope', new OwnerScopeComponent({
      bulkEditModel: this.model,
      isForFlows: false,
    }));
  },
});

const BulkEditActionsInlineView = BulkEditActionsBodyView.extend({
  className: 'bulk-edit-inline bulk-edit-inline--actions',
  template: BulkEditActionsInlineTemplate,
  triggers: {
    'click .js-cancel': 'cancel',
    'click .js-save': 'save',
  },
  ui: {
    heading: '.bulk-edit-inline__heading',
  },
  templateContext() {
    return {
      itemCount: this.model.get('collection').length,
      isSaving: this.model.get('isSaving'),
    };
  },
  updateCollection() {
    this.getUI('heading')[0].textContent = renderTemplate(ActionsCountTemplate, {
      itemCount: this.model.get('collection').length,
    });
    this.showState();
    this.showOwner();
    this.showDueDateTime();
    this.showDuration();
    this.showOwnerScope();
  },
});

const BulkEditFlowsBodyView = View.extend({
  modelEvents: {
    'change': 'onModelChange',
  },
  onModelChange() {
    if (this.model.hasChanged('collection')) return this.updateCollection();
    if (this.model.hasChanged('isSaving')) return this.render();

    if (hasDerivedValueChanged(this.model, 'state')) this.showState();
    if (hasDerivedValueChanged(this.model, 'owner')) this.showOwner();
  },
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    ownerScope: '[data-owner-scope-region]',
  },
  onRender() {
    this.isSaving = this.model.get('isSaving');

    this.showState();
    this.showOwner();
    this.showOwnerScope();
  },
  getStateComponent() {
    const isDisabled = this.isSaving;

    if (this.model.get('stateMulti')) {
      return new MixedFlowStateComponent({
        isCompact: true,
        flows: this.model.get('collection'),
        stateOptions: { isDisabled },
      });
    }

    return new BulkFlowsStateComponent({
      isCompact: true,
      flows: this.model.get('collection'),
      stateId: get(this.model.get('state'), 'id'),
      stateOptions: { isDisabled },
    });
  },
  getOwnerComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('ownerMulti')) {
      return new MixedOwnerComponent({
        stateOptions: { isDisabled },
      });
    }

    return new BulkEditOwnerComponent({
      isCompact: true,
      owner: this.model.get('owner'),
      workspaces: this.model.get('workspaces'),
      stateOptions: { isDisabled },
    });
  },
  showState() {
    const stateComponent = this.getStateComponent();

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.setState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    const ownerComponent = this.getOwnerComponent();

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.setOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showOwnerScope() {
    this.showChildView('ownerScope', new OwnerScopeComponent({
      bulkEditModel: this.model,
      isForFlows: true,
    }));
  },
});

const BulkEditFlowsInlineView = BulkEditFlowsBodyView.extend({
  className: 'bulk-edit-inline bulk-edit-inline--flows',
  template: BulkEditFlowsInlineTemplate,
  triggers: {
    'click .js-cancel': 'cancel',
    'click .js-save': 'save',
  },
  ui: {
    heading: '.bulk-edit-inline__heading',
  },
  templateContext() {
    return {
      itemCount: this.model.get('collection').length,
      isSaving: this.model.get('isSaving'),
    };
  },
  updateCollection() {
    this.getUI('heading')[0].textContent = renderTemplate(FlowsCountTemplate, {
      itemCount: this.model.get('collection').length,
    });
    this.showState();
    this.showOwner();
    this.showOwnerScope();
  },
});

const BulkEditFlowsSuccessTemplate = hbs`{{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditFlowsSuccess") itemCount=itemCount}}`;

const BulkEditActionsSuccessTemplate = hbs`{{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditActionsSuccess") itemCount=itemCount}}`;

export {
  BulkEditActionsInlineView,
  BulkEditFlowsInlineView,
  BulkEditFlowsSuccessTemplate,
  BulkEditActionsSuccessTemplate,
};
