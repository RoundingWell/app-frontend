import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, Region } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

const i18n = intl.patients.patient.form.formViews;

import Droplist from 'js/components/droplist';
import Tooltip from 'js/components/tooltip';

import IframeFormBehavior from 'js/behaviors/iframe-form';
import './form.scss';

const FormStateActionsView = View.extend({
  className: 'flex',
  template: hbs`
    {{#if hasHistory}}<button class="js-history-button form__actions-icon{{#if shouldShowHistory}} is-selected{{/if}}">{{far "clock-rotate-left"}}</button>{{/if}}
  `,
  templateContext() {
    return {
      hasHistory: this.responses && !!this.responses.length,
    };
  },
  onRender() {
    this.renderHistoryTooltip();
  },
  initialize({ responses }) {
    this.responses = responses;

    if (responses) this.listenTo(responses, 'update', this.render);
  },
  modelEvents: {
    'change:shouldShowHistory': 'render',
  },
  ui: {
    historyButton: '.js-history-button',
  },
  triggers: {
    'click @ui.historyButton': 'click:historyButton',
  },
  renderHistoryTooltip() {
    if (!this.responses) return;

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
          <div class="form__title">
            <span class="form__title-icon">{{far "square-poll-horizontal"}}</span>
            <span class="u-text--overflow">{{ name }}</span>
          </div>
        </div>
        <div class="flex-grow">
          <div data-status-region>&nbsp;</div>
          <div class="form__controls">
            <div data-state-actions-region></div>
            <div data-draft-status-region></div>
            <div data-form-action-region></div>
          </div>
        </div>
      </div>
      <div data-widgets-header-region></div>
      <div data-form-region></div>
    </div>
  `,
  regionClass: Region.extend({ replaceElement: true }),
  regions: {
    form: '[data-form-region]',
    draftStatus: '[data-draft-status-region]',
    formAction: {
      el: '[data-form-action-region]',
      replaceElement: true,
    },
    stateActions: '[data-state-actions-region]',
    status: '[data-status-region]',
    widgets: '[data-widgets-header-region]',
  },
});

const IframeView = View.extend({
  behaviors: [IframeFormBehavior],
  className: 'form__content',
  template: hbs`<iframe src="{{ url }}"></iframe>`,
  templateContext() {
    return {
      url: this.model.getFormUrl({
        responseId: this.getOption('responseId'),
      }),
    };
  },
});

const StatusView = View.extend({
  className: 'u-text-align--right',
  template: hbs`{{formatHTMLMessage (intlGet "patients.patient.form.formViews.statusView.label") date=(formatDateTime updated_at "AT_TIME")}}`,
});

const ReadOnlyView = View.extend({
  className: 'form__form-action',
  template: hbs`
    <button class="button--grey" disabled=true>{{ @intl.patients.patient.form.formViews.readOnlyView.buttonText }}</button>
  `,
});

const LockedSubmitView = View.extend({
  className: 'form__submit-status',
  template: hbs`
    <div class="form__submit-status-icon">
      {{far "lock-keyhole"}}
    </div>
    <div class="form__submit-status-locked-text">
      {{ @intl.patients.patient.form.formViews.lockedSubmitView.permissionMessage }}
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

const DraftMenuView = View.extend({
  className: 'form__draft-menu',
  template: hbs`
    <div class="form__draft-menu-info">{{ @intl.patients.patient.form.formViews.draftStatusView.storedWork }}</div>
    <div class="form__draft-menu-saved">{{formatHTMLMessage (intlGet "patients.patient.form.formViews.draftStatusView.updatedAt") updated=(formatDateTime updated "AGO_OR_TODAY")}}</div>
    <button class="form__draft-menu-discard-button js-discard">{{ @intl.patients.patient.form.formViews.draftStatusView.discardDraft }}</button>
  `,
  modelEvents: {
    'change:updated': 'render',
  },
  templateContext() {
    return { updated: this.model.get('updated') };
  },
  triggers: {
    'click .js-discard': 'click:discard',
  },
  initialize() {
    this.renderInterval = setInterval(() => {
      this.render();
    }, 45000);
  },
  onBeforeDestroy() {
    clearInterval(this.renderInterval);
  },
});

const DraftStatusView = Droplist.extend({
  align: 'right',
  viewOptions: {
    className: 'form__actions-icon u-margin--l-16 u-margin--r-0',
    template: hbs`{{far "shield-check"}}`,
  },
  initialize({ model }) {
    this.model = model;
  },
  onShow() {
    this._showTooltip();

    this.listenTo(this.getState(), 'change:isActive', (state, isActive) => {
      if (isActive) {
        this._tooltip.destroy();
        this.getView().$el.off('.tooltip');
        return;
      }

      this._showTooltip();
    });
  },
  _showTooltip() {
    const view = this.getView();

    view.$el.off('.tooltip');
    this._tooltip = new Tooltip({
      message: i18n.draftStatusView.tooltip,
      uiView: view,
      ui: view.$el,
      orientation: 'vertical',
      shouldDelay: true,
    });
  },
  showPicklist() {
    const menuView = new DraftMenuView({ model: this.model });

    this.popRegion.show(menuView, this.popRegionOptions());
    this.bindEvents(menuView, this._picklistEvents);
  },
  _picklistEvents: {
    'click:discard': 'onClickDiscard',
    'destroy': 'onPicklistDestroy',
  },
  onClickDiscard() {
    this.popRegion.empty();

    const modal = Radio.request('modal', 'show:small', {
      bodyText: i18n.draftStatusView.discardModal.bodyText,
      headingText: i18n.draftStatusView.discardModal.headingText,
      submitText: i18n.draftStatusView.discardModal.submitText,
      buttonClass: 'button--red',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('discard:submission');
      },
    });
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
        {{ @intl.patients.patient.form.formViews.saveView.save.buttonText }}
      {{/if}}
      {{#if showSaveGoBackButton}}
        {{ @intl.patients.patient.form.formViews.saveView.saveAndGoBack.buttonText }}
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
    <button class="button--green">{{ @intl.patients.patient.form.formViews.updateView.buttonText }}</button>
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
        {{far "clock-rotate-left"}}{{formatDateTime updated_at "AT_TIME"}} {{formatMessage (intlGet "patients.patient.form.formViews.historyDroplistView.nameText") name=name}}{{far "angle-down"}}
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
        {{formatDateTime updated_at "AT_TIME"}}&nbsp;{{formatMessage (intlGet "patients.patient.form.formViews.historyDroplistView.nameText") name=name}}
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
    <button class="button--blue js-current u-margin--l-8">{{ @intl.patients.patient.form.formViews.historyView.currentVersionButton }}</button>
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
  FormStateActionsView,
  StatusView,
  ReadOnlyView,
  LockedSubmitView,
  SaveView,
  UpdateView,
  HistoryView,
  DraftStatusView,
};
