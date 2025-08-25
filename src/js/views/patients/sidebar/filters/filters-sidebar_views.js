import { View, CollectionView } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';
import 'scss/modules/sidebar.scss';

import Droplist from 'js/components/droplist';
import { CheckComponent } from 'js/views/patients/shared/actions_views';

import intl from 'js/i18n';

import './filters-sidebar.scss';

const i18n = intl.patients.sidebar.filters.filtersSidebarViews;

const CustomFilterDropList = Droplist.extend({
  popWidth() {
    return this.getView().$el.outerWidth();
  },
  viewOptions: {
    className: 'button-secondary w-100',
    template: hbs`{{ name }}`,
  },
  picklistOptions() {
    return {
      attr: 'name',
      isSelectlist: true,
      headingText: i18n.customFilterDropList.headingText,
      placeholderText: `${ this.getOption('filterTitle') }...`,
    };
  },
});

const CustomFilterView = View.extend({
  className: 'flex flex-align-center u-margin--b-8',
  template: hbs`
    <h4 class="sidebar__label">{{ name }}</h4>
    <div class="flex-grow u-text--overflow" data-filter-button></div>
  `,
  regions: {
    filterButton: '[data-filter-button]',
  },
  initialize({ state }) {
    this.state = state;
    this.slug = this.model.get('slug');

    this.listenTo(state, 'change:customFilters', this.render);
  },
  onRender() {
    const options = this.getOptions();
    const selected = options.get(this.state.getFilter(this.slug)) || options.at(0);

    const customFilter = new CustomFilterDropList({
      collection: options,
      state: { selected },
      filterTitle: this.model.get('name'),
    });

    this.listenTo(customFilter.getState(), 'change:selected', (state, { id }) => {
      this.state.setFilter(this.slug, id);
    });

    this.showChildView('filterButton', customFilter);
  },
  getOptions() {
    const options = this.model.getOptions().clone();

    options.unshift({
      id: null,
      name: i18n.customFilterView.defaultText,
    });

    return options;
  },
});

const CustomFiltersView = CollectionView.extend({
  className: 'u-margin--t-32',
  childView: CustomFilterView,
  childViewOptions() {
    return {
      state: this.getOption('state'),
    };
  },
  viewComparator({ model }) {
    return String(model.get('name')).toLowerCase();
  },
});

const StatesFilterView = View.extend({
  className: 'u-margin--b-8',
  template: hbs`
    <div class="flex flex-align-center">
      <div data-check-region class="u-margin--r-16"></div>
      <span class="action--{{ options.color }}">
        <span class="u-margin--r-8">{{fa options.iconType options.icon}}</span><span>{{ name }}</span>
      </span>
    </div>
  `,
  regions: {
    check: '[data-check-region]',
  },
  initialize({ state, stateType }) {
    this.state = state;
    this.stateType = stateType;
  },
  onRender() {
    this.showCheck();
  },
  toggleSelected(isSelected) {
    this.$el.toggleClass('is-selected', isSelected);
  },
  showCheck() {
    const stateId = this.model.id;
    const selectedStates = this.state.get(this.stateType);
    const isInitSelected = selectedStates && selectedStates.includes(stateId);

    this.toggleSelected(isInitSelected);

    const checkComponent = new CheckComponent({ state: { isSelected: isInitSelected } });

    this.listenTo(checkComponent, {
      'change:isSelected': isSelected => {
        this.toggleSelected(isSelected);
        this.triggerMethod('select', stateId, isSelected);
      },
    });

    this.showChildView('check', checkComponent);
  },
});

const StatesFiltersView = CollectionView.extend({
  modelEvents: {
    'change:states': 'render',
  },
  childView: StatesFilterView,
  childViewOptions() {
    return {
      state: this.model,
      stateType: 'states',
    };
  },
  childViewTriggers: {
    'select': 'select:state',
  },
  className: 'sidebar__section',
  template: hbs`<h3 class="sidebar__heading u-margin--b-8">{{ @intl.patients.sidebar.filters.filtersSidebarViews.statesFiltersView.headingText }}</h3>`,
  onSelectState(stateId, isSelected) {
    this.model.selectStatesFilter(stateId, isSelected);
  },
});

const FlowStatesFiltersView = CollectionView.extend({
  modelEvents: {
    'change:flowStates': 'render',
  },
  childView: StatesFilterView,
  childViewOptions() {
    return {
      state: this.model,
      stateType: 'flowStates',
    };
  },
  childViewTriggers: {
    'select': 'select:state',
  },
  className: 'sidebar__section',
  template: hbs`<h3 class="sidebar__heading u-margin--b-8">{{ @intl.patients.sidebar.filters.filtersSidebarViews.flowStatesFiltersView.headingText }}</h3>`,
  onSelectState(stateId, isSelected) {
    this.model.selectFlowStatesFilter(stateId, isSelected);
  },
});

const HeadingView = View.extend({
  modelEvents: {
    'change:filtersCount': 'render',
  },
  template: hbs`
    <span class="u-margin--r-8">{{far "sliders"}}</span>{{ @intl.patients.sidebar.filters.filtersSidebarViews.headingView.allFiltersLabel }}
    {{#if filtersCount}}<span>({{filtersCount}})</span>{{/if}}
  `,
});

const MenuView = View.extend({
  modelEvents: {
    'change:filtersCount': 'render',
  },
  triggers: {
    'click .js-clear-filters': 'click:clear',
  },
  template: hbs`
    <button class="button--text filters-sidebar__clear-filters js-clear-filters" {{#unless filtersCount}}disabled{{/unless}}>
    {{ @intl.patients.sidebar.filters.filtersSidebarViews.menuView.clearFilters }}
    </button>
  `,
});

const LayoutView = View.extend({
  className: 'flex-grow',
  template: hbs`
    <div data-custom-filters-region></div>
    <div data-states-filters-region></div>
    <div data-flow-states-filters-region></div>
  `,
  regions: {
    customFilters: '[data-custom-filters-region]',
    statesFilters: '[data-states-filters-region]',
    flowStatesFilters: '[data-flow-states-filters-region]',
  },
});

export {
  LayoutView,
  HeadingView,
  MenuView,
  CustomFiltersView,
  StatesFiltersView,
  FlowStatesFiltersView,
};
