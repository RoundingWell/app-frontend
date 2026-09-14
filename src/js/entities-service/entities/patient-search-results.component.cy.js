import { Collection } from './patient-search-results';

context('Patient search results', function() {
  specify('keeps searching until the latest request completes', function() {
    const collection = new Collection();
    const searchComplete = cy.spy();
    let finishFirst;
    let finishLatest;

    const firstRequest = new Promise(resolve => {
      finishFirst = resolve;
    });
    const latestRequest = new Promise(resolve => {
      finishLatest = resolve;
    });

    collection.on('search', searchComplete);
    const fetch = cy.stub(collection, 'fetch');
    fetch.onFirstCall().returns(firstRequest);
    fetch.onSecondCall().returns(latestRequest);

    cy.then(() => collection.search('first'));
    cy.wrap(fetch).should('have.been.calledOnce');
    cy.then(() => collection.search('latest'));
    cy.wrap(fetch).should('have.been.calledTwice');

    cy.then(() => {
      expect(fetch).to.be.calledTwice;
      expect(fetch.firstCall.args[0].signal.aborted).to.be.true;
      finishFirst();

      return firstRequest;
    });

    cy.then(() => {
      expect(collection.isSearching).to.be.true;
      expect(searchComplete).not.to.be.called;
      finishLatest();

      return latestRequest;
    });

    cy.then(() => {
      expect(collection.isSearching).to.be.false;
      expect(searchComplete).to.be.calledOnceWithExactly(collection);
    });
  });
});
