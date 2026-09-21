import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/flows';

export const FLOW_INCLUDE = [
  'program-flow',
  'program-flow.program',
  'program-flow.program-actions',
].join();

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'flows:model': 'getModel',
    'flows:collection': 'getCollection',
    'fetch:flows:model': 'fetchFlow',
    'fetch:flows:collection': 'fetchCollection',
    'fetch:flows:collection:byPatient': 'fetchFlowsByPatient',
  },
  fetchFlow(id, options = {}) {
    const data = { ...options.data, include: FLOW_INCLUDE };

    return this.fetchModel(id, { ...options, data });
  },
  fetchFlowsByPatient({ patientId, filter }, options = {}) {
    const data = {
      ...options.data,
      filter: { ...options.data?.filter, ...filter },
    };
    const url = `/api/patients/${ patientId }/flows`;

    return this.fetchCollection({ ...options, url, data });
  },
});

export default new Entity();
