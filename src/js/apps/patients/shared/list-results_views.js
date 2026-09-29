import { View } from 'marionette';

import { CountView } from './list_views';

import ResultsTemplate from './list-results.hbs';

// The results application owns this complete surface through one page region.
export default View.extend({
  className: 'patient-list-page__results',
  template: ResultsTemplate,
  regions: {
    selectAll: '[data-select-all-region]',
    count: '[data-count-region]',
    bulkEdit: '[data-bulk-edit-region]',
    status: '[data-list-status-region]',
    list: { el: '[data-list-region]', replaceElement: true },
  },
  showSelectAll(options) {
    const SelectAllView = this.getOption('SelectAllView');
    const view = new SelectAllView(options);
    view.on('click', () => this.triggerMethod('click:select-all'));
    this.showChildView('selectAll', view);
  },
  showCount(options) {
    this.showChildView('count', new CountView(options));
  },
});
