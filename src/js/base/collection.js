import { clone, invoke, extend, map, get } from 'underscore';
import Backbone from 'backbone';

import JsonApiMixin from './jsonapi-mixin';

export default Backbone.Collection.extend(extend({
  getResources() {
    return this.invoke('getResource');
  },
  fetch(options = {}) {
    const fetcher = Backbone.Collection.prototype.fetch.call(this, options);

    // Resolve with entity if successful
    return fetcher.then(response => {
      if (!response || response.ok) return this;

      return response;
    });
  },
  parse(response) {
    /* istanbul ignore if */
    if (!response || !response.data) return response;

    this.cacheIncluded(response.included);

    this.meta = response.meta;

    return map(response.data, this.parseModel, this);
  },
  getMeta(key) {
    return get(this.meta, key);
  },
  destroy(options) {
    const models = clone(this.models);

    const destroys = invoke(models, 'destroy', options);

    return Promise.all(destroys);
  },
}, JsonApiMixin));
