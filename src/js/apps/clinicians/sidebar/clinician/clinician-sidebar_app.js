import Radio from 'backbone.radio';

import App from 'js/base/app';

import { SidebarView, headingText } from 'js/apps/clinicians/sidebar/clinician/clinician-sidebar_views';

export default App.extend({
  onBeforeStart({ clinician }) {
    this.clinician = clinician;
    this.clinician.trigger('editing', true);

    this.showChildView('heading', headingText);
    this.showContent();
  },
  onStop() {
    this.clinician.trigger('editing', false);
  },
  showContent() {
    const sidebarView = new SidebarView({ model: this.clinician });

    this.listenTo(sidebarView, 'save', this.onSave);

    this.showChildView('content', sidebarView);
  },
  onSave({ model }) {
    this.clinician.save(model.attributes).then(() => {
      Radio.trigger('event-router', 'clinician', this.clinician.id);
    }, ({ responseData }) => {
      const errors = this.clinician.parseErrors(responseData);
      this.getChildView('content').showErrors(errors);
    });
  },
});
