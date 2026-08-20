import { debounce, each, extend, noop, pick, result, size } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/forms.scss';

import intl from 'js/i18n';
import hasAllText from 'js/utils/formatting/has-all-text';

import Component from 'js/base/component';

import InputFocusBehavior from 'js/behaviors/input-focus';
import InputWatcherBehavior from 'js/behaviors/input-watcher';
import PicklistBehavior from 'js/behaviors/picklist-transport';

import './picklist.scss';

const CLASS_OPTIONS = [
  'attr',
  'canClear',
  'childView',
  'childViewEventPrefix',
  'className',
  'clearText',
  'emptyView',
  'emptyViewOptions',
  'headingText',
  'infoText',
  'isListsAsync',
  'isSelectlist',
  'lists',
  'loadingText',
  'noResultsText',
  'placeholderText',
  'template',
];

const CLASS_OPTIONS_ITEM = [
  'attr',
  'getItemSearchText',
  'isCheckable',
  'itemClassName',
  'itemTemplate',
  'itemTemplateContext',
];

const attr = 'text';
const canClear = false;
const isSelectlist = false;

const PicklistEmpty = View.extend({
  tagName: 'li',
  template: hbs`
    {{#if isLoading}}
      <div class="picklist__message-loading">
        {{fas "circle"}}{{ loadingText }}
      </div>
    {{else}}
      <div class="picklist__message">
        {{ noResultsText }}
      </div>
    {{/if}}
  `,
  serializeData() {
    return this.options;
  },
});

const PicklistItem = View.extend({
  tagName: 'li',
  itemTemplate: hbs`
    <div class="picklist__item-content">{{#if icon}}{{fa icon.type icon.icon classes=icon.classes}}{{/if}}<span>{{matchText text query}}</span></div>
    {{#if isChecked}}{{fas "check"}}{{/if}}
  `,
  itemClassName() {
    const classNames = [];

    if (this.model.get('isDisabled')) classNames.push('is-disabled');
    if (this.model.get('hasDivider')) classNames.push('has-divider');

    return classNames.join(' ');
  },
  className() {
    const classNames = ['picklist__item', 'js-picklist-item', result(this, 'itemClassName', '')];

    if (this.model === this.state.get('selected')) classNames.push('is-selected');

    return classNames.join(' ');
  },
  attributes() {
    const isDisabled = this.model.get('isDisabled');
    const isSelected = this.model === this.state.get('selected');

    return {
      'aria-disabled': String(Boolean(isDisabled)),
      'aria-selected': String(isSelected),
      'role': 'option',
    };
  },
  triggers: {
    'click': 'select',
  },
  preinitialize(options) {
    this.mergeOptions(options, ['state', ...CLASS_OPTIONS_ITEM]);
  },
  onRender() {
    this.searchText = this.getItemSearchText(this.model);
  },
  getItemSearchText(item) {
    return this.$el.text();
  },
  itemTemplateContext: noop,
  templateContext() {
    const isCheckable = this.getOption('isCheckable');
    const isSelected = this.model === this.state.get('selected');
    return extend({
      text: this.model.get(this.attr),
      query: this.state.get('query'),
      isChecked: isCheckable && isSelected,
    }, result(this, 'itemTemplateContext'));
  },
  getTemplate() {
    return this.itemTemplate;
  },
});

const Picklist = CollectionView.extend({
  attributes: {
    role: 'presentation',
  },
  className: 'picklist__group',
  tagName: 'li',
  template: hbs`
    {{#if headingText}}<div class="picklist__heading">{{ headingText }}</div>{{/if}}
    <ul role="presentation"></ul>
    {{#if infoText}}<div class="picklist__info">{{fas "circle-info"}}{{ infoText }}</div>{{/if}}
  `,
  serializeCollection: noop,
  childViewContainer: 'ul',
  childViewEventPrefix: 'item',
  modelEvents: {
    'change:query': 'filter',
  },
  viewFilter(view) {
    view.render();
    const query = this.model.get('query');
    return !query || !view.searchText || hasAllText(view.searchText, query);
  },
  initialize(options) {
    this.mergeOptions(options, CLASS_OPTIONS_ITEM);
  },
  childViewOptions() {
    const opts = pick(this, ...CLASS_OPTIONS_ITEM);
    return extend({ state: this.model }, opts);
  },
  templateContext() {
    return {
      headingText: this.getOption('headingText'),
      infoText: this.getOption('infoText'),
    };
  },
});

const Picklists = CollectionView.extend({
  behaviors: [
    {
      behaviorClass: InputFocusBehavior,
      selector: '.js-input',
    },
    InputWatcherBehavior,
    PicklistBehavior,
  ],
  template: hbs`
    <div class="picklist__controls">
      <div class="picklist__mobile-header">
        <button class="button button--icon picklist__mobile-close js-close" type="button" aria-label="{{ @intl.components.picklist.closeText }}">{{fas "arrow-left"}}</button>
        <div class="picklist__mobile-title">{{#if headingText}}{{ headingText }}{{else}}{{ @intl.components.picklist.headingText }}{{/if}}</div>
      </div>
      {{#if headingText}}<div class="picklist__heading picklist__desktop-heading u-margin--b-8">{{ headingText }}</div>{{/if}}
      {{#if isSelectlist}}<input class="js-input picklist__input form-input form-input--primary form-input--small" type="search" value="{{ query }}" placeholder="{{ placeholderText }}" aria-label="{{#if placeholderText}}{{ placeholderText }}{{else}}{{ @intl.components.picklist.searchText }}{{/if}}" autocomplete="off" autocapitalize="none" spellcheck="false">{{/if}}
      {{#if canClear}}<div><button class="picklist__item picklist__clear js-picklist-item js-clear" type="button">{{ clearText }}</button></div>{{/if}}
    </div>
    <ul class="flex-region picklist__scroll js-picklist-scroll" role="listbox"></ul>
    {{#if infoText}}<div class="picklist__info ">{{fas "circle-info"}}{{ infoText }}</div>{{/if}}
  `,
  triggers: {
    'focus @ui.input': 'focus',
    'click @ui.clear': 'clear',
    'click @ui.close': 'close',
  },
  ui: {
    input: '.js-input',
    clear: '.js-clear',
    close: '.js-close',
  },
  attributes() {
    return {
      'aria-label': this.getOption('headingText') || intl.components.picklist.headingText,
    };
  },
  onClear() {
    this.triggerMethod('picklist:item:select', { model: null });
  },
  serializeCollection: noop,
  childViewContainer: 'ul',
  emptyView: PicklistEmpty,
  initialize(options) {
    this.mergeOptions(options, CLASS_OPTIONS);
    this.mergeOptions(options, CLASS_OPTIONS_ITEM);

    this.debouncedFilter = debounce(this.filter, 1);

    if (this.isListsAsync) {
      this.isLoading = true;
      this.lists.then(lists => {
        this.isLoading = false;
        this.addLists(lists);
        if (!this.children.length) this.render();
      });

      return;
    }

    this.addLists(this.lists);
  },
  addLists(lists) {
    this.lists = lists;
    each(lists, this.addList, this);
  },
  addList(list) {
    const options = extend({
      model: this.model,
      childView: this.childView,
    }, pick(this, ...CLASS_OPTIONS_ITEM), list);

    const picklist = new Picklist(options);

    picklist.render();

    this.addChildView(picklist);
  },
  viewFilter(childView) {
    return !!size(childView.children) || childView.shouldShow;
  },
  childViewEvents: {
    'before:render:children'() {
      return this.debouncedFilter();
    },
  },
  onRenderChildren() {
    this.$('.js-picklist-item').removeClass('is-highlighted');

    if (!this.model.get('query')) return;

    this.$('.js-picklist-item').first().addClass('is-highlighted');
  },
  emptyViewOptions() {
    return {
      isLoading: this.isLoading,
      loadingText: this.loadingText,
      noResultsText: this.noResultsText,
    };
  },
  templateContext() {
    return {
      canClear: this.canClear,
      clearText: this.clearText,
      headingText: this.headingText,
      infoText: this.infoText,
      placeholderText: this.placeholderText,
      isSelectlist: this.isSelectlist,
    };
  },
});

export default Component.extend({
  attr,
  canClear,
  isSelectlist,
  childView: PicklistItem,
  className: 'picklist',
  childViewEventPrefix: 'picklist',
  clearText: intl.components.picklist.clearText,
  headingText: '',
  infoText: '',
  loadingText: intl.components.picklist.loadingText,
  noResultsText: intl.components.picklist.noResultsText,
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);
    this.mergeOptions(options, CLASS_OPTIONS_ITEM);

    Component.apply(this, arguments);
  },
  viewOptions() {
    const opts = pick(this, ...CLASS_OPTIONS, ...CLASS_OPTIONS_ITEM);
    return extend({ model: this.getState() }, opts);
  },
  ViewClass: Picklists,
  viewEvents: {
    'watch:change': 'onWatchChange',
  },
  onWatchChange(query) {
    this.setState('query', query);
  },
});
