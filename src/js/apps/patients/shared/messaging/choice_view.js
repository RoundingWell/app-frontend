import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import Droplist from 'js/components/droplist';

const ChoiceItemView = View.extend({
  tagName: 'li',
  className() {
    return `picklist__item js-picklist-item${ this.model.get('isDisabled') ? ' is-disabled' : '' }`;
  },
  attributes() {
    return { 'role': 'option', 'aria-disabled': String(!!this.model.get('isDisabled')), 'aria-selected': String(this.getOption('state').get('selected') === this.model), 'data-choice-id': this.model.id };
  },
  template: hbs`<div class="picklist__item-content"><span>{{ text }}{{#if reason}} · {{ reason }}{{/if}}</span></div>`,
  triggers: { click: 'select' },
  onRender() {
    this.searchText = this.el.textContent;
  },
});

// The same Droplist/Pop/Picklist transport used by action status and owner controls.
export default Droplist.extend({
  template: hbs`<span class="button__value">{{#if text}}{{ text }}{{else}}{{ placeholder }}{{/if}}</span>{{far "angle-down"}}`,
  templateContext() {
    return { placeholder: this.getOption('placeholder') };
  },
  initialize({ choices, selectedId, disabled }) {
    this.collection = new Backbone.Collection(choices);
    this.getState().set({ selected: this.collection.get(selectedId), isDisabled: !!disabled });
    this.popRegion = {
      show: (view, options) => Radio.request('app', 'show:pop', view, options),
      empty: () => this.picklist?.destroy(),
    };
  },
  picklistOptions() {
    return {
      childView: ChoiceItemView,
      headingText: this.getOption('label'),
      template: hbs`<ul class="flex-region picklist__scroll js-picklist-scroll" role="listbox" aria-label="{{ headingText }}"></ul>`,
    };
  },
  events: { keydown: 'onKeydown' },
  onKeydown(event) {
    if (event.key !== 'ArrowDown' || this.getState().get('isActive')) return;
    event.preventDefault();
    this.getState().set('isActive', true);
  },
  onRender() {
    this.el.value = this.getState().get('selected')?.id || '';
    this.el.setAttribute('aria-label', this.getOption('label'));
    const description = this.getOption('descriptionId');
    if (description) this.el.setAttribute('aria-describedby', description);
  },
  onPicklistSelect({ model }) {
    if (!model || model.get('isDisabled')) return;
    this.popRegion.empty();
    this.getState().set('selected', model);
    if (!this.isDestroyed()) this.el.focus();
  },
  onPicklistClose(event) {
    this.popRegion.empty();
    if (event?.key === 'Escape') this.el.focus();
  },
});
