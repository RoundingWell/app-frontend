import { size, extend } from 'underscore';
import { Radio } from 'marionette';

import App from 'js/base/app';

import { SidebarMixin } from 'js/services/sidebar';

import {
  SidebarView,
  MenuView,
  HeadingView,
  TimestampsView,
  UploadsEnabledView,
} from 'js/apps/programs/sidebar/action/action-sidebar_views';

export default App.extend(extend({
  prepareStart(options, { signal }) {
    return Radio.request('entities', 'fetch:tags:collection', { signal });
  },
  onBeforeStart(app, { action }) {
    this.action = action;

    this.action.trigger('editing', true);

    this.showHeading();
    this.showMenu();
    this.showTimestamps();
  },
  onStart(app, options, tags) {
    const contentView = new SidebarView({
      action: this.action,
      tags,
    });

    this.listenTo(contentView, {
      'save': this.onSave,
      'close': this.stop,
    });

    this.getView().showChildView('content', contentView);

    this.listenTo(this.action, {
      'change:allowed_uploads': this.showUploadsEnabled,
    });

    this.showUploadsEnabled();
  },
  showHeading() {
    this.getView().showChildView('heading', new HeadingView());
  },
  showMenu() {
    const menuView = new MenuView();

    this.listenTo(menuView, 'delete', this.onDelete);

    this.getView().showChildView('menu', menuView);
  },
  showTimestamps() {
    if (this.action.isNew()) return;
    this.getView().showChildView('footer', new TimestampsView({ model: this.action }));
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
  onSave({ model }) {
    if (model.isNew()) {
      this.action.saveAll(model.attributes)
        .then(() => {
          const programFlow = this.action.getProgramFlow();

          if (programFlow) {
            Radio.trigger('event-router', 'programFlow:action', programFlow.id, this.action.id);
            return;
          }

          Radio.trigger('event-router', 'program:action', this.action.getProgram().id, this.action.id);
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
    this.stopListening(this.action);
    this.action.trigger('editing', false);
    if (this.action && this.action.isNew()) this.action.destroy();
  },
}, SidebarMixin));
