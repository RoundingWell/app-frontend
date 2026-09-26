import Backbone from 'backbone';

import Collection from './collection';

context('Collection batch ownership', function() {
  specify('finishes the original targets after selection cleanup without subscribing temporary batches', async function() {
    let finishFirst;
    const pending = new Promise(resolve => {
      finishFirst = resolve;
    });
    const write = cy.stub();
    write.onFirstCall().returns(pending);
    const Model = Backbone.Model.extend({ saveAll: write });
    const models = [1, 2, 3].map(id => new Model({ id }));
    const selected = new Collection(models);
    const save = selected.batchInvoke('saveAll', 20, { name: 'Saved' });
    expect(write.callCount).to.equal(2);
    selected.reset();
    finishFirst();
    await save;
    expect(write.callCount).to.equal(3);
    expect(write.thirdCall.thisValue).to.equal(models[2]);
  });
});
