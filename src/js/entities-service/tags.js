import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/tags';

let tagsCache;

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'tags:model': 'getModel',
    'tags:collection': 'getCollection',
    'fetch:tags:collection': 'fetchTags',
  },
  fetchTags(options) {
    if (tagsCache) return tagsCache;

    return this.fetchCollection(options).then(tags => {
      tagsCache = tags;
      return tags;
    });
  },
});

export default new Entity();
