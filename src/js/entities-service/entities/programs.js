import Backbone from 'backbone';
import { Radio } from 'marionette';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'programs';

const _Model = BaseModel.extend({
  type: TYPE,
  urlRoot: '/api/programs',
  getAddable() {
    const programActions = Radio.request('entities', 'programActions:collection', this.get('_program_actions'));
    const programFlows = Radio.request('entities', 'programFlows:collection', this.get('_program_flows'));

    const actions = programActions.filterAddable();
    const flows = programFlows.filterAddable();

    return new Backbone.Collection([...flows.models, ...actions.models], { comparator: 'name' });
  },
  getUserWorkspaces() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const userWorkspaces = currentUser.getWorkspaces();
    const workspaces = Radio.request('entities', 'workspaces:collection', this.get('_workspaces'));
    workspaces.reset(workspaces.filter(workspace => userWorkspaces.get(workspace.id)));
    return workspaces;
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/programs',
  model: Model,
});

export {
  Model,
  _Model,
  Collection,
};
