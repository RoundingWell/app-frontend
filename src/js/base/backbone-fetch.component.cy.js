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

  specify('preserves queued websocket updates when a model request is aborted after headers', function() {
    cy.window().then(win => {
      const Model = Store(BaseModel.extend({
        type: TYPE,
        messages: {
          MetadataUpdated({ attributes }) {
            this.set(attributes);
          },
        },
      }), TYPE);
      const model = new Model({ id: 'row', name: 'Initial value' });
      const controller = new AbortController();
      const notification = {
        category: 'MetadataUpdated', resource: model.getResource(), author: { type: 'clinicians', id: 'sender' }, payload: { attributes: { name: 'Websocket value' } },
      };
      const trigger = cy.spy();
      Radio.reply('ws', 'trigger', trigger);
      Radio.reply('auth', 'getToken', () => undefined);
      let started;
      const bodyStarted = new Cypress.Promise(resolve => {
        started = resolve;
      });
      const response = new Response(new ReadableStream({
        start(body) {
          let released = false;
          releaseBody = () => {
            if (released) return;
            released = true;
            body.enqueue(new TextEncoder().encode(JSON.stringify({ data: {
              type: TYPE, id: model.id, attributes: { name: 'Stale value' },
            } })));
            body.close();
          };
        },
      }), { headers: { 'Content-Type': 'application/vnd.api+json' } });
      const clone = response.clone.bind(response);
      cy.stub(response, 'clone').callsFake(() => {
        started();
        return clone();
      });
      cy.stub(win, 'fetch').resolves(response);
      const request = model.fetch({ url: '/api/cancelled-body-model-test', signal: controller.signal });
      requests.push(request);

      return bodyStarted.then(() => {
        model.handleMessage(notification);
        expect(model.get('name')).to.equal('Initial value');
        expect(trigger).not.to.have.been.called;
        controller.abort();
        releaseBody();
        return request;
      }).then(() => {
        expect(model.get('name')).to.equal('Websocket value');
        expect(trigger).to.have.been.calledOnce;
        expect(trigger.lastCall.args[0]).to.deep.equal(notification);
        expect(trigger.lastCall.args[1]).to.equal(model);
        expect(model.isFetching()).to.equal(false);
      });
    });
  });

  specify('dispatches queued deletion after an older model fetch succeeds and the newer fetch fails', function() {
    cy.window().then(win => {
      const Model = Store(BaseModel.extend({
        type: TYPE,
        messages: {
          ResourceDeleted() {
            this.destroy({ isDeleted: true });
          },
        },
      }), TYPE);
      const model = new Model({ id: 'row', name: 'Initial value' });
      const releases = [];
      releaseBody = () => {
        for (const release of releases) release();
      };
      const pendingResponse = (name, status = 200) => {
        let started;
        const bodyStarted = new Cypress.Promise(resolve => {
          started = resolve;
        });
        const response = new Response(new ReadableStream({
          start(body) {
            let released = false;
            releases.push(() => {
              if (released) return;
              released = true;
              const data = { data: { type: TYPE, id: model.id, attributes: { name } } };
              body.enqueue(new TextEncoder().encode(JSON.stringify(data)));
              body.close();
            });
          },
        }), { status, headers: { 'Content-Type': 'application/vnd.api+json' } });
        const clone = response.clone.bind(response);
        cy.stub(response, 'clone').callsFake(() => {
          started();
          return clone();
        });
        return { response, bodyStarted };
      };
      const oldResponse = pendingResponse('Older response');
      const newerResponse = pendingResponse('Failed response', 422);
      const trigger = cy.spy();
      const destroyed = cy.spy();
      model.on('destroy', destroyed);
      Radio.reply('ws', 'trigger', trigger);
      Radio.reply('auth', 'getToken', () => undefined);
      cy.stub(win, 'fetch')
        .onFirstCall().resolves(oldResponse.response)
        .onSecondCall().resolves(newerResponse.response);
      const oldRequest = model.fetch({ url: '/api/overlapping-model-test', abort: false });
      requests.push(oldRequest);
      let newerRequest;

      return oldResponse.bodyStarted.then(() => {
        newerRequest = model.fetch({ url: '/api/overlapping-model-test', abort: false }).catch(error => {
          expect(error.response.status).to.equal(422);
        });
        requests.push(newerRequest);
        return newerResponse.bodyStarted;
      }).then(() => {
        model.handleMessage({ category: 'ResourceDeleted', resource: model.getResource() });
        releases[1]();
        return newerRequest;
      }).then(() => {
        expect(destroyed).not.to.have.been.called;
        expect(trigger).not.to.have.been.called;
        releases[0]();
        return oldRequest;
      }).then(() => {
        expect(destroyed, 'queued deletion applied after the older success').to.have.been.calledOnce;
        expect(trigger).to.have.been.calledOnce;
        expect(trigger.lastCall.args[0].category).to.equal('ResourceDeleted');
        expect(model.isFetching()).to.equal(false);
      });
    });
  });

  specify('keeps the Store current when a signal-less collection request is internally cancelled', function() {
    const resource = name => ({ data: [{ type: TYPE, id: 'row', attributes: { name } }] });
    let started;
    const firstStarted = new Cypress.Promise(resolve => {
      started = resolve;
    });
    const heldResponse = new Cypress.Promise(resolve => {
      releaseBody = resolve;
    });
    let reads = 0;

    cy
      .intercept('GET', '/api/internal-collection-cancellation', req => {
        if (++reads === 1) {
          const reply = heldResponse.then(() => req.reply({ body: resource('Stale value') }));
          requests.push(reply);
          started();
          return reply;
        }
        req.reply({ body: resource('Current value') });
      });

    cy.window().then(win => {
      const nativeFetch = cy.spy(win, 'fetch');
      const Model = Store(BaseModel.extend({ type: TYPE }), TYPE);
      const Collection = BaseCollection.extend({ model: Model });
      const model = new Model({ id: 'row', name: 'Initial value' });
      const oldWindow = new Collection([model]);
      const currentWindow = new Collection([model]);
      Radio.reply('auth', 'getToken', () => undefined);
      const oldRequest = oldWindow.fetch({ url: '/api/internal-collection-cancellation' });
      requests.push(oldRequest);

      return firstStarted.then(() => {
        const currentRequest = currentWindow.fetch({ url: '/api/internal-collection-cancellation' });
        requests.push(currentRequest);
        expect(nativeFetch.firstCall.args[1].signal.aborted, 'superseded native request cancelled').to.equal(true);
        releaseBody();
        return currentRequest;
      }).then(() => {
        expect(model.get('name')).to.equal('Current value');
        return oldRequest;
      }).then(() => {
        expect(Store.find(TYPE, model.id)).to.equal(model);
        expect(model.get('name')).to.equal('Current value');
      });
    });
  });
});
