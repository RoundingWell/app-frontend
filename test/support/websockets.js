import { Server, WebSocket as MockedWebSocket } from 'mock-socket';

let mockServer;

function stopMockServer() {
  const server = mockServer;
  mockServer = undefined;

  if (!server) return;

  try {
    server.close();
  } finally {
    server.stop();
  }
}

/* eslint-disable-next-line mocha/no-top-level-hooks */
afterEach(stopMockServer);

Cypress.Commands.add('mockWs', url => {
  cy.log('ws: Mocking WebSocket');

  cy.on('window:before:load', win => {
    win.WebSocket = MockedWebSocket;
  });

  const messageHandler = cy.stub().as('wsHandleMessage');

  return cy.then(() => {
    stopMockServer();
    mockServer = new Server(url, { mock: true });

    mockServer.on('connection', socket => {
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
