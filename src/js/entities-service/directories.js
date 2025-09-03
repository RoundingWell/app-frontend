import BaseEntity from 'js/base/entity-service';
import { Model, Collection } from './entities/directories';

const Entity = BaseEntity.extend({
  Entity: { Model, Collection },
  radioRequests: {
    'directories:collection': 'getCollection',
    'fetch:directories:model': 'fetchDirectory',
  },
  fetchDirectory(slug, query) {
    const model = new Model({ slug });

    return model.fetch({ data: query });
  },
});

export default new Entity();
