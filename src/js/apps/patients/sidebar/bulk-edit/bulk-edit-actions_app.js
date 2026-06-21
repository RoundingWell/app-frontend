import { pick } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';
import { BulkEditActionsBodyView, BulkEditActionsHeaderView } from 'js/apps/patients/shared/bulk-edit/bulk-edit_views';

const StateModel = Backbone.Model.extend({
  initialize({ collection }) {
    const initModel = collection.at(0);
    this.initBulkState(collection, initModel);
    this.initBulkOwner(collection, initModel);
    this.initBulkDueDate(collection, initModel);
    this.initBulkDueTime(collection, initModel);
    this.initBulkDuration(collection, initModel);
  },
  initBulkState(collection, initModel) {
    const state = initModel.getState().getResource();
    const stateMulti = collection.some(item => {
      return item.getState().id !== state.id;
    });

    this.set({
      stateMulti,
      state: stateMulti ? null : state,
    });
  },
  initBulkOwner(collection, initModel) {
    const owner = initModel.getOwner();
    const program = initModel.getProgram();
    const ownerMulti = collection.some(item => {
      const differentOwners = item.getOwner().id !== owner.id;
      const differentPrograms = item.getProgram().id !== program.id;
      return differentOwners || differentPrograms;
    });

    this.set({
      ownerMulti,
      owner: ownerMulti ? null : owner,
      workspaces: program.getUserWorkspaces(),
    });
  },
  initBulkDueDate(collection, initModel) {
    const date = initModel.get('due_date');
    const dateMulti = collection.some(item => {
      return item.get('due_date') !== date;
    });

    this.set({
      dateMulti,
      date: dateMulti ? null : date,
    });
  },
  initBulkDueTime(collection, initModel) {
    const time = initModel.get('due_time');
    const timeMulti = collection.some(item => {
      return item.get('due_time') !== time;
    });

    this.set({
      timeMulti,
      time: timeMulti ? null : time,
    });
  },
  initBulkDuration(collection, initModel) {
    const duration = initModel.get('duration');
    const durationMulti = collection.some(item => {
      return item.get('duration') !== duration;
    });

    this.set({
      durationMulti,
      duration: durationMulti ? null : duration,
    });
  },
  setState(state) {
    return this.set({ state: state.getResource(), stateMulti: false, stateChanged: true });
  },
  setOwner(owner) {
    return this.set({ owner, ownerMulti: false, ownerChanged: true });
  },
  setDueDate(date) {
    if (!date) {
      return this.set({ date: null, time: null, dateMulti: false, timeMulti: false });
    }
    return this.set({ date: date.format('YYYY-MM-DD'), dateMulti: false, dateChanged: true });
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

export default App.extend({
  StateModel,
  onStart() {
    const headerView = new BulkEditActionsHeaderView({
      collection: this.getState('collection'),
    });

    const bodyView = new BulkEditActionsBodyView({
      model: this.getState(),
      collection: this.getState('collection'),
    });

    this.modal = Radio.request('modal', 'show:sidebar', {
      headerView,
      bodyView,
      onSubmit: this.onSubmit.bind(this),
    });

    this.listenTo(this.modal, {
      'destroy': this.stop,
    });
  },
  onSubmit() {
    this.setState({ isSaving: true });

    this.modal.showSavingFooter();

    const applyOwner = !!this.getState('applyOwner');
    if (applyOwner) {
      this.triggerMethod('applyOwner', this.getState('owner'));
    }

    this.triggerMethod('save', this.getState().getData());
  },
  onStop() {
    this.modal.destroy();
  },
});
