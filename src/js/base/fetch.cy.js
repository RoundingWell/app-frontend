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
});
