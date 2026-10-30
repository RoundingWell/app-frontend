import { first, size } from 'underscore';
import { Radio } from 'marionette';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

import { STATE_STATUS, PROGRAM_BEHAVIORS } from 'js/static';

const TYPE = 'program-flows';

const _Model = BaseModel.extend({
  urlRoot: '/api/program-flows',
  type: TYPE,
  getOwner() {
    return this.getRelationship('_owner');
  },
  createFlow(patient) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();

    const defaultInitialState = first(states.filter({ status: STATE_STATUS.QUEUED }));

    const flow = Radio.request('entities', 'flows:model', {
      _patient: patient.getResource(),
      _program_flow: this.getResource(),
      _state: defaultInitialState.getResource(),
    });

    return flow;
  },
  getActions() {
    return Radio.request('entities', 'programActions:collection', this.get('_program_actions'), { flowId: this.id });
  },
  getAddableActions() {
    return this.getActions().filterAddable();
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
  url: '/api/program-flows',
  model: Model,
  filterAddable() {
    const clone = this.clone();

    const addable = this.filter(flow => {
      const isPublished = !!flow.get('published_at');
      const isArchived = !!flow.get('archived_at');
      const isAutomated = flow.get('behavior') === PROGRAM_BEHAVIORS.AUTOMATED;
      const isVisible = flow.isVisibleToCurrentUser();

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
