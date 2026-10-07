import { Radio, View } from 'marionette';

import App from 'js/base/app';

import { LayoutView } from 'js/services/sidebar/sidebar_views';

import { SidebarView, TimestampsView, headingText } from 'js/apps/programs/sidebar/program/programs-sidebar_views';

export default App.extend({
  viewEvents: {
    'close': 'stop',
  },
  onBeforeStart(app, { program }) {
    this.setView(new LayoutView());
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
  onStart() {
    this.showView();
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
