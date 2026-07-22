import Backbone from 'backbone';
import { version } from 'uuid';

import './uuid';

context('base UUID generation', function() {
  specify('generates UUIDv7 IDs for created resources', function() {
    const sync = cy.stub(Backbone, 'sync');

    const model = new Backbone.Model();
    const options = {
      data: JSON.stringify({ data: { type: 'tests' } }),
    };

    model.sync('create', model, options);

    const [, , syncOptions] = sync.firstCall.args;
    const { id } = JSON.parse(syncOptions.data).data;

    expect(version(id)).to.equal(7);
    expect(Backbone.sync).to.have.been.calledOnce;
  });

  specify('preserves model-specific deterministic IDs', function() {
    const sync = cy.stub(Backbone, 'sync');

    const Model = Backbone.Model.extend({
      createId() {
        return 'deterministic-id';
      },
    });
    const model = new Model();
    const options = {
      data: JSON.stringify({ data: { type: 'tests' } }),
    };

    model.sync('create', model, options);

    const [, , syncOptions] = sync.firstCall.args;

    expect(JSON.parse(syncOptions.data).data.id).to.equal('deterministic-id');
  });
});
