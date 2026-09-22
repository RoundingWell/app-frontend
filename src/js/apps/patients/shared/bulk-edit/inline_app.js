import App from 'js/base/app';

export default App.extend({
  createState({ stateOptions }) {
    return new this.StateModel(stateOptions);
  },
  onBeforeStart(app, { collection } = {}) {
    if (collection) this.updateCollection(collection);
  },
  onStart() {
    const view = new this.ViewClass({
      model: this.getState(),
    });

    this.listenTo(view, {
      'cancel': this.onClickCancel,
      'save': this.onSubmit,
    });

    this.showView(view);
  },
  onStop() {
    this.getState().clear();
  },
  resetChanges() {
    this.getState().set({
      applyOwner: false,
      isSaving: false,
      stateChanged: false,
      ownerChanged: false,
      dateChanged: false,
      timeChanged: false,
      durationChanged: false,
    });
  },
  updateCollection(collection) {
    this.getState().updateCollection(collection);
  },
  onClickCancel() {
    this.trigger('cancel');
  },
  onSubmit() {
    this.getState().set({ isSaving: true });

    const applyOwner = !!this.getState().get('applyOwner');
    if (applyOwner) {
      this.triggerMethod('applyOwner', this.getState().get('owner'));
    }

    this.triggerMethod('save', this.getState().getData());
  },
});
