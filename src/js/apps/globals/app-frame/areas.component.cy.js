import { Radio } from 'marionette';
import { Router } from '@mnjs/router';
import { testScope } from '@mnjs/test/cypress';

import PatientsApp from 'js/apps/patients/patients-main_app';
import ProgramsApp from 'js/apps/programs/programs-main_app';
import CliniciansApp from 'js/apps/clinicians/clinicians-main_app';
import DashboardsApp from 'js/apps/dashboards/dashboards-main_app';
import { areaRoutes } from 'js/apps/globals/app-frame/areas';

// Public application URLs and positional parameter order used by Radio callers.
const URLS = {
  'worklist': '/one/worklist/owned-by',
  'schedule': '/one/schedule',
  'patient:workflow': '/one/patient/p/workflow',
  'patient:workflow:closed': '/one/patient/p/workflow/closed',
  'patient:interactions': '/one/patient/p/interactions',
  'patient:interaction': '/one/patient/p/interactions/i',
  'patient:action': '/one/patient/p/action/a',
  'patient:flow': '/one/patient/p/flow/f',
  'patient:flow:focus': '/one/patient/p/flow/f/focus/a',
  'patient:flow:action': '/one/patient/p/flow/f/action/a',
  'patient:form': '/one/patient/p/form/frm',
  'patient:workflow:alias:0': '/one/patient/dashboard/p',
  'patient:workflow:closed:alias:0': '/one/patient/archive/p',
  'patient:action:alias:0': '/one/patient/archive/p/action/a',
  'legacy:patient:flow': '/one/flow/f',
  'legacy:patient:flow:alias:0': '/one/flow/f/details',
  'legacy:patient:flow:action': '/one/flow/f/action/a',
  'programs:all': '/one/programs',
  'program:details': '/one/program/prg',
  'program:action': '/one/program/prg/action/a',
  'program:action:new': '/one/program/prg/action',
  'programFlow:new': '/one/program/prg/flow',
  'programFlow': '/one/program-flow/f',
  'programFlow:action': '/one/program-flow/f/action/a',
  'programFlow:action:new': '/one/program-flow/f/action',
  'clinicians:all': '/one/clinicians',
  'clinician': '/one/clinicians/c',
  'dashboards:all': '/one/dashboards',
  'dashboard': '/one/dashboards/d',
};

context('application-owned route declarations', function() {
  let router;

  beforeEach(function() {
    const scope = testScope();
    router = scope.own(new Router({
      routes: [
        {
          name: 'notFound',
          path: '/404',
        },
        {
          name: 'workspace',
          path: '/:workspace',
        },
      ],
    }));
    router.mount(areaRoutes({
      patients: PatientsApp,
      programs: ProgramsApp,
      clinicians: CliniciansApp,
      dashboards: DashboardsApp,
    }), {
      parent: 'workspace',
      controller: {
        routeTo() {},
      },
    });
  });

  specify('retains all public names, URLs and positional parameter order', function() {
    const params = {
      workspace: 'one',
      worklistId: 'owned-by',
      patientId: 'p',
      interactionId: 'i',
      actionId: 'a',
      flowId: 'f',
      formId: 'frm',
      programId: 'prg',
      clinicianId: 'c',
      dashboardId: 'd',
    };
    expect(Object.keys(URLS)).to.have.length(29);
    for (const [name, url] of Object.entries(URLS)) {
      expect(router.hasRoute(name), name).to.equal(true);
      expect(router.url(name, params), name).to.equal(url);
      const expected = ['workspace', ...url.split('/').slice(2).map(value => {
        return Object.keys(params).find(key => key !== 'workspace' && params[key] === value);
      }).filter(Boolean)];
      expect(router.getParamNames(name), name).to.deep.equal(expected);
    }
  });

  specify('keeps area startup recovery separate from unexpected detail failures', async function() {
    const scope = testScope();
    const failure = Object.assign(new Error('Unexpected detail failure'), {
      response: {
        status: 503,
      },
    });
    const events = [];
    const channel = Radio.channel('event-router');
    const onUnknownError = (...args) => events.push(['unknownError', ...args]);
    const onNotFound = (...args) => events.push(['notFound', ...args]);
    channel.on({
      unknownError: onUnknownError,
      notFound: onNotFound,
    });
    scope.defer(() => {
      channel.off('unknownError', onUnknownError);
      channel.off('notFound', onNotFound);
    });
    const clinicians = scope.own(new CliniciansApp());
    const programs = scope.own(new ProgramsApp());

    for (const app of [clinicians, programs]) {
      const outcome = await Promise.resolve().then(() => app.handleRouteError(failure, null, {
        phase: 'route',
      })).then(value => ({
        value,
      }), error => ({
        error,
      }));
      expect(outcome.error, 'detail errors preserve their original rejection').to.equal(failure);
    }
    expect(events, 'detail failures do not use global startup recovery').to.deep.equal([]);

    clinicians.handleRouteError(failure, null, {
      mount: 'cliniciansAll',
      phase: 'start',
    });
    programs.handleRouteError(failure, null, {
      mount: 'program',
      phase: 'start',
    });
    programs.handleRouteError(failure, null, {
      mount: 'programflow',
      phase: 'start',
    });
    programs.handleRouteError(new Error('Network failure'), null, {
      mount: 'program',
      phase: 'start',
    });
    expect(events).to.deep.equal([
      ['unknownError', 503],
      ['unknownError', 503],
      ['notFound'],
      ['unknownError', undefined],
    ]);
  });
});
