import RouterApp from './routerapp';
import SubRouterApp from './subrouterapp';

const PatientStub = SubRouterApp.extend({
  routeScope: ['patientId'],
  routeActions() {
    return {
      'patient:workflow': 'show',
      'patient:action': 'show',
    };
  },
  initialize() {
    this.startCount = 0;
    this.routes = [];
  },
  onStart() {
    this.startCount++;
    this.startCurrentRoute();
  },
  onStartRoute(routeContext) {
    this.routes.push(routeContext.event);
  },
  show() {},
});

const Router = RouterApp.extend({
  childApps: {
    patient: PatientStub,
  },
  eventRoutes() {
    return {
      'patient:workflow': { action: 'showPatient' },
      'patient:action': { action: 'showPatient' },
      'worklist': { action: 'showWorklist' },
      'schedule': { action: 'showSchedule' },
    };
  },
  showPatient(patientId) {
    this.routePromise = this.startRoute('patient', { patientId });

    return this.routePromise;
  },
  showWorklist() {},
  showSchedule() {},
});

function show(app, name, params, info) {
  return app.showRoute({ name, params, info });
}

function deferred() {
  let resolve;
  const promise = new Cypress.Promise(res => {
    resolve = res;
  });
  return { promise, resolve };
}

context('RouterApp', function() {
  let app;

  afterEach(async function() {
    if (app) await app.destroy();
    app = null;
  });

  describe('route context', function() {
    specify('passes route params by position, then info args, to the action', async function() {
      const worklist = cy.stub();
      app = new (Router.extend({ showWorklist: worklist }))();

      await show(app, 'worklist', { worklistId: 'owned-by' }, { args: [{ clinicianId: 'c1' }] });

      expect(worklist).to.have.been.calledOnceWith('owned-by', { clinicianId: 'c1' });
    });

    specify('exposes the current route context', async function() {
      app = new Router();

      await show(app, 'patient:action', { patientId: 'p1', actionId: 'a1' });

      expect(app.getCurrentRoute()).to.deep.equal({
        event: 'patient:action',
        eventArgs: ['p1', 'a1'],
        definition: { action: 'showPatient' },
      });
    });
  });

  describe('route action failures', function() {
    specify('observes async failures for the current route', async function() {
      const failure = new Error('route failed');
      const readiness = deferred();
      const errorHandler = cy.stub();
      app = new (Router.extend({
        showSchedule() {
          return readiness.promise.then(() => {
            throw failure;
          });
        },
        onRouteError: errorHandler,
      }))();

      const routing = show(app, 'schedule', {});
      expect(errorHandler).not.to.have.been.called;
      readiness.resolve();
      await routing;
      expect(errorHandler).to.have.been.calledOnceWith(failure, app.getCurrentRoute());
    });

    specify('ignores a failure once a newer route takes over', async function() {
      const readiness = deferred();
      const errorHandler = cy.stub();
      app = new (Router.extend({
        showSchedule() {
          return readiness.promise.then(() => {
            throw new Error('route failed');
          });
        },
        onRouteError: errorHandler,
      }))();

      const routing = show(app, 'schedule', {});
      await show(app, 'worklist', { worklistId: 'owned-by' });
      readiness.resolve();
      await routing;

      expect(errorHandler).not.to.have.been.called;
    });
  });

  describe('scope identity', function() {
    specify('reuses the child and forwards the route for an equal scope', async function() {
      app = new Router();
      await show(app, 'patient:workflow', { patientId: 'p1' });
      await app.routePromise;
      const child = app.getCurrent();

      await show(app, 'patient:action', { patientId: 'p1', actionId: 'a1' });
      await app.routePromise;

      expect(app.getCurrent()).to.equal(child);
      expect(child.startCount).to.equal(1);
      expect(child.routes).to.deep.equal(['patient:workflow', 'patient:action']);
    });

    specify('restarts the child for a different scope', async function() {
      app = new Router();
      await show(app, 'patient:workflow', { patientId: 'p1' });
      await app.routePromise;
      const child = app.getCurrent();

      await show(app, 'patient:workflow', { patientId: 'p2' });
      await app.routePromise;

      expect(child.startCount).to.equal(2);
    });

    specify('startCurrent is unconditional even for an equal scope', async function() {
      app = new Router();
      await app.startCurrent('patient', { patientId: 'p1' });
      const child = app.getCurrent();
      await app.startCurrent('patient', { patientId: 'p1' });

      expect(child.startCount).to.equal(2);
    });
  });

  describe('child stop cleanup', function() {
    specify('restarts a stopped child for the next route in the same scope', async function() {
      app = new Router();
      await show(app, 'patient:workflow', { patientId: 'p1' });
      await app.routePromise;
      const child = app.getCurrent();

      await child.stop();
      await show(app, 'patient:action', { patientId: 'p1', actionId: 'a1' });
      await app.routePromise;

      expect(app.getCurrent()).to.equal(child);
      expect(child.startCount).to.equal(2);
      expect(child.routes).to.deep.equal(['patient:workflow', 'patient:action']);
    });

    specify('clears the current child when its owner stops', async function() {
      app = new Router();
      await show(app, 'patient:workflow', { patientId: 'p1' });
      await app.routePromise;
      const child = app.getCurrent();

      await app.stop();

      expect(app.getCurrent()).to.equal(null);
      expect(child.isRunning()).to.equal(false);
    });

    specify('dispatches the newest route after synchronous stop', async function() {
      app = new Router();
      await show(app, 'patient:workflow', { patientId: 'p1' });
      await app.routePromise;
      const child = app.getCurrent();
      expect(app.stop()).to.equal(true);
      expect(child.isRunning()).to.be.false;
      await show(app, 'patient:action', { patientId: 'p1', actionId: 'a1' });
      await app.routePromise;
      expect(child.routes).to.deep.equal(['patient:workflow', 'patient:action']);
    });

    specify('does not dispatch a route overtaken by a later stop', async function() {
      app = new Router();

      await show(app, 'patient:workflow', { patientId: 'p1' });
      await app.routePromise;
      const child = app.getCurrent();

      const routing = show(app, 'patient:action', { patientId: 'p1', actionId: 'a1' });
      const stopping = app.stop();

      await Promise.all([routing, stopping]);

      expect(child.routes).to.deep.equal(['patient:workflow']);
      expect(app.isRunning()).to.be.false;
    });
  });
});
