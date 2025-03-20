import { View, CollectionView } from 'marionette';

import hbs from 'handlebars-inline-precompile';

import { buildWidget } from './widgets';

import './widgets.scss';

const WidgetView = View.extend({
  className() {
    return this.getOption('itemClassName');
  },
  getTemplate() {
    return this.contentWidget.getOption('wrapperTemplate') || this.template;
  },
  template: hbs`{{#if definition.display_name}}<div class="widgets__heading">{{ definition.display_name }}</div>{{/if}}<div class="widgets__item" data-content-region></div>`,
  ui: {
    content: '[data-content-region]',
  },
  initialize() {
    const patient = this.getOption('patient');
    this.contentWidget = buildWidget(this.model, patient);
  },
  serializeData() {
    return {
      ...this.model.attributes,
      ...this.contentWidget.getOption('values'),
    };
  },
  onRender() {
    if (this.ui.content.length === 0) return;
    this.addRegion('content', { el: this.ui.content });
    this.showChildView('content', this.contentWidget);
  },
});

const WidgetCollectionView = CollectionView.extend({
  childView: WidgetView,
  childViewOptions(model) {
    return {
      itemClassName: this.getOption('itemClassName'),
      model,
      patient: this.model,
    };
  },
  viewFilter({ model }) {
    return model.get('category');
  },
  viewComparator: false,
});

export {
  WidgetCollectionView,
};
