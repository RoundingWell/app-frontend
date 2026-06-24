import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import App from 'js/base/app';

import intl from 'js/i18n';

import { AttachmentsView } from 'js/apps/patients/patient/action/action-attachments_views';

export default App.extend({
  onBeforeStart() {
    this.getRegion().startPreloader();
  },
  beforeStart({ action }) {
    return Radio.request('entities', 'fetch:files:collection:byAction', action.id);
  },
  onStart({ action }, attachments) {
    this.action = action;
    this.attachments = attachments;

    this.listenTo(action, {
      'change:_owner': this.showAttachments,
      'ws:add:attachment': this.onWsAddAttachment,
    });

    this.showAttachments();
    this.subscribe();
  },
  onBeforeStop() {
    if (!this.attachments) return;

    Radio.request('ws', 'unsubscribe', this.attachments.models);
  },
  onWsAddAttachment(model) {
    this.attachments.add(model);

    Radio.request('ws', 'add', model);

    if (this.attachments.length === 1) this.showAttachments();
  },
  showAttachments() {
    const canUploadAttachments = !!Radio.request('settings', 'get', 'upload_attachments') && this.action.hasAllowedUploads();

    if (!canUploadAttachments && !this.attachments.length) {
      this.getRegion().empty();
      return;
    }

    const attachmentsView = new AttachmentsView({
      collection: this.attachments,
      canUploadAttachments,
      canRemoveAttachments: this.action.canEdit(),
    });

    this.listenTo(attachmentsView, {
      'add:attachment': this.onAddAttachment,
      'remove:attachment': this.onRemoveAttachment,
    });

    this.showView(attachmentsView);
  },
  onAddAttachment(file) {
    const attachment = this.attachments.add({
      _actions: [this.action.getResource()],
      _patient: this.action.getPatient().getResource(),
      created_at: dayjs.utc().format(),
    });
    attachment.upload(file);

    this.listenTo(attachment, {
      'upload:success': uploadedAttachment => {
        this.action.addFile(uploadedAttachment);
        Radio.request('ws', 'add', uploadedAttachment);
      },
      'upload:failed': () => {
        Radio.request('alert', 'show:error', intl.patients.patient.action.actionApp.uploadError);
      },
    });
  },
  onRemoveAttachment(model) {
    model.destroy({ wait: true })
      .then(() => {
        this.action.removeFile(model);

        Radio.request('ws', 'unsubscribe', model);
      })
      .catch(({ responseData }) => {
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
  subscribe() {
    Radio.request('ws', 'add', this.attachments.models);
  },
});
