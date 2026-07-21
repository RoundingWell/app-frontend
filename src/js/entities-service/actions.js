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
  fetchAction(id) {
    return this.fetchModel(id, { data: { include: ACTION_INCLUDE } });
  },
  fetchActionWithResponses(id) {
    const data = {
      include: [ACTION_INCLUDE, 'form-responses'].join(),
      fields: {
        'form-responses': ['status', 'updated_at', 'editor'],
      },
    };

    return this.fetchModel(id, { data });
  },
  fetchActionsByPatient({ patientId, filter }) {
    const data = { filter };
    const url = `/api/patients/${ patientId }/actions`;

    return this.fetchCollection({ url, data });
  },
  fetchActionsByFlow(flowId) {
    const data = { include: ACTION_INCLUDE };
    const url = `/api/flows/${ flowId }/actions`;

    return this.fetchCollection({ url, data });
  },
});

export default new Entity();
