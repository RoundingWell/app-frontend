import { Radio } from 'marionette';

import router from 'js/router';

import LatestListService from './latest-list';

function route(name, params, meta, { query = new URLSearchParams() } = {}) {
  router.trigger('route', { name, params, query, meta });
}

context('LatestListService', function() {
  let service;

  beforeEach(function() {
    service = new LatestListService();
  });

  afterEach(function() {
    service.destroy();
    Radio.reset();
  });

  specify('records list routes from route metadata', function() {
    expect(Radio.request('history', 'has:latestList')).to.be.false;

    route('worklist', { workspace: 'one', worklistId: 'owned-by' }, { isList: true });

    expect(Radio.request('history', 'has:latestList')).to.be.true;
  });

  specify('leaves the latest list unchanged for plain routes', function() {
    const navigate = cy.stub().resolves(true);
    Radio.reply('router', 'navigate', navigate);

    route('worklist', { workspace: 'one', worklistId: 'owned-by' }, { isList: true });
    route('patient:workflow', { workspace: 'one', patientId: '1' }, {});

    Radio.request('history', 'go:latestList');

    expect(navigate).to.have.been.calledOnceWith('worklist', { worklistId: 'owned-by' }, { query: new URLSearchParams() });
  });

  specify('routes back to the latest list by name with its query', function() {
    const navigate = cy.stub().resolves(true);
    const query = new URLSearchParams({ clinicianId: 'c1' });
    Radio.reply('router', 'navigate', navigate);

    route('worklist', { workspace: 'one', worklistId: 'owned-by' }, { isList: true }, { query });

    Radio.request('history', 'go:latestList');

    expect(navigate).to.have.been.calledOnceWith('worklist', { worklistId: 'owned-by' }, { query });
  });
});
