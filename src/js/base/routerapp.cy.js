import RouterApp from './routerapp';
import SubRouterApp from './subrouterapp';

const PatientStub = SubRouterApp.extend({
  routeScope: ['patientId'],
  routeActions() {
    return {
      'patient:dashboard': 'show',
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
  childApps: {
    patient: PatientStub,
  },
  eventRoutes() {
    return {
      'patient:dashboard': { action: 'showPatient', route: 'patient/dashboard/:id' },
      'patient:action': { action: 'showPatient', route: 'patient/:id/action/:aid' },
      'worklist': { action: 'showWorklist', route: 'worklist/:id', meta: { isList: true } },
      'schedule': { action: 'showSchedule', route: 'schedule', meta: { clearLatestList: true } },
    };
  },
  showPatient(patientId) {
    this.startRoute('patient', { patientId });
  },
  showWorklist() {},
  showSchedule() {},
});

function trigger(app, event, ...args) {
  app.router.getChannel().trigger(event, ...args);
}

context('RouterApp', function() {
  let app;

  afterEach(function() {
    if (app) app.destroy();
    app = null;
  });

  describe('route triggers and aliases', function() {
    specify('prefixes the workspace slug onto non-root routes', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      expect(app.router.getDefaultRoute('patient:dashboard')).to.equal('test-ws/patient/dashboard/:id');
    });

    specify('registers every alias and treats the first as canonical', function() {
      const AliasRouter = Router.extend({
        eventRoutes() {
          return {
            'patient:dashboard': {
              action: 'showPatient',
              route: ['patient/:id/workflow', 'patient/dashboard/:id'],
            },
          };
        },
      });
      app = new AliasRouter({ workspaceSlug: 'test-ws' });

      expect(app.router.getDefaultRoute('patient:dashboard')).to.equal('test-ws/patient/:id/workflow');
      expect(app.translateEvent('patient:dashboard', 'p1')).to.equal('test-ws/patient/p1/workflow');

      trigger(app, 'patient:dashboard', 'p1');
      expect(app.getCurrentRoute().definition.route).to.equal('patient/:id/workflow');
    });

    specify('requires a workspace slug for non-root routes', function() {
      expect(() => new Router()).to.throw('RouterApp requires workspaceSlug for non-root routes');
    });
  });

  describe('route context', function() {
    specify('sets the current route before before:appRoute and exposes the full context', function() {
      const CapturingRouter = Router.extend({
        onBeforeAppRoute(router, routeContext) {
          this.capturedRouter = router;
          this.captured = routeContext;
          this.currentDuringHook = this.getCurrentRoute();
        },
      });
      app = new CapturingRouter({ workspaceSlug: 'test-ws' });

      trigger(app, 'patient:dashboard', 'p1');

      expect(app.capturedRouter).to.equal(app);
      expect(app.captured.event).to.equal('patient:dashboard');
      expect(app.captured.eventArgs).to.deep.equal(['p1']);
      expect(app.captured.definition.action).to.equal('showPatient');
      expect(app.captured.definition.route).to.equal('patient/dashboard/:id');
      expect(app.currentDuringHook).to.equal(app.captured);
    });

    specify('passes the router before route context to appRoute events', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      const beforeAppRoute = cy.stub();
      const appRoute = cy.stub();

      app.on('before:appRoute', beforeAppRoute);
      app.on('appRoute', appRoute);

      trigger(app, 'patient:dashboard', 'p1');

      const routeContext = app.getCurrentRoute();

      expect(beforeAppRoute).to.have.been.calledWith(app, routeContext);
      expect(appRoute).to.have.been.calledWith(app, routeContext);
    });

    specify('getCurrentRouteMeta returns the definition meta', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      trigger(app, 'worklist', 'w1');
      expect(app.getCurrentRouteMeta()).to.deep.equal({ isList: true });
    });
  });

  describe('scope identity', function() {
    specify('reuses the child and forwards the route for an equal scope', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      trigger(app, 'patient:dashboard', 'p1');
      const child = app.getCurrent();

      trigger(app, 'patient:action', 'p1', 'a1');

      expect(app.getCurrent()).to.equal(child);
      expect(child.startCount).to.equal(1);
      expect(child.routes).to.deep.equal(['patient:dashboard', 'patient:action']);
    });

    specify('restarts the child for a different scope', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      trigger(app, 'patient:dashboard', 'p1');
      const child = app.getCurrent();

      trigger(app, 'patient:dashboard', 'p2');

      expect(child.startCount).to.equal(2);
    });

    specify('startCurrent is unconditional even for an equal scope', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      app.startCurrent('patient', { patientId: 'p1' });
      const child = app.getCurrent();
      app.startCurrent('patient', { patientId: 'p1' });

      expect(child.startCount).to.equal(2);
    });
  });

  describe('child stop cleanup', function() {
    specify('clears current references when the child stops itself', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      trigger(app, 'patient:dashboard', 'p1');
      const child = app.getCurrent();

      child.stop();

      expect(app.getCurrent()).to.equal(null);
      expect(app.isCurrent('patient', { patientId: 'p1' })).to.equal(false);
    });

    specify('keeps the current child when it restarts itself', function() {
      app = new Router({ workspaceSlug: 'test-ws' });
      trigger(app, 'patient:dashboard', 'p1');
      const child = app.getCurrent();

      // a Toolkit restart() emits stop+start; the child remains current
      child.restart();

      expect(app.getCurrent()).to.equal(child);
      expect(app.isCurrent('patient', { patientId: 'p1' })).to.equal(true);
    });
  });
});
