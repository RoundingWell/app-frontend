import { size, extend } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { ACTION_OUTREACH } from 'js/static';

import { SidebarMixin } from 'js/services/sidebar';

import {
  SidebarView, 
  MenuView, 
  HeadingView, 
  TimestampsView, 
  FormSharingButtonView, 
  FormSharingView, 
  UploadsEnabledView,
} from 'js/views/programs/sidebar/action/action-sidebar_views';

export default App.extend(extend({
  beforeStart() {
    return Radio.request('entities', 'fetch:tags:collection');
  },
  onBeforeStart({ action }) {
    this.action = action;

    this.action.trigger('editing', true);

    this.showHeading();
    this.showMenu();
    this.showTimestamps();
  },
  onStart(options, tags) {
    const contentView = new SidebarView({
      action: this.action,
      tags,
    });

    this.listenTo(contentView, {
      'save': this.onSave,
      'close': this.stop,
      'click:form': this.onClickForm,
    });

    this.showChildView('content', contentView);

    this.listenTo(this.action, {
      'change:_form change:outreach': this.onChangeOutreach,
      'change:allowed_uploads': this.showUploadsEnabled,
    });

    this.showFormSharing();
    this.showUploadsEnabled();
  },
  onChangeOutreach() {
    this.showHeading();
    this.showFormSharing();
  },
  showHeading() {
    this.showChildView('heading', new HeadingView({ model: this.action }));
  },
  showMenu() {
    const menuView = new MenuView();

    this.listenTo(menuView, 'delete', this.onDelete);

    this.showChildView('menu', menuView);
  },
  showTimestamps() {
    if (this.action.isNew()) return;
    this.showChildView('footer', new TimestampsView({ model: this.action }));
  },
  showUploadsEnabled() {
    if (!Radio.request('settings', 'get', 'upload_attachments')) return;

    const uploadsEnabledView = new UploadsEnabledView({
      isUploadsEnabled: !!size(this.action.get('allowed_uploads')),
      isButtonDisabled: this.action.isNew(),
    });

    this.listenTo(uploadsEnabledView, 'click:enable', () => {
      this.action.enableAttachmentUploads();
    });

    this.listenTo(uploadsEnabledView, 'click:disable', () => {
      this.action.disableAttachmentUploads();
    });

    this.showContentView('allowUploads', uploadsEnabledView);
  },
  showFormSharing() {
    if (!Radio.request('settings', 'get', 'care_team_outreach')) return;

    const form = this.action.getForm();

    if (!form) {
      this.showContentView('formSharing', new FormSharingButtonView({ isDisabled: true }));
      return;
    }

    if (!this.action.hasOutreach()) {
      const button = new FormSharingButtonView();

      this.listenTo(button, 'click', () => {
        this.action.save({ outreach: 'patient' });
      });

      this.showContentView('formSharing', button);
      return;
    }

    const formSharingView = new FormSharingView();

    this.listenTo(formSharingView, 'click', () => {
      this.action.save({ outreach: ACTION_OUTREACH.DISABLED });
    });

    this.showContentView('formSharing', formSharingView);
  },
  onSave({ model }) {
    if (model.isNew()) {
      this.action.saveAll(model.attributes)
        .then(() => {
          const flowId = this.action.get('_program_flow');

          if (flowId) {
            Radio.trigger('event-router', 'programFlow:action', flowId, this.action.id);
            return;
          }

          Radio.trigger('event-router', 'program:action', this.action.get('_program'), this.action.id);
        });
      return;
    }

    this.action.save(model.pick('name', 'details'));
  },
  onDelete() {
    this.action.destroy({ wait: true })
      .then(() => {
        Radio.request('sidebar', 'stop');
      })
      .catch(({ responseData }) => {
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
  onClose() {
    this.stop();
  },
  onStop() {
    this.action.trigger('editing', false);
    if (this.action && this.action.isNew()) this.action.destroy();
  },
  onClickForm(form) {
    Radio.trigger('event-router', 'form:preview', form.id);
  },
}, SidebarMixin));
