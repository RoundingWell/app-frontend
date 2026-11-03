import Store from 'backbone.store';
import { Radio } from 'marionette';

import BaseCollection from './collection';
import BaseModel from './model';
import './backbone-fetch';

const TYPE = 'cancelled-body-test-models';

context('Backbone fetch cancellation', function() {
  let requests;
  let releaseBody;

  beforeEach(function() {
    requests = [];
    releaseBody = undefined;
  });

  afterEach(function() {
    if (releaseBody) releaseBody();
    return Cypress.Promise.all(requests).finally(() => {
      Store.remove(TYPE);
      Radio.reset();
    });
  });

  specify('does not overwrite the Store when a cancelled response body finishes late', function() {
    cy.window().then(win => {
      const Model = Store(BaseModel.extend({ type: TYPE }), TYPE);
      const Collection = BaseCollection.extend({ model: Model });
      const model = new Model({ id: 'row', name: 'Initial value' });
      const oldWindow = new Collection([model]);
      const currentWindow = new Collection([model]);
      const controller = new AbortController();
      const resource = name => ({ data: [{ type: TYPE, id: model.id, attributes: { name } }] });
      let started;
      const bodyStarted = new Cypress.Promise(resolve => {
        started = resolve;
      });
      const stream = new ReadableStream({
        start(body) {
          let released = false;
          releaseBody = () => {
            if (released) return;
            released = true;
            body.enqueue(new TextEncoder().encode(JSON.stringify(resource('Stale value'))));
            body.close();
          };
        },
      });
      const oldResponse = new Response(stream, { headers: { 'Content-Type': 'application/vnd.api+json' } });
      const clone = oldResponse.clone.bind(oldResponse);
      cy.stub(oldResponse, 'clone').callsFake(() => {
        started();
        return clone();
      });
      cy.stub(win, 'fetch')
        .onFirstCall().resolves(oldResponse)
        .onSecondCall().resolves(new Response(JSON.stringify(resource('Current value')), {
          headers: { 'Content-Type': 'application/vnd.api+json' },
        }));
      Radio.reply('auth', 'getToken', () => undefined);

      const oldRequest = oldWindow.fetch({ url: '/api/cancelled-body-test', signal: controller.signal });
      requests.push(oldRequest);

      return bodyStarted.then(() => {
        controller.abort();
        const currentRequest = currentWindow.fetch({ url: '/api/cancelled-body-test' });
        requests.push(currentRequest);
        return currentRequest;
      }).then(() => {
        expect(currentWindow.get(model.id)).to.equal(model);
        expect(model.get('name')).to.equal('Current value');
        releaseBody();
        return oldRequest;
      }).then(() => {
        expect(Store.find(TYPE, model.id)).to.equal(model);
        expect(model.get('name')).to.equal('Current value');
      });
    });
  });
});
