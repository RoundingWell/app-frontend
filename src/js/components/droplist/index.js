import { defer, extend, result } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';
import { getAdjacentFocusableElement } from 'js/utils/accessibility/focus-trap';
import Component from 'js/base/component';

import Picklist from 'js/components/picklist';

// NOTE: Use this if you intend to keep the selected state

const CLASS_OPTIONS = [
  'align',
  'collection',
  'isSelectlist',
  'lists',
  'picklistEvents',
  'picklistOptions',
  'popRegion',
  'popWidth',
  'presentation',
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
    const resolvedPicklistOptions = result(this, 'picklistOptions');
    const isSelectlist = this.isSelectlist || resolvedPicklistOptions.isSelectlist;
    const picklist = new Picklist(extend({
      lists: this.lists || [{ collection: this.collection }],
      state: { selected: this.getState('selected') },
    }, resolvedPicklistOptions, { isSelectlist }));

    this.popRegion.show(picklist, this.popRegionOptions(resolvedPicklistOptions));

    this.bindEvents(picklist.getView(), this._picklistEvents);
    this.bindEvents(picklist.getView(), result(this, 'picklistEvents'));
  },
  position() {
    return this.getView().getBounds();
  },
  popRegionOptions(resolvedPicklistOptions = result(this, 'picklistOptions')) {
    return extend({
      ignoreEl: this.getView().el,
      popWidth: result(this, 'popWidth'),
      align: this.align,
      presentation: this.presentation || (this.isSelectlist || resolvedPicklistOptions.isSelectlist ? 'fullscreen' : 'anchored'),
    }, result(this, 'position'));
  },
  _picklistEvents: {
    'close': 'onPicklistClose',
    'picklist:item:select': 'onPicklistSelect',
    'destroy': 'onPicklistDestroy',
  },
  onPicklistClose(dismissal) {
    this.restoreFocusOnDestroy = dismissal?.reason !== 'tab';
    if (!this.restoreFocusOnDestroy) {
      this.focusAfterDestroy = getAdjacentFocusableElement(this.getView().el, {
        exclude: this.popRegion.currentView.el,
        reverse: dismissal.reverse,
      });
    }

    this.popRegion.empty();
  },
  onPicklistSelect({ model }) {
    this.popRegion.empty();
    this.setState('selected', model);
  },
  onPicklistDestroy() {
    const focusAfterDestroy = this.focusAfterDestroy;
    this.focusAfterDestroy = null;
    const restoreFocus = this.restoreFocusOnDestroy !== false;
    this.restoreFocusOnDestroy = true;
    this.toggleState('isActive', false);
    if (!restoreFocus && !focusAfterDestroy) return;

    defer(() => {
      if (focusAfterDestroy?.isConnected) {
        focusAfterDestroy.focus();
        return;
      }

      const view = this.getView();

      if (!view || view.isDestroyed() || !view.isAttached()) return;

      view.$el.trigger('focus');
    });
  },
}, {
  setPopRegion(region) {
    this.prototype.popRegion = region;
  },
});
