import { MnObject } from 'marionette';

// Derives selection and editable collections for one results run.
export default MnObject.extend({
  constructor: function({ state }) {
    MnObject.apply(this, arguments);
    this.state = state;
    this.listenTo(state, 'change:actionsSelected change:flowsSelected', this.updateSelection);
  },
  setCollection(collection, { isFlowList = false } = {}) {
    this.releaseCollections();
    this.collection = collection;
    this.isFlowList = isFlowList;
    this.filteredCollection = collection.clone();
    this.editableCollection = collection.clone();
    this.listenTo(this.filteredCollection, 'reset', this.notifyFilter);
    this.listenTo(this.editableCollection, 'reset', this.updateSelection);
    this.notifyFilter();
    this.updateSelection();
  },
  updateSelection() {
    if (!this.editableCollection) return;

    const selected = this.state.getSelected(this.editableCollection);
    const unchanged = this.selected?.length === selected.length
      && selected.every((model, index) => model === this.selected.at(index));
    if (unchanged) selected.reset();
    else {
      this.selected?.reset();
      this.selected = selected;
    }
    this.triggerMethod('change', this.selected);
  },
  filter(models) {
    this.filteredCollection.reset(models);
    this.updateEditableCollection();
  },
  updateEditableCollection() {
    this.editableCollection.reset(this.filteredCollection.filter(model => {
      return (this.isFlowList || !model.isFlowDone()) && model.canEdit();
    }));
  },
  onBeforeDestroy() {
    this.releaseCollections();
  },
  releaseCollections() {
    if (this.filteredCollection) this.stopListening(this.filteredCollection);
    if (this.editableCollection) this.stopListening(this.editableCollection);
    this.selected?.reset();
    this.selected = null;
    this.collection = null;
    this.filteredCollection?.reset();
    this.editableCollection?.reset();
    this.filteredCollection = null;
    this.editableCollection = null;
  },
  getControlState() {
    const editableCount = this.editableCollection?.length || 0;
    const selectedCount = this.selected?.length || 0;
    return {
      isDisabled: !editableCount,
      isSelectAll: !!editableCount && selectedCount === editableCount,
      isSelectNone: !selectedCount,
      itemType: this.state.getType() === 'flows' ? 'flows' : 'actions',
    };
  },
  toggleAll() {
    if (this.selected.length === this.editableCollection.length) {
      this.state.clearSelected();
      return;
    }

    this.state.selectMultiple(this.editableCollection.map('id'));
  },
  notifyFilter() {
    this.triggerMethod('filter', this.collection, this.filteredCollection);
  },
});
