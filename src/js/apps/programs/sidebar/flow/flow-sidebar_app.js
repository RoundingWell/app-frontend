import Radio from 'backbone.radio';

import App from 'js/base/app';

import {
  SidebarView,
  headingText,
  MenuView,
  TimestampsView,
  getDeleteModal,
} from 'js/apps/programs/sidebar/flow/flow-sidebar_views';

export default App.extend({
  onBeforeStart({ flow }) {
    this.flow = flow;
    this.flow.trigger('editing', true);

    this.showHeading();
    this.showMenu();
    this.showTimestamps();
  },
  beforeStart() {
    return Radio.request('entities', 'fetch:tags:collection');
  },
  onStart(options, tags) {
    const contentView = new SidebarView({
      flow: this.flow,
      tags,
    });

    this.listenTo(contentView, {
      'save': this.onSave,
      'close': this.stop,
    });

    this.showChildView('content', contentView);
  },
  showHeading() {
    this.showChildView('heading', headingText);
  },
  showMenu() {
    const menuView = new MenuView();

    this.listenTo(menuView, 'delete', this.onDelete);

    this.showChildView('menu', menuView);
  },
  showTimestamps() {
    if (this.flow.isNew()) return;
    this.showChildView('footer', new TimestampsView({ model: this.flow }));
  },
  onSave({ model }) {
    if (model.isNew()) {
      this.flow.saveAll(model.attributes).then(() => {
        Radio.trigger('event-router', 'programFlow', this.flow.id);
      });
      return;
    }

    this.flow.save(model.pick('name', 'details'));
  },
  onDelete() {
    const modal = Radio.request('modal', 'show:small', getDeleteModal({
      onSubmit: () => {
        this.flow.destroy({ wait: true })
          .then(() => {
            Radio.trigger('event-router', 'program:details', this.flow.getProgram().id);
          })
          .catch(({ responseData }) => {
            Radio.request('alert', 'show:apiError', responseData);
          });

        modal.destroy();
      },
    }));
  },
  onClose() {
    this.stop();
  },
  onStop() {
    if (this.flow && this.flow.isNew()) this.flow.destroy();
    this.flow.trigger('editing', false);
  },
});
