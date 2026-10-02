import { Radio, View } from 'marionette';

import App from 'js/base/app';

import { LayoutView } from 'js/services/sidebar/sidebar_views';

import { SidebarView, headingText } from 'js/apps/clinicians/sidebar/clinician/clinician-sidebar_views';

export default App.extend({
  viewEvents: {
    'close': 'closeSidebar',
  },
  onBeforeStart(app, { clinician }) {
    this.setView(new LayoutView());
    this.clinician = clinician;
    this.clinician.trigger('editing', true);

    this.getView().showChildView('heading', new View({ template: () => headingText }));
    this.showContent();
  },
  onStart() {
    this.showView();
  },
  onStop() {
    this.clinician.trigger('editing', false);
  },
  showContent() {
    const sidebarView = new SidebarView({ model: this.clinician });

    this.listenTo(sidebarView, 'save', this.onSave);

    this.getView().showChildView('content', sidebarView);
  },
  closeSidebar() {
    this.triggerMethod('close', this);
  },
  onSave({ model }) {
    this.clinician.save(model.attributes).then(() => {
      Radio.trigger('event-router', 'clinician', this.clinician.id);
    }, ({ responseData }) => {
      const errors = this.clinician.parseErrors(responseData);
      this.getView().getChildView('content').showErrors(errors);
    });
  },
});
