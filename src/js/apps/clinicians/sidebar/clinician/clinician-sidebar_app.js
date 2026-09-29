import { Radio, View } from 'marionette';

import App from 'js/base/app';

import { SidebarView, headingText } from 'js/apps/clinicians/sidebar/clinician/clinician-sidebar_views';

export default App.extend({
  onBeforeStart(app, { clinician }) {
    this.clinician = clinician;
    this.clinician.trigger('editing', true);

    this.getView().showChildView('heading', new View({ template: () => headingText }));
    this.showContent();
  },
  onStop() {
    this.clinician.trigger('editing', false);
  },
  showContent() {
    const sidebarView = new SidebarView({ model: this.clinician });

    this.listenTo(sidebarView, 'save', this.onSave);

    this.getView().showChildView('content', sidebarView);
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
