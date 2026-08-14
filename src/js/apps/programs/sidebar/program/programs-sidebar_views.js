import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';
import dayjs from 'dayjs';

import 'scss/modules/buttons.scss';
import 'scss/modules/textarea-flex.scss';
import 'scss/modules/sidebar.scss';

import intl from 'js/i18n';
import keyCodes from 'js/utils/formatting/key-codes';
import removeNewline from 'js/utils/formatting/remove-newline';
import trim from 'js/utils/formatting/trim';

import InputWatcherBehavior from 'js/behaviors/input-watcher';

import ProgramDetailsTemplate from './program-details.hbs';
import ProgramNameTemplate from './program-name.hbs';
import ProgramSidebarTemplate from './program-sidebar.hbs';

import 'js/apps/programs/shared/program-editor-sidebar.scss';

const { ENTER_KEY } = keyCodes;

const i18n = intl.programs.sidebar.program.programsSidebarViews;

export const headingText = i18n.headingText;

const DisabledSaveView = View.extend({
  className: 'u-margin--t-8 sidebar__save',
  template: hbs`<button class="button button--positive" type="button" disabled>{{ @intl.programs.sidebar.program.programsSidebarViews.disabledSaveView.saveBtn }}</button>`,
});

const SaveView = View.extend({
  className: 'u-margin--t-8 sidebar__save',
  template: hbs`
    <button class="button button--positive js-save" type="button">{{ @intl.programs.sidebar.program.programsSidebarViews.saveView.saveBtn }}</button>
    <button class="button button--text u-margin--r-4 js-cancel" type="button">{{ @intl.programs.sidebar.program.programsSidebarViews.saveView.cancelBtn }}</button>
  `,
  triggers: {
    'click .js-cancel': 'cancel',
    'click .js-save': 'save',
  },
});

const NameView = View.extend({
  template: ProgramNameTemplate,
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
      error: this.getOption('error'),
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
  className: 'textarea-flex',
  template: ProgramDetailsTemplate,
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
    <button class="button button--secondary program-editor-sidebar__toggle {{#if status}}is-on{{/if}} js-toggle" type="button" {{#if isDisabled}}disabled{{/if}}>
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
    <div class="sidebar__footer-left"><h4 class="sidebar__label">{{ @intl.programs.sidebar.program.programsSidebarViews.timestampsView.createdAt }}</h4><div>{{formatDateTime created_at "AT_TIME"}}</div></div>
    <div><h4 class="sidebar__label">{{ @intl.programs.sidebar.program.programsSidebarViews.timestampsView.updatedAt }}</h4><div>{{formatDateTime updated_at "AT_TIME"}}</div></div>
  `,
});

const SidebarView = View.extend({
  childViewTriggers: {
    'save': 'save',
    'cancel': 'cancel',
    'toggle': 'toggle',
  },
  className: 'flex-grow',
  template: ProgramSidebarTemplate,
  regions: {
    name: '[data-name-region]',
    details: '[data-details-region]',
    published: '[data-published-region]',
    archived: '[data-archived-region]',
    save: '[data-save-region]',
  },
  templateContext() {
    return {
      isNew: this.model.isNew(),
    };
  },
  initialize({ program }) {
    this.program = program;
    this.model = this.program.clone();

    if (!this.model.isNew()) {
      this.listenTo(this.program, {
        'change:published_at': this.showPublished,
        'change:archived_at': this.showArchived,
      });
    }
  },
  onRender() {
    this.showForm();
    this.showPublished();
    this.showArchived();
  },
  showForm() {
    this.stopListening(this.model);
    this.model = this.program.clone();
    this.listenTo(this.model, 'change:name change:details', this.showSave);

    if (this.model.isNew()) this.showDisabledSave();
    else this.getRegion('save').empty();

    this.showName();
    this.showDetails();
  },
  showName(error) {
    this.showChildView('name', new NameView({ model: this.model, program: this.program, error }));
  },
  showDetails() {
    this.showChildView('details', new DetailsView({ model: this.model, program: this.program }));
  },
  showSave() {
    if (!this.model.isValid()) return this.showDisabledSave();

    this.showChildView('save', new SaveView({ model: this.model }));
  },
  showPublished() {
    if (this.program.isNew()) return;

    const isPublished = !!this.program.get('published_at');

    const toggleView = new ToggleView({
      status: isPublished,
    });

    this.listenTo(toggleView, 'click', () => {
      const newPublishedAt = isPublished ? null : dayjs.utc().format();
      this.program.save({ published_at: newPublishedAt });
    });

    this.showChildView('published', toggleView);
  },
  showArchived() {
    if (this.program.isNew()) return;

    const isArchived = !!this.program.get('archived_at');

    const toggleView = new ToggleView({
      status: isArchived,
    });

    this.listenTo(toggleView, 'click', () => {
      const newArchivedAt = isArchived ? null : dayjs.utc().format();
      this.program.save({ archived_at: newArchivedAt });
    });

    this.showChildView('archived', toggleView);
  },
  showDisabledSave() {
    this.showChildView('save', new DisabledSaveView());
  },
  onSave() {
    if (this.model.isNew()) this.showDisabledSave();
    else this.getRegion('save').empty();
  },
  showErrors({ name }) {
    this.showName(name);
    this.showDisabledSave();
  },
  onCancel() {
    if (this.model.isNew()) {
      this.triggerMethod('close', this);
      return;
    }

    this.showForm();
  },
});

export {
  SidebarView,
  TimestampsView,
};
