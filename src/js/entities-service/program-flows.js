import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/program-flows';

import { PROGRAM_BEHAVIORS } from 'js/static';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'programFlows:model': 'getModel',
    'programFlows:collection': 'getCollection',
    'fetch:programFlows:model': 'fetchModel',
    'fetch:programFlows:collection:byProgram': 'fetchProgramFlowsByProgram',
    'fetch:programFlows:collection': 'fetchProgramFlows',
  },
  fetchProgramFlowsByProgram({ programId }, options) {
    const url = `/api/programs/${ programId }/flows`;

    return this.fetchCollection({ ...options, url });
  },
  fetchProgramFlows(behavior = PROGRAM_BEHAVIORS.STANDARD, options = {}) {
    const collection = new this.Entity.Collection();
    const data = {
      ...options.data,
      filter: { ...options.data?.filter, behavior },
    };

    return collection.fetch({ ...options, data });
  },
});

export default new Entity();
