import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import router from 'js/router';
import AppFrameApp from 'js/apps/globals/app-frame/app-frame_app';
import { routeTable } from '@mnjs/router';

import PatientsApp from 'js/apps/patients/patients-main_app';

import RouterRadioService from './router-radio';
import LatestListService from './latest-list';

function reportingFixture() {
  const scope = testScope();
  const browserReport = cy.stub(window, 'reportError');
  const customReport = cy.spy(console, 'error');
  const reporter = {
    onRouteError: AppFrameApp.prototype.onRouteError,
    workspaceStartupFailure: null,
  };
  router.on('route:error', reporter.onRouteError, reporter);
  scope.defer(() => router.off('route:error', reporter.onRouteError, reporter));
  const attempts = [];
  cy.stub(router, 'navigate').callsFake((name, params, options) => {
    const deferred = Promise.withResolvers();
    attempts.push({
      name,
      info: options.info,
      ...deferred,
    });
    return {
      finished: deferred.promise,
    };
  });
  return {
    browserReport,
    customReport,
    reporter,
    attempts,
  };
}

context('RouterRadioService', function() {
  let service;

  beforeEach(function() {
    const scope = testScope();
    scope.defer(router.mount(routeTable(PatientsApp), {
      parent: 'workspace',
      controller: {
        routeTo() {},
      },
    }));
    scope.reply(Radio, 'workspace', 'current', () => ({
      get: () => 'two',
    }));
    service = scope.own(new RouterRadioService());
  });

  specify('keeps workspace navigation available after a root error route', async function() {
    const finished = Promise.resolve(true);
    const navigateEvent = cy.spy(service, 'navigateEvent');
    const navigate = cy.stub(router, 'navigate').returns({
      finished,
    });

    Radio.trigger('event-router', 'schedule');
    await navigateEvent.lastCall.returnValue;

    expect(navigate).to.have.been.calledOnceWithExactly('schedule', {
      workspace: 'two',
    }, {
      focusReset: 'manual',
      scroll: 'manual',
      info: {
        entryTarget: undefined,
        status: undefined,
      },
    });

    Radio.request('router', 'navigate', 'schedule', {
      workspace: 'one',
    });
    expect(navigate.secondCall.args[1]).to.deep.equal({
      workspace: 'one',
    });

    const worklist = {
      clinicianId: 'clinician-id',
    };
    Radio.trigger('event-router', 'worklist', 'owned-by', worklist);
    await navigateEvent.lastCall.returnValue;
    expect(navigate.thirdCall.args[2]).to.deep.equal({
      focusReset: 'manual',
      scroll: 'manual',
      info: {
        worklist,
      },
    });

    Radio.trigger('event-router', 'workspace', 'one');
    await navigateEvent.lastCall.returnValue;
    expect(navigate.lastCall.args[1]).to.deep.equal({
      workspace: 'one',
    });

    Radio.trigger('event-router', 'unrelated:event');
    expect(navigate).to.have.callCount(4);

    Radio.trigger('event-router', 'notFound');
    await navigateEvent.lastCall.returnValue;
    expect(navigate.lastCall.args[2].history).to.equal('replace');
    Radio.trigger('event-router', 'unknownError', 503);
    await navigateEvent.lastCall.returnValue;
    expect(navigate.lastCall.args[2]).to.deep.equal({
      focusReset: 'manual',
      scroll: 'manual',
      info: {
        entryTarget: 503,
        status: 503,
      },
    });
  });

  specify('observes Back to List failures once without losing list query or current workspace', async function() {
    testScope().own(new LatestListService());
    const { browserReport, customReport, attempts } = reportingFixture();
    const query = new URLSearchParams('filter=one&filter=two');
    const info = {
      worklist: {
        clinicianId: 'list-owner',
      },
    };
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
    const error = new Error('Back to List failed');

    Radio.request('history', 'go:latestList');
    expect(router.navigate).to.have.been.calledOnce;
    expect(router.navigate.firstCall.args[1]).to.deep.equal({
      workspace: 'two',
      worklistId: 'owned-by',
    });
    expect(router.navigate.firstCall.args[2].query).to.equal(query);
    const attempt = attempts[0];
    expect(attempt.info.worklist).to.equal(info.worklist);
    router.triggerMethod('route:error', error, null, {
      info: attempt.info,
    });
    attempt.reject(error);
    await Promise.allSettled([attempt.promise]);
    expect(browserReport).to.have.been.calledOnceWithExactly(error);
    expect(customReport).not.to.have.been.called;

    Radio.request('history', 'go:latestList');
    attempts[1].reject(error);
    await Promise.allSettled([attempts[1].promise]);
    expect(customReport).to.have.been.calledOnceWithExactly(error);

    Radio.request('history', 'go:latestList');
    attempts[2].resolve(true);
    await Promise.allSettled([attempts[2].promise]);
    expect(browserReport).to.have.been.calledOnce;
    expect(customReport).to.have.been.calledOnce;
  });

  specify('reports handled event failures once and preserves later driver failures and public rejections', async function() {
    const { browserReport, customReport, attempts } = reportingFixture();
    const navigateEvent = cy.spy(service, 'navigateEvent');
    const failure = new Error('event navigation failed');
    for (const event of ['schedule', 'default', 'workspace:two']) {
      const channel = Radio.channel('event-router');
      expect(channel.trigger(event), 'Radio stays synchronous').to.equal(channel);
      const attempt = attempts.at(-1);
      router.triggerMethod('route:error', failure, null, {
        info: attempt.info,
      });
      attempt.reject(failure);
      await navigateEvent.lastCall.returnValue;
    }
    expect(browserReport).to.have.been.calledThrice;
    expect(customReport).not.to.have.been.called;

    const driver = service.navigateEvent('schedule');
    attempts.at(-1).reject(failure);
    await driver;
    expect(customReport).to.have.been.calledOnceWithExactly(failure);

    const success = service.navigateEvent('schedule');
    attempts.at(-1).resolve(true);
    await success;
    expect(customReport).to.have.been.calledOnce;

    const requested = Radio.request('router', 'navigate', 'schedule');
    const publicAttempt = attempts.at(-1);
    expect(requested).to.equal(publicAttempt.promise);
    publicAttempt.reject(failure);
    await requested.catch(error => expect(error).to.equal(failure));
    expect(customReport).to.have.been.calledOnce;
  });

  specify('keeps concurrent and reentrant event reports associated with their own attempts', async function() {
    const { browserReport, customReport, attempts, reporter } = reportingFixture();
    const failure = new Error('shared failure');
    const route = service.navigateEvent('schedule');
    const routeAttempt = attempts.at(-1);
    const driver = service.navigateEvent('schedule');
    const driverAttempt = attempts.at(-1);
    router.triggerMethod('route:error', failure, null, {
      info: routeAttempt.info,
    });
    driverAttempt.reject(failure);
    routeAttempt.reject(failure);
    await Promise.all([route, driver]);
    expect(browserReport).to.have.been.calledOnce;
    expect(customReport).to.have.been.calledOnceWithExactly(failure);

    const innerFailure = new Error('reentrant failure');
    let inner;
    browserReport.callsFake(error => {
      if (error !== failure) return;
      inner = service.navigateEvent('schedule');
      const attempt = attempts.at(-1);
      reporter.onRouteError(innerFailure, null, {
        info: attempt.info,
      });
      attempt.reject(innerFailure);
    });
    const outer = service.navigateEvent('schedule');
    const outerAttempt = attempts.at(-1);
    reporter.onRouteError(failure, null, {
      info: outerAttempt.info,
    });
    outerAttempt.reject(failure);
    await Promise.all([outer, inner]);
    expect(browserReport).to.have.been.calledThrice;
    expect(customReport).to.have.been.calledOnce;
    expect(Reflect.ownKeys(outerAttempt.info), 'the transient report token is released').to.deep.equal([]);
  });

  specify('compares exact primitive failures and preserves fallback when browser reporting throws', async function() {
    const { browserReport, customReport, attempts, reporter } = reportingFixture();
    for (const failure of [undefined, NaN]) {
      const finished = service.navigateEvent('schedule');
      const attempt = attempts.at(-1);
      reporter.onRouteError(failure, null, {
        info: attempt.info,
      });
      attempt.reject(failure);
      await finished;
    }
    expect(browserReport).to.have.been.calledTwice;
    expect(customReport).not.to.have.been.called;

    const different = service.navigateEvent('schedule');
    const differentAttempt = attempts.at(-1);
    reporter.onRouteError(NaN, null, {
      info: differentAttempt.info,
    });
    differentAttempt.reject(undefined);
    await different;
    expect(customReport).to.have.been.calledOnceWithExactly(undefined);

    const failure = new Error('route failed');
    const reportFailure = new Error('report callback failed');
    browserReport.callsFake(() => {
      throw reportFailure;
    });
    const unreported = service.navigateEvent('schedule');
    const attempt = attempts.at(-1);
    let thrown;
    try {
      reporter.onRouteError(failure, null, {
        info: attempt.info,
      });
    } catch(error) {
      thrown = error;
    }
    expect(thrown).to.equal(reportFailure);
    attempt.reject(failure);
    await unreported;
    expect(customReport).to.have.been.calledTwice;
    expect(customReport.lastCall.args[0]).to.equal(failure);

    const setupFailure = new Error('setup failed');
    const navigate = router.navigate;
    navigate.resetBehavior();
    navigate.callsFake(() => {
      throw setupFailure;
    });
    try {
      Radio.trigger('event-router', 'schedule');
    } catch(error) {
      thrown = error;
    }
    expect(thrown).to.equal(setupFailure);
    expect(customReport).to.have.been.calledTwice;
  });

  specify('leaves the exact initial workspace failure with root startup reporting', async function() {
    const { browserReport, customReport, attempts, reporter } = reportingFixture();
    const failure = new Error('shared workspace startup failed');
    reporter.workspaceStartupFailure = {
      error: failure,
    };
    const finished = service.navigateEvent('root');
    const attempt = attempts.at(-1);
    reporter.onRouteError(failure, null, {
      info: attempt.info,
    });
    attempt.reject(failure);
    await finished;
    expect(browserReport).not.to.have.been.called;
    expect(customReport).not.to.have.been.called;
  });
});
