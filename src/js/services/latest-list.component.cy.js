import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import router from 'js/router';

import LatestListService from './latest-list';

context('LatestListService', function() {
  beforeEach(function() {
    testScope().own(new LatestListService());
  });

  specify('remembers the list and filter while keeping the destination workspace current', function() {
    const navigate = cy.stub().resolves(true);
    const query = new URLSearchParams({
      ct: 'cache-token',
    });
    const info = {
      worklist: {
        clinicianId: 'clinician-id',
      },
    };
    testScope().reply(Radio, 'router', 'navigate:event', navigate);

    expect(Radio.request('history', 'has:latestList')).to.equal(false);

    router.triggerMethod('route', {
      name: 'worklist',
      params: {
        workspace: 'one',
        worklistId: 'owned-by',
      },
      query,
      info,
      meta: {
        isList: true,
      },
    });

    router.triggerMethod('route', {
      name: 'patient:workflow',
      params: {
        workspace: 'two',
        patientId: 'patient-id',
      },
      query: new URLSearchParams(),
      meta: {},
    });

    expect(Radio.request('history', 'has:latestList')).to.equal(true);
    Radio.request('history', 'go:latestList');
    expect(navigate).to.have.been.calledOnceWithExactly('worklist', {
      worklistId: 'owned-by',
    }, {
      query,
      info,
    });
  });
});
