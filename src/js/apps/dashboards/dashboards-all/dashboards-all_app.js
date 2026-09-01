import Radio from 'backbone.radio';

import App from 'js/base/app';

import { ListView, LayoutView } from 'js/apps/dashboards/dashboards-all/dashboards-all_views';
import SearchComponent from 'js/components/list-search';

export default App.extend({
  stateEvents: {
    'change:searchQuery': 'onChangSearchQuery',
  },
  onChangSearchQuery(state) {
    this.currentSearchQuery = state.get('searchQuery');
  },
  onBeforeStart() {
    this.showView(new LayoutView());
    this.getRegion('list').startPreloader({ variant: 'generic' });

    this.setState({ searchQuery: this.currentSearchQuery });

    this.showSearchView();
  },
  beforeStart() {
    return Radio.request('entities', 'fetch:dashboards:collection');
  },
  onStart(options, collection) {
    this.showChildView('list', new ListView({
      collection,
      state: this.getState(),
    }));
  },
  showSearchView() {
    const searchComponent = this.showChildView('search', new SearchComponent({
      state: {
        query: this.getState('searchQuery'),
      },
    }));

    this.listenTo(searchComponent.getState(), 'change:query', this.setSearchState);
  },
  setSearchState(state, searchQuery) {
    this.setState({
      searchQuery: searchQuery.length > 2 ? searchQuery : '',
    });
  },
});
