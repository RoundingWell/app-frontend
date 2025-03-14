import { noop } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import Radio from 'backbone.radio';
import { View, CollectionView, Region } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/modals.scss';

import Component from 'js/base/component';

import InputFocusBehavior from 'js/behaviors/input-focus';
import InputWatcherBehavior from 'js/behaviors/input-watcher';
import PicklistBehavior from 'js/behaviors/picklist-transport';

import './patient-search.scss';

const TipTemplate = hbs`
  <div class="patient-search__tip">{{ @intl.globals.search.patientSearchViews.emptyView.searchTip }}</div>
  <div class="patient-search__search-by">
    <div class="patient-search__search-by-title">{{ @intl.globals.search.patientSearchViews.emptyView.searchBy }}</div>
    <div class="u-margin--t-8 qa-search-option">
      <span class="patient-search__search-by-label">{{ @intl.globals.search.patientSearchViews.emptyView.exampleDobLabel }}</span>
      {{ @intl.globals.search.patientSearchViews.emptyView.exampleDob }}
    </div>
    {{#each settings.identifiers}}
      <div class="u-margin--t-8 qa-search-option">
        <span class="patient-search__search-by-label">{{this.label}}</span>
        {{ @intl.globals.search.patientSearchViews.emptyView.exampleId }} {{this.example}}
      </div>
    {{/each}}
  </div>
  <div class="patient-search__shortcut">{{fas "keyboard"}}<strong class="u-margin--l-8">{{ @intl.globals.search.patientSearchViews.emptyView.shortcut }}</strong></div>
`;

const EmptyView = View.extend({
  collectionEvents: {
    'search': 'render',
  },
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
        <a class="u-margin--l-8 u-text-link js-add">{{ @intl.globals.search.patientSearchViews.emptyView.addPatient }}</a>
      {{/if}}
    `;
  },
});

const PicklistItem = View.extend({
  tagName: 'li',
  className: 'js-picklist-item patient-search__picklist-item',
  initialize({ state }) {
    this.state = state;
    this.listenTo(this.state, 'change:search', this.render);
  },
  triggers: {
    'click': 'select',
  },
  onSelect() {
    this.state.set({ selected: this.model });
  },
  template: hbs`
    <div class="patient-search__picklist-item-name u-text--overflow">
      <div class="patient-search__picklist-item-name-icon">
        {{far "address-card"}}
      </div>
      <div class="patient-search__picklist-item-name-text">
        <span>{{matchText name search}}{{~ remove_whitespace ~}}</span>
      </div>
    </div>
    <div class="patient-search__picklist-item-meta">
      <div class="patient-search__picklist-item-dob u-text--overflow">
        {{formatDateTime birth_date "MM/DD/YYYY"}}
      </div>
      {{#if hasIdentifiers}}
        <div class="patient-search__picklist-item-identifier u-text--overflow">
          {{#if identifiers.0.value}}{{matchText identifiers.0.value search}}{{else}}&ndash;{{/if}}
        </div>
      {{/if}}
    </div>
  `,
  templateContext() {
    return {
      name: `${ this.model.get('first_name') } ${ this.model.get('last_name') }`,
      search: this.state.get('search'),
      hasIdentifiers: this.collection.hasIdentifiers(),
    };
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
  template: hbs`
    <div class="patient-search__picklist-header-name">
      <div class="patient-search__picklist-header-name-icon"></div>
      <div class="patient-search__picklist-header-name-text">
        {{ @intl.globals.search.patientSearchViews.headerView.patient }}
      </div>
    </div>
    <div class="patient-search__picklist-header-meta">
      <div class="patient-search__picklist-header-dob">
        {{ @intl.globals.search.patientSearchViews.headerView.dob }}
      </div>
      {{#if hasIdentifiers}}
        <div class="patient-search__picklist-header-identifier">
        {{ @intl.globals.search.patientSearchViews.headerView.id }}
        </div>
      {{/if}}
    </div>
  `,
  templateContext() {
    return {
      hasIdentifiers: this.collection.hasIdentifiers(),
    };
  },
});

const DialogView = View.extend({
  className: 'patient-search__picklist',
  collectionEvents: {
    'search': 'showHeader',
  },
  modelEvents: {
    'change:search': 'showHeader',
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
  },
  ui: {
    input: '.js-input',
    add: '.js-add',
  },
  regionClass: Region.extend({ replaceElement: true }),
  regions: {
    header: '[data-header-region]',
    list: '[data-list-region]',
  },
  template: hbs`
    <div class="modal__header patient-search__header">
      <span class="modal__header-icon">{{far "magnifying-glass"}}</span>
      <input type="text" class="js-input patient-search__input" placeholder="{{ @intl.globals.search.patientSearchViews.dialogView.placeholderText }}" value="{{ search }}">
    </div>
    <div class="flex-region picklist__scroll js-picklist-scroll">
      <div data-header-region></div>
      <div data-list-region></div>
    </div>
  `,
  onRender() {
    this.showHeader();
    this.showChildView('list', new ListView({
      collection: this.collection,
      model: this.model,
    }));
  },
  showHeader() {
    if (!this.collection.length) {
      this.getRegion('header').empty();
      return;
    }

    this.showChildView('header', new HeaderView({ collection: this.collection }));
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
  className: 'modal--large',
  template: hbs`
    <a href="#" class="button--icon patient-search__close js-close">{{far "xmark"}}</a>
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
