import Radio from 'backbone.radio';

import LatestListService from './latest-list';

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
    Radio.request('history', 'apply:route', {
      event: 'worklist',
      eventArgs: ['owned-by'],
      definition: {
        meta: { isList: true },
      },
    });

    expect(service._latestList).to.equal('worklist');
    expect(service._latestListArgs).to.deep.equal(['owned-by']);
  });

  specify('clears the latest list when requested by route metadata', function() {
    service.setLatestList('worklist', ['owned-by']);

    Radio.request('history', 'apply:route', {
      event: 'schedule',
      eventArgs: [],
      definition: {
        meta: { clearLatestList: true },
      },
    });

    expect(service.hasLatestList()).to.equal(false);
  });

  specify('leaves the latest list unchanged for plain routes', function() {
    service.setLatestList('worklist', ['owned-by']);

    Radio.request('history', 'apply:route', {
      event: 'patient:dashboard',
      eventArgs: ['patient-id'],
      definition: {
        meta: {},
      },
    });

    expect(service._latestList).to.equal('worklist');
    expect(service._latestListArgs).to.deep.equal(['owned-by']);
  });
});
