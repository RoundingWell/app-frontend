import { debounce } from 'underscore';
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
  _debouncedSearch(search) {
    const filter = { search };

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
