import BaseEntity from 'js/base/entity-service';

import { _Model, Model, Collection } from './entities/sidebars';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  isWorkspaceScoped: false,
  radioRequests: {
    'sidebars:model': 'getModel',
    'sidebars:collection': 'getCollection',
    'fetch:sidebars:collection': 'fetchCollectionCache',
  },
});

export default new Entity();
