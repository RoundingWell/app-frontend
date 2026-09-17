import { Radio } from 'marionette';
import Backbone from 'backbone';

import App from 'js/base/app';

import { ListView, LayoutView } from 'js/apps/dashboards/dashboards-all/dashboards-all_views';
import SearchView from 'js/components/list-search';

export default App.extend({
  createState() {
    return new Backbone.Model({ searchQuery: '' });
  },
  onBeforeStart() {
    const view = this.setView(new LayoutView());

    view.render();
    view.getRegion('list').startPreloader({ variant: 'generic' });

    this.showSearchView();
    this.showView();
  },
  prepareStart(options, { signal }) {
    return Radio.request('entities', 'fetch:dashboards:collection', { signal });
  },
  onStart(app, options, collection) {
    this.getView().showChildView('list', new ListView({
      collection,
      state: this.getState(),
    }));
  },
  showSearchView() {
    const searchView = this.getView().showChildView('search', new SearchView({
      query: this.getState().get('searchQuery'),
    }));

    this.listenTo(searchView, 'change:query', this.setSearchState);
  },
  setSearchState(searchQuery) {
    this.getState().set({
      searchQuery: searchQuery.length > 2 ? searchQuery : '',
    });
  },
});
