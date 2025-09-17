import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView } from 'marionette';
import { animate } from 'animejs';

import { alphaSort } from 'js/utils/sorting';

import intl from 'js/i18n';

import 'scss/modules/sidebar.scss';
import 'scss/modules/loader.scss';

import './action-sidebar.scss';

const EmptyView = View.extend({
  className: 'action-sidebar__no-results',
  template: hbs`{{ @intl.patients.sidebar.action.actionSidebarAttachmentsViews.emptyView }}`,
});

const AttachmentView = View.extend({
  className: 'u-margin--t-16',
  modelEvents: {
    'change:_progress': 'onChangeProgress',
    'change:_download': 'render',
  },
  downloadTemplate: hbs`
    <a class="action-sidebar__attachment-filename" target="_blank" href="{{_view}}">{{filename}}</a>
    <div class="flex">
      <a class="action-sidebar__attachment-action flex-grow" target="_blank" href="{{_download}}" download>
        {{far "download"}} <span>{{ @intl.patients.sidebar.action.actionSidebarAttachmentsViews.attachmentView.downloadText }}</span>
      </a>
      {{#if canRemoveAttachments}}
        <a class="action-sidebar__attachment-action js-remove">
          {{far "trash-can"}} <span>{{ @intl.patients.sidebar.action.actionSidebarAttachmentsViews.attachmentView.removeText }}</span>
        </a>
      {{/if}}
    </div>
  `,
  uploadTemplate: hbs`
    <div class="action-sidebar__attachment-filename">{{filename}}</div>
    <div class="loader__bar u-margin--t-8 js-progress-bar">
      <div class="loader__bar-progress js-progress"></div>
    </div>
  `,
  ui: {
    progress: '.js-progress',
    remove: '.js-remove',
  },
  triggers: {
    'click @ui.remove': 'click:remove',
  },
  onChangeProgress() {
    /* istanbul ignore if: Avoids async change errors */
    if (!this.isRendered() || !this.ui.progress.length) return;

    animate(this.ui.progress[0], {
      width: `${ this.model.get('_progress') }%`,
      ease: 'inOutSine',
    });
  },
  onClickRemove() {
    const modal = Radio.request('modal', 'show:small', {
      bodyText: intl.patients.sidebar.action.actionSidebarAttachmentsViews.removeModal.bodyText,
      headingText: intl.patients.sidebar.action.actionSidebarAttachmentsViews.removeModal.headingText,
      submitText: intl.patients.sidebar.action.actionSidebarAttachmentsViews.removeModal.submitText,
      buttonClass: 'button--red',
      onSubmit: () => {
        modal.destroy();
        this.triggerMethod('remove:attachment', this.model);
      },
    });
  },
  getTemplate() {
    if (this.model.get('_download')) {
      return this.downloadTemplate;
    }
    return this.uploadTemplate;
  },
  templateContext() {
    return {
      filename: this.model.getFilename(),
      canRemoveAttachments: this.getOption('canRemoveAttachments'),
    };
  },
});

const AttachmentsView = CollectionView.extend({
  className: 'u-margin--t-24',
  collectionEvents: {
    'changeId': 'filter',
  },
  template: hbs`
    <div class="sidebar__attachments">
      <h3 class="sidebar__heading">
        {{far "paperclip"}}<span class="u-margin--l-8">{{ @intl.patients.sidebar.action.actionSidebarAttachmentsViews.attachmentsViews.attachmentsHeadingText }}</span>
      </h3>
      <div data-attachments-files-region></div>
      {{#if canUploadAttachments}}
        <form>
          <input type="file" id="upload-attachment" accept=".pdf" class="action-sidebar__attachment-file js-file">
          <label for="upload-attachment" class="button-primary u-margin--t-16 js-add">{{far "paperclip"}}<span>{{ @intl.patients.sidebar.action.actionSidebarAttachmentsViews.attachmentsViews.addAttachment }}</span></label>
        </form>
      {{/if}}
    </div>
  `,
  templateContext() {
    return {
      canUploadAttachments: this.getOption('canUploadAttachments'),
    };
  },
  childViewContainer: '[data-attachments-files-region]',
  childView: AttachmentView,
  childViewOptions() {
    return {
      canRemoveAttachments: this.getOption('canRemoveAttachments'),
    };
  },
  emptyView: EmptyView,
  viewComparator(viewA, viewB) {
    return alphaSort('desc', viewA.model.get('created_at'), viewB.model.get('created_at'));
  },
  viewFilter({ model }) {
    return !model.isNew();
  },
  ui: {
    file: '.js-file',
    add: '.js-add',
  },
  events: {
    'change @ui.file': 'onChangeFile',
    'click @ui.add': 'onClickAdd',
  },
  /* istanbul ignore next: Cypress tests file selection by injection */
  onClickAdd() {
    // NOTE: Clears previous selection if reuploading
    this.ui.file[0].value = '';
  },
  onChangeFile() {
    const file = this.ui.file[0].files[0];
    /* istanbul ignore next: Cypress can't cancel a file selection dialog */
    if (file) this.triggerMethod('add:attachment', file);
  },
  childViewTriggers: {
    'remove:attachment': 'remove:attachment',
  },
});

export {
  AttachmentsView,
};
