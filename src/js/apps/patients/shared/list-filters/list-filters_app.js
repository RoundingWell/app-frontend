import { Radio } from 'marionette';

import App from 'js/base/app';

import { PanelView, LayoutView, HeadingView, MenuView, CustomFiltersLoadingView, CustomFiltersView, StatesFiltersView, FlowStatesFiltersView } from 'js/apps/patients/shared/list-filters/list-filters_views';

const ListFiltersApp = App.extend({
  ViewClass: LayoutView,

  onBeforeStart(app, options) {
    const view = this.setView(new this.ViewClass({
      isDrawer: options.isDrawer,
      model: options.layoutState,
    }));

    view.render();
    view.showChildView('content', new LayoutView());
    if (options.controlsView) view.showChildView('controls', options.controlsView);
  },
  onStart(app, { filtersState }) {
    this.filtersState = filtersState;
    this.filters = Radio.request('entities', 'filters:customFilters');
    this.isCustomFiltersLoaded = false;

    this.showHeadingView();
    this.showMenu();
    this.showCustomFiltersLoadingView();
    this.loadCustomFilters();
    this.showStatesFiltersView();
    this.showFlowStatesFiltersView();
    this.showView();

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

    this.getView().showChildView('heading', headerView);
  },
  showMenu() {
    const menuView = new MenuView({ model: this.filtersState });

    this.listenTo(menuView, 'click:clear', () => {
      this.filtersState.setDefaultFilterStates();
    });

    this.getView().showChildView('menu', menuView);
  },
  showCustomFiltersLoadingView() {
    const loadingView = new CustomFiltersLoadingView({ filterCount: Math.min(this.filters.length, 2) });

    this.showContentView('customFilters', loadingView);
  },
  loadCustomFilters() {
    this.abortCustomFiltersFetch();

    const controller = new AbortController();
    const request = Radio.request('entities', 'fetch:filters:customFilters', {
      entityType: this.filtersState.get('listType'),
      worklist: this.filtersState.get('worklist'),
      signal: controller.signal,
    });

    if (!request) return;

    this.customFiltersController = controller;
    const currentView = this.getView().getChildView('content').getRegion('customFilters').currentView;

    if (this.isCustomFiltersLoaded && currentView && currentView.setLoading) {
      currentView.setLoading(true);
    }

    request
      .then(({ filters, hasLoadError }) => {
        if (!this.isRunning() || controller.signal.aborted) return;
        this.customFiltersController = null;

        filters.each(filter => {
          this.filters.findWhere({ slug: filter.get('slug') }).set(filter.attributes);
        });

        if (!this.isCustomFiltersLoaded) {
          this.isCustomFiltersLoaded = true;
          this._showCustomFiltersView({ hasLoadError });
          return;
        }

        const customFiltersView = this.getView().getChildView('content').getRegion('customFilters').currentView;

        customFiltersView.setLoadError(hasLoadError);
        customFiltersView.setLoading(false);
      });
  },
  abortCustomFiltersFetch() {
    if (this.customFiltersController) this.customFiltersController.abort();
    this.customFiltersController = null;
  },
  onStop() {
    this.abortCustomFiltersFetch();
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
    const region = this.getView().getChildView('content').getRegion(name);
    region.show(view, options);
    return view;
  },
  showFlowStatesFiltersView() {
    // Filters actions by their flow's state
    if (this.filtersState.isFlowType()) {
      this.getView().getChildView('content').getRegion('flowStatesFilters').empty();
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
  ViewClass: PanelView,
});

export {
  ListFiltersPanelApp,
};
