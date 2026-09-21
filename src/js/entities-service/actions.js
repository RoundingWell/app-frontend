import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/actions';

export const ACTION_INCLUDE = [
  'program-action.program',
  'flow.program-flow.program',
].join();

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'actions:model': 'getModel',
    'actions:collection': 'getCollection',
    'fetch:actions:model': 'fetchAction',
    'fetch:actions:collection': 'fetchCollection',
    'fetch:actions:withResponses': 'fetchActionWithResponses',
    'fetch:actions:collection:byPatient': 'fetchActionsByPatient',
    'fetch:actions:collection:byFlow': 'fetchActionsByFlow',
  },
  fetchAction(id, options = {}) {
    const data = { ...options.data, include: ACTION_INCLUDE };

    return this.fetchModel(id, { ...options, data });
  },
  fetchActionWithResponses(id, options = {}) {
    const data = {
      ...options.data,
      include: [ACTION_INCLUDE, 'form-responses'].join(),
      fields: {
        'form-responses': ['status', 'updated_at', 'editor'],
      },
    };

    return this.fetchModel(id, { ...options, data });
  },
  fetchActionsByPatient({ patientId, filter }, options = {}) {
    const data = {
      ...options.data,
      filter: { ...options.data?.filter, ...filter },
    };
    const url = `/api/patients/${ patientId }/actions`;

    return this.fetchCollection({ ...options, url, data });
  },
  fetchActionsByFlow(flowId, options = {}) {
    const data = { ...options.data, include: ACTION_INCLUDE };
    const url = `/api/flows/${ flowId }/actions`;

    return this.fetchCollection({ ...options, url, data });
  },
});

export default new Entity();
