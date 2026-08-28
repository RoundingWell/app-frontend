import App from 'js/base/app';

export default App.extend({
  onStart() {
    const view = new this.ViewClass({
      model: this.getState(),
      collection: this.getState('collection'),
    });

    this.listenTo(view, {
      'cancel': this.onClickCancel,
      'save': this.onSubmit,
    });

    this.showView(view);
  },
  updateCollection(collection) {
    this.getState().updateCollection(collection);
    this.getView().collection = collection;
    this.getView().render();
  },
  onClickCancel() {
    this.trigger('cancel');
  },
  onSubmit() {
    this.setState({ isSaving: true });

    const applyOwner = !!this.getState('applyOwner');
    if (applyOwner) {
      this.triggerMethod('applyOwner', this.getState('owner'));
    }

    this.triggerMethod('save', this.getState().getData());
  },
  onStop() {
    this.getRegion().empty();
  },
});
