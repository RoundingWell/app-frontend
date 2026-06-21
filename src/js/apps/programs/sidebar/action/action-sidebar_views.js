import dayjs from 'dayjs';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/forms.scss';
import 'scss/modules/textarea-flex.scss';
import 'scss/modules/sidebar.scss';

import intl from 'js/i18n';
import keyCodes from 'js/utils/formatting/key-codes';
import removeNewline from 'js/utils/formatting/remove-newline';
import trim from 'js/utils/formatting/trim';

import InputWatcherBehavior from 'js/behaviors/input-watcher';
import Optionlist from 'js/components/optionlist';

import { BehaviorComponent, OwnerComponent, DueDayComponent, FormComponent } from 'js/apps/programs/shared/actions_views';
import TagsManagerComponent from 'js/apps/programs/shared/components/tags-manager_component';

import ActionSidebarTemplate from './action-sidebar.hbs';
import ActionNameTemplate from './action-name.hbs';
import ActionDetailsTemplate from './action-details.hbs';

import './action-sidebar.scss';

const { ENTER_KEY } = keyCodes;

const DisabledSaveView = View.extend({
  className: 'u-margin--t-8 sidebar__save',
  template: hbs`<button class="button--green" disabled>{{ @intl.programs.sidebar.action.actionSidebarViews.disabledSaveView.saveBtn }}</button>`,
});

const SaveView = View.extend({
  className: 'u-margin--t-8 sidebar__save',
  template: hbs`
    <button class="button--green js-save">{{ @intl.programs.sidebar.action.actionSidebarViews.saveView.saveBtn }}</button>
    <button class="button--text u-margin--r-4 js-cancel">{{ @intl.programs.sidebar.action.actionSidebarViews.saveView.cancelBtn }}</button>
  `,
  triggers: {
    'click .js-cancel': 'cancel',
    'click .js-save': 'save',
  },
});

const NameView = View.extend({
  className: 'pos--relative',
  template: ActionNameTemplate,
  behaviors: [InputWatcherBehavior],
  ui: {
    input: '.js-input',
    spacer: '.js-spacer',
  },
  onWatchKeydown(evt) {
    if (evt.which === ENTER_KEY) {
      evt.preventDefault();
      return;
    }
  },
  onWatchChange(text) {
    const newText = removeNewline(text);
    this.ui.input.val(newText);
    this.ui.spacer.text(newText || ' ');

    this.model.set('name', newText);
  },
  templateContext() {
    return {
      isNew: this.model.isNew(),
    };
  },
  onDomRefresh() {
    if (this.model.isNew()) {
      this.ui.input.focus();
    }
  },
});

const DetailsView = View.extend({
  className: 'pos--relative',
  template: ActionDetailsTemplate,
  behaviors: [InputWatcherBehavior],
  ui: {
    input: '.js-input',
    spacer: '.js-spacer',
  },
  onWatchChange(text) {
    this.ui.input.val(text);
    this.ui.spacer.text(text || ' ');

    this.model.set('details', trim(text));
  },
});

const ToggleView = View.extend({
  template: hbs`
    <button class="program-action-sidebar__toggle button-secondary {{#if status}}is-on{{/if}} js-toggle" {{#if isDisabled}}disabled{{/if}}>
      {{#if status}}{{fas "toggle-on"}}{{else}}{{far "toggle-off"}}{{/if}}
      {{formatMessage (intlGet "programs.shared.components.toggleComponent.toggle") status=status}}
    </button>
  `,
  templateContext() {
    return {
      status: this.getOption('status'),
      isDisabled: this.getOption('isDisabled'),
    };
  },
  triggers: {
    'click .js-toggle': 'click',
  },
});

const TimestampsView = View.extend({
  className: 'sidebar__footer flex',
  template: hbs`
    <div class="sidebar__footer-left"><h4 class="sidebar__label">{{ @intl.programs.sidebar.action.actionSidebarViews.timestampsView.createdAt }}</h4><div>{{formatDateTime created_at "AT_TIME"}}</div></div>
    <div><h4 class="sidebar__label">{{ @intl.programs.sidebar.action.actionSidebarViews.timestampsView.updatedAt }}</h4><div>{{formatDateTime updated_at "AT_TIME"}}</div></div>
  `,
});

const HeadingView = View.extend({
  getTemplate() {
    if (this.model.hasOutreach()) {
      return hbs`{{ @intl.programs.sidebar.action.actionSidebarViews.headingView.headingOutreachText }}`;
    }
    return hbs`{{ @intl.programs.sidebar.action.actionSidebarViews.headingView.headingText }}`;
  },
});

const FormSharingView = View.extend({
  className: 'sidebar__dialog',
  template: hbs`
    <div class="flex">
      <h3 class="sidebar__heading flex-grow">{{far "share-from-square" classes="u-margin--r-8"}}{{ @intl.programs.sidebar.action.actionSidebarViews.formSharingView.label }}</h3>
    </div>
    <div class="flex u-margin--t-16">
      <h4 class="sidebar__label--inset u-margin--t-8">{{ @intl.programs.sidebar.action.actionSidebarViews.formSharingView.recipientLabel }}</h4>
      <div class="flex-grow"><button class="button-secondary w-100" disabled>{{far "user-plus"}} {{ @intl.programs.sidebar.action.actionSidebarViews.formSharingView.recipientDefault }}</button></div>
    </div>
    <div class="flex u-margin--t-8">
      <h4 class="sidebar__label--inset u-margin--t-8">{{ @intl.programs.sidebar.action.actionSidebarViews.formSharingView.whenLabel }}</h4>
      <div class="flex-grow"><button class="button-secondary w-100" disabled>{{far "stopwatch"}} {{ @intl.programs.sidebar.action.actionSidebarViews.formSharingView.whenDefault }}</button></div>
    </div>
  `,
});

const UploadsEnabledView = View.extend({
  template: hbs`
    {{#if isUploadsEnabled}}
      <div class="flex sidebar__attachments">
        <h3 class="flex-grow sidebar__heading">
          {{far "paperclip"}}<span class="u-margin--l-8">{{ @intl.programs.sidebar.action.actionSidebarViews.uploadsEnabledView.attachmentsHeadingText }}</span>
        </h3>
        <button class="button--link js-disable">{{ @intl.programs.sidebar.action.actionSidebarViews.uploadsEnabledView.disableButtonText }}</button>
      </div>
    {{else}}
      <button {{#if isButtonDisabled}}disabled{{/if}} class="button--blue w-100 js-enable">
        {{far "paperclip"}} {{ @intl.programs.sidebar.action.actionSidebarViews.uploadsEnabledView.enableButtonText }}
      </button>
    {{/if}}
  `,
  triggers: {
    'click .js-enable': 'click:enable',
    'click .js-disable': 'click:disable',
  },
  templateContext() {
    return {
      isUploadsEnabled: this.getOption('isUploadsEnabled'),
      isButtonDisabled: this.getOption('isButtonDisabled'),
    };
  },
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button--icon js-menu',
  template: hbs`{{far "ellipsis"}}`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const menuOptions = new Backbone.Collection([{}]);

    const optionlist = new Optionlist({
      ui: this.$el,
      uiView: this,
      headingText: intl.programs.sidebar.action.actionSidebarViews.menuView.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.programs.sidebar.action.actionSidebarViews.menuView.delete }}</span>`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('delete');
    });

    optionlist.show();
  },
});

const SidebarView = View.extend({
  childViewTriggers: {
    'save': 'save',
    'cancel': 'cancel',
  },
  className: 'flex-grow',
  template: ActionSidebarTemplate,
  regions: {
    name: '[data-name-region]',
    details: '[data-details-region]',
    published: '[data-published-region]',
    archived: '[data-archived-region]',
    behavior: '[data-behavior-region]',
    owner: '[data-owner-region]',
    due: '[data-due-region]',
    form: '[data-form-region]',
    formSharing: '[data-form-sharing-region]',
    allowUploads: '[data-allow-uploads-region]',
    tags: '[data-tags-region]',
    save: '[data-save-region]',
  },
  templateContext() {
    const isNew = this.model.isNew();

    return {
      isNew,
      canTag: !isNew && this.currentUser.can('programs:tags:manage'),
    };
  },
  initialize({ action, tags }) {
    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.tags = tags;
    this.action = action;
    this.model = this.action.clone();
    this.listenTo(this.action, {
      'change:published_at': this.showPublished,
      'change:archived_at': this.showArchived,
      'change:behavior': this.showBehavior,
      'change:_owner': this.onChangeOwner,
      'change:days_until_due': this.onChangeDueDay,
    });
  },
  onChangeOwner() {
    this.showOwner();
  },
  onChangeDueDay() {
    this.showDueDay();
  },
  onRender() {
    this.showAction();
    this.showTags();
  },
  showAction() {
    this.showEditForm();
    this.showPublished();
    this.showArchived();
    this.showBehavior();
    this.showOwner();
    this.showDueDay();
    this.showForm();
  },
  showEditForm() {
    this.stopListening(this.model);
    this.model = this.action.clone();
    this.listenTo(this.model, 'change:name change:details', this.showSave);

    if (this.model.isNew()) this.showDisabledSave();
    else this.getRegion('save').empty();

    this.showName();
    this.showDetails();
  },
  showName() {
    this.showChildView('name', new NameView({ model: this.model, action: this.action }));
  },
  showDetails() {
    this.showChildView('details', new DetailsView({ model: this.model, action: this.action }));
  },
  showPublished() {
    const isPublished = !!this.action.get('published_at');

    const toggleView = new ToggleView({
      status: isPublished,
      isDisabled: this.action.isNew(),
    });

    this.listenTo(toggleView, 'click', () => {
      const newPublishedAt = isPublished ? null : dayjs.utc().format();
      this.action.save({ published_at: newPublishedAt });
    });

    this.showChildView('published', toggleView);
  },
  showArchived() {
    const isArchived = !!this.action.get('archived_at');

    const toggleView = new ToggleView({
      status: isArchived,
      isDisabled: this.action.isNew(),
    });

    this.listenTo(toggleView, 'click', () => {
      const newArchivedAt = isArchived ? null : dayjs.utc().format();
      this.action.save({ archived_at: newArchivedAt });
    });

    this.showChildView('archived', toggleView);
  },
  showBehavior() {
    const isDisabled = this.action.isNew();
    const isFromFlow = !!this.action.getProgramFlow();
    const behaviorComponent = new BehaviorComponent({
      isConditionalAvailable: isFromFlow,
      behavior: this.action.get('behavior'),
      state: { isDisabled },
    });

    this.listenTo(behaviorComponent, 'change:status', ({ behavior }) => {
      this.action.save({ behavior });
    });

    this.showChildView('behavior', behaviorComponent);
  },
  showOwner() {
    const isDisabled = this.action.isNew();
    const isFromFlow = !!this.action.getProgramFlow();
    const ownerComponent = new OwnerComponent({ owner: this.action.getOwner(), isFromFlow, state: { isDisabled } });

    this.listenTo(ownerComponent, 'change:owner', owner => {
      this.action.saveOwner(owner);
    });

    this.showChildView('owner', ownerComponent);
  },
  showDueDay() {
    const isDisabled = this.action.isNew();
    const dueDayComponent = new DueDayComponent({ day: this.action.get('days_until_due'), state: { isDisabled } });

    this.listenTo(dueDayComponent, 'change:day', day => {
      this.action.save({ days_until_due: day });
    });

    this.showChildView('due', dueDayComponent);
  },
  showForm() {
    const isDisabled = this.action.isNew();
    const formComponent = new FormComponent({ form: this.action.getForm(), state: { isDisabled } });

    this.listenTo(formComponent, {
      'change:form'(form) {
        this.action.saveForm(form);
      },
    });

    this.showChildView('form', formComponent);
  },
  showTags() {
    if (this.model.isNew() || !this.currentUser.can('programs:tags:manage')) return;

    const tagsComponent = new TagsManagerComponent({
      allTags: this.tags,
      tags: this.action.getTags(),
    });

    this.listenTo(tagsComponent, {
      'add:tag'(tag) {
        this.action.addTag(tag);
      },
      'remove:tag'(tag) {
        this.action.removeTag(tag);
      },
    });

    this.showChildView('tags', tagsComponent);
  },
  showSave() {
    if (!this.model.isValid()) return this.showDisabledSave();

    this.showChildView('save', new SaveView({ model: this.model }));
  },
  showDisabledSave() {
    this.showChildView('save', new DisabledSaveView());
  },
  onSave() {
    this.getRegion('save').empty();
  },
  onCancel() {
    if (this.model.isNew()) {
      this.triggerMethod('close', this);
      return;
    }

    this.showEditForm();
  },
});

export {
  HeadingView,
  MenuView,
  TimestampsView,
  SidebarView,
  FormSharingView,
  UploadsEnabledView,
};
