import { first, size } from 'underscore';
import { Radio } from 'marionette';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

import { STATE_STATUS, PROGRAM_BEHAVIORS } from 'js/static';

const TYPE = 'program-actions';

const _Model = BaseModel.extend({
  type: TYPE,
  getProgram() {
    return this.getRelationship('_program');
  },
  createAction({ patient, flow }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();

    const defaultInitialState = first(states.filter({ status: STATE_STATUS.QUEUED }));
    const actionPatient = patient || flow.getPatient();

    const attrs = {
      name: this.get('name'),
      _state: defaultInitialState.getResource(),
      _program_action: this.getResource(),
      _patient: actionPatient.getResource(),
    };
    if (flow) attrs._flow = flow.getResource();
    attrs._program = this.getProgram().getResource();

    return Radio.request('entities', 'actions:model', attrs);
  },
  getOwner() {
    return this.getRelationship('_owner');
  },
  getForm() {
    return this.getRelationship('_form');
  },
  isVisibleToCurrentUser() {
    const visibleToTeamsList = this.get('_teams');
    const visibleToRolesList = this.get('_roles');
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (size(visibleToTeamsList)) {
      const currentUserTeam = currentUser.getTeam();
      if (!visibleToTeamsList.find(team => team.id === currentUserTeam.id)) return false;
    }

    if (size(visibleToRolesList)) {
      const currentUserRole = currentUser.getRole();
      if (!visibleToRolesList.find(role => role.id === currentUserRole.id)) return false;
    }

    return true;
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  initialize(models, options = {}) {
    this.flowId = options.flowId;
    if (this.flowId) this.comparator = 'sequence';
  },
  url() {
    if (this.flowId) return `/api/program-flows/${ this.flowId }/actions`;
    return '/api/program-actions';
  },
  model: Model,
  filterAddable() {
    const clone = this.clone();

    const addable = this.filter(action => {
      const isPublished = !!action.get('published_at');
      const isArchived = !!action.get('archived_at');
      const isAutomated = action.get('behavior') === PROGRAM_BEHAVIORS.AUTOMATED;
      const isVisible = action.isVisibleToCurrentUser();

      return isPublished && !isArchived && !isAutomated && isVisible;
    });

    clone.reset(addable);

    return clone;
  },
});

export {
  _Model,
  Model,
  Collection,
};
