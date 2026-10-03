import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import InteractionsPreviewApp from 'js/apps/patients/patient/interactions/interactions-preview_app';

export default View.extend({
  template: hbs`<div data-preview-region></div>`,
  regions: { preview: '[data-preview-region]' },
  initialize() {
    this.previewApp = new InteractionsPreviewApp();
  },
  onRender() {
    this.previewApp.stop();
    this.previewApp.start({
      patient: this.model,
      region: this.getRegion('preview'),
    }).catch(error => this.previewApp.handleStartFailure(error));
  },
  onBeforeDestroy() {
    this.previewApp.destroy();
  },
});
