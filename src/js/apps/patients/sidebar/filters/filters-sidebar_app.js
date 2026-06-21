import { extend } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { SidebarMixin } from 'js/services/sidebar';

import { LayoutView, HeadingView, MenuView, CustomFiltersView, StatesFiltersView, FlowStatesFiltersView } from 'js/apps/patients/sidebar/filters/filters-sidebar_views';

export default App.extend(extend({
  onStart({ filtersState }) {
    this.filtersState = filtersState;
    this.filters = Radio.request('entities', 'filters:customFilters');

    this.showHeadingView();
    this.showMenu();
    this.showChildView('content', new LayoutView());
    this.showCustomFiltersView();
    this.showStatesFiltersView();
    this.showFlowStatesFiltersView();

    this.listenTo(filtersState, {
      'change:listType'() {
        this.showFlowStatesFiltersView();
        this.fetchFilters();
      },
      'change:worklist'() {
        this.fetchFilters();
      },
    });
  },
  onClose() {
    this.stop();
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
  fetchFilters() {
    return this.filters.invokeFetch({
      entityType: this.filtersState.get('listType'),
      worklist: this.filtersState.get('worklist'),
    });
  },
  showCustomFiltersView() {
    Promise.allSettled(this.fetchFilters() || /* istanbul ignore next */ [])
      .then(() => {
        if (!this.isRunning()) return;

        this._showCustomFiltersView();
      });
  },
  _showCustomFiltersView() {
    const customFiltersView = new CustomFiltersView({
      collection: this.filters,
      state: this.filtersState,
    });

    this.showContentView('customFilters', customFiltersView);
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
}, SidebarMixin));
