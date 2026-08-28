import Radio from 'backbone.radio';
import dayjs from 'dayjs';

import App from 'js/base/app';

import intl from 'js/i18n';

import { AttachmentsView } from 'js/apps/patients/patient/action/action-attachments_views';

export default App.extend({
  beforeStart({ action }) {
    return Radio.request('entities', 'fetch:files:collection:byAction', action.id);
  },
  onStart({ action, focusOnLoad }, attachments) {
    this.action = action;
    this.attachments = attachments;
    const flow = action.getFlow();

    this.listenTo(action, {
      'change:_owner': this.showAttachments,
      'ws:add:attachment': this.onWsAddAttachment,
    });
    if (flow) this.listenTo(flow, 'change:_state', this.showAttachments);

    this.showAttachments();
    this.subscribe();

    if (focusOnLoad) this.focus();
  },
  focus() {
    this.getRegion().focus();
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
    const canEdit = !this.action.isFlowDone() && this.action.canEdit();
    const canUploadAttachments = !!Radio.request('settings', 'get', 'upload_attachments') && canEdit && this.action.hasAllowedUploads();

    if (!canUploadAttachments && !this.attachments.length) {
      this.getRegion().empty();
      return;
    }

    const attachmentsView = new AttachmentsView({
      collection: this.attachments,
      canUploadAttachments,
      canRemoveAttachments: canEdit,
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
