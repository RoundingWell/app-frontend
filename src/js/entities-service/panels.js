import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection } from './entities/panels';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  isWorkspaceScoped: false,
  radioRequests: {
    'panels:model': 'getModel',
    'panels:collection': 'getCollection',
    'fetch:panels:collection': 'fetchCollectionCache',
  },
});

export default new Entity();
