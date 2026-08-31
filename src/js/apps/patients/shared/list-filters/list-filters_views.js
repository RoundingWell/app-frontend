import { View, CollectionView } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';
import 'scss/modules/skeleton.scss';

import intl, { renderTemplate } from 'js/i18n';

import Droplist from 'js/components/droplist';

import { CheckComponent } from 'js/apps/patients/shared/actions_views';

import PanelTemplate from './panel.hbs';

import './list-filters.scss';

const i18n = intl.patients.shared.listFilters;
const StateFilterSelectLabelTemplate = hbs`{{formatMessage message state=state}}`;

const ItemTemplate = hbs`
  {{~#if value ~}}
    <span class="flex-grow">{{matchText value query}}</span>
    {{~#if total}}<span class="list-filters__filter-count">{{ total }}</span>{{/if}}
  {{~ else ~}}
    <span>{{ defaultText }}</span>
  {{~/if~}}
`;

const CustomFilterDropList = Droplist.extend({
  popWidth() {
    return this.getView().$el.outerWidth();
  },
  viewOptions: {
    className: 'button button--secondary list-filters__custom-filter-button w-100',
    template: hbs`{{ value }}{{#unless value}}{{ defaultText }}{{/unless}}`,
    templateContext: {
      defaultText: i18n.customFilterView.defaultText,
    },
  },
  picklistOptions() {
    return {
      itemTemplate: ItemTemplate,
      isSelectlist: true,
      canClear: true,
      clearText: i18n.customFilterDropList.defaultText,
      headingText: i18n.customFilterDropList.headingText,
      placeholderText: `${ this.getOption('filterTitle') }...`,
    };
  },
});

const CustomFilterView = View.extend({
  modelEvents: {
    'change:values': 'render',
  },
  className: 'list-filters__custom-filter',
  template: hbs`
    <h4 class="list-filters__custom-filter-label">{{ name }}</h4>
    <div class="flex-grow u-text--overflow" data-filter-button></div>
  `,
  regions: {
    filterButton: '[data-filter-button]',
  },
  initialize({ state }) {
    this.state = state;

    this.listenTo(state, 'change:customFilters', this.render);
  },
  onRender() {
    const slug = this.model.get('slug');
    const { withTotals, withoutTotals, values } = this.model.getValues();
    const selected = values.find({ value: this.state.getFilter(slug) }) || null;

    const customFilter = new CustomFilterDropList({
      lists: [
        {
          collection: withTotals,
        },
        {
          headingText: i18n.customFilterView.noResultsHeading,
          collection: withoutTotals,
        },
      ],
      state: { selected },
      filterTitle: this.model.get('name'),
    });

    this.listenTo(customFilter.getState(), 'change:selected', (state, newSelected) => {
      if (!newSelected) {
        this.state.setFilter(slug, null);
        return;
      }

      this.state.setFilter(slug, newSelected.get('value'));
    });

    this.showChildView('filterButton', customFilter);
  },
});

const CustomFiltersLoadingView = View.extend({
  className: 'list-filters__custom-filters list-filters__skeleton skeleton-loading',
  attributes: {
    'aria-busy': 'true',
    'aria-label': i18n.loadingView.loading,
    'role': 'status',
  },
  template: hbs`
    <div class="list-filters__section-heading list-filters__skeleton-heading" aria-hidden="true">
      <span>{{ @intl.patients.shared.listFilters.loadingView.heading }}</span>
    </div>
    <div class="list-filters__skeleton-list">
      {{#each filters}}
        <div class="list-filters__skeleton-filter" aria-hidden="true">
          <span class="skeleton-loading__shape list-filters__skeleton-label"></span>
          <span class="skeleton-loading__shape list-filters__skeleton-control"></span>
        </div>
      {{/each}}
    </div>
  `,
  templateContext() {
    return {
      filters: new Array(this.getOption('filterCount')).fill(null),
    };
  },
});

const CustomFiltersEmptyView = View.extend({
  className: 'list-filters__empty',
  template: hbs`{{#unless hasLoadError}}{{ @intl.patients.shared.listFilters.loadingView.empty }}{{/unless}}`,
  templateContext() {
    return {
      hasLoadError: this.getOption('hasLoadError'),
    };
  },
});

const CustomFiltersView = CollectionView.extend({
  className: 'list-filters__custom-filters',
  attributes: {
    'aria-busy': 'false',
  },
  childView: CustomFilterView,
  emptyView: CustomFiltersEmptyView,
  childViewContainer: '[data-custom-filters-list-region]',
  template: hbs`
    <button class="list-filters__section-button list-filters__section-heading js-toggle-section" type="button" aria-expanded="true">
      <span>{{ @intl.patients.shared.listFilters.loadingView.heading }}{{#if customFiltersCount}} ({{ customFiltersCount }}){{/if}}</span>
      {{far "angle-right"}}
    </button>
    <div class="list-filters__custom-filters-list js-custom-filters-list" data-custom-filters-list-region></div>
    {{#if hasLoadError}}
      <div class="list-filters__load-error" role="alert">
        <span>{{ @intl.patients.shared.listFilters.loadingView.error }}</span>
        <button class="button button--text js-retry" type="button">{{ @intl.patients.shared.listFilters.loadingView.retry }}</button>
      </div>
    {{/if}}
  `,
  triggers: {
    'click .js-toggle-section': 'click:toggle',
    'click .js-retry': 'retry',
  },
  ui: {
    customFiltersList: '.js-custom-filters-list',
    sectionButton: '.js-toggle-section',
  },
  childViewOptions() {
    return {
      state: this.getOption('state'),
    };
  },
  emptyViewOptions() {
    return {
      hasLoadError: this.hasLoadError,
    };
  },
  collectionEvents: {
    'change:name': 'filter',
  },
  initialize({ state, hasLoadError }) {
    this.state = state;
    this.hasLoadError = hasLoadError;
    this.listenTo(state, 'change:customFilters', this.render);
  },
  onRender() {
    this.updateCollapsed();
  },
  onRenderChildren() {
    this.updateCollapsed();
  },
  updateCollapsed() {
    const isExpanded = this.state.get('customFiltersExpanded');

    this.ui.customFiltersList.prop('hidden', !isExpanded);
    this.ui.sectionButton.attr('aria-expanded', String(isExpanded));
  },
  onClickToggle() {
    this.state.set('customFiltersExpanded', !this.state.get('customFiltersExpanded'));
    this.updateCollapsed();
  },
  setLoading(isLoading) {
    this.$el
      .attr('aria-busy', String(isLoading))
      .toggleClass('is-loading', isLoading);
  },
  setLoadError(hasLoadError) {
    this.hasLoadError = hasLoadError;
    this.render();
  },
  templateContext() {
    const customFilters = this.getOption('state').get('customFilters');
    const customFiltersCount = Object.values(customFilters).filter(value => value !== null && value !== undefined).length;

    return {
      customFiltersCount,
      hasLoadError: this.hasLoadError,
    };
  },
  viewComparator({ model }) {
    return String(model.get('name')).toLowerCase();
  },
  viewFilter({ model }) {
    return model.has('name');
  },
});

const StatesFilterView = View.extend({
  className: 'list-filters__state-filter',
  template: hbs`
    <div class="flex flex-align-center">
      <div class="list-filters__state-check" data-check-region></div>
      <span class="action-state action-state--{{ options.color }}">
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

    const stateName = this.model.get('name');
    const checkComponent = new CheckComponent({
      deselectLabel: renderTemplate(StateFilterSelectLabelTemplate, {
        message: i18n.statesFiltersView.deselectState,
        state: stateName,
      }),
      selectLabel: renderTemplate(StateFilterSelectLabelTemplate, {
        message: i18n.statesFiltersView.selectState,
        state: stateName,
      }),
      state: { isSelected: isInitSelected },
    });

    this.listenTo(checkComponent, {
      'change:isSelected': isSelected => {
        this.toggleSelected(isSelected);
        this.triggerMethod('select', stateId, isSelected);
      },
    });

    this.showChildView('check', checkComponent);
  },
});

const StateFiltersView = CollectionView.extend({
  childView: StatesFilterView,
  childViewOptions() {
    return {
      state: this.model,
      stateType: this.stateType,
    };
  },
  childViewTriggers: {
    'select': 'select:state',
  },
  className: 'list-filters__section',
  template: hbs`
    <button class="list-filters__section-button js-toggle-section" type="button" aria-expanded="false">
      <span>{{ headingText }}</span>
      {{far "angle-right"}}
    </button>
  `,
  triggers: {
    'click .js-toggle-section': 'click:toggle',
  },
  ui: {
    sectionButton: '.js-toggle-section',
  },
  initialize() {
    this.expandedState = `${ this.stateType }Expanded`;
    this.listenTo(this.model, `change:${ this.stateType }`, this.render);
    this.listenTo(this.model, 'expand:sections', this.expandSection);
  },
  onRender() {
    this.updateCollapsed();
  },
  onRenderChildren() {
    this.updateCollapsed();
  },
  updateCollapsed() {
    const isExpanded = this.model.get(this.expandedState);

    this.ui.sectionButton.attr('aria-expanded', String(isExpanded));
    this.$el.toggleClass('is-collapsed', !isExpanded);
  },
  expandSection() {
    this.model.set(this.expandedState, true);
    this.updateCollapsed();
  },
  onClickToggle() {
    this.model.set(this.expandedState, !this.model.get(this.expandedState));
    this.updateCollapsed();
  },
  onSelectState(stateId, isSelected) {
    this.model.set(this.expandedState, true);
    this.model.selectStatesFilter(stateId, isSelected, this.stateType);
  },
  templateContext() {
    return {
      headingText: this.headingText,
    };
  },
});

const StatesFiltersView = StateFiltersView.extend({
  headingText: i18n.statesFiltersView.headingText,
  stateType: 'states',
});

const FlowStatesFiltersView = StateFiltersView.extend({
  headingText: i18n.flowStatesFiltersView.headingText,
  stateType: 'flowStates',
});

const HeadingView = View.extend({
  modelEvents: {
    'change:filtersCount': 'render',
  },
  template: hbs`
    {{ @intl.patients.shared.listFilters.headingView.heading }}
    {{#if filtersCount}}<span>({{ filtersCount }})</span>{{/if}}
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
    <button class="button button--text list-filters__clear-filters js-clear-filters" type="button" {{#unless filtersCount}}disabled{{/unless}}>
    {{ @intl.patients.shared.listFilters.menuView.clearFilters }}
    </button>
  `,
});

const PanelView = View.extend({
  className: 'list-filters flex-region',
  template: PanelTemplate,
  regions: {
    heading: '[data-heading-region]',
    menu: '[data-menu-region]',
    controls: '[data-controls-region]',
    content: '[data-content-region]',
  },
  modelEvents: {
    'change:sidebarCollapsed': 'toggleCollapsed',
  },
  ui: {
    body: '.js-filters-body',
  },
  initialize() {
    this.isDrawer = this.getOption('isDrawer');
  },
  onRender() {
    this.setDrawerMode(this.isDrawer);
  },
  toggleCollapsed() {
    const isCollapsed = !this.isDrawer && this.model.get('sidebarCollapsed');
    this.ui.body.prop('hidden', isCollapsed);
    this.$el.toggleClass('is-collapsed', isCollapsed);
  },
  setDrawerMode(isDrawer) {
    this.isDrawer = isDrawer;
    this.$el.toggleClass('list-filters--drawer', isDrawer);
    this.toggleCollapsed();
  },
});

const LayoutView = View.extend({
  className: 'flex-grow list-filters__sections',
  template: hbs`
    <div data-custom-filters-region></div>
    <div data-states-filters-region></div>
    <div data-flow-states-filters-region></div>
  `,
  regions: {
    customFilters: {
      el: '[data-custom-filters-region]',
    },
    statesFilters: '[data-states-filters-region]',
    flowStatesFilters: '[data-flow-states-filters-region]',
  },
});

export {
  PanelView,
  LayoutView,
  HeadingView,
  MenuView,
  CustomFiltersView,
  CustomFiltersLoadingView,
  StatesFiltersView,
  FlowStatesFiltersView,
};
