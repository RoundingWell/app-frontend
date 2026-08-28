import Radio from 'backbone.radio';

import App from 'js/base/app';

import { PanelView, LayoutView, HeadingView, MenuView, CustomFiltersLoadingView, CustomFiltersView, StatesFiltersView, FlowStatesFiltersView } from 'js/apps/patients/shared/list-filters/list-filters_views';

const ListFiltersApp = App.extend({
  onStart({ filtersState }) {
    this.filtersState = filtersState;
    this.filters = Radio.request('entities', 'filters:customFilters');
    this.customFiltersFetchId = 0;
    this.isCustomFiltersLoaded = false;

    this.showHeadingView();
    this.showMenu();
    this.showChildView('content', new LayoutView());
    this.showCustomFiltersLoadingView();
    this.loadCustomFilters();
    this.showStatesFiltersView();
    this.showFlowStatesFiltersView();

    this.listenTo(filtersState, {
      'change:listType'() {
        this.showFlowStatesFiltersView();
        this.loadCustomFilters();
      },
      'change:worklist'() {
        this.loadCustomFilters();
      },
    });
  },
  showHeadingView() {
    const headerView = new HeadingView({ model: this.filtersState });

    this.showChildView('heading', headerView);
  },
  showMenu() {
    const menuView = new MenuView({ model: this.filtersState });

    this.listenTo(menuView, 'click:clear', () => {
      this.filtersState.setDefaultFilterStates();
    });

    this.showChildView('menu', menuView);
  },
  fetchFilters(filters) {
    return filters.invokeFetch({
      entityType: this.filtersState.get('listType'),
      worklist: this.filtersState.get('worklist'),
    });
  },
  showCustomFiltersLoadingView() {
    const loadingView = new CustomFiltersLoadingView({ filterCount: Math.min(this.filters.length, 2) });

    this.showContentView('customFilters', loadingView);
  },
  loadCustomFilters() {
    const filters = new this.filters.constructor(this.filters.toJSON());
    const requests = this.fetchFilters(filters);

    if (!requests) return;

    const fetchId = ++this.customFiltersFetchId;
    const currentView = this.getChildView('content').getRegion('customFilters').currentView;

    if (this.isCustomFiltersLoaded && currentView && currentView.setLoading) {
      currentView.setLoading(true);
    }

    Promise.allSettled(requests)
      .then(results => {
        if (!this.isRunning() || fetchId !== this.customFiltersFetchId) return;

        filters.each(filter => {
          this.filters.findWhere({ slug: filter.get('slug') }).set(filter.attributes);
        });

        const hasLoadError = results.some(({ status }) => status === 'rejected');

        if (!this.isCustomFiltersLoaded) {
          this.isCustomFiltersLoaded = true;
          this._showCustomFiltersView({ hasLoadError });
          return;
        }

        const customFiltersView = this.getChildView('content').getRegion('customFilters').currentView;

        customFiltersView.setLoadError(hasLoadError);
        customFiltersView.setLoading(false);
      });
  },
  retryCustomFilters() {
    this.isCustomFiltersLoaded = false;
    this.showCustomFiltersLoadingView();
    this.loadCustomFilters();
  },
  _showCustomFiltersView({ hasLoadError }) {
    const customFiltersView = new CustomFiltersView({
      collection: this.filters,
      hasLoadError,
      state: this.filtersState,
    });

    this.listenTo(customFiltersView, 'retry', this.retryCustomFilters);
    this.showContentView('customFilters', customFiltersView);
  },
  showContentView(name, view, options) {
    const region = this.getChildView('content').getRegion(name);
    region.show(view, options);
    return view;
  },
  showFlowStatesFiltersView() {
    // Filters actions by their flow's state
    if (this.filtersState.isFlowType()) {
      this.getChildView('content').getRegion('flowStatesFilters').empty();
      return;
    }

    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();

    const flowStatesFiltersView = new FlowStatesFiltersView({
      collection: states,
      model: this.filtersState,
    });

    this.showContentView('flowStatesFilters', flowStatesFiltersView);
  },
  showStatesFiltersView() {
    const statesFiltersView = new StatesFiltersView({
      collection: this.filtersState.getAvailableStates(),
      model: this.filtersState,
    });

    this.showContentView('statesFilters', statesFiltersView);
  },
});

const ListFiltersPanelApp = ListFiltersApp.extend({
  onStart(options) {
    this.showView(new PanelView({
      isDrawer: options.isDrawer,
      model: options.collapsedState,
    }));

    if (options.controlsView) this.showChildView('controls', options.controlsView);

    ListFiltersApp.prototype.onStart.call(this, options);
  },
});

export {
  ListFiltersPanelApp,
};
