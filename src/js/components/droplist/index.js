import { extend, result } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';
import Component from 'js/base/component';

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
  'viewOptions',
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

const viewOptions = {
  className: 'button button--secondary',
  template: hbs`
    {{~#if icon}}{{fa icon.type icon.icon classes=icon.classes}}{{/if}}
    {{~#if (lookup this attr)}}<span class="button__value">{{lookup this attr}}</span>{{else}}
      {{~#if defaultText}}<span class="button__value">{{ defaultText }}</span>{{/if~}}
    {{/if}}`,
  templateContext() {
    return {
      attr: 'text',
      defaultText: intl.components.droplist.defaultText,
    };
  },
};

const StateModel = Backbone.Model.extend({
  defaults: {
    isDisabled: false,
    isActive: false,
    selected: null,
  },
});

const ViewClass = View.extend({
  initialize({ state }) {
    this.model = state.selected;
  },
  attributes() {
    const state = this.getOption('state');

    return {
      'aria-expanded': String(state.isActive),
      'aria-haspopup': 'listbox',
      'disabled': state.isDisabled,
      'type': 'button',
    };
  },
  tagName: 'button',
  triggers: {
    'click': 'click',
    'focus': 'focus',
  },
});

export default Component.extend({
  picklistOptions,
  popWidth,
  StateModel,
  ViewClass,
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);

    this.once('show', () => {
      if (!this.getState('isActive')) return;

      this.showPicklist();
    });

    Component.apply(this, arguments);
  },
  mixinViewOptions(options) {
    return extend({ state: this.getState().attributes }, viewOptions, result(this, 'viewOptions'), options);
  },
  viewEvents: {
    'click': 'onClick',
  },
  onClick() {
    this.toggleState('isActive');
  },
  stateEvents: {
    'change:isDisabled': 'onChangeIsDisabled',
    'change:isActive': 'onChangeIsActive',
    'change:selected': 'onChangeStateSelected',
  },
  onChangeIsDisabled() {
    this.show();
  },
  onChangeIsActive(state, isActive) {
    const view = this.getView();
    view.$el
      .attr('aria-expanded', String(isActive))
      .toggleClass('is-active', isActive);

    if (!isActive) return;

    // blur off the button so enter won't trigger select repeatedly
    view.$el.blur();

    this.showPicklist();
  },
  onChangeStateSelected(state, selected) {
    this.show();
    this.triggerMethod('change:selected', selected);
  },
  showPicklist() {
    const picklist = new Picklist(extend({
      lists: this.lists || [{ collection: this.collection }],
      state: { selected: this.getState('selected') },
    }, result(this, 'picklistOptions')));

    this.popRegion.show(picklist, this.popRegionOptions());

    this.bindEvents(picklist.getView(), this._picklistEvents);
    this.bindEvents(picklist.getView(), result(this, 'picklistEvents'));
  },
  position() {
    return this.getView().getBounds();
  },
  popRegionOptions() {
    return extend({
      ignoreEl: this.getView().el,
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
    this.setState('selected', model);
  },
  onPicklistDestroy() {
    this.toggleState('isActive', false);
  },
}, {
  setPopRegion(region) {
    this.prototype.popRegion = region;
  },
});
