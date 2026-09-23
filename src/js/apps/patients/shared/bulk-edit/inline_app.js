import App from 'js/base/app';

export default App.extend({
  createState({ stateOptions }) {
    return new this.StateModel(stateOptions);
  },
  onBeforeStart(app, { collection }) {
    this.pendingSave = null;
    this.updateCollection(collection);
  },
  onStart() {
    const view = new this.ViewClass({
      model: this.getState(),
    });

    this.listenTo(view, {
      'destroy': () => {
        this.pendingSave = null;
        this.stopListening(view);
      },
      'cancel': this.onClickCancel,
      'save': this.onSubmit,
    });

    this.showView(view);
  },
  onStop() {
    this.pendingSave = null;
    this.getState().clear();
  },
  resetChanges(save) {
    if (save && this.pendingSave !== save) return false;

    this.pendingSave = null;
    this.getState().set({
      applyOwner: false,
      isSaving: false,
      stateChanged: false,
      ownerChanged: false,
      dateChanged: false,
      timeChanged: false,
      durationChanged: false,
    });
    if (save) this.updateCollection(this.getState().get('collection'));
    return true;
  },
  updateCollection(collection) {
    this.getState().updateCollection(collection);
  },
  onClickCancel() {
    this.trigger('cancel');
  },
  onSubmit() {
    const save = this.pendingSave = {};
    this.getState().set({ isSaving: true });

    const applyOwner = !!this.getState().get('applyOwner');
    if (applyOwner) {
      this.triggerMethod('applyOwner', this.getState().get('owner'));
    }

    this.triggerMethod('save', this.getState().getData(), save);
  },
});
