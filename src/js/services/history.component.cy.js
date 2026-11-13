import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import router from 'js/router';
import AppFrameApp from 'js/apps/globals/app-frame/app-frame_app';

import HistoryService from './history';

async function verifyBackFailure(routeFailure) {
  const error = new Error('Back failed');
  const finished = Promise.withResolvers();
  const browserReport = cy.stub(window, 'reportError');
  const customReport = cy.spy(console, 'error');
  cy.stub(router, 'canGoBack').returns(true);
  const back = cy.stub(router, 'back').returns(finished.promise);
  const reporter = {
    onRouteError: AppFrameApp.prototype.onRouteError,
  };
  router.on('route:error', reporter.onRouteError, reporter);
  testScope().defer(() => router.off('route:error', reporter.onRouteError, reporter));

  expect(Radio.request('history', 'go:back')).to.equal(undefined);
  expect(back).to.have.been.calledOnce;
  if (routeFailure) {
    router.triggerMethod('route:error', error, null, {
      info: undefined,
    });
  }
  finished.reject(error);
  await new Promise(resolve => setTimeout(resolve, 0));

  expect(browserReport).to.have.callCount(routeFailure ? 1 : 0);
  expect(customReport).to.have.been.calledOnceWithExactly(error);
  await finished.promise.then(() => {
    throw new Error('Back unexpectedly fulfilled');
  }, value => {
    expect(value).to.equal(error);
  });
}

context('HistoryService', function() {
  beforeEach(function() {
    const scope = testScope();
    scope.own(new HistoryService());
  });

  specify('closes route overlays after readiness or a committed failure', function() {
    const change = cy.stub();
    cy.stub(window, 'reportError');
    Radio.channel('history').on('change:route', change);
    testScope().defer(() => Radio.channel('history').off('change:route', change));

    router.triggerMethod('route:ready', {
      url: new URL(window.location.href),
    });
    expect(change).not.to.have.been.called;

    const error = new Error('route failed');
    router.triggerMethod('route:error', error, null);
    expect(change).not.to.have.been.called;

    const match = {
      url: new URL('/failed-page', window.location.href),
    };
    router.triggerMethod('route:error', error, match);
    expect(change).to.have.been.calledOnceWithExactly('/failed-page');

    router.triggerMethod('route:ready', match);
    expect(change).to.have.been.calledOnce;

    router.triggerMethod('route:ready', {
      url: new URL('/ready-page', window.location.href),
    });
    expect(change).to.have.callCount(2);
    expect(change.lastCall).to.have.been.calledWithExactly('/ready-page');
  });

  specify('observes a Back destination failure', function() {
    return verifyBackFailure(true);
  });

  specify('reports a driver-only Back failure without an unhandled rejection', function() {
    return verifyBackFailure(false);
  });

  specify('observes successful Back and preserves the synchronous empty-history fallback', async function() {
    const finished = Promise.resolve(true);
    const customReport = cy.spy(console, 'error');
    const canGoBack = cy.stub(router, 'canGoBack').returns(true);
    const back = cy.stub(router, 'back').returns(finished);
    const fallback = cy.stub().returns(undefined);

    expect(Radio.request('history', 'go:back', fallback)).to.equal(undefined);
    await finished;
    expect(back).to.have.been.calledOnce;
    expect(fallback).not.to.have.been.called;
    expect(customReport).not.to.have.been.called;

    canGoBack.returns(false);
    expect(Radio.request('history', 'go:back', fallback)).to.equal(undefined);
    expect(fallback).to.have.been.calledOnce;
    expect(back).to.have.been.calledOnce;
    expect(customReport).not.to.have.been.called;
  });
});
