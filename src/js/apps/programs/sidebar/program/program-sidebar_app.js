import Radio from 'backbone.radio';

import App from 'js/base/app';

import { SidebarView, TimestampsView, headingText } from 'js/apps/programs/sidebar/program/programs-sidebar_views';

export default App.extend({
  onBeforeStart({ program }) {
    this.program = program;

    this.showHeading();

    const contentView = new SidebarView({
      program: this.program,
    });

    this.listenTo(contentView, {
      'save': this.onSave,
      'close': this.stop,
    });

    this.showChildView('content', contentView);
    this.showTimestamps();
  },
  onSave({ model }) {
    const isNew = this.program.isNew();
    this.program.save(model.pick('name', 'details'))
      .then(() => {
        if (isNew) Radio.request('sidebar', 'stop');
      }, ({ responseData }) => {
        const errors = this.program.parseErrors(responseData);
        this.getChildView('content').showErrors(errors);
      });
  },
  onClose() {
    this.stop();
  },
  onStop() {
    if (this.program && this.program.isNew()) this.program.destroy();
  },
  showHeading() {
    this.showChildView('heading', headingText);
  },
  showTimestamps() {
    if (this.program.isNew()) return;
    this.showChildView('footer', new TimestampsView({ model: this.program }));
  },
});
