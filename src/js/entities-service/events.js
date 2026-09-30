import { getUrl } from 'js/base/fetch';
import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/events';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'events:model': 'getModel',
    'events:collection': 'getCollection',
    'fetch:actionEvents:collection': 'fetchActionEvents',
    'fetch:flowEvents:collection': 'fetchFlowEvents',
    'fetch:events:collection:byInteraction': 'fetchInteractionEvents',
  },
  fetchActionEvents(actionId, options) {
    return this.fetchCollection({ ...options, url: `/api/actions/${ actionId }/activity` });
  },
  fetchFlowEvents(flowId, options) {
    return this.fetchCollection({ ...options, url: `/api/flows/${ flowId }/activity` });
  },
  fetchInteractionEvents({ interactionId, cursor }, options) {
    return this.fetchCollection({
      ...options,
      url: getUrl('/api/events', {
        filter: { name: 'InteractionEvent', resource: interactionId },
        page: { limit: 100, ...(cursor ? { cursor } : {}) },
      }),
    });
  },
});

export default new Entity();
