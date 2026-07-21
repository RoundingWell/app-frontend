import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/programs';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'programs:model': 'getModel',
    'programs:collection': 'getCollection',
    'fetch:programs:model': 'fetchModel',
    'fetch:programs:collection': 'fetchCollection',
    'fetch:programs:model:byProgramFlow': 'fetchProgramByProgramFlow',
    'fetch:programs:byWorkspace': 'fetchProgramsByWorkspace',
  },
  fetchProgramByProgramFlow(flowId) {
    return this.fetchBy(`/api/program-flows/${ flowId }/program`);
  },
  fetchProgramsByWorkspace(workspaceId) {
    const url = `/api/workspaces/${ workspaceId }/programs`;
    return this.fetchCollectionCache({ url });
  },
});

export default new Entity();
