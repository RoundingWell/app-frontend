import Backbone from 'backbone';

import Component from 'js/base/component';

import { SearchView } from './list-search_views';

const StateModel = Backbone.Model.extend({
  defaults: {
    query: '',
  },
});

export default Component.extend({
  StateModel,
  ViewClass: SearchView,
  viewEvents: {
    'watch:change': 'onViewWatchChange',
    'clear': 'onViewClear',
  },
  onViewClear() {
    this.setState('query', '');
  },
  onViewWatchChange(query) {
    this.setState('query', query);
  },
});
