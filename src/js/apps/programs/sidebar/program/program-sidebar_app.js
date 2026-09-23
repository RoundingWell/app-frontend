import { Radio, View } from 'marionette';

import App from 'js/base/app';

import { SidebarView, TimestampsView, headingText } from 'js/apps/programs/sidebar/program/programs-sidebar_views';

export default App.extend({
  onBeforeStart(app, { program }) {
    this.program = program;

    this.showHeading();

    const contentView = new SidebarView({
      program: this.program,
    });

    this.listenTo(contentView, {
      'save': this.onSave,
      'close': this.stop,
    });

    this.getView().showChildView('content', contentView);
    this.showTimestamps();
  },
  onSave({ model }) {
    const isNew = this.program.isNew();
    this.program.save(model.pick('name', 'details'))
      .then(() => {
        if (isNew) Radio.request('sidebar', 'stop');
      }, ({ responseData }) => {
        const errors = this.program.parseErrors(responseData);
        this.getView().getChildView('content').showErrors(errors);
      });
  },
  onClose() {
    this.stop();
  },
  onStop() {
    if (this.program && this.program.isNew()) this.program.destroy();
  },
  showHeading() {
    this.getView().showChildView('heading', new View({ template: () => headingText }));
  },
  showTimestamps() {
    if (this.program.isNew()) return;
    this.getView().showChildView('footer', new TimestampsView({ model: this.program }));
  },
});
