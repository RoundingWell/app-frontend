import { extend } from 'underscore';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'flows';

const _Model = BaseModel.extend({
  messages: {
    OwnerChanged({ owner, attributes }) {
      this.set({ _owner: owner, ...attributes });
    },
    StateChanged({ state, attributes }) {
      this.set({ _state: state.id, ...attributes });
    },
    NameChanged({ attributes }) {
      this.set(attributes);
    },
    DetailsChanged({ attributes }) {
      this.set(attributes);
    },
  },
  urlRoot() {
    if (this.isNew()) return `/api/patients/${ this.get('_patient') }/relationships/flows`;

    return '/api/flows';
  },
  type: TYPE,
  getPatient() {
    return Radio.request('entities', 'patients:model', this.get('_patient'));
  },
  getOwner() {
    return this.getRelationship('_owner');
  },
  getAuthor() {
    return Radio.request('entities', 'clinicians:model', this.get('_author'));
  },
  getState() {
    return Radio.request('entities', 'states:model', this.get('_state'));
  },
  getProgramFlow() {
    return Radio.request('entities', 'programFlows:model', this.get('_program_flow'));
  },
  getProgram() {
    return Radio.request('entities', 'programs:model', this.get('_program'));
  },
  isDone() {
    const state = this.getState();
    return state.isDone();
  },
  isAllDone() {
    const { complete, total } = this.get('_progress');
    return complete === total;
  },
  canEdit() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (currentUser.can('work:manage')) return true;

    if (currentUser.can('work:owned:manage') && this.getOwner() === currentUser) return true;

    if (currentUser.can('work:team:manage')) {
      const owner = this.getOwner();
      const currentUsersTeam = currentUser.getTeam();
      const ownersTeam = owner.type === 'teams' ? owner : owner.getTeam();

      if (currentUsersTeam === ownersTeam) return true;
    }

    return false;
  },
  canDelete() {
    // Delete UI unavailable if action is not editable
    if (!this.canEdit()) return false;

    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (currentUser.can('work:delete')) return true;

    if (currentUser.can('work:owned:delete') && this.getOwner() === currentUser) return true;

    if (currentUser.can('work:authored:delete') && this.getAuthor() === currentUser) return true;

    return false;
  },
  saveState(state) {
    return this.save({ _state: state.id }, {
      relationships: {
        state: this.toRelation(state),
      },
    });
  },
  saveOwner(owner) {
    return this.save({ _owner: owner }, {
      relationships: {
        owner: this.toRelation(owner),
      },
    });
  },
  applyOwner(owner) {
    const url = `${ this.url() }/relationships/actions`;
    const relationships = { 'owner': this.toRelation(owner) };

    return this.save({}, { relationships }, { url });
  },
  saveAll(attrs) {
    if (this.isNew()) attrs = extend({}, this.attributes, attrs);

    const relationships = {
      'state': this.toRelation(attrs._state, 'states'),
      'owner': this.toRelation(attrs._owner),
      'program-flow': this.toRelation(attrs._program_flow, 'program-flows'),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/flows',
  model: Model,
  save(attrs) {
    const saves = this.invoke('saveAll', attrs);

    return Promise.all(saves);
  },
  applyOwner(owner) {
    const saves = this.invoke('applyOwner', owner);

    return Promise.all(saves);
  },
});

export {
  _Model,
  Model,
  Collection,
};
