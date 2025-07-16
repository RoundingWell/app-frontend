import { debounce, get, isBoolean } from 'underscore';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'patients-search-results';

const Model = BaseModel.extend({
  type: TYPE,
});

const Collection = BaseCollection.extend({
  url: '/api/patients',
  model: Model,
  initialize() {
    this._debouncedSearch = debounce(this._debouncedSearch, 150);
  },
  prevSearch: '',
  controller: new AbortController(),
  search(
    /* istanbul ignore next */
    search = '') {
    if (search.length < 3) {
      if (!search.length || !this.prevSearch.includes(search)) {
        delete this._hasIdentifiers;
        delete this._hasFieldQueryResults;
        this.reset();
        this.prevSearch = '';
      }
      this._debouncedSearch.cancel();
      this.controller.abort();
      return;
    }

    this.prevSearch = search;
    this.isSearching = true;
    this._debouncedSearch(search);
  },
  hasFieldQueryResults() {
    if (isBoolean(this._hasFieldQueryResults)) return this._hasFieldQueryResults;

    this._hasFieldQueryResults = this.some(model => model.has('value'));

    return this._hasFieldQueryResults;
  },
  hasIdentifiers() {
    if (isBoolean(this._hasIdentifiers)) return this._hasIdentifiers;

    this._hasIdentifiers = !!this.find(model => {
      return get(model.get('identifiers'), 'length');
    });

    return this._hasIdentifiers;
  },
  _debouncedSearch(search) {
    const filter = { search };

    delete this._hasIdentifiers;
    delete this._hasFieldQueryResults;
    this.controller.abort();
    this.controller = new AbortController();

    const fetcher = this.fetch({ data: { filter }, signal: this.controller.signal });
    this.fetcher = fetcher;

    fetcher.then(() => {
      if (this.fetcher !== fetcher) return;
      this.isSearching = false;
      this.trigger('search', this);
    });
  },
});

export {
  Collection,
  Model,
};
