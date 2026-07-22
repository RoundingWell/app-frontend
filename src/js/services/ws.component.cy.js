import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { version } from 'uuid';

import 'js/entities-service/entities/flows';

import WSService from './ws';

let service;
const clientKey = 'clientKey';
const workspace = 'workspaceId';
const endpoint = 'ws://cypress-websocket/ws';

function getWsResponse(token, options = {}) {
  return {
    statusCode: 200,
    body: {
      data: {
        is_enabled: true,
        endpoint,
        authentication: {
          type: 'connect-token',
          token,
          query_parameter: 'connect_token',
          expires_in: 60,
        },
        ...options,
      },
    },
  };
}

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
    Radio.reply('auth', 'getToken', () => 'Bearer token');

    let tokenId = 0;

    cy
      .intercept('GET', '/api/websockets', req => {
        tokenId += 1;
        req.reply(getWsResponse(`connect-token-${ tokenId }`));
      })
      .as('websocketsApi');

    cy.mockWs(endpoint);
    service = new WSService();
  });

  afterEach(function() {
    service.destroy();
    Radio.stopReplying('auth', 'getToken');
    Radio.stopReplying('bootstrap', 'currentUser');
    Radio.stopReplying('workspace', 'current');
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
        expect(secondCall.args[0]).to.deep.equal({
          state: {},
          data: {
            name: 'Subscribe',
            data: {
              clientKey,
              workspace,
              resources: [closedTest],
              subscriptionVersion: service.subscriptionVersion,
            },
          },
        });
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
      .then(() =>
        cy.sendWs({
          category: 'Test',
          resource: { id: 'id', type: 'flows' },
          subscription_version: service.subscriptionVersion,
        }),
      )
      .then(() => {
        expect(handler).to.be.calledOnce;
        const callArgs = handler.getCall(0).args;
        expect(callArgs[0].category).to.equal('Test');
        expect(callArgs[1].type).to.equal('flows');
        expect(handler2).to.be.calledOnce;
      });

    // subscription_version intentionally left undefined to test that message is still handled
    cy
      .then(() => {
        handler.reset();
        handler2.reset();

        cy.sendWs({ category: 'Test' });
      })
      .then(() => {
        expect(handler).to.be.calledOnce;
        expect(handler2).to.not.be.called;
      });

    // should not handle this message because subscription_version doesn't match
    cy
      .then(() => {
        handler.reset();
        handler2.reset();

        cy.sendWs({
          category: 'Test',
          subscription_version: 'stale-version',
        });
      })
      .then(() => {
        expect(handler).to.not.be.called;
        expect(handler2).to.not.be.called;
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

  specify('Clearing timers on stop', function() {
    const channel = Radio.channel('ws');
    const resource = { id: 'foo', type: 'bar' };

    cy
      .startService()
      .then(() => {
        service.HEART_BEAT_INTERVAL = 10;
        cy.spy(service, 'sendData').as('sendData');
      });

    cy.clock();
    cy
      .then(() => {
        channel.request('subscribe', resource);
      })
      .get('@sendData')
      .should('be.calledOnce')
      .then(() => {
        service.stop();
        service.sendData.resetHistory();
      });

    cy
      .tick(10)
      .get('@sendData')
      .should('not.be.called');
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
          subscriptionVersion: Cypress.sinon.match.string,
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
        expect(version(service.subscriptionVersion)).to.equal(7);
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

  specify('Subscribing with filters and no resources', function() {
    const channel = Radio.channel('ws');
    const filters = {
      category: 'Action',
      status: ['active'],
    };

    channel.request('subscribe', [], { filters });

    cy
      .get('@wsHandleMessage')
      .should('be.calledWith', {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources: [],
          subscriptionVersion: Cypress.sinon.match.string,
          filters,
        },
      });
  });

  specify('Resubscribing filter-only subscriptions after socket close', function() {
    const channel = Radio.channel('ws');
    const filters = {
      category: 'Flow',
      status: ['active'],
    };
    let subscriptionVersion;

    cy
      .startService()
      .then(() => {
        service.RECONNECT_BASE_DELAY = 1000;
        cy.stub(Math, 'random').returns(0);
        channel.request('subscribe', [], { filters });
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources: [],
          subscriptionVersion: Cypress.sinon.match.string,
          filters,
        },
      })
      .then(() => {
        subscriptionVersion = service.subscriptionVersion;
      });

    cy.clock();
    cy.then(() => {
      service.ws.readyState = WebSocket.CLOSED;
      service.onClose();
    });

    cy
      .get('@startService')
      .should('be.calledOnce')
      .tick(999)
      .get('@startService')
      .should('be.calledOnce')
      .tick(1);

    cy
      .get('@startService')
      .should('be.calledTwice')
      .then(spy => {
        const secondCall = spy.getCall(1);

        expect(secondCall.args[0]).to.deep.equal({
          state: {},
          data: {
            name: 'Subscribe',
            data: {
              clientKey,
              workspace,
              resources: [],
              subscriptionVersion: service.subscriptionVersion,
              filters,
            },
          },
        });
        expect(service.subscriptionVersion).to.not.equal(subscriptionVersion);
      });
  });

  specify('Skipping reconnect without active subscriptions', function() {
    const channel = Radio.channel('ws');

    cy
      .startService()
      .then(() => {
        service.RECONNECT_BASE_DELAY = 1000;
        channel.request('subscribe', []);
      });

    cy.clock();
    cy
      .then(() => {
        service.ws.readyState = WebSocket.CLOSED;
        service.onClose();
        // No subscription, so no reconnect was scheduled.
        expect(service.reconnect).to.be.undefined;
      })
      .tick(1000)
      .get('@startService')
      .should('be.calledOnce');
  });

  specify('Skipping scheduled resubscribe after subscriptions clear', function() {
    cy
      .startService()
      .then(() => {
        service.RECONNECT_BASE_DELAY = 1000;
        cy.stub(Math, 'random').returns(0);
        cy.spy(service, '_subscribe').as('_subscribe');
      });

    cy.clock();
    cy.then(() => {
      // Schedule a reconnect with no resources, so the timer is a no-op.
      service.startReconnect();
    });

    cy
      .tick(1000)
      .get('@_subscribe')
      .should('not.be.called')
      .then(() => {
        expect(service.reconnect).to.be.null;
      });
  });

  specify('Applying reconnect backoff and jitter', function() {
    service.RECONNECT_BASE_DELAY = 1000;
    service.RECONNECT_MAX_DELAY = 3000;

    // Jitter spans [0, RECONNECT_BASE_DELAY); 0.5 => +500.
    cy
      .stub(Math, 'random')
      .returns(0.5);

    service.reconnectAttempts = 0;
    expect(service._getReconnectDelay()).to.equal(1500);

    service.reconnectAttempts = 1;
    expect(service._getReconnectDelay()).to.equal(2500);

    // Backoff is capped at RECONNECT_MAX_DELAY.
    service.reconnectAttempts = 2;
    expect(service._getReconnectDelay()).to.equal(3500);

    service.reconnectAttempts = 8;
    expect(service._getReconnectDelay()).to.equal(3500);
  });

  specify('Resetting backoff and clearing a pending reconnect when the socket opens', function() {
    cy
      .startService()
      .then(() => {
        service.RECONNECT_BASE_DELAY = 1000;
        service.reconnectAttempts = 3;
        cy.spy(service, '_subscribe').as('_subscribe');
      });

    cy.clock();
    cy.then(() => {
      service.startReconnect();
      expect(service.reconnect).to.not.be.null;

      // A successful (re)open resets backoff and cancels the pending reconnect.
      service.onOpen();
      expect(service.reconnectAttempts).to.equal(0);
      expect(service.reconnect).to.be.null;
    });

    cy
      .tick(1000)
      .get('@_subscribe')
      .should('not.be.called');
  });

  specify('Ignoring empty filters without subscribed resources', function() {
    const channel = Radio.channel('ws');

    cy
      .startService()
      .then(() => {
        channel.request('subscribe', [], { filters: {} });
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources: [],
          subscriptionVersion: Cypress.sinon.match.string,
        },
      })
      .then(() => {
        service.ws.close();
      });

    cy
      .get('@startService')
      .should('be.calledOnce');
  });

  specify('Clearing filters before reconnecting resource subscriptions', function() {
    const channel = Radio.channel('ws');
    const resource = { id: 'foo', type: 'bar' };

    cy
      .startService()
      .then(() => {
        channel.request('subscribe', [], {
          filters: {
            category: 'Action',
          },
        });
      })
      .get('@wsHandleMessage')
      .should('be.calledWith', {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources: [],
          subscriptionVersion: Cypress.sinon.match.string,
          filters: {
            category: 'Action',
          },
        },
      })
      .then(() => {
        channel.request('subscribe', resource);
      })
      .get('@wsHandleMessage')
      .should('have.been.calledTwice')
      .then(spy => {
        expect(spy.lastCall.args[0]).to.deep.equal({
          name: 'Subscribe',
          data: {
            clientKey,
            workspace,
            resources: [resource],
            subscriptionVersion: service.subscriptionVersion,
          },
        });
      })
      .then(() => {
        service.ws.close();
      });

    cy
      .get('@startService')
      .should('be.calledTwice')
      .then(spy => {
        const call = spy.getCall(1);

        expect(call.args[0]).to.deep.equal({
          state: {},
          data: {
            name: 'Subscribe',
            data: {
              clientKey,
              workspace,
              resources: [resource],
              subscriptionVersion: service.subscriptionVersion,
            },
          },
        });
      });
  });

  specify('websocket config request includes normal auth', function() {
    cy.startService();

    cy
      .wait('@websocketsApi')
      .then(({ request }) => {
        expect(request.headers.authorization).to.equal('Bearer token');
        expect(request.headers.workspace).to.equal(workspace);
        expect(request.headers['client-key']).to.equal(clientKey);
      });
  });

  specify('connect token added to websocket URL', function() {
    cy
      .startService()
      .then(() => {
        const url = new URL(service.ws.url);

        expect(url.searchParams.get('connect_token')).to.equal('connect-token-1');
        expect(url.toString()).to.not.include('Bearer');
      });
  });

  specify('reconnecting fetches a fresh connect token', function() {
    const channel = Radio.channel('ws');

    cy
      .startService()
      .then(() => {
        channel.request('subscribe', { id: 'foo', type: 'bar' });
        service.ws.close();
      });

    cy
      .get('@startService')
      .should('be.calledTwice')
      .then(() => {
        const url = new URL(service.ws.url);

        expect(url.searchParams.get('connect_token')).to.equal('connect-token-2');
      });

    cy
      .get('@websocketsApi.all')
      .should('have.length', 2);
  });

  specify('websocket auth does not use Sec-WebSocket-Protocol', function() {
    cy
      .startService()
      .then(() => {
        expect(service.ws.protocol).to.equal('');
      });
  });
});

/* eslint-disable-next-line */
context('WS Service - Disabled', function() {
  beforeEach(function() {
    Radio.reply('bootstrap', 'currentUser', { clientKey });
    Radio.reply('workspace', 'current', { id: workspace });
    Radio.reply('auth', 'getToken', () => 'Bearer token');

    cy
      .intercept('GET', '/api/websockets', {
        statusCode: 200,
        body: {
          data: {
            is_enabled: false,
            endpoint,
          },
        },
      })
      .as('websocketsApiDisabled');
  });

  afterEach(function() {
    Radio.stopReplying('auth', 'getToken');
    Radio.stopReplying('bootstrap', 'currentUser');
    Radio.stopReplying('workspace', 'current');
  });

  specify('ws not enabled', function() {
    const disabledService = new WSService();

    disabledService.start();

    cy.wait('@websocketsApiDisabled');

    const channel = Radio.channel('ws');

    channel.request('subscribe', { id: 'foo', type: 'bar' });

    expect(disabledService.isRunning()).to.be.false;
  });
});
