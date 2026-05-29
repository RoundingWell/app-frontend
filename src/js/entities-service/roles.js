import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/roles';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  isWorkspaceScoped: false,
  radioRequests: {
    'roles:model': 'getModel',
    'roles:collection': 'getCollection',
    'fetch:roles:collection': 'fetchCollectionCache',
  },
});

export default new Entity();
