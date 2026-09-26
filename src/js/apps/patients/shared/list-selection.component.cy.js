import Backbone from 'backbone';

import ListSelection from './list-selection';

const Action = Backbone.Model.extend({
  canEdit: () => true,
  isFlowDone: () => false,
});
const State = Backbone.Model.extend({
  getSelected(collection) {
    return new Backbone.Collection(collection.filter(model => this.get('actionsSelected')[model.id]));
  },
});

context('List selection ownership', function() {
  specify('releases every derived collection while other consumers keep receiving model changes', function() {
    const action = new Action({ id: 'a' });
    const collection = new Backbone.Collection([action]);
    const state = new State({ actionsSelected: { a: true } });
    const selection = new ListSelection({ state });
    const sourceChanged = cy.spy();
    collection.on('change', sourceChanged);
    selection.setCollection(collection);
    const obsolete = selection.selected;
    const obsoleteChanged = cy.spy();
    obsolete.on('change', obsoleteChanged);
    state.set('actionsSelected', { a: true, b: true });
    expect(selection.selected).to.equal(obsolete);
    state.set('actionsSelected', {});
    state.set('actionsSelected', { a: true });
    const currentChanged = cy.spy();
    const filteredChanged = cy.spy();
    const editableChanged = cy.spy();
    selection.selected.on('change', currentChanged);
    selection.filteredCollection.on('change', filteredChanged);
    selection.editableCollection.on('change', editableChanged);
    selection.destroy();
    action.set('name', 'Still observed');
    expect(sourceChanged).to.have.been.calledOnce;
    expect(obsoleteChanged).not.to.have.been.called;
    expect(currentChanged).not.to.have.been.called;
    expect(filteredChanged).not.to.have.been.called;
    expect(editableChanged).not.to.have.been.called;
    expect(collection.models).to.deep.equal([action]);
  });
});
