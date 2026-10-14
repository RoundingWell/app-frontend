import { Radio } from 'marionette';

import router from 'js/router';

import LatestListService from './latest-list';

function route(path, meta, info) {
  router.trigger('route', { url: new URL(path, window.location.origin), info, meta });
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

    route('/one/worklist/owned-by', { isList: true });

    expect(Radio.request('history', 'has:latestList')).to.be.true;
  });

  specify('leaves the latest list unchanged for plain routes', function() {
    const navigate = cy.stub().resolves(true);
    Radio.reply('router', 'navigate', navigate);

    route('/one/worklist/owned-by', { isList: true });
    route('/one/patient/1/workflow', {});

    Radio.request('history', 'go:latestList');

    expect(navigate).to.have.been.calledOnceWith(`${ window.location.origin }/one/worklist/owned-by`);
  });

  specify('routes back to the latest list with its info', function() {
    const navigate = cy.stub().resolves(true);
    const info = { args: [{ clinicianId: 'c1' }] };
    Radio.reply('router', 'navigate', navigate);

    route('/one/worklist/owned-by', { isList: true }, info);

    Radio.request('history', 'go:latestList');

    expect(navigate).to.have.been.calledOnceWith(`${ window.location.origin }/one/worklist/owned-by`, { info });
  });
});
