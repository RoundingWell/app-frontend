import { get, some } from 'underscore';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View } from 'marionette';

import intl from 'js/i18n';

import 'scss/modules/buttons.scss';
import 'scss/modules/modals.scss';
import 'scss/modules/sidebar.scss';

import { StateComponent, OwnerComponent, DueComponent, TimeComponent, DurationComponent } from 'js/apps/patients/shared/actions_views';

import BulkEditActionBodyTemplate from './bulk-edit-action-body.hbs';
import BulkEditFlowBodyTemplate from './bulk-edit-flow-body.hbs';

const i18n = intl.patients.shared.bulkEdit.bulkEditViews;

function getIsOverdue(date, time) {
  if (!date) return false;

  const dueDateTime = dayjs(time ? `${ date } ${ time }` : date);

  return dueDateTime.isBefore(dayjs(), 'day') || dueDateTime.isBefore(dayjs(), 'minute');
}

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
        buttonClass: 'button--blue',
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

const BulkEditButtonView = View.extend({
  template: hbs`
    <button class="button--blue js-bulk-edit">
      {{#if isFlowList}}
        {{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditButtonView.editFlows") itemCount=items.length}}
      {{else}}
        {{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditButtonView.editActions") itemCount=items.length}}
      {{/if}}
    </button>
    <span class="button--text js-cancel">{{@intl.patients.shared.bulkEdit.bulkEditViews.bulkEditButtonView.cancel}}</span>
  `,
  templateContext() {
    return {
      isFlowList: this.getOption('isFlowType'),
    };
  },
  triggers: {
    'click .js-cancel': 'click:cancel',
    'click .js-bulk-edit': 'click:edit',
  },
});

const BulkEditActionsHeaderView = View.extend({
  className: 'modal__header--sidebar',
  template: hbs`
    <div class="flex">
      <div class="flex-grow">
      <h3 class="sidebar__heading">{{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditActionsHeaderView.headingText") itemCount=items.length}}</h3>
      </div>
      <div>
        <button class="button--icon js-close">{{fas "xmark"}}</button>
      </div>
    </div>
  `,
});

const BulkEditFlowsHeaderView = View.extend({
  className: 'modal__header--sidebar',
  template: hbs`
    <div class="flex">
      <div class="flex-grow">
        <h3 class="sidebar__heading">{{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditFlowsHeaderView.headingText") itemCount=items.length}}</h3>
      </div>
      <div>
        <button class="button--icon js-close">{{fas "xmark"}}</button>
      </div>
    </div>
  `,
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
  className: 'modal__content--sidebar',
  template: BulkEditActionBodyTemplate,
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
    duration: '[data-duration-region]',
    applyOwner: '[data-apply-owner-region]',
  },
  onRender() {
    this.isSaving = this.model.get('isSaving');

    this.showState();
    this.showOwner();
    this.showDueDateTime();
    this.showDuration();
    this.showApplyOwner();
  },
  getStateComponent() {
    const isDisabled = this.isSaving;

    if (this.model.get('stateMulti')) {
      return new StateComponent({
        viewOptions: {
          attributes: {
            disabled: isDisabled,
          },
          className: 'button-secondary w-100',
          template: hbs`{{fas "circle-dot"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkStateDefaultText }}</span>`,
        },
      });
    }

    return new StateComponent({
      stateId: get(this.model.get('state'), 'id'),
      state: { isDisabled },
    });
  },
  getOwnerComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('ownerMulti')) {
      return new OwnerComponent({
        viewOptions: {
          attributes: {
            disabled: isDisabled,
          },
          className: 'button-secondary w-100',
          template: hbs`{{far "circle-user"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkOwnerDefaultText }}</span>`,
        },
      });
    }

    return new OwnerComponent({
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
          },
          tagName: 'button',
          className: 'button-secondary w-100 due-component',
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
    });
  },
  getDueTimeComponent() {
    if (this.model.get('timeMulti')) {
      return new TimeComponent({
        viewOptions: {
          attributes: {
            disabled: this.model.get('dateMulti') || this.model.someComplete() || this.isSaving,
          },
          className: 'button-secondary time-component w-100',
          template: hbs`{{far "clock"}} <span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDueTimeDefaultText }}</span>`,
        },
      });
    }

    const time = this.model.get('time');
    const isDisabled = (this.model.get('dateMulti') && !time) || !this.model.get('date') || this.model.someComplete() || this.isSaving;
    const isOverdue = getIsOverdue(this.model.get('date'), time);

    return new TimeComponent({
      time,
      state: { isDisabled },
      isOverdue,
    });
  },
  getDurationComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('durationMulti')) {
      return new DurationComponent({
        viewOptions: {
          className: 'button-secondary w-100',
          attributes: {
            disabled: isDisabled,
          },
          template: hbs`{{far "stopwatch"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkDurationDefaultText }}</span>`,
        },
      });
    }

    return new DurationComponent({
      duration: this.model.get('duration'),
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
  showApplyOwner() {
    this.showChildView('applyOwner', new ApplyOwnerView({
      model: this.model,
      isForFlows: false,
    }));
  },
});

const ApplyOwnerView = View.extend({
  modelEvents: {
    'change:applyOwner': 'render',
    'change:ownerMulti': 'render',
  },
  className: 'u-margin--l-16',
  template: hbs`
    <button class="button--checkbox js-apply-owner"{{#if isDisabled}} disabled{{/if}}>
      {{#if applyOwner}}{{fas "square-check"}}{{else}}{{fal "square"}}{{/if~}}
      {{#if isForFlows}}
        <span>{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkEditFlowBodyTemplate.applyOwnerLabel }}</span>
      {{else}}
        <span>{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkEditActionBodyTemplate.applyOwnerLabel }}</span>
      {{/if}}
    </button>`,
  triggers: {
    'click .js-apply-owner': 'click:select',
  },
  initialize({ isForFlows }) {
    this.isForFlows = isForFlows;
  },
  templateContext() {
    return {
      isDisabled: this.model.get('ownerMulti') || this.model.get('isSaving'),
      isForFlows: this.isForFlows,
    };
  },
  onClickSelect() {
    this.model.set('applyOwner', !this.model.get('applyOwner'));
  },
});

const BulkEditFlowsBodyView = View.extend({
  modelEvents: {
    'change:stateMulti': 'showState',
    'change:ownerMulti': 'showOwner',
    'change:isSaving': 'render',
  },
  className: 'modal__content--sidebar',
  template: BulkEditFlowBodyTemplate,
  regions: {
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    applyOwner: '[data-apply-owner-region]',
  },
  onRender() {
    this.isSaving = this.model.get('isSaving');

    this.showState();
    this.showOwner();
    this.showApplyOwner();
  },
  getStateComponent() {
    const isDisabled = this.isSaving;

    if (this.model.get('stateMulti')) {
      return new FlowsStateComponent({
        flows: this.collection,
        viewOptions: {
          attributes: {
            disabled: isDisabled,
          },
          className: 'button-secondary w-100',
          template: hbs`{{fas "circle-dot"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkStateDefaultText }}</span>`,
        },
      });
    }

    return new FlowsStateComponent({
      flows: this.collection,
      stateId: get(this.model.get('state'), 'id'),
      state: { isDisabled },
    });
  },
  getOwnerComponent() {
    const isDisabled = this.model.someComplete() || this.isSaving;

    if (this.model.get('ownerMulti')) {
      return new OwnerComponent({
        viewOptions: {
          className: 'button-secondary w-100',
          template: hbs`{{far "circle-user"}}<span class="button__value--indeterminate">{{ @intl.patients.shared.bulkEdit.bulkEditViews.bulkOwnerDefaultText }}</span>`,
        },
        state: { isDisabled },
      });
    }

    return new OwnerComponent({
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
  showApplyOwner() {
    this.showChildView('applyOwner', new ApplyOwnerView({
      model: this.model,
      isForFlows: true,
    }));
  },
});

const BulkEditFlowsSuccessTemplate = hbs`{{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditFlowsSuccess") itemCount=itemCount}}`;

const BulkEditActionsSuccessTemplate = hbs`{{formatMessage  (intlGet "patients.shared.bulkEdit.bulkEditViews.bulkEditActionsSuccess") itemCount=itemCount}}`;

export {
  BulkEditButtonView,
  BulkEditActionsHeaderView,
  BulkEditFlowsHeaderView,
  BulkEditActionsBodyView,
  BulkEditFlowsBodyView,
  BulkEditFlowsSuccessTemplate,
  BulkEditActionsSuccessTemplate,
};
