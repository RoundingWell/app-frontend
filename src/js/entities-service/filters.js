import { map } from 'underscore';
import Radio from 'backbone.radio';
import BaseEntity from 'js/base/entity-service';
import { Model, Collection } from './entities/filters';

const Entity = BaseEntity.extend({
  Entity: { Model, Collection },
  radioRequests: {
    'filters:collection': 'getCollection',
    'filters:customFilters': 'getCustomFilters',
    'fetch:filters:customFilters': 'fetchCustomFilters',
  },
  getCustomFilters() {
    const customFilters = Radio.request('settings', 'get', 'custom_filters');

    const filters = map(customFilters, slug => ({ slug }));

    return this.getCollection(filters);
  },
  fetchCustomFilters(options) {
    const filters = this.getCustomFilters();
    const requests = filters.fetchAll(options);

    if (!requests) return;

    return Promise.allSettled(requests)
      .then(results => ({
        filters,
        hasLoadError: results.some(({ status }) => status === 'rejected'),
      }));
  },
});

export default new Entity();
