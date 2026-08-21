import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View, Region } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';
import Tooltip from 'js/components/tooltip';

import IframeFormBehavior from 'js/behaviors/iframe-form';

import FormViewportBehavior from './form-viewport';
import LayoutTemplate from './layout.hbs';

import './form.scss';

const i18n = intl.patients.patient.form.formViews;

const FormExpandActionView = View.extend({
  className: 'flex',
  template: hbs`
    <button class="button button--icon form__control js-expand-button form__actions-icon form__actions-icon--expand{{#if isExpanded}} is-selected{{/if}}" type="button" aria-label="{{ expandLabel }}">
      {{#if isExpanded}}{{fas "down-left-and-up-right-to-center"}}{{else}}{{fas "up-right-and-down-left-from-center"}}{{/if}}
    </button>
  `,
  templateContext() {
    const isExpanded = this.model.get('formExpanded');

    return {
      expandLabel: isExpanded ? i18n.formActionsView.decreaseWidth : i18n.formActionsView.increaseWidth,
      isExpanded,
    };
  },
  onBeforeRender() {
    this.destroyTooltips();
  },
  onRender() {
    this.renderExpandTooltip();
  },
  onBeforeDestroy() {
    this.destroyTooltips();
  },
  modelEvents: {
    'change:formExpanded': 'render',
  },
  ui: {
    expandButton: '.js-expand-button',
  },
  triggers: {
    'click @ui.expandButton': 'click:expandButton',
  },
  onClickExpandButton() {
    this.expandTooltip.hideTooltip();
  },
  destroyTooltips() {
    if (!this.expandTooltip) return;

    this.expandTooltip.destroy();
    this.expandTooltip = null;
  },
  renderExpandTooltip() {
    const message = this.model.get('formExpanded') ? i18n.formActionsView.decreaseWidth : i18n.formActionsView.increaseWidth;

    this.expandTooltip = new Tooltip({
      message,
      uiView: this,
      ui: this.ui.expandButton,
    });
  },
});

const LayoutView = View.extend({
  behaviors() {
    if (!this.getOption('isActionForm')) return [];

    return [FormViewportBehavior];
  },
  className: 'patient__content form__frame',
  attributes: {
    'data-form-viewport-frame': '',
  },
  template: LayoutTemplate,
  regionClass: Region.extend({ replaceElement: true }),
  regions: {
    form: '[data-form-region]',
    draftStatus: '[data-draft-status-region]',
    formAction: {
      el: '[data-form-action-region]',
      replaceElement: true,
    },
    expandAction: '[data-expand-action-region]',
    status: '[data-status-region]',
    widgets: '[data-widgets-header-region]',
  },
  ui: {
    viewportInteract: '.js-viewport-interact',
  },
  triggers: {
    'click @ui.viewportInteract': 'form:interact',
  },
  onRender() {
    this.$el.toggleClass('form__frame--embedded', !!this.getOption('isActionForm'));
    this.setExpanded(this.getOption('isExpanded'));
  },
  templateContext() {
    return { isActionForm: !!this.getOption('isActionForm') };
  },
  setExpanded(isExpanded) {
    this.$el.toggleClass('form__frame--expanded', !!isExpanded);
    this.trigger('change:expanded', !!isExpanded);
  },
});

const IframeView = View.extend({
  behaviors: [IframeFormBehavior],
  className: 'form__content',
  ui: {
    iframe: 'iframe',
  },
  template: hbs`<iframe src="{{ url }}" data-form-viewport-iframe></iframe>`,
  templateContext() {
    return {
      url: this.model.getFormUrl({
        responseId: this.getOption('responseId'),
      }),
    };
  },
  getViewportElement() {
    return this.ui.iframe[0];
  },
  getViewportHeight() {
    return this.getViewportElement().getBoundingClientRect().height;
  },
  setViewportHeight(height) {
    this.getViewportElement().style.height = `${ height }px`;
  },
  clearViewportHeight() {
    this.getViewportElement().style.removeProperty('height');
  },
});

const StatusView = View.extend({
  className: 'u-text-align--right',
  template: hbs`{{formatHTMLMessage (intlGet "patients.patient.form.formViews.statusView.label") date=(formatDateTime updated_at "AT_TIME")}}`,
});

const ReadOnlyView = View.extend({
  className: 'form__control form__form-action',
  template: hbs`
    <button class="button button--muted" type="button" disabled>{{ @intl.patients.patient.form.formViews.readOnlyView.buttonText }}</button>
  `,
});

const LockedSubmitView = View.extend({
  className: 'form__control form__submit-status',
  template: hbs`
    <div class="form__submit-status-icon">
      {{far "lock-keyhole"}}
    </div>
    <div class="form__submit-status-locked-text">
      {{ @intl.patients.patient.form.formViews.lockedSubmitView.permissionMessage }}
    </div>
  `,
});

const DraftMenuView = View.extend({
  className: 'form__draft-menu',
  template: hbs`
    <div class="form__draft-menu-info">{{ @intl.patients.patient.form.formViews.draftStatusView.storedWork }}</div>
    <div class="form__draft-menu-saved">{{formatHTMLMessage (intlGet "patients.patient.form.formViews.draftStatusView.updatedAt") updated=(formatDateTime updated "AGO_OR_TODAY")}}</div>
    <button class="form__draft-menu-discard-button js-discard" type="button">{{ @intl.patients.patient.form.formViews.draftStatusView.discardDraft }}</button>
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
    className: 'button button--icon form__control form__actions-icon form__actions-icon--draft',
    template: hbs`{{far "cloud-check"}}`,
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
      buttonClass: 'button button--danger',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('discard:submission');
      },
    });
  },
});

const SaveButtonTypeDroplist = Droplist.extend({
  align: 'right',
  initialize({ model }) {
    this.collection = new Backbone.Collection([
      {
        text: i18n.saveView.saveAndGoBack.droplistItemText,
        value: 'saveAndGoBack',
      },
      {
        text: i18n.saveView.save.droplistItemText,
        value: 'save',
      },
    ]);

    this.setState('selected', this.collection.find({
      value: model.get('saveButtonType'),
    }));
  },
  viewOptions: {
    className: 'button button--positive form__submit-choice',
    template: hbs`{{fas "caret-down"}}`,
  },
  picklistOptions() {
    return {
      headingText: i18n.saveView.droplistLabel,
      isCheckable: true,
    };
  },
});

const SaveView = View.extend({
  className: 'form__control form__form-action',
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
    const canChooseSaveType = this.getOption('canChooseSaveType');
    const saveButtonType = this.model.get('saveButtonType');

    return {
      canChooseSaveType,
      isDisabled: this.getOption('isDisabled'),
      saveButtonText: canChooseSaveType ?
        i18n.saveView[saveButtonType].buttonText :
        i18n.saveView.save.buttonText,
    };
  },
  template: hbs`
    <button class="button button--positive form__action-button js-save-button{{#if canChooseSaveType}} form__submit-button{{/if}}" type="button" {{#if isDisabled}}disabled{{/if}}>
      {{ saveButtonText }}
    </button>
    {{#if canChooseSaveType}}<button type="button" data-save-type-region></button>{{/if}}
  `,
  triggers: {
    'click .js-save-button': 'click:save',
  },
  onRender() {
    if (!this.getOption('canChooseSaveType')) return;

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
  className: 'form__control form__form-action',
  template: hbs`
    <button class="button button--positive form__action-button" type="button">{{ @intl.patients.patient.form.formViews.updateView.buttonText }}</button>
  `,
  triggers: {
    'click': 'click',
  },
});

const SubmissionStatusDroplist = Droplist.extend({
  align: 'right',
  viewOptions() {
    return {
      className: 'button form__submission-status',
      template: hbs`
        {{far "cloud-check"}}{{formatDateTime updated_at "AT_TIME"}}{{far "angle-down" classes="form__submission-status-arrow"}}
      `,
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
  className: 'form__control form__form-action',
  template: hbs`
    <button class="button button--primary js-current" type="button">{{ @intl.patients.patient.form.formViews.historyView.currentVersionButton }}</button>
  `,
  triggers: {
    'click .js-current': 'click:current',
  },
});

export {
  LayoutView,
  IframeView,
  FormExpandActionView,
  StatusView,
  ReadOnlyView,
  LockedSubmitView,
  SaveView,
  UpdateView,
  SubmissionStatusDroplist,
  HistoryView,
  DraftStatusView,
};
