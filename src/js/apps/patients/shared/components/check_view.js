import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

const SelectedTemplate = hbs`{{fas "square-check" classes="button__checkbox-icon button__checkbox-icon--selected"}}`;
const EmptyTemplate = hbs`{{fal "square" classes="button__checkbox-icon button__checkbox-icon--empty"}}`;

export default View.extend({
  tagName: 'button',
  className: 'button button--checkbox js-select',
  attributes: {
    'role': 'checkbox',
    'type': 'button',
  },
  initialize({ isSelected }) {
    // Required labels are supplied by every UI caller; retain the developer-error guard.
    /* istanbul ignore if */
    if (!this.getOption('selectLabel') || !this.getOption('deselectLabel')) {
      throw new TypeError('CheckView requires selectLabel and deselectLabel');
    }

    this.isSelected = !!isSelected;
  },
  getTemplate() {
    return this.isSelected ? SelectedTemplate : EmptyTemplate;
  },
  triggers: {
    'click': 'click',
  },
  onRender() {
    const ariaLabel = this.isSelected ? this.getOption('deselectLabel') : this.getOption('selectLabel');

    this.el.setAttribute('aria-checked', String(this.isSelected));
    this.el.setAttribute('aria-label', ariaLabel);
  },
  onClick(view, domEvent) {
    this.isSelected = !this.isSelected;
    this.render();
    this.triggerMethod('change:isSelected', this.isSelected);
    this.triggerMethod('select', domEvent);
  },
});
