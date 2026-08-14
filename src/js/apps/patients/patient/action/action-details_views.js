import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/textarea-flex.scss';
import 'scss/modules/sidebar.scss';

import trim from 'js/utils/formatting/trim';

import InputWatcherBehavior from 'js/behaviors/input-watcher';

import { StateComponent, OwnerComponent, DueComponent, TimeComponent, DurationComponent } from 'js/apps/patients/shared/actions_views';
import { ReadOnlyStateView, ReadOnlyOwnerView, ReadOnlyDueDateTimeView, ReadOnlyDurationView } from 'js/apps/patients/shared/read-only_views';
import { DialerView } from 'js/apps/patients/patient/action/action-dialer_views';

import ActionDetailsTemplate from './action-details.hbs';
import ActionEditTemplate from './action-edit.hbs';
import ReadOnlyTemplate from './read-only.hbs';

import 'scss/domain/action-icons.scss';
import './action.scss';

const getActionIcon = model => {
  if (model.hasOutreach()) {
    return {
      icon: 'share-from-square',
      iconType: 'far',
    };
  }

  const options = model.get('options');

  return options?.icon ? options : null;
};

const getActionContentClassName = model => {
  const iconClass = getActionIcon(model) ? ' patient-action__content--with-icon' : '';

  return `patient-action__content${ iconClass }`;
};

const NameView = View.extend({
  tagName: 'h1',
  className() {
    const iconClass = getActionIcon(this.model) ? ' patient-action__title--with-icon' : '';

    return `patient-detail-page__title patient-action__title${ iconClass }`;
  },
  template: hbs`
    {{#if icon}}
      <span class="patient-action__title-icon">
        {{#if icon.color}}
          <span class="action-icon action-icon--{{ icon.color }}">{{fa icon.iconType icon.icon}}</span>
        {{else}}
          {{fa icon.iconType icon.icon}}
        {{/if}}
      </span>
    {{/if}}
    <span class="patient-action__name" data-testid="patient-action-name">{{ name }}</span>
  `,
  templateContext() {
    return {
      icon: getActionIcon(this.model),
    };
  },
});

const SaveView = View.extend({
  className: 'patient-action__details-actions',
  template: hbs`
    <button class="button button--text js-cancel" type="button">{{ @intl.patients.patient.action.detailsViews.saveView.cancelBtn }}</button>
    <button class="button button--positive js-save" type="button">{{ @intl.patients.patient.action.detailsViews.saveView.saveBtn }}</button>
  `,
  triggers: {
    'click .js-cancel': 'cancel',
    'click .js-save': 'save',
  },
});

const DetailsView = View.extend({
  className: 'textarea-flex',
  template: ActionDetailsTemplate,
  behaviors: [InputWatcherBehavior],
  ui: {
    input: '.js-input',
    spacer: '.js-spacer',
  },
  modelEvents: {
    'change:details': 'onChangeDetails',
  },
  events: {
    'focusin .js-input': 'onFocusInput',
    'focusout .js-input': 'onFocusoutInput',
  },
  onChangeDetails() {
    this.hasDetailsChange = true;
  },
  onFocusInput() {
    this.$el.addClass('is-editing');
  },
  onFocusoutInput() {
    if (this.hasDetailsChange) return;

    this.$el.removeClass('is-editing');
  },
  onWatchChange(text) {
    this.ui.input.val(text);
    this.ui.spacer.text(text || ' ');

    this.model.set('details', trim(text));
  },
});

const ReadOnlyActionView = View.extend({
  className() {
    return getActionContentClassName(this.model);
  },
  template: ReadOnlyTemplate,
  regions: {
    name: '[data-name-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDateTime: '[data-due-datetime-region]',
    duration: '[data-duration-region]',
    dialer: '[data-dialer-region]',
  },
  onRender() {
    this.showChildView('name', new NameView({ model: this.model }));
    this.showState();
    this.showOwner();
    this.showDueDateTime();
    this.showDuration();
    this.showDialer();
  },
  showState() {
    const readOnlyStateView = new ReadOnlyStateView({ model: this.model, showLabel: true });
    this.showChildView('state', readOnlyStateView);
  },
  showOwner() {
    const readOnlyOwnerView = new ReadOnlyOwnerView({ model: this.model });
    this.showChildView('owner', readOnlyOwnerView);
  },
  showDueDateTime() {
    const readOnlyDueDateTimeView = new ReadOnlyDueDateTimeView({ model: this.model });
    this.showChildView('dueDateTime', readOnlyDueDateTimeView);
  },
  showDuration() {
    const readOnlyDurationView = new ReadOnlyDurationView({ model: this.model });
    this.showChildView('duration', readOnlyDurationView);
  },
  showDialer() {
    if (!this.getOption('hasDialer')) return;

    this.showChildView('dialer', new DialerView({
      model: this.model,
      canEdit: false,
    }));
  },
  templateContext() {
    return {
      canEdit: this.model.canEdit(),
    };
  },
});

const ActionView = View.extend({
  className() {
    return getActionContentClassName(this.model);
  },
  childViewTriggers: {
    'save': 'save',
    'cancel': 'cancel',
  },
  template: ActionEditTemplate,
  regions: {
    name: '[data-name-region]',
    details: '[data-details-region]',
    save: '[data-save-region]',
    state: '[data-state-region]',
    owner: '[data-owner-region]',
    dueDate: '[data-due-date-region]',
    dueTime: '[data-due-time-region]',
    duration: '[data-duration-region]',
    dialer: '[data-dialer-region]',
  },
  modelEvents: {
    'change:name': 'onChangeName',
    'change:details': 'onChangeDetails',
    'change:_state': 'onChangeActionState',
    'change:_owner': 'onChangeOwner',
    'change:due_date': 'onChangeDue',
    'change:due_time': 'onChangeDue',
    'change:duration': 'onChangeDuration',
  },
  onChangeName() {
    this.showName();
  },
  onChangeDetails() {
    if (this.isEditingDetails) return;

    this.showEditForm();
  },
  onChangeActionState() {
    const isDone = this.model.isDone();

    const prevState = this.model.getPreviousState();
    const isPrevDone = prevState.isDone();

    if (isDone === isPrevDone) {
      this.showState();
      return;
    }

    this.render();
  },
  onChangeOwner() {
    if (!this.isRendered()) return;
    this.showOwner();
  },
  onChangeDue() {
    this.showDueDate();
    this.showDueTime();
  },
  onChangeDuration() {
    this.showDuration();
  },
  cloneAction() {
    // NOTE: creates a new clone from the truth for cancelable editing
    if (this.clonedAction) this.stopListening(this.clonedAction);
    this.clonedAction = this.model.clone();
  },
  onRender() {
    this.showName();
    this.showEditForm();
    this.showState();
    this.showOwner();
    this.showDueDate();
    this.showDueTime();
    this.showDuration();
    this.showDialer();
  },
  onSave() {
    this.stopEditingDetails();
  },
  onCancel() {
    this.showEditForm();
  },
  showName() {
    this.showChildView('name', new NameView({ model: this.model }));
  },
  showEditForm() {
    this.cloneAction();

    this.listenTo(this.clonedAction, 'change:details', this.startEditingDetails);

    this.stopEditingDetails();

    this.showDetails();
  },
  startEditingDetails() {
    this.isEditingDetails = true;

    this.showChildView('save', new SaveView({ model: this.clonedAction }));
  },
  stopEditingDetails() {
    this.isEditingDetails = false;

    this.getRegion('save').empty();
  },
  showDetails() {
    this.showChildView('details', new DetailsView({ model: this.clonedAction }));
  },
  showState() {
    const stateComponent = new StateComponent({ stateId: this.model.getState().id, isCompact: true, showLabel: true });

    this.listenTo(stateComponent, 'change:state', state => {
      this.model.saveState(state);
    });

    this.showChildView('state', stateComponent);
  },
  showOwner() {
    const isDisabled = this.model.isDone();
    const program = this.model.getProgram();
    const ownerComponent = new OwnerComponent({
      owner: this.model.getOwner(),
      workspaces: program.getUserWorkspaces(),
      isCompact: true,
      state: { isDisabled },
    });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.model.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showDueDate() {
    const isDisabled = this.model.isDone();
    const dueDateComponent = new DueComponent({
      date: this.model.get('due_date'),
      isCompact: true,
      state: { isDisabled },
      isOverdue: this.model.isOverdue(),
    });

    this.listenTo(dueDateComponent, 'change:due', date => {
      this.model.saveDueDate(date);
    });

    this.showChildView('dueDate', dueDateComponent);
  },
  showDueTime() {
    const isDisabled = this.model.isDone() || !this.model.get('due_date');
    const dueTimeComponent = new TimeComponent({
      time: this.model.get('due_time'),
      isCompact: true,
      isOverdue: this.model.isOverdue(),
      state: { isDisabled },
    });

    this.listenTo(dueTimeComponent, 'change:time', time => {
      this.model.saveDueTime(time);
    });

    this.showChildView('dueTime', dueTimeComponent);
  },
  showDuration() {
    const isDisabled = this.model.isDone();
    const durationComponent = new DurationComponent({
      duration: this.model.get('duration'),
      hideDefaultText: true,
      isCompact: true,
      state: { isDisabled },
    });

    this.listenTo(durationComponent, 'change:duration', duration => {
      this.model.save({ duration });
    });

    this.showChildView('duration', durationComponent);
  },
  showDialer() {
    if (!this.getOption('hasDialer')) return;

    this.showChildView('dialer', new DialerView({
      model: this.model,
      canEdit: true,
    }));
  },
});

export {
  ReadOnlyActionView,
  ActionView,
};
