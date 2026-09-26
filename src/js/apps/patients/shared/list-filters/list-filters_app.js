import { Radio } from 'marionette';

import createLatestRequest from 'js/utils/latest-request';
import { addError } from 'js/datadog';

import App from 'js/base/app';

import { PanelView, LayoutView, HeadingView, MenuView, CustomFiltersLoadingView, CustomFiltersView, StatesFiltersView, FlowStatesFiltersView } from 'js/apps/patients/shared/list-filters/list-filters_views';

const ListFiltersPanelApp = App.extend({
  onBeforeStart(app, options) {
    const view = this.setView(new PanelView({
      isDrawer: options.isDrawer,
      model: options.layoutState,
    }));

    view.render();
    view.showChildView('content', new LayoutView());
  },
  onStart(app, { filtersState }) {
    this.customFiltersRequests?.dispose();
    this.stopListening(this.filtersState);
    this.filtersState = filtersState;
    this.customFiltersRequests = createLatestRequest({
      load: (options, { signal }) => Radio.request('entities', 'fetch:filters:customFilters', { ...options, signal }),
      commit: result => {
        if (result) this.showCustomFilters(result);
      },
      fail: error => {
        this.showCustomFilters({ filters: this.filters, hasLoadError: true });
        addError(error);
      },
    });
    const requests = this.customFiltersRequests;
    const view = this.getView();
    this.listenTo(view, 'before:destroy', () => {
      requests.dispose();
      this.stopListening(filtersState);
      this.stopListening(view);
    });
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
    const currentView = this.getView().getChildView('content').getChildView('customFilters');
    if (this.isCustomFiltersLoaded) currentView.setLoading(true);

    return this.customFiltersRequests.run({
      entityType: this.filtersState.get('listType'),
      worklist: this.filtersState.get('worklist'),
    });
  },
  showCustomFilters({ filters, hasLoadError }) {
    filters.each(filter => {
      this.filters.findWhere({ slug: filter.get('slug') }).set(filter.attributes);
    });

    if (!this.isCustomFiltersLoaded) {
      this.isCustomFiltersLoaded = true;
      this._showCustomFiltersView({ hasLoadError });
      return;
    }

    const view = this.getView().getChildView('content').getChildView('customFilters');
    view.setLoadError(hasLoadError);
    view.setLoading(false);
  },
  onStop() {
    this.customFiltersRequests?.dispose();
    this.stopListening(this.filtersState, 'change:listType change:worklist');
  },
  onBeforeDestroy() {
    this.customFiltersRequests?.dispose();
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

export {
  ListFiltersPanelApp,
};
