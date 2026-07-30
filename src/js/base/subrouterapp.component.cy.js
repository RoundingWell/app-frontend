import SubRouterApp from './subrouterapp';

// Resolve queued microtasks (the base App loading chain) before asserting.
function flush() {
  return new Cypress.Promise(resolve => setTimeout(resolve, 0));
}

function deferred() {
  let resolve;
  const promise = new Cypress.Promise(res => {
    resolve = res;
  });
  return { promise, resolve };
}

const BaseApp = SubRouterApp.extend({
  routeScope: ['patientId'],
  routeActions() {
    return {
      'patient:workflow': 'showDashboard',
      'patient:action': 'showAction',
    };
  },
  initialize() {
    this.calls = [];
    this.beforeRoutes = [];
    this.startedRoutes = [];
  },
  onBeforeStartRoute(routeContext) {
    this.beforeRoutes.push(routeContext.event);
  },
  onStartRoute(routeContext) {
    this.startedRoutes.push(routeContext.event);
  },
  showDashboard(patientId) {
    this.calls.push(['dashboard', patientId]);
  },
  showAction(patientId, actionId) {
    this.calls.push(['action', patientId, actionId]);
  },
});

const SyncApp = BaseApp.extend({
  onStart() {
    this.startCurrentRoute();
  },
});

const LoadingApp = BaseApp.extend({
  beforeStart() {
    this.loaded = deferred();
    return this.loaded.promise;
  },
  onStart() {
    this.startCurrentRoute();
  },
});

const dashboard = { event: 'patient:workflow', eventArgs: ['p1'], definition: {} };
const action = { event: 'patient:action', eventArgs: ['p1', 'a1'], definition: {} };

context('SubRouterApp', function() {
  let app;

  afterEach(function() {
    if (app) app.destroy();
    app = null;
  });

  describe('getRouteScope', function() {
    specify('returns only the configured scope keys', function() {
      app = new BaseApp();
      expect(app.getRouteScope({ patientId: 'p1', clinicianId: 'c9' })).to.deep.equal({ patientId: 'p1' });
    });

    specify('returns {} when options are omitted', function() {
      app = new BaseApp();
      expect(app.getRouteScope()).to.deep.equal({});
    });

    specify('returns {} for an empty scope', function() {
      app = new (BaseApp.extend({ routeScope: [] }))();
      expect(app.getRouteScope({ patientId: 'p1' })).to.deep.equal({});
    });

    specify('returns the full options when no scope is declared', function() {
      app = new (BaseApp.extend({ routeScope: undefined }))();
      expect(app.getRouteScope({ patientId: 'p1', clinicianId: 'c9' })).to.deep.equal({ patientId: 'p1', clinicianId: 'c9' });
    });
  });

  describe('synchronous startup', function() {
    specify('dispatches the current route from onStart with positional args', function() {
      app = new SyncApp();
      app.setCurrentRoute(action);
      app.start();

      expect(app.calls).to.deep.equal([['action', 'p1', 'a1']]);
      expect(app.beforeRoutes).to.deep.equal(['patient:action']);
      expect(app.startedRoutes).to.deep.equal(['patient:action']);
    });

    specify('dispatches immediately when a route arrives while running', function() {
      app = new SyncApp();
      app.start();
      expect(app.calls).to.deep.equal([]);

      app.startRoute(dashboard);
      expect(app.calls).to.deep.equal([['dashboard', 'p1']]);
    });
  });

  describe('loading startup', function() {
    specify('retains only the newest route while loading and dispatches it once ready', function() {
      app = new LoadingApp();
      app.setCurrentRoute(dashboard);
      app.start();

      // still loading: nothing dispatched
      app.startRoute(action);
      expect(app.calls).to.deep.equal([]);

      app.loaded.resolve();
      return flush().then(() => {
        expect(app.calls).to.deep.equal([['action', 'p1', 'a1']]);
      });
    });
  });

  describe('unmatched routes', function() {
    specify('is a safe no-op and does not fire startRoute', function() {
      app = new SyncApp();
      app.setCurrentRoute({ event: 'patient:missing', eventArgs: [], definition: {} });
      app.start();

      expect(app.calls).to.deep.equal([]);
      expect(app.beforeRoutes).to.deep.equal(['patient:missing']);
      expect(app.startedRoutes).to.deep.equal([]);
    });
  });

  describe('stop and restart', function() {
    specify('clears the current route on a normal stop', function() {
      app = new SyncApp();
      app.setCurrentRoute(dashboard);
      app.start();
      app.stop();

      expect(app.getCurrentRoute()).to.equal(null);
    });

    specify('preserves the current route across restart', function() {
      app = new SyncApp();
      app.setCurrentRoute(dashboard);
      app.start();
      app.restart();

      expect(app.getCurrentRoute()).to.deep.equal(dashboard);
      // re-dispatched on restart
      expect(app.calls).to.deep.equal([['dashboard', 'p1'], ['dashboard', 'p1']]);
    });
  });
});
