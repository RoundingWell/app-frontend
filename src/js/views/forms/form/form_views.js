import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, Region } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

const i18n = intl.forms.form.formViews;

import Droplist from 'js/components/droplist';
import Tooltip from 'js/components/tooltip';

import IframeFormBehavior from 'js/behaviors/iframe-form';

import './form.scss';

const ContextTrailView = View.extend({
  className: 'form__context-trail',
  actionTemplate: hbs`<a class="js-back form__context-link">{{fas "chevron-left" }}{{ @intl.forms.form.formViews.contextTrailView.backBtn }}</a>`,
  patientTemplate: hbs`<a class="js-dashboard form__context-link">{{fas "chevron-left" }}{{ @intl.forms.form.formViews.contextTrailView.backDashboard }}</a>`,
  getTemplate() {
    if (!this.action) return this.patientTemplate;

    return this.actionTemplate;
  },
  initialize({ patient, action }) {
    this.patient = patient;
    this.action = action;
  },
  triggers: {
    'click .js-back': 'click:back',
    'click .js-dashboard': 'click:dashboard',
  },
  onClickBack() {
    Radio.request('history', 'go:back', () => {
      if (this.action.getFlow()) {
        this.routeToFlow();
        return;
      }

      this.routeToPatient();
    });
  },
  onClickDashboard() {
    this.routeToPatient();
  },
  routeToFlow() {
    Radio.trigger('event-router', 'flow', this.action.getFlow().id);
  },
  routeToPatient() {
    Radio.trigger('event-router', 'patient:dashboard', this.patient.id);
  },
});

const FormStateActionsView = View.extend({
  className: 'flex',
  template: hbs`
    {{#if hasHistory}}<button class="js-history-button form__actions-icon{{#if shouldShowHistory}} is-selected{{/if}}">{{far "clock-rotate-left"}}</button>{{/if}}
    <button class="js-expand-button form__actions-icon">{{#if isExpanded}}{{fas "down-left-and-up-right-to-center"}}{{else}}{{fas "up-right-and-down-left-from-center"}}{{/if}}</button>
    {{#if hasAction}}<button class="js-sidebar-button form__actions-icon{{#if isActionShown}} is-selected{{/if}}">{{far "file-lines"}}</button>{{/if}}
  `,
  templateContext() {
    return {
      isActionShown: this.isActionShown(),
      hasHistory: this.responses && !!this.responses.length,
      hasAction: !!this.action,
    };
  },
  onRender() {
    this.renderSidebarTooltip();
    this.renderExpandTooltip();
    this.renderHistoryTooltip();
  },
  initialize({ action, responses }) {
    this.action = action;
    this.responses = responses;

    this.listenTo(this.responses, 'update', this.render);
  },
  modelEvents: {
    'change:isExpanded': 'render',
    'change:isActionSidebar': 'render',
    'change:shouldShowHistory': 'render',
  },
  ui: {
    sidebarButton: '.js-sidebar-button',
    expandButton: '.js-expand-button',
    historyButton: '.js-history-button',
  },
  triggers: {
    'click @ui.sidebarButton': 'click:sidebarButton',
    'click @ui.expandButton': 'click:expandButton',
    'click @ui.historyButton': 'click:historyButton',
  },
  isActionShown() {
    return this.model.get('isActionSidebar') && !this.model.get('isExpanded');
  },
  renderSidebarTooltip() {
    const isActionShown = this.isActionShown();
    const message = isActionShown ? i18n.formActionsView.hideActionSidebar : i18n.formActionsView.showActionSidebar;

    new Tooltip({
      message,
      uiView: this,
      ui: this.ui.sidebarButton,
    });
  },
  renderExpandTooltip() {
    const isExpanded = this.model.get('isExpanded');
    const message = isExpanded ? i18n.formActionsView.decreaseWidth : i18n.formActionsView.increaseWidth;

    new Tooltip({
      message,
      uiView: this,
      ui: this.ui.expandButton,
    });
  },
  renderHistoryTooltip() {
    const shouldShowHistory = this.model.get('shouldShowHistory');
    const message = shouldShowHistory ? i18n.formActionsView.currentVersion : i18n.formActionsView.responseHistory;

    new Tooltip({
      message,
      uiView: this,
      ui: this.ui.historyButton,
    });
  },
});

const LayoutView = View.extend({
  className: 'form__frame',
  template: hbs`
    <div class="form__layout">
      <div class="flex">
        <div class="overflow--hidden flex-grow">
          <div data-context-trail-region></div>
          <div class="form__title">
            <span class="form__title-icon">{{far "square-poll-horizontal"}}</span>
            <span class="u-text--overflow">{{patient.first_name}} {{patient.last_name}} — {{ name }}</span>
          </div>
        </div>
        <div class="flex-grow">
          <div data-status-region>&nbsp;</div>
          <div class="form__controls">
            <div data-state-actions-region></div>
            <div data-form-updated-region></div>
            <div data-form-action-region></div>
          </div>
        </div>
      </div>
      <div data-widgets-header-region></div>
      <div data-form-region></div>
    </div>
    <div class="form__sidebar" data-sidebar-region></div>
  `,
  regionClass: Region.extend({ replaceElement: true }),
  regions: {
    contextTrail: '[data-context-trail-region]',
    form: '[data-form-region]',
    formUpdated: '[data-form-updated-region]',
    formAction: {
      el: '[data-form-action-region]',
      replaceElement: true,
    },
    sidebar: {
      el: '[data-sidebar-region]',
      replaceElement: false,
    },
    stateActions: '[data-state-actions-region]',
    status: '[data-status-region]',
    widgets: '[data-widgets-header-region]',
  },
  templateContext() {
    return {
      patient: this.getOption('patient').pick('first_name', 'last_name'),
    };
  },
  onRender() {
    this.showChildView('contextTrail', new ContextTrailView({
      patient: this.getOption('patient'),
      action: this.getOption('action'),
    }));
  },
});

const IframeView = View.extend({
  behaviors: [IframeFormBehavior],
  className: 'form__content',
  template: hbs`<iframe src="/formapp/{{#if responseId}}{{ responseId }}{{/if}}"></iframe>`,
  templateContext() {
    return {
      responseId: this.getOption('responseId'),
    };
  },
});

const StoredSubmissionView = View.extend({
  className: 'form__content',
  template: hbs`
    <div class="form__prompt">
      <h2 class="form__prompt-title">{{ @intl.forms.form.formViews.storedSubmissionView.title }}</h2>
      <div class="form__prompt-dialog">
        <div class="flex-shrink">
          <button class="button--blue button--large js-submit">{{ @intl.forms.form.formViews.storedSubmissionView.submitButton }}</button>
          <div class="u-margin--t-16">{{formatHTMLMessage (intlGet "forms.form.formViews.storedSubmissionView.updated") updated=(formatDateTime updated "TIME_OR_DAY")}}</div>
        </div>
        <div class="flex-shrink">
          <button class="button-secondary button--large form__discard-button js-discard" style="color:red">{{ @intl.forms.form.formViews.storedSubmissionView.cancelButton }}</button>
        </div>
      </div>
    </div>
  `,
  templateContext() {
    return {
      updated: this.getOption('updated'),
    };
  },
  triggers: {
    'click .js-submit': 'submit',
    'click .js-discard': 'discard',
  },
  onDiscard() {
    const modal = Radio.request('modal', 'show:small', {
      bodyText: i18n.storedSubmissionView.discardModal.bodyText,
      headingText: i18n.storedSubmissionView.discardModal.headingText,
      submitText: i18n.storedSubmissionView.discardModal.submitText,
      buttonClass: 'button--red',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('discard:submission');
      },
    });
  },
});

const StatusView = View.extend({
  className: 'u-text-align--right',
  template: hbs`{{formatHTMLMessage (intlGet "forms.form.formViews.statusView.label") date=(formatDateTime updated_at "AT_TIME")}}`,
});

const ReadOnlyView = View.extend({
  className: 'form__form-action',
  template: hbs`
    <button class="button--grey" disabled=true>{{ @intl.forms.form.formViews.readOnlyView.buttonText }}</button>
  `,
});

const LockedSubmitView = View.extend({
  className: 'form__submit-status',
  template: hbs`
    <div class="form__submit-status-icon">
      {{far "lock-keyhole"}}
    </div>
    <div class="form__submit-status-locked-text">
      {{ @intl.forms.form.formViews.lockedSubmitView.permissionMessage }}
    </div>
  `,
});

const SaveButtonTypeDroplist = Droplist.extend({
  align: 'right',
  initialize({ model }) {
    this.collection = new Backbone.Collection([
      {
        text: i18n.saveView.save.droplistItemText,
        value: 'save',
      },
      {
        text: i18n.saveView.saveAndGoBack.droplistItemText,
        value: 'saveAndGoBack',
      },
    ]);

    const currentSaveButtonType = model.get('saveButtonType');

    this.setState('selected', this.collection.find({ value: currentSaveButtonType }));
  },
  viewOptions: {
    className: 'button--green button__drop-list-select',
    template: hbs`{{fas "caret-down"}}`,
  },
  picklistOptions() {
    return {
      headingText: i18n.saveView.droplistLabel,
      isCheckable: true,
    };
  },
});

const LastUpdatedView = View.extend({
  className: 'form__submit-status',
  template: hbs`
    <div class="form__submit-status-icon">
      {{far "shield-check"}}
    </div>
    <div class="form__submit-status-text">
      <div class="u-text--overflow">{{ @intl.forms.form.formViews.lastUpdatedView.storedWork }}</div>
      {{#if updated}}
        <div class="u-text--overflow">{{formatHTMLMessage (intlGet "forms.form.formViews.lastUpdatedView.updatedAt") updated=(formatDateTime updated "AGO_OR_TODAY")}}</div>
      {{/if}}
    </div>
  `,
  templateContext() {
    return {
      updated: this.updated,
    };
  },
  initialize({ updated }) {
    this.updated = updated;

    if (this.updated) {
      this.renderInterval = setInterval(() => {
        this.render();
      }, 45000);
    }
  },
  onBeforeDestroy() {
    clearInterval(this.renderInterval);
  },
});

const SaveView = View.extend({
  className: 'form__form-action',
  regions: {
    saveType: {
      el: '[data-save-type-region]',
      replaceElement: true,
    },
  },
  modelEvents: {
    'change:saveButtonType': 'render',
  },
  templateContext() {
    const saveButtonType = this.model.get('saveButtonType');

    return {
      isDisabled: this.getOption('isDisabled'),
      showSaveButton: saveButtonType === 'save',
      showSaveGoBackButton: saveButtonType === 'saveAndGoBack',
    };
  },
  template: hbs`
    <button class="button--green button__drop-list-action js-save-button" {{#if isDisabled}}disabled{{/if}}>
      {{#if showSaveButton}}
        {{ @intl.forms.form.formViews.saveView.save.buttonText }}
      {{/if}}
      {{#if showSaveGoBackButton}}
        {{ @intl.forms.form.formViews.saveView.saveAndGoBack.buttonText }}
      {{/if}}
    </button>
    <button data-save-type-region></button>
  `,
  triggers: {
    'click .js-save-button': 'click:save',
  },
  onRender() {
    const saveButtonTypeDroplist = this.showChildView('saveType', new SaveButtonTypeDroplist({
      model: this.model,
      state: {
        isDisabled: this.getOption('isDisabled'),
      },
    }));

    this.listenTo(saveButtonTypeDroplist, {
      'change:selected'(selected) {
        this.triggerMethod('select:button:type', selected.get('value'));
      },
    });
  },
});

const UpdateView = View.extend({
  className: 'form__form-action',
  template: hbs`
    <button class="button--green">{{ @intl.forms.form.formViews.updateView.buttonText }}</button>
  `,
  triggers: {
    'click': 'click',
  },
});

const HistoryDroplist = Droplist.extend({
  viewOptions() {
    return {
      className: 'button-filter',
      template: hbs`
        {{far "clock-rotate-left"}}{{formatDateTime updated_at "AT_TIME"}} {{formatMessage (intlGet "forms.form.formViews.historyDroplistView.nameText") name=name}}{{far "angle-down"}}
      `,
      templateContext() {
        return {
          name: this.model.getEditorName(),
        };
      },
    };
  },
  picklistOptions() {
    return {
      itemTemplate: hbs`
        {{formatDateTime updated_at "AT_TIME"}}&nbsp;{{formatMessage (intlGet "forms.form.formViews.historyDroplistView.nameText") name=name}}
      `,
      itemTemplateContext() {
        return {
          name: this.model.getEditorName(),
        };
      },
    };
  },
});

const HistoryView = View.extend({
  className: 'form__form-action',
  template: hbs`
    <div data-versions-region></div>
    <button class="button--blue js-current u-margin--l-8">{{ @intl.forms.form.formViews.historyView.currentVersionButton }}</button>
  `,
  regions: {
    versions: {
      el: '[data-versions-region]',
      replaceElement: true,
    },
  },
  triggers: {
    'click .js-current': 'click:current',
  },
  initialize({ selected, collection }) {
    const responseDroplist = this.showChildView('versions', new HistoryDroplist({
      collection,
      state: { selected },
    }));

    this.listenTo(responseDroplist, {
      'change:selected'(response) {
        this.triggerMethod('change:response', response);
      },
    });
  },
});

export {
  LayoutView,
  IframeView,
  StoredSubmissionView,
  FormStateActionsView,
  StatusView,
  ReadOnlyView,
  LockedSubmitView,
  SaveView,
  UpdateView,
  HistoryView,
  LastUpdatedView,
};
