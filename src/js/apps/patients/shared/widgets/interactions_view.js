import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import RecentInteractionsApp from './recent-interactions_app';

export default View.extend({
  template: hbs`<div data-preview-region></div>`,
  regions: { preview: '[data-preview-region]' },
  initialize() {
    this.recentInteractionsApp = new RecentInteractionsApp();
  },
  onRender() {
    this.recentInteractionsApp.stop();
    this.recentInteractionsApp.start({
      patient: this.model,
      region: this.getRegion('preview'),
    }).catch(error => this.recentInteractionsApp.handleStartFailure(error));
  },
  onBeforeDestroy() {
    this.recentInteractionsApp.destroy();
  },
});
