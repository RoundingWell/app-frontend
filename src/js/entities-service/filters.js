import { map } from 'underscore';
import Radio from 'backbone.radio';
import BaseEntity from 'js/base/entity-service';
import { Model, Collection } from './entities/filters';

const Entity = BaseEntity.extend({
  Entity: { Model, Collection },
  radioRequests: {
    'filters:collection': 'getCollection',
    'filters:customFilters': 'getCustomFilters',
  },
  getCustomFilters() {
    const customFilters = Radio.request('settings', 'get', 'custom_filters');

    const filters = map(customFilters, slug => ({ slug }));

    return this.getCollection(filters);
  },
});

export default new Entity();
