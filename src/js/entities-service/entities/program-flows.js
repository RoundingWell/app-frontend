import { extend, first, size } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

import trim from 'js/utils/formatting/trim';
import collectionOf from 'js/utils/formatting/collection-of';


import { STATE_STATUS, PROGRAM_BEHAVIORS } from 'js/static';

const TYPE = 'program-flows';

const _Model = BaseModel.extend({
  urlRoot() {
    if (this.isNew()) return `/api/programs/${ this.get('_program') }/relationships/flows`;

    return '/api/program-flows';
  },
  type: TYPE,
  validate({ name }) {
    if (!trim(name)) return 'Flow name required';
  },
  getTags() {
    return Radio.request('entities', 'tags:collection', collectionOf(this.get('tags'), 'text'));
  },
  addTag(tag) {
    const tags = this.getTags();
    tags.add(tag);
    return this.save({ tags: tags.map('text') });
  },
  removeTag(tag) {
    const tags = this.getTags();
    tags.remove(tag);
    return this.save({ tags: tags.map('text') });
  },
  getOwner() {
    const owner = this.get('_owner');
    if (!owner) return;
    return Radio.request('entities', 'teams:model', owner.id);
  },
  getFlow(patientId) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const states = currentWorkspace.getStates();

    const defaultInitialState = first(states.filter({ status: STATE_STATUS.QUEUED }));

    const flow = Radio.request('entities', 'flows:model', {
      _patient: patientId,
      _program_flow: this.get('id'),
      _state: defaultInitialState.id,
    });

    return flow;
  },
  saveOwner(owner) {
    owner = this.toRelation(owner);
    return this.save({ _owner: owner.data }, {
      relationships: { owner },
    });
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const relationships = {
      owner: this.toRelation(attrs._owner, 'teams'),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
  getActions() {
    return Radio.request('entities', 'programActions:collection', this.get('_program_actions'), { flowId: this.id });
  },
  getAddableActions() {
    return this.getActions().filterAddable();
  },
  isVisibleToCurrentUser() {
    const visibleToTeamsList = this.get('_teams');
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentUserTeam = currentUser.getTeam();

    if (!size(visibleToTeamsList)) return true;

    return !!visibleToTeamsList.find(team => team.id === currentUserTeam.id);
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
