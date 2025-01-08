import Backbone from 'backbone';
import Radio from 'backbone.radio';

import WSService from './ws';

let service;
const clientKey = 'clientKey';
const workspace = 'workspaceId';

Cypress.Commands.add('startService', () => {
  const startSpy = cy.spy().as('startService');

  service.on('start', startSpy);

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
    service.start();

    cy
      .interceptWs('SendTest').as('sendTest');

    service.on('start', () => {
      const channel = Radio.channel('ws');

      service.ws.readyState = WebSocket.CONNECTING;
      channel.request('send', { name: 'SendTest', data: 'NOTCONNECTED' });
    });

    cy
      .get('@sendTest')
      .should('equal', 'NOTCONNECTED');
  });

  specify('Connecting the websocket', function() {
    const channel = Radio.channel('ws');

    cy
      .startService()
      .interceptWs('SendTest', () => {
        channel.request('send', { name: 'SendTest', data: 'CONNECTING' });
      })
      .should('equal', 'CONNECTING')
      .then(() => {
        expect(service.isRunning()).to.be.true;
      });

    cy
      .interceptWs('SendTest', () => {
        channel.request('send', { name: 'SendTest', data: 'OPEN' });
      })
      .should('equal', 'OPEN');
  });

  specify('Restarting a closed socket', function() {
    const channel = Radio.channel('ws');

    const closedTest = { id: 'foo', type: 'bar' };
    const addTest = { id: 'foo2', type: 'bar2' };

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
      })
      .then(() => {
        channel.request('add', addTest);
        service.ws.close();
      });

    cy
      .get('@startService')
      .should('be.calledThrice')
      .then(spy => {
        const thirdCall = spy.getCall(2);
        notification.data.data.resources.push(addTest);
        expect(thirdCall.args[0]).to.deep.equal(notification);
      });
  });

  specify('Message handling', function() {
    const channel = Radio.channel('ws');

    const handler = cy.stub();

    cy
      .startService()
      .then(() => {
        service.listenTo(channel, 'message', handler);

        channel.request('subscribe', {});
      });

    cy
      .sendWs({ id: 'foo', category: 'Test' })
      .then(() => {
        expect(handler).to.be.calledWith({ id: 'foo', category: 'Test' });
      });
  });

  specify('Heartbeat', function() {
    service.HEART_BEAT_INTERVAL = 10;

    cy
      .startService()
      .wait(10);

    cy
      .interceptWs('ping')
      .sendWs({ name: 'pong' });
  });

  specify('Subscribing', function() {
    const notifications = [
      { id: 'foo', type: 'bar' },
      { id: 'foo2', type: 'bar2' },
      { id: 'foo3', type: 'bar3' },
      { id: 'foo4', type: 'bar4' },
    ];

    const channel = Radio.channel('ws');

    cy
      .startService()
      .interceptWs('Subscribe', () => {
        const TestModel = Backbone.Model.extend({ type: 'bar' });

        channel.request('subscribe', new TestModel({ id: 'foo', foo: true }));
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[0]] });

    cy
      .interceptWs('Subscribe', () => {
        channel.request('add', notifications[1], { shouldPersist: true });
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[0], notifications[1]] });

    cy
      .interceptWs('Subscribe', () => {
        channel.request('subscribe', notifications[2]);
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[2], notifications[1]] });

    cy
      .interceptWs('Subscribe', () => {
        channel.request('unsubscribe', notifications[1]);
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[2]] });

    cy
      .interceptWs('Subscribe', () => {
        channel.request('subscribe', [notifications[3]], { shouldPersist: true });
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[3]] });

    cy
      .interceptWs('Subscribe', () => {
        channel.request('add', [notifications[0], notifications[1]]);
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[3], notifications[0], notifications[1]] });

    cy
      .interceptWs('Subscribe', () => {
        channel.request('unsubscribe', [notifications[3]]);
      })
      .should('deep.equal', { clientKey, workspace, resources: [notifications[0], notifications[1]] });
  });
});
