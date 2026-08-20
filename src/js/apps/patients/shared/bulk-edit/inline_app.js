import Radio from 'backbone.radio';

import App from 'js/base/app';

export default App.extend({
  onStart({ presentation = 'inline' } = {}) {
    this._isStoppingBulkEdit = false;
    this.presentation = presentation;
    const ViewClass = presentation === 'modal' ? this.ModalViewClass : this.ViewClass;
    const view = new ViewClass({
      model: this.getState(),
      collection: this.getState('collection'),
    });

    this.bulkEditView = view;

    this.listenTo(view, {
      'cancel': this.onClickCancel,
      'destroy': this.onViewDestroy,
      'save': this.onSubmit,
    });

    if (presentation === 'modal') {
      Radio.request('modal', 'show:custom', view);
      return;
    }

    this.showView(view);
  },
  getPresentation() {
    return this.presentation;
  },
  updateCollection(collection) {
    this.getState().updateCollection(collection);
    this.bulkEditView.collection = collection;
    this.bulkEditView.render();
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
  onViewDestroy() {
    if (this.presentation === 'modal' && !this._isStoppingBulkEdit) this.trigger('cancel');
  },
  onStop() {
    this._isStoppingBulkEdit = true;

    if (this.presentation === 'modal') {
      if (!this.bulkEditView.isDestroyed()) this.bulkEditView.destroy();
    } else {
      this.getRegion().empty();
    }

    this.bulkEditView = null;
  },
});
