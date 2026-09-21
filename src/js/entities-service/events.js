import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/events';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'events:model': 'getModel',
    'events:collection': 'getCollection',
    'fetch:actionEvents:collection': 'fetchActionEvents',
    'fetch:flowEvents:collection': 'fetchFlowEvents',
  },
  fetchActionEvents(actionId, options = {}) {
    return this.fetchCollection({ ...options, url: `/api/actions/${ actionId }/activity` });
  },
  fetchFlowEvents(flowId) {
    return this.fetchCollection({ url: `/api/flows/${ flowId }/activity` });
  },
});

export default new Entity();
