import { Server, WebSocket as MockedWebSocket } from 'mock-socket';
import { createTestScope } from '@mnjs/test';

let mockServer;
let scope = createTestScope();

/* eslint-disable-next-line mocha/no-top-level-hooks */
beforeEach(() => {
  scope = createTestScope();
});

/* eslint-disable-next-line mocha/no-top-level-hooks */
afterEach(() => scope.cleanup());

Cypress.Commands.add('mockWs', url => {
  cy.log('ws: Mocking WebSocket');

  cy.on('window:before:load', win => {
    win.WebSocket = MockedWebSocket;
  });

  const messageHandler = cy.stub().as('wsHandleMessage');

  return cy.then(async() => {
    await scope.cleanup();
    scope = createTestScope();
    const server = new Server(url, { mock: true });
    scope.defer(() => server.stop());
    scope.defer(() => server.close());
    mockServer = server;

    server.on('connection', socket => {
      socket.on('message', message => {
        messageHandler(JSON.parse(message));
      });
    });
  });
});

Cypress.Commands.add('sendWs', message => {
  cy.then(() => {
    message = JSON.stringify(message);
    cy.log('ws: Sending message', message);
    mockServer.emit('message', message);
  });
});

Cypress.Commands.add('errorWs', () => {
  cy.then(() => {
    cy.log('ws: Sending error');
    mockServer.simulate('error');
  });
});
