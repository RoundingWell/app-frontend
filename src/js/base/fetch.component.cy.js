import Radio from 'backbone.radio';

import fetcher from './fetch';

function response(status) {
  return new Response('{}', {
    status,
    headers: {
      'Content-Type': 'application/vnd.api+json',
    },
  });
}

context('base fetch auth recovery', function() {
  afterEach(function() {
    Radio.reset();
  });

  specify('delegates 401 handling to auth and uses the retry response', function() {
    cy.window().then(win => {
      const fetchMock = cy.stub(win, 'fetch')
        .onFirstCall().resolves(response(401))
        .onSecondCall().resolves(response(200));
      const getToken = cy.stub()
        .onFirstCall().resolves('Bearer old-token')
        .onSecondCall().resolves('Bearer new-token');
      const handleUnauthorized = cy.stub().callsFake(retry => retry());

      Radio.reply('auth', {
        getToken,
        handleUnauthorized,
      });

      return fetcher('/api/test').then(result => {
        expect(result.status).to.equal(200);
        expect(fetchMock).to.have.been.calledTwice;
        expect(handleUnauthorized).to.have.been.calledOnce;
        expect(handleUnauthorized.getCall(0).args[0]).to.be.a('function');
      });
    });
  });

  specify('keeps the original 401 when auth returns no retry response', function() {
    cy.window().then(win => {
      const fetchMock = cy.stub(win, 'fetch').resolves(response(401));
      const handleUnauthorized = cy.stub();

      Radio.reply('auth', {
        getToken: cy.stub().resolves('Bearer token'),
        handleUnauthorized,
      });

      return fetcher('/api/test').then(result => {
        expect(result.status).to.equal(401);
        expect(fetchMock).to.have.been.calledOnce;
        expect(handleUnauthorized).to.have.been.calledOnce;
      });
    });
  });

  specify('cleans up retry fetchers after auth recovery', function() {
    cy.window().then(win => {
      const fetchMock = cy.stub(win, 'fetch')
        .onFirstCall().resolves(response(401))
        .onSecondCall().resolves(response(200))
        .onThirdCall().resolves(response(200));

      Radio.reply('auth', {
        getToken: cy.stub().resolves('Bearer token'),
        handleUnauthorized: cy.stub().callsFake(retry => retry()),
      });

      return fetcher('/api/test', { abort: false })
        .then(() => fetcher('/api/test', { abort: false }))
        .then(result => {
          expect(result.status).to.equal(200);
          expect(fetchMock).to.have.been.calledThrice;
        });
    });
  });

  specify('forwards caller cancellation through the base request controller', function() {
    cy.window().then(win => {
      const controller = new AbortController();
      let requestSignal;
      const fetchMock = cy.stub(win, 'fetch').callsFake((_url, options) => {
        requestSignal = options.signal;

        return new Cypress.Promise((resolve, reject) => {
          const abort = () => {
            const error = new Error('Request aborted');
            error.name = 'AbortError';
            reject(error);
          };

          if (requestSignal.aborted) {
            abort();
            return;
          }

          requestSignal.addEventListener('abort', abort, { once: true });
        });
      });

      Radio.reply('auth', 'getToken', cy.stub().resolves('Bearer token'));

      const request = fetcher('/api/test', { signal: controller.signal });
      controller.abort();

      return request.then(result => {
        expect(result).to.be.undefined;
        expect(fetchMock).to.have.been.calledOnce;
        expect(requestSignal).not.to.equal(controller.signal);
        expect(requestSignal.aborted).to.be.true;
      });
    });
  });

  specify('retains same-url cancellation for caller-controlled requests', function() {
    cy.window().then(win => {
      const controller = new AbortController();
      const fetchMock = cy.stub(win, 'fetch').callsFake((_url, options) => {
        if (options.signal.aborted) {
          const error = new Error('Request aborted');
          error.name = 'AbortError';
          return Cypress.Promise.reject(error);
        }

        return Cypress.Promise.resolve(response(200));
      });

      Radio.reply('auth', 'getToken', cy.stub().resolves('Bearer token'));

      const firstRequest = fetcher('/api/test', { signal: controller.signal });
      const secondRequest = fetcher('/api/test');

      return Promise.all([firstRequest, secondRequest])
        .then(([firstResponse, secondResponse]) => {
          expect(firstResponse).to.be.undefined;
          expect(secondResponse.status).to.equal(200);
          expect(controller.signal.aborted).to.be.false;
          expect(fetchMock).to.have.been.calledTwice;
        });
    });
  });

  specify('does not automatically cancel write requests', function() {
    cy.window().then(win => {
      const fetchMock = cy.stub(win, 'fetch').callsFake((_url, options) => {
        if (options.signal.aborted) {
          const error = new Error('Request aborted');
          error.name = 'AbortError';
          return Cypress.Promise.reject(error);
        }

        return Cypress.Promise.resolve(response(200));
      });

      Radio.reply('auth', 'getToken', cy.stub().resolves('Bearer token'));

      const writeRequest = fetcher('/api/test', { method: 'POST' });
      const readRequest = fetcher('/api/test');

      return Promise.all([writeRequest, readRequest])
        .then(([writeResponse, readResponse]) => {
          expect(writeResponse.status).to.equal(200);
          expect(readResponse.status).to.equal(200);
          expect(fetchMock).to.have.been.calledTwice;
        });
    });
  });

  specify('builds lowercase GET requests as reads', function() {
    cy.window().then(win => {
      const fetchMock = cy.stub(win, 'fetch').resolves(response(200));

      Radio.reply('auth', 'getToken', cy.stub().resolves('Bearer token'));

      return fetcher('/api/test', {
        method: 'get',
        data: { filter: 'active' },
      }).then(fetchResponse => {
        expect(fetchResponse.status).to.equal(200);
        expect(fetchMock).to.have.been.calledOnce;
        expect(fetchMock.firstCall.args[0]).to.equal('/api/test?filter=active');
        expect(fetchMock.firstCall.args[1]).not.to.have.property('body');
      });
    });
  });

  specify('does not let stale cleanup evict a replacement request', function() {
    cy.window().then(win => {
      let firstStarted;
      let secondStarted;
      let resolveSecond;
      const firstStartedPromise = new Cypress.Promise(resolve => {
        firstStarted = resolve;
      });
      const secondStartedPromise = new Cypress.Promise(resolve => {
        secondStarted = resolve;
      });
      const fetchMock = cy.stub(win, 'fetch')
        .onFirstCall().callsFake((_url, options) => {
          firstStarted();

          return new Cypress.Promise((resolve, reject) => {
            const error = new Error('Request aborted');
            error.name = 'AbortError';
            options.signal.addEventListener('abort', () => reject(error), { once: true });
          });
        })
        .onSecondCall().callsFake(() => {
          secondStarted();

          return new Cypress.Promise(resolve => {
            resolveSecond = resolve;
          });
        })
        .onThirdCall().resolves(response(200));

      Radio.reply('auth', 'getToken', cy.stub().resolves('Bearer token'));

      const firstRequest = fetcher('/api/test');

      return firstStartedPromise
        .then(() => {
          const secondRequest = fetcher('/api/test');

          return secondStartedPromise
            .then(() => firstRequest)
            .then(() => {
              const sharedRequest = fetcher('/api/test', { abort: false });
              resolveSecond(response(200));

              return Promise.all([secondRequest, sharedRequest]);
            });
        })
        .then(([secondResponse, sharedResponse]) => {
          expect(secondResponse).to.equal(sharedResponse);
          expect(fetchMock).to.have.been.calledTwice;
        });
    });
  });
});
