import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView } from 'marionette';
import { animate } from 'animejs';

import { alphaSort } from 'js/utils/sorting';

import intl from 'js/i18n';

import './action.scss';

const AttachmentView = View.extend({
  className: 'patient-action__attachment',
  modelEvents: {
    'change:_progress': 'onChangeProgress',
    'change:_download': 'render',
  },
  downloadTemplate: hbs`
    <a class="patient-action__attachment-filename" href="{{_view}}" title="{{ filename }}" target="_blank">{{ filename }}</a>
    <a class="patient-action__attachment-action js-download" href="{{_download}}" title="{{ @intl.patients.patient.action.attachmentsViews.attachmentView.downloadText }}" aria-label="{{ @intl.patients.patient.action.attachmentsViews.attachmentView.downloadText }}" target="_blank" download>{{far "download"}}</a>
    {{#if canRemoveAttachments}}
      <button class="patient-action__attachment-action js-remove" type="button" title="{{ @intl.patients.patient.action.attachmentsViews.attachmentView.removeText }}" aria-label="{{ @intl.patients.patient.action.attachmentsViews.attachmentView.removeText }}">{{far "trash-can"}}</button>
    {{/if}}
  `,
  uploadTemplate: hbs`
    <div class="patient-action__attachment-filename">{{ filename }}</div>
    <div class="patient-action__attachment-progress js-progress-bar">
      <div class="patient-action__attachment-progress-value js-progress"></div>
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
      bodyText: intl.patients.patient.action.attachmentsViews.removeModal.bodyText,
      headingText: intl.patients.patient.action.attachmentsViews.removeModal.headingText,
      submitText: intl.patients.patient.action.attachmentsViews.removeModal.submitText,
      buttonClass: 'button button--danger',
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
  className: 'patient-action__attachments-content',
  collectionEvents: {
    'changeId': 'filter',
  },
  template: hbs`
    {{#if canUploadAttachments}}
      <form class="patient-action__attachment-form">
        <input class="patient-action__attachment-file js-file" id="upload-attachment" type="file" accept=".pdf">
        <button class="patient-action__attachment-control js-add" type="button" title="{{ @intl.patients.patient.action.attachmentsViews.attachmentsViews.addAttachment }}" aria-label="{{ @intl.patients.patient.action.attachmentsViews.attachmentsViews.addAttachment }}">{{far "paperclip"}}</button>
      </form>
    {{else}}
      <span class="patient-action__attachment-icon">{{far "paperclip"}}</span>
    {{/if}}
    <div class="patient-action__attachment-files" data-attachments-files-region></div>
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
    this.ui.file[0].click();
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
