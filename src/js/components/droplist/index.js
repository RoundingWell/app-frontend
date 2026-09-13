import { each, extend, result } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Picklist from 'js/components/picklist';

// NOTE: Use this if you intend to keep the selected state

const CLASS_OPTIONS = [
  'align',
  'attributes',
  'className',
  'isDisabled',
  'isOpen',
  'lists',
  'picklistEvents',
  'picklistOptions',
  'popRegion',
  'popWidth',
  'position',
  'selected',
  'tagName',
  'template',
  'templateContext',
  'triggers',
];

const picklistOptions = {
  attr: 'text',
  canClear: false,
  headingText: null,
  infoText: null,
  isSelectlist: false,
  placeholderText: null,
};

const popWidth = null;

export default View.extend({
  isDisabled: false,
  isOpen: false,
  selected: null,
  picklistOptions,
  popWidth,
  tagName: 'button',
  className: 'button button--secondary',
  template: hbs`
    {{~#if icon}}{{fa icon.type icon.icon classes=icon.classes}}{{/if}}
    {{~#if (lookup this attr)}}<span class="button__value">{{lookup this attr}}</span>{{else}}
      {{~#if defaultText}}<span class="button__value">{{ defaultText }}</span>{{/if~}}
    {{/if}}`,
  constructor: function(options = {}) {
    this.mergeOptions(options, CLASS_OPTIONS);
    View.apply(this, arguments);
    this.refreshClassName();
  },
  attributes() {
    return {
      'aria-expanded': String(this.isOpen),
      'aria-haspopup': 'listbox',
      'disabled': this.isDisabled ? '' : null,
      'type': 'button',
    };
  },
  serializeData() {
    return this.selected?.toJSON() || {};
  },
  templateContext() {
    return {
      attr: 'text',
      defaultText: intl.components.droplist.defaultText,
    };
  },
  triggers: {
    'click': 'click',
    'focus': 'focus',
  },
  onAttach() {
    if (!this.isOpen) return;

    this.showPicklist();
  },
  onClick() {
    this.setOpen(!this.isOpen);
  },
  setDisabled(isDisabled) {
    this.isDisabled = isDisabled;
    this.el.toggleAttribute('disabled', isDisabled);
  },
  setOpen(isOpen) {
    if (this.isOpen === isOpen) return;

    this.isOpen = isOpen;
    this.el.setAttribute('aria-expanded', String(isOpen));
    this.el.classList.toggle('is-active', isOpen);

    this.trigger('change:isOpen', this, isOpen);

    if (!isOpen) return;

    // blur off the button so enter won't trigger select repeatedly
    this.el.blur();

    this.showPicklist();
  },
  setSelected(selected) {
    if (this.selected === selected) return;

    this.selected = selected;
    this.render();
    this.refreshClassName();
    this.triggerMethod('change:selected', selected);
  },
  refreshClassName() {
    this.el.className = result(this, 'className');
    this.el.classList.toggle('is-active', this.isOpen);
  },
  showPicklist() {
    const picklist = this.picklist = new Picklist(extend({
      lists: this.lists || [{ collection: this.collection }],
      model: new Backbone.Model({ selected: this.selected }),
    }, result(this, 'picklistOptions')));

    this.popRegion.show(picklist, this.popRegionOptions());

    this.bindPicklistEvents(picklist, this._picklistEvents);
    this.bindPicklistEvents(picklist, result(this, 'picklistEvents'));
  },
  bindPicklistEvents(picklist, events) {
    each(events, (handler, eventName) => {
      this.listenTo(picklist, eventName, typeof handler === 'string' ? this[handler] : handler);
    });
  },
  position() {
    return this.getBounds();
  },
  popRegionOptions() {
    return extend({
      ignoreEl: this.el,
      popWidth: result(this, 'popWidth'),
      align: this.align,
    }, result(this, 'position'));
  },
  _picklistEvents: {
    'close': 'onPicklistClose',
    'picklist:item:select': 'onPicklistSelect',
    'destroy': 'onPicklistDestroy',
  },
  onPicklistClose() {
    this.popRegion.empty();
  },
  onPicklistSelect({ model }) {
    this.popRegion.empty();
    this.setSelected(model);
  },
  onPicklistDestroy() {
    this.picklist = null;
    this.setOpen(false);
  },
  onBeforeDestroy() {
    if (this.popRegion.currentView !== this.picklist) return;

    this.popRegion.empty();
  },
}, {
  setPopRegion(region) {
    this.prototype.popRegion = region;
  },
});
