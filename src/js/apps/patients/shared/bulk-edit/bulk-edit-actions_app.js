import { extend, pick } from 'underscore';
import Backbone from 'backbone';

import BulkEditInlineApp from 'js/apps/patients/shared/bulk-edit/inline_app';
import { BulkEditActionsInlineView } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const StateModel = Backbone.Model.extend({
  initialize({ collection }) {
    this.updateCollection(collection);
  },
  updateCollection(collection) {
    const initModel = collection.at(0);
    const attributes = { collection };

    if (!this.get('stateChanged')) extend(attributes, this.getBulkState(collection, initModel));
    if (!this.get('ownerChanged')) extend(attributes, this.getBulkOwner(collection, initModel));
    if (!this.get('dateChanged')) extend(attributes, this.getBulkDueDate(collection, initModel));
    if (!this.get('timeChanged')) extend(attributes, this.getBulkDueTime(collection, initModel));
    if (!this.get('durationChanged')) extend(attributes, this.getBulkDuration(collection, initModel));

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
  getBulkDueDate(collection, initModel) {
    const date = initModel.get('due_date');
    const dateMulti = collection.some(item => {
      return item.get('due_date') !== date;
    });
    const hasMissingDueDate = collection.some(item => !item.get('due_date'));

    return {
      dateMulti,
      date: dateMulti ? null : date,
      hasMissingDueDate,
    };
  },
  getBulkDueTime(collection, initModel) {
    const time = initModel.get('due_time');
    const timeMulti = collection.some(item => {
      return item.get('due_time') !== time;
    });

    return {
      timeMulti,
      time: timeMulti ? null : time,
    };
  },
  getBulkDuration(collection, initModel) {
    const duration = initModel.get('duration');
    const durationMulti = collection.some(item => {
      return item.get('duration') !== duration;
    });

    return {
      durationMulti,
      duration: durationMulti ? null : duration,
    };
  },
  setState(state) {
    return this.set({ state: state.getResource(), stateMulti: false, stateChanged: true });
  },
  setOwner(owner) {
    return this.set({ owner, ownerMulti: false, ownerChanged: true });
  },
  setDueDate(date) {
    if (!date) {
      return this.set({
        date: null,
        time: null,
        dateMulti: false,
        timeMulti: false,
        dateChanged: true,
        timeChanged: true,
        hasMissingDueDate: true,
      });
    }
    return this.set({ date: date.format('YYYY-MM-DD'), dateMulti: false, dateChanged: true, hasMissingDueDate: false });
  },
  setDueTime(time) {
    return this.set({ time: time || null, timeMulti: false, timeChanged: true });
  },
  setDuration(duration) {
    return this.set({ duration, durationMulti: false, durationChanged: true });
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
      dateChanged,
      date,
      timeChanged,
      time,
      durationChanged,
      duration,
    } = this.attributes;

    const saveData = {};

    if (stateChanged) saveData._state = pick(state, 'id', 'type');
    if (ownerChanged) saveData._owner = pick(owner, 'id', 'type');
    if (dateChanged) saveData.due_date = date;
    if (timeChanged) saveData.due_time = time;
    if (durationChanged) saveData.duration = duration;

    return saveData;
  },
});

export default BulkEditInlineApp.extend({
  StateModel,
  ViewClass: BulkEditActionsInlineView,
});
