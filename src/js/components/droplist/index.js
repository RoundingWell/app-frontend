import { extend, result } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Picklist from 'js/components/picklist';

// NOTE: Use this if you intend to keep the selected state

const CLASS_OPTIONS = [
  'align',
  'collection',
  'lists',
  'picklistEvents',
  'picklistOptions',
  'popRegion',
  'popWidth',
  'position',
  'stateOptions',
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

const StateModel = Backbone.Model.extend({
  defaults: {
    isDisabled: false,
    isActive: false,
    selected: null,
  },
});

export default View.extend({
  className: 'button button--secondary',
  attributes: {
    'aria-haspopup': 'listbox',
    'type': 'button',
  },
  tagName: 'button',
  template: hbs`
    {{~#if icon}}{{fa icon.type icon.icon classes=icon.classes}}{{/if}}
    {{~#if (lookup this attr)}}<span class="button__value">{{lookup this attr}}</span>{{else}}
      {{~#if defaultText}}<span class="button__value">{{ defaultText }}</span>{{/if~}}
    {{/if}}`,
  serializeData() {
    return this.getState().get('selected')?.toJSON() || {};
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
  picklistOptions,
  popWidth,
  createState() {
    return new StateModel(this.stateOptions || {});
  },
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);

    this.once('attach', () => {
      if (!this.getState().get('isActive')) return;

      this.showPicklist();
    });

    View.apply(this, arguments);

    this.syncStateAttributes();
    this.on('before:destroy', () => this.picklist?.destroy());
  },
  onClick() {
    const state = this.getState();

    state.set('isActive', !state.get('isActive'));
  },
  stateEvents: {
    'change:isDisabled': 'onChangeIsDisabled',
    'change:isActive': 'onChangeIsActive',
    'change:selected': 'onChangeStateSelected',
  },
  onChangeIsDisabled() {
    this.syncStateAttributes();
  },
  onChangeIsActive(state, isActive) {
    this.syncStateAttributes();

    if (!isActive) return;

    // blur off the button so enter won't trigger select repeatedly
    this.el.blur();

    this.showPicklist();
  },
  onChangeStateSelected(state, selected) {
    this.render();
    this.syncStateAttributes();
    this.triggerMethod('change:selected', selected);
  },
  syncStateAttributes() {
    const state = this.getState();
    const isActive = state.get('isActive');

    this.el.setAttribute('aria-haspopup', 'listbox');
    this.el.setAttribute('aria-expanded', String(isActive));
    this.el.toggleAttribute('disabled', state.get('isDisabled'));
    this.el.classList.toggle('is-active', isActive);
  },
  showPicklist() {
    const picklist = new Picklist(extend({
      lists: this.lists || [{ collection: this.collection }],
      model: new Backbone.Model({ selected: this.getState().get('selected') }),
    }, result(this, 'picklistOptions')));

    this.popRegion.show(picklist, this.popRegionOptions());
    this.picklist = picklist;

    this.bindEvents(picklist, this._picklistEvents);
    this.bindEvents(picklist, result(this, 'picklistEvents'));
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
    this.getState().set('selected', model);
  },
  onPicklistDestroy(picklist) {
    this.picklist = null;
    this.stopListening(picklist);
    this.getState().set('isActive', false);
  },
}, {
  setPopRegion(region) {
    this.prototype.popRegion = region;
  },
});
