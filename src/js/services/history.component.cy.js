import { Radio } from 'marionette';

import router from 'js/router';

import HistoryService from './history';

context('HistoryService', function() {
  let service;

  beforeEach(function() {
    service = new HistoryService();
  });

  afterEach(function() {
    service.destroy();
    Radio.reset();
  });

  specify('closes route overlays after readiness or a committed failure', function() {
    const change = cy.stub();
    cy.stub(window, 'reportError');
    Radio.channel('history').on('change:route', change);

    router.triggerMethod('route:ready', { url: new URL(window.location.href) });
    expect(change).not.to.have.been.called;

    const error = new Error('route failed');
    router.triggerMethod('route:error', error, null);
    expect(change).not.to.have.been.called;

    const match = { url: new URL('/failed-page', window.location.href) };
    router.triggerMethod('route:error', error, match);
    expect(change).to.have.been.calledOnceWithExactly('/failed-page');

    router.triggerMethod('route:ready', match);
    expect(change).to.have.been.calledOnce;

    router.triggerMethod('route:ready', { url: new URL('/ready-page', window.location.href) });
    expect(change).to.have.callCount(2);
    expect(change.lastCall).to.have.been.calledWithExactly('/ready-page');
  });
});
