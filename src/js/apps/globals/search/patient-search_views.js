import { noop } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView, Region } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/modals.scss';

import intl from 'js/i18n';

import Component from 'js/base/component';

import DialogFocusBehavior from 'js/behaviors/dialog-focus';
import InputFocusBehavior from 'js/behaviors/input-focus';
import InputWatcherBehavior from 'js/behaviors/input-watcher';
import PicklistBehavior from 'js/behaviors/picklist-transport';

import DialogTemplate from './dialog.hbs';
import ResultHeaderTemplate from './result-header.hbs';
import ResultItemTemplate from './result-item.hbs';
import TipTemplate from './tip.hbs';

import './patient-search.scss';

const EmptyView = View.extend({
  tagName: 'li',
  className: 'patient-search__no-results',
  initialize({ state }) {
    this.state = state;
    this.listenTo(this.state, 'change:search', this.render);
  },
  templateContext() {
    const settings = Radio.request('settings', 'get', 'patient_search');
    const canPatientCreate = this.state.get('canPatientCreate');
    return { settings, canPatientCreate };
  },
  getTemplate() {
    const search = this.state.get('search');

    if (!search || search.length < 3) return TipTemplate;
    if (this.collection.isSearching) return hbs`{{ @intl.globals.search.patientSearchViews.emptyView.searching }}`;

    return hbs`
      {{ @intl.globals.search.patientSearchViews.emptyView.noResults }}
      {{#if canPatientCreate}}
        <button class="patient-search__add u-margin--l-8 js-add" type="button">{{ @intl.globals.search.patientSearchViews.emptyView.addPatient }}</button>
      {{/if}}
    `;
  },
});

const PicklistItem = View.extend({
  tagName: 'li',
  className: 'patient-search__result',
  initialize({ state }) {
    this.state = state;
    this.listenTo(this.state, 'change:search', this.render);
  },
  triggers: {
    'click .js-picklist-item': 'select',
  },
  onSelect() {
    this.state.set({ selected: this.model });
  },
  template: ResultItemTemplate,
  templateContext() {
    return {
      name: `${ this.model.get('first_name') } ${ this.model.get('last_name') }`,
      search: this.state.get('search'),
      shouldShowMatch: this.shouldShowMatch(),
      isDobMatch: this.isDobMatch(),
      isInactive: this.model.get('status') !== 'active',
    };
  },
  shouldShowMatch() {
    const label = this.model.get('match').label;
    const i18n = intl.globals.search.patientSearchViews.picklistItemView;

    return label !== i18n.labelName && label !== i18n.labelDob;
  },
  isDobMatch() {
    const label = this.model.get('match').label;
    const i18n = intl.globals.search.patientSearchViews.picklistItemView;

    return label === i18n.labelDob;
  },
});

const ListView = CollectionView.extend({
  tagName: 'ul',
  serializeCollection: noop,
  childView: PicklistItem,
  childViewOptions() {
    return {
      collection: this.collection,
      state: this.model,
    };
  },
  onRenderChildren() {
    this.$('.js-picklist-item').removeClass('is-highlighted');

    if (!this.model.get('search')) return;

    this.$('.js-picklist-item').first().addClass('is-highlighted');
  },
  emptyView: EmptyView,
});

const HeaderView = View.extend({
  className: 'patient-search__picklist-header',
  template: ResultHeaderTemplate,
});

const DialogView = View.extend({
  className: 'patient-search__picklist',
  collectionEvents: {
    'search': 'onSearchComplete',
  },
  modelEvents: {
    'change:search': 'onSearchChange',
  },
  behaviors: [
    {
      behaviorClass: InputFocusBehavior,
      selector: '.js-input',
    },
    InputWatcherBehavior,
    PicklistBehavior,
  ],
  triggers: {
    'focus @ui.input': 'focus',
    'click @ui.add': 'add',
    'click @ui.close': 'close',
  },
  events: {
    'click @ui.clear': 'onClear',
  },
  ui: {
    input: '.js-input',
    add: '.js-add',
    clear: '.js-clear',
    close: '.js-close',
  },
  regionClass: Region.extend({ replaceElement: true }),
  regions: {
    header: '[data-header-region]',
    list: '[data-list-region]',
  },
  template: DialogTemplate,
  onRender() {
    this.showHeader();
    this.showList();
    this.updateClearButton();
  },
  onSearchComplete() {
    this.showHeader();
    this.showList();
  },
  onSearchChange() {
    this.showHeader();
    this.updateClearButton();
  },
  onClear() {
    this.ui.input.val('').focus();
    this.triggerMethod('watch:change', '');
  },
  updateClearButton() {
    this.ui.clear.prop('hidden', !this.model.get('search'));
  },
  showHeader() {
    if (!this.collection.length) {
      this.getRegion('header').empty();
      return;
    }

    this.showChildView('header', new HeaderView({ collection: this.collection }));
  },
  showList() {
    this.showChildView('list', new ListView({
      collection: this.collection,
      model: this.model,
    }));
  },
});

const PatientSearchPicklist = Component.extend({
  initialize: function(options) {
    this.mergeOptions(options, ['collection']);
  },
  viewOptions() {
    return {
      model: this.getState(),
      collection: this.collection,
    };
  },
  ViewClass: DialogView,
  viewEvents: {
    'watch:change': 'onWatchChange',
  },
  viewTriggers: {
    'add': 'click:addPatient',
    'close': 'close',
  },
  onWatchChange(search) {
    this.setState('search', search);
  },
});

const PatientSearchModal = View.extend({
  behaviors: [DialogFocusBehavior],
  className: 'modal patient-search__modal',
  attributes: {
    'aria-label': intl.globals.search.patientSearchViews.dialogView.placeholderText,
    'aria-modal': 'true',
    'role': 'dialog',
    'tabindex': '-1',
  },
  template: hbs`
    <button class="button button--icon patient-search__close patient-search__close--desktop js-close" type="button" aria-label="{{ closeText }}">{{far "xmark"}}</button>
    <div data-picklist-region></div>
  `,
  triggers: {
    'click .js-close': 'close',
  },
  regions: {
    picklist: {
      el: '[data-picklist-region]',
      replaceElement: true,
    },
  },
  serializeCollection: noop,
  templateContext() {
    return {
      closeText: intl.globals.modal.modalViews.modalView.closeText,
    };
  },
  onRender() {
    const collection = this.collection;
    const search = this.getOption('prefillText');

    const picklistComponent = new PatientSearchPicklist({
      collection,
      state: { search, canPatientCreate: this.getOption('canPatientCreate') },
    });

    this.listenTo(picklistComponent.getState(), {
      'change:search': this.onChangeSearch,
      'change:selected': this.onChangeSelected,
    });

    this.showChildView('picklist', picklistComponent);

    if (search) this.collection.search(search);

    this.listenTo(picklistComponent, {
      'click:addPatient': () => {
        this.triggerMethod('click:addPatient');
      },
      'close': this.destroy,
    });
  },
  onChangeSearch(state, search) {
    this.collection.search(search);
  },
  onChangeSelected(state, result) {
    this.triggerMethod('search:select', result);
  },
  onClose() {
    this.destroy();
  },
});

export {
  PatientSearchModal,
};
