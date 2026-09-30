import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import { addError } from 'js/datadog';

import InteractionsPreviewApp from 'js/apps/patients/patient/interactions/interactions-preview_app';

export default View.extend({
  template: hbs`<div data-preview-region></div>`,
  regions: { preview: '[data-preview-region]' },
  initialize() {
    this.previewApp = new InteractionsPreviewApp();
  },
  onRender() {
    this.previewApp.restart({
      patient: this.model,
      region: this.getRegion('preview'),
    }).catch(addError);
  },
  onBeforeDestroy() {
    this.previewApp.destroy().catch(addError);
  },
});
