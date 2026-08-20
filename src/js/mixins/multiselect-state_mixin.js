import { clone, keys, reduce } from 'underscore';

import Radio from 'backbone.radio';

// Note: Requires a `getType` method to be defined on the model returning the entity name

export default {
  enterSelectionMode() {
    this.set('isSelectionMode', true);
  },
  exitSelectionMode() {
    this.clearSelected();
    this.set('isSelectionMode', false);
  },
  setSelectedList(list, lastSelectedIndex) {
    return this.set({
      [`${ this.getType() }Selected`]: list,
      lastSelectedIndex,
    });
  },
  getSelectedList() {
    return clone(this.get(`${ this.getType() }Selected`));
  },
  isSelected(model) {
    const selectedList = this.getSelectedList();

    return !!selectedList[model.id];
  },
  getSelected(collection) {
    const selectedList = this.getSelectedList();

    const collectionSelected = reduce(keys(selectedList), (selected, id) => {
      if (selectedList[id] && collection.get(id)) {
        selected.push({ id });
      }

      return selected;
    }, []);

    return Radio.request('entities', `${ this.getType() }:collection`, collectionSelected);
  },
  clearSelected() {
    this.setSelectedList({}, null);
  },
  selectRange(collection, selectedModel, shouldSelectMultiple) {
    const isSelected = this.isSelected(selectedModel);
    const selectedIndex = collection.findIndex(selectedModel);
    const lastSelectedIndex = this.get('lastSelectedIndex');

    if (!shouldSelectMultiple || lastSelectedIndex === null || isSelected) {
      this.selectOne(selectedModel.id, !isSelected, selectedIndex);
      return;
    }

    const minIndex = Math.min(selectedIndex, lastSelectedIndex);
    const maxIndex = Math.max(selectedIndex, lastSelectedIndex);

    const selectedIds = collection.map('id').slice(minIndex, maxIndex + 1);

    this.selectMultiple(selectedIds, selectedIndex);
  },
  selectOne(selectedId, isSelected, selectedIndex) {
    const selectedList = this.getSelectedList();

    selectedList[selectedId] = isSelected;

    this.setSelectedList(selectedList, isSelected ? selectedIndex : null);
  },
  selectMultiple(selectedIds, newLastSelectedIndex = null) {
    const selectedList = this.getSelectedList();

    const newSelectedList = selectedIds.reduce((selected, id) => {
      selected[id] = true;
      return selected;
    }, selectedList);

    this.setSelectedList(newSelectedList, newLastSelectedIndex);
  },
};
