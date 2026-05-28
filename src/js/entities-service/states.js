import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/states';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'states:model': 'getModel',
    'states:collection': 'getCollection',
    'fetch:states:collection': 'fetchCollectionCache',
  },
});

export default new Entity();
