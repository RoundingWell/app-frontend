import Backbone from 'backbone';
import Radio from 'backbone.radio';

import 'js/entities-service/entities/flows';

import WSService from './ws';

let service;
const clientKey = 'clientKey';
const workspace = 'workspaceId';

Cypress.Commands.add('startService', () => {
  const startStub = cy.stub().as('startService');

  service.on('start', startStub);

  // Return a promise that resolves when the service starts
  return new Cypress.Promise(resolve => {
    service.once('start', resolve);
    service.start();
  });
});

context('WS Service', function() {
  beforeEach(function() {
    Radio.reply('bootstrap', 'currentUser', { clientKey });
    Radio.reply('workspace', 'current', { id: workspace });
    Radio.reply('auth', 'getToken', () => 'token');
    const url = 'ws://cypress-websocket/ws';
    cy.mockWs(url);
    service = new WSService({ url });
  });

  afterEach(function() {
    service.destroy();
    Radio.stopReplying('auth', 'getToken');
    Radio.stopReplying('bootstrap', 'currentUser');
    Radio.stopReplying('workspace', 'current');
  });

  specify('ws url not configured', function() {
    service.destroy();

    service = new WSService({ url: null });
    const channel = Radio.channel('ws');

    channel.request('subscribe', { id: 'foo', type: 'bar' });

    expect(service.isRunning()).to.be.false;
  });

  specify('Constructing the websocket', function() {
    const testNotConnected = { name: 'SendTest', data: 'NOTCONNECTED' };

    service.start();

    service.on('start', () => {
      const channel = Radio.channel('ws');

      service.ws.readyState = WebSocket.CONNECTING;
      channel.request('send', testNotConnected);
    });

    cy
      .get('@wsHandleMessage')
      .should('be.calledWith', testNotConnected);
  });

  specify('Connecting the websocket', function() {
    const channel = Radio.channel('ws');
    const testConnecting = { name: 'SendTest', data: 'CONNECTING' };
    const testOpen = { name: 'SendTest', data: 'OPEN' };

    cy
      .wrap(service)
      .then(() => {
        expect(service.isRunning()).to.be.false;
        channel.request('send', testConnecting);
      });

    cy
      .get('@wsHandleMessage')
      .should('be.calledWith', testConnecting)
      .then(() => {
        expect(service.isRunning()).to.be.true;
        channel.request('send', testOpen);
      });

    cy
      .get('@wsHandleMessage')
      .should('be.calledWith', testOpen);
  });

  specify('Restarting a closed socket', function() {
    const channel = Radio.channel('ws');

    const closedTest = { id: 'foo', type: 'bar' };

    const notification = {
      state: {},
      data: {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources: [closedTest],
        },
      },
    };

    cy
      .startService()
      .then(() => {
        return new Cypress.Promise(resolve => {
          service.ws.addEventListener('close', () => {
            channel.request('subscribe', closedTest);
            resolve();
          });
          service.ws.close();
        });
      });

    cy
      .get('@startService')
      .should('be.calledTwice')
      .then(spy => {
        const secondCall = spy.getCall(1);
        expect(secondCall.args[0]).to.deep.equal(notification);
      });
  });

  specify('Message handling', function() {
    const channel = Radio.channel('ws');

    const handler = cy.stub();
    const handler2 = cy.stub();

    cy
      .startService()
      .then(() => {
        service.listenTo(channel, 'message', handler);
        service.listenTo(channel, 'message:flows', handler2);

        channel.request('subscribe', {});
      });

    cy
      .sendWs({ category: 'Test', resource: { id: 'id', type: 'flows' } })
      .then(() => {
        expect(handler).to.be.calledOnce;
        const callArgs = handler.getCall(0).args;
        expect(callArgs[0].category).to.equal('Test');
        expect(callArgs[1].type).to.equal('flows');
        expect(handler2).to.be.calledOnce;
      });

    cy
      .sendWs({ category: 'Test' })
      .then(() => {
        expect(handler).to.be.calledTwice;
        expect(handler2).to.be.calledOnce;
      });
  });

  specify('Heartbeat', function() {
    service.HEART_BEAT_INTERVAL = 10;

    cy
      .startService();

    cy
      .get('@wsHandleMessage')
      .should('be.calledWith', { name: 'ping' })
      .sendWs({ name: 'pong' });
  });

  specify('Subscribing', function() {
    const notifications = [
      { id: 'foo', type: 'bar' },
      { id: 'foo2', type: 'bar2' },
      { id: 'foo3', type: 'bar3' },
      { id: 'foo4', type: 'bar4' },
    ];

    function testData(resources) {
      return {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources,
        },
      };
    }

    const channel = Radio.channel('ws');

    const TestModel = Backbone.Model.extend({ type: 'bar' });

    channel.request('subscribe', new TestModel({ id: 'foo', foo: true }));

    cy
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[0]]))

      .then(() => {
        channel.request('add', notifications[1], { shouldPersist: true });
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[0], notifications[1]]))

      .then(() => {
        channel.request('subscribe', notifications[2]);
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[2], notifications[1]]))

      .then(() => {
        channel.request('unsubscribe', notifications[1]);
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[2]]))

      .then(() => {
        channel.request('subscribe', [notifications[3]], { shouldPersist: true });
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[3]]))

      .then(() => {
        channel.request('add', [notifications[0], notifications[1]]);
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[3], notifications[0], notifications[1]]))

      .then(() => {
        channel.request('unsubscribe', [notifications[3]]);
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', testData([notifications[0], notifications[1]]));
  });
});
