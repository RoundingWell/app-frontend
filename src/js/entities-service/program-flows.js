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
  fetchProgramFlowsByProgram({ programId }) {
    const url = `/api/programs/${ programId }/flows`;

    return this.fetchCollection({ url });
  },
  fetchProgramFlows(behavior = PROGRAM_BEHAVIORS.STANDARD) {
    const collection = new this.Entity.Collection();

    return collection.fetch({ data: { filter: { behavior } } });
  },
});

export default new Entity();
