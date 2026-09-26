import { extend, pick } from 'underscore';
import Backbone from 'backbone';

import BulkEditInlineApp from 'js/apps/patients/shared/bulk-edit/inline_app';
import { BulkEditFlowsInlineView } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const StateModel = Backbone.Model.extend({
  initialize({ collection }) {
    this.updateCollection(collection);
  },
  updateCollection(collection) {
    const initModel = collection.at(0);
    const attributes = { collection };

    if (!this.get('stateChanged')) extend(attributes, this.getBulkState(collection, initModel));
    if (!this.get('ownerChanged')) extend(attributes, this.getBulkOwner(collection, initModel));

    return this.set(attributes);
  },
  getBulkState(collection, initModel) {
    const state = initModel.getState().getResource();
    const stateMulti = collection.some(item => {
      return item.getState().id !== state.id;
    });

    return {
      stateMulti,
      state: stateMulti ? null : state,
    };
  },
  getBulkOwner(collection, initModel) {
    const owner = initModel.getOwner();
    const program = initModel.getProgram();
    const ownerMulti = collection.some(item => {
      const differentOwners = item.getOwner().id !== owner.id;
      const differentPrograms = item.getProgram().id !== program.id;
      return differentOwners || differentPrograms;
    });

    return {
      ownerMulti,
      owner: ownerMulti ? null : owner,
      workspaces: program.getUserWorkspaces(),
    };
  },
  setState(state) {
    return this.set({ state: state.getResource(), stateMulti: false, stateChanged: true });
  },
  setOwner(owner) {
    return this.set({ owner, ownerMulti: false, ownerChanged: true });
  },
  someComplete() {
    return this.get('collection').some(item => {
      return item.isDone();
    });
  },
  getData() {
    const {
      stateChanged,
      state,
      ownerChanged,
      owner,
    } = this.attributes;

    const saveData = {};

    if (stateChanged) saveData._state = pick(state, 'id', 'type');
    if (ownerChanged) saveData._owner = pick(owner, 'id', 'type');

    return saveData;
  },
});

export default BulkEditInlineApp.extend({
  StateModel,
  ViewClass: BulkEditFlowsInlineView,
});
