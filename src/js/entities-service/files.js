import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/files';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'files:model': 'getModel',
    'files:collection': 'getCollection',
    'fetch:files:collection:byAction': 'fetchFilesByAction',
  },
  fetchFilesByAction(actionId, options) {
    const url = `/api/actions/${ actionId }/files`;
    const data = { ...options.data, urls: ['download', 'view'] };

    return this.fetchCollection({ ...options, url, data });
  },
});

export default new Entity();
