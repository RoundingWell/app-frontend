import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/settings';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  isWorkspaceScoped: false,
  radioRequests: {
    'settings:model': 'getModel',
    'fetch:settings:collection': 'fetchCollectionCache',
  },
});

export default new Entity();
