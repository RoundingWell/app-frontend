import { clone, invoke, extend, map, get } from 'underscore';
import Backbone from 'backbone';

import JsonApiMixin from './jsonapi-mixin';
import { setResponse } from './cache/entity-cache';

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
  parse(response, options) {
    /* istanbul ignore if */
    if (!response || !response.data) return response;

    if (options && options._cacheKey) setResponse(options._cacheKey, response);

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
  async batchInvoke(methodName, batchSize, ...args) {
    /* istanbul ignore next: Branch only for testing */
    const size = _TEST_ ? 2 : batchSize;
    const results = [];
    let count = 0;

    while (count < this.length) {
      const batch = new this.constructor(this.slice(count, count + size));
      const batchInvokes = batch.invoke(methodName, ...args);
      const batchResults = await Promise.all(batchInvokes);

      results.push(...batchResults);
      count += size;
    }

    return results;
  },
}, JsonApiMixin));
