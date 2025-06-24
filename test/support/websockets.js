import { Server, WebSocket as MockedWebSocket } from 'mock-socket';

let socketReady;
let mockServer;

const getServer = (url, messageHandler) => {
  return new Cypress.Promise(resolve => {
    if (mockServer) {
      mockServer.close();
    }

    mockServer = new Server(url, { mock: true });

    mockServer.on('connection', socket => {
      socket.on('message', message => {
        messageHandler(JSON.parse(message));
      });
    });

    resolve();
  });
};

Cypress.Commands.add('mockWs', url => {
  cy.log('ws: Mocking WebSocket');

  cy.on('window:before:load', win => {
    win.WebSocket = MockedWebSocket;
  });

  const messageHandler = cy.stub().as('wsHandleMessage');

  socketReady = getServer(url, messageHandler);

  cy.on('test:after:run', () => {
    cy.log('ws: Stopping Mock Server');
    mockServer.close();
  });
});

Cypress.Commands.add('sendWs', message => {
  cy.wrap(socketReady).then(() => {
    message = JSON.stringify(message);
    cy.log('ws: Sending message', message);
    mockServer.emit('message', message);
  });
});

Cypress.Commands.add('errorWs', () => {
  cy.wrap(socketReady).then(() => {
    cy.log('ws: Sending error');
    mockServer.simulate('error');
  });
});
