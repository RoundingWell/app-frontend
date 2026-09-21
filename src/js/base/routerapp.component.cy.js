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
  routerAppName: 'patients',
  initialize() {
    this.addChildApp('patient', new PatientStub());
  },
  eventRoutes() {
    return {
      'patient:workflow': { action: 'showPatient', route: 'patient/:id/workflow' },
      'patient:action': { action: 'showPatient', route: 'patient/:id/action/:aid' },
      'worklist': { action: 'showWorklist', route: 'worklist/:id', meta: { isList: true } },
      'schedule': { action: 'showSchedule', route: 'schedule', meta: { clearLatestList: true } },
    };
  },
  showPatient(patientId) {
    this.routePromise = this.startRoute('patient', { patientId });

    return this.routePromise;
  },
  showWorklist() {},
  showSchedule() {},
});

function trigger(app, event, ...args) {
  const routed = new Cypress.Promise(resolve => app.once('appRoute', resolve));
  app.router.getChannel().trigger(event, ...args);
  return routed;
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

  describe('route triggers and aliases', function() {
    specify('prefixes the workspace slug onto non-root routes', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      expect(app.router.getDefaultRoute('patient:workflow')).to.equal('test-ws/patient/:id/workflow');
    });

    specify('registers every alias and treats the first as canonical', async function() {
      const AliasRouter = Router.extend({
        eventRoutes() {
          return {
            'patient:workflow': {
              action: 'showPatient',
              route: ['patient/:id/workflow', 'patient/:id/legacy-alias'],
            },
          };
        },
      });
      app = new AliasRouter({ workspaceSlug: 'test-ws' });

      expect(app.router.getDefaultRoute('patient:workflow')).to.equal('test-ws/patient/:id/workflow');
      expect(app.translateEvent('patient:workflow', 'p1')).to.equal('test-ws/patient/p1/workflow');

      await trigger(app, 'patient:workflow', 'p1');
      expect(app.getCurrentRoute().definition.route).to.equal('patient/:id/workflow');
    });

    specify('requires a workspace slug for non-root routes', function() {
      expect(() => new Router()).to.throw('RouterApp requires workspaceSlug for non-root routes');
    });

    specify('does not require a workspace slug for root routes', function() {
      const RootRouter = RouterApp.extend({
        eventRoutes: {
          root: {
            action: 'showRoot',
            route: '',
            root: true,
          },
        },
        showRoot() {},
      });

      app = new RootRouter();

      expect(app.router.getDefaultRoute('root')).to.equal('');
    });
  });

  describe('route context', function() {
    specify('sets the current route before before:appRoute and exposes the full context', async function() {
      const CapturingRouter = Router.extend({
        onBeforeAppRoute(router, routeContext) {
          this.capturedRouter = router;
          this.captured = routeContext;
          this.currentDuringHook = this.getCurrentRoute();
        },
      });
      app = new CapturingRouter({ workspaceSlug: 'test-ws' });

      await trigger(app, 'patient:workflow', 'p1');

      expect(app.capturedRouter).to.equal(app);
      expect(app.captured.event).to.equal('patient:workflow');
      expect(app.captured.eventArgs).to.deep.equal(['p1']);
      expect(app.captured.definition.action).to.equal('showPatient');
      expect(app.captured.definition.route).to.equal('patient/:id/workflow');
      expect(app.currentDuringHook).to.equal(app.captured);
    });

    specify('passes the router before route context to appRoute events', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      const beforeAppRoute = cy.stub();
      const appRoute = cy.stub();

      app.on('before:appRoute', beforeAppRoute);
      app.on('appRoute', appRoute);

      await trigger(app, 'patient:workflow', 'p1');

      const routeContext = app.getCurrentRoute();

      expect(beforeAppRoute).to.have.been.calledWith(app, routeContext);
      expect(appRoute).to.have.been.calledWith(app, routeContext);
    });

    specify('getCurrentRouteMeta returns the definition meta', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      await trigger(app, 'worklist', 'w1');
      expect(app.getCurrentRouteMeta()).to.deep.equal({ isList: true });
    });
  });

  describe('scope identity', function() {
    specify('reuses the child and forwards the route for an equal scope', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      await trigger(app, 'patient:workflow', 'p1');
      await app.routePromise;
      const child = app.getCurrent();

      await trigger(app, 'patient:action', 'p1', 'a1');
      await app.routePromise;

      expect(app.getCurrent()).to.equal(child);
      expect(child.startCount).to.equal(1);
      expect(child.routes).to.deep.equal(['patient:workflow', 'patient:action']);
    });

    specify('restarts the child for a different scope', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      await trigger(app, 'patient:workflow', 'p1');
      await app.routePromise;
      const child = app.getCurrent();

      await trigger(app, 'patient:workflow', 'p2');
      await app.routePromise;

      expect(child.startCount).to.equal(2);
    });

    specify('startCurrent is unconditional even for an equal scope', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      await app.startCurrent('patient', { patientId: 'p1' });
      const child = app.getCurrent();
      await app.startCurrent('patient', { patientId: 'p1' });

      expect(child.startCount).to.equal(2);
    });
  });

  describe('child stop cleanup', function() {
    specify('restarts a stopped child for the next route in the same scope', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      await trigger(app, 'patient:workflow', 'p1');
      await app.routePromise;
      const child = app.getCurrent();

      await child.stop();
      await trigger(app, 'patient:action', 'p1', 'a1');
      await app.routePromise;

      expect(app.getCurrent()).to.equal(child);
      expect(child.startCount).to.equal(2);
      expect(child.routes).to.deep.equal(['patient:workflow', 'patient:action']);
    });

    specify('clears the current child when its owner stops', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      await trigger(app, 'patient:workflow', 'p1');
      await app.routePromise;
      const child = app.getCurrent();

      await app.stop();

      expect(app.getCurrent()).to.equal(null);
      expect(child.isRunning()).to.equal(false);
    });

    specify('dispatches the newest route after a pending stop is superseded', async function() {
      const stopReadiness = deferred();
      const PendingRouter = Router.extend({
        prepareStop() {
          return stopReadiness.promise;
        },
      });
      app = new PendingRouter({ workspaceSlug: 'test-ws' });

      await trigger(app, 'patient:workflow', 'p1');
      await app.routePromise;
      const child = app.getCurrent();
      const stopping = app.stop();
      const routed = trigger(app, 'patient:action', 'p1', 'a1');

      expect(child.routes).to.deep.equal(['patient:workflow']);

      stopReadiness.resolve();
      expect(await stopping).to.equal(false);
      await routed;
      await app.routePromise;

      expect(child.routes).to.deep.equal(['patient:workflow', 'patient:action']);
    });

    specify('does not dispatch a route overtaken by a later stop', async function() {
      app = new Router({ workspaceSlug: 'test-ws' });

      await trigger(app, 'patient:workflow', 'p1');
      await app.routePromise;
      const child = app.getCurrent();

      const routing = app.routeAction('patient:action', 'showPatient', 'p1', 'a1');
      const stopping = app.stop();

      await Promise.all([routing, stopping]);

      expect(child.routes).to.deep.equal(['patient:workflow']);
      expect(app.isRunning()).to.be.false;
    });
  });
});
