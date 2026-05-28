import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/widgets';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  isWorkspaceScoped: false,
  radioRequests: {
    'widgets:model': 'getModel',
    'widgets:collection': 'getCollection',
    'fetch:widgets:collection': 'fetchWidgets',
  },
  fetchWidgets({ filter = {} } = {}) {
    const data = { filter };
    return this.fetchCollectionCache({ data });
  },

});

export default new Entity();
