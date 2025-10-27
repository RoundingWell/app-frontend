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
      this.set({ _state: state, ...attributes });
    },
    NameChanged({ attributes }) {
      this.set(attributes);
    },
    DetailsChanged({ attributes }) {
      this.set(attributes);
    },
    FlowProgressChanged({ attributes }) {
      this.set({ _progress: attributes.progress });
    },
    ResourceDeleted() {
      this.destroy({ isDeleted: true });
    },
  },
  urlRoot() {
    if (this.isNew()) {
      const patient = this.getPatient();
      return `/api/patients/${ patient.id }/relationships/flows`;
    }

    return '/api/flows';
  },
  type: TYPE,
  getPatient() {
    return this.getRelationship('_patient');
  },
  getOwner() {
    return this.getRelationship('_owner');
  },
  getAuthor() {
    return this.getRelationship('_author');
  },
  getState() {
    return this.getRelationship('_state');
  },
  getProgramFlow() {
    return this.getRelationship('_program_flow');
  },
  getProgram() {
    return this.getRelationship('_program');
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
    return this.save({ _state: state.getResource() }, {
      relationships: {
        state: this.toRelation(state),
      },
    });
  },
  saveOwner(owner) {
    return this.save({ _owner: owner.getResource() }, {
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
      'state': this.toRelation(attrs._state),
      'owner': this.toRelation(attrs._owner),
      'program-flow': this.toRelation(attrs._program_flow),
    };

    return this.save(attrs, { relationships }, { wait: true });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/flows',
  model: Model,
  save(attrs) {
    return this._processBatches('saveAll', attrs);
  },
  applyOwner(owner) {
    return this._processBatches('applyOwner', owner);
  },
  async _processBatches(
    methodName,
    ...args
  ) {
    /* istanbul ignore next: Branch only for testing */
    const batchSize = _TEST_ ? 2 : 20;
    const results = [];
    let count = 0;

    while (count < this.length) {
      const batch = new Collection(this.slice(count, count + batchSize));
      const batchSaves = batch.invoke(methodName, ...args);
      const batchResults = await Promise.all(batchSaves);

      results.push(...batchResults);
      count += batchSize;
    }

    return results;
  },
});

export {
  _Model,
  Model,
  Collection,
};
