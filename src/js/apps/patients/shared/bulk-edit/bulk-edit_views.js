import { extend, get, some } from 'underscore';
import dayjs from 'dayjs';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import { StateComponent, OwnerComponent, DueComponent, TimeComponent, DurationComponent } from 'js/apps/patients/shared/actions_views';

import BulkEditActionsInlineTemplate from './actions-inline.hbs';
import BulkEditFlowsInlineTemplate from './flows-inline.hbs';

import './bulk-edit.scss';

const i18n = intl.patients.shared.bulkEdit.bulkEditViews;

function getIsOverdue(date, time) {
  if (!date) return false;

  const dueDateTime = dayjs(time ? `${ date } ${ time }` : date);

  return dueDateTime.isBefore(dayjs(), 'day') || dueDateTime.isBefore(dayjs(), 'minute');
}

const BulkStateTemplate = hbs`<span class="action-state action-state--{{ options.color }}">{{fa options.iconType options.icon}}<span>{{ name }}</span></span>`;

const BulkEditOwnerComponent = OwnerComponent.extend({
  viewOptions() {
    const options = OwnerComponent.prototype.viewOptions.call(this);

    return extend({}, options, {
      className: `${ options.className } bulk-edit-inline__owner-button`,
    });
  },
});

const OwnerScopeComponent = Droplist.extend({
  align: 'right',
  popWidth: 184,
  viewOptions: {
    className: 'button button--compact bulk-edit-inline__owner-scope',
    template: hbs`<span class="button__value">{{ text }}</span>{{far "angle-down"}}`,
  },
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
    this.listenTo(this.bulkEditModel, 'change:ownerMulti change:isSaving', this.syncDisabled);
  },
  syncSelected() {
    const applyOwner = this.bulkEditModel.get('applyOwner') === true;

    this.setState('selected', this.collection.findWhere({
      applyOwner,
    }));
  },
  syncDisabled() {
    this.setState('isDisabled', this.bulkEditModel.get('ownerMulti') || this.bulkEditModel.get('isSaving'));
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
    this.setState('selected', model);
    this.popRegion.empty();
  },
});

const BulkEditActionsBodyView = View.extend({
  modelEvents: {
    'change:stateMulti': 'showState',
    'change:ownerMulti': 'showOwner',
    'change:dateMulti': 'showDueDateTime',
    'change:date': 'showDueDateTime',
    'change:timeMulti': 'showDueTime',
    'change:durationMulti': 'showDuration',
    'change:isSaving': 'render',
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
      return new StateComponent({
        isCompact: true,
        viewOptions: {
          attributes: {
            disabled: isDisabled,
            type: 'button',
          },
          className: 'button button--compact',
          template: hbs`{{fas "circle-dot"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkStateDefaultText }}</span>`,
        },
      });
    }

    return new StateComponent({
      isCompact: true,
      stateId: get(this.model.get('state'), 'id'),
      state: { isDisabled },
      viewOptions: {
        className: 'button button--compact',
        template: BulkStateTemplate,
      },
    });
  },
  getOwnerComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('ownerMulti')) {
      return new BulkEditOwnerComponent({
        viewOptions: {
          attributes: {
            disabled: isDisabled,
          },
          className: 'owner-component owner-component--compact button button--compact bulk-edit-inline__owner-button',
          template: hbs`{{far "circle-user"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkOwnerDefaultText }}</span>`,
        },
      });
    }

    return new BulkEditOwnerComponent({
      isCompact: true,
      owner: this.model.get('owner'),
      workspaces: this.model.get('workspaces'),
      state: { isDisabled },
    });
  },
  getDueDateComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('dateMulti')) {
      return new DueComponent({
        state: { isDisabled },
        viewOptions: {
          attributes: {
            disabled: isDisabled,
            type: 'button',
          },
          tagName: 'button',
          className: 'button button--compact due-component',
          triggers: {
            'click': 'click',
          },
          template: hbs`{{far "calendar-days"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDueDateDefaultText }}</span>`,
        },
      });
    }

    const isOverdue = getIsOverdue(this.model.get('date'));

    return new DueComponent({
      date: this.model.get('date'),
      state: { isDisabled },
      isOverdue,
      isCompact: true,
      showLabel: !isDisabled,
    });
  },
  getDueTimeComponent() {
    if (this.model.get('timeMulti')) {
      return new TimeComponent({
        viewOptions: {
          attributes: {
            disabled: this.model.get('hasMissingDueDate') || this.model.someComplete() || this.isSaving,
          },
          className: 'button button--compact time-component',
          template: hbs`{{far "clock"}} <span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDueTimeDefaultText }}</span>`,
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
      state: { isDisabled },
      isOverdue,
      isCompact: true,
      showLabel: !isDisabled,
    });
  },
  getDurationComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('durationMulti')) {
      return new DurationComponent({
        isCompact: true,
        viewOptions: {
          className: 'button button--compact',
          attributes: {
            disabled: isDisabled,
          },
          template: hbs`{{far "stopwatch"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDurationDefaultText }}</span>`,
        },
      });
    }

    return new DurationComponent({
      duration: this.model.get('duration'),
      isCompact: true,
      state: { isDisabled },
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
  showDueDateTime() {
    this.showDueDate();
    this.showDueTime();
  },
  showDueDate() {
    const dueDateComponent = this.getDueDateComponent();

    this.listenTo(dueDateComponent, 'change:due', date => {
      this.model.setDueDate(date);
    });

    this.showChildView('dueDate', dueDateComponent);
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
  templateContext() {
    return {
      itemCount: this.collection.length,
      isSaving: this.model.get('isSaving'),
    };
  },
});

const BulkEditFlowsBodyView = View.extend({
  modelEvents: {
    'change:stateMulti': 'showState',
    'change:ownerMulti': 'showOwner',
    'change:isSaving': 'render',
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
      return new FlowsStateComponent({
        isCompact: true,
        flows: this.collection,
        viewOptions: {
          attributes: {
            disabled: isDisabled,
          },
          className: 'button button--compact',
          template: hbs`{{fas "circle-dot"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkStateDefaultText }}</span>`,
        },
      });
    }

    return new FlowsStateComponent({
      isCompact: true,
      flows: this.collection,
      stateId: get(this.model.get('state'), 'id'),
      state: { isDisabled },
      viewOptions: {
        className: 'button button--compact',
        template: BulkStateTemplate,
      },
    });
  },
  getOwnerComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('ownerMulti')) {
      return new BulkEditOwnerComponent({
        viewOptions: {
          className: 'owner-component owner-component--compact button button--compact bulk-edit-inline__owner-button',
          template: hbs`{{far "circle-user"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkOwnerDefaultText }}</span>`,
        },
        state: { isDisabled },
      });
    }

    return new BulkEditOwnerComponent({
      isCompact: true,
      owner: this.model.get('owner'),
      workspaces: this.model.get('workspaces'),
      state: { isDisabled },
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
  templateContext() {
    return {
      itemCount: this.collection.length,
      isSaving: this.model.get('isSaving'),
    };
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
