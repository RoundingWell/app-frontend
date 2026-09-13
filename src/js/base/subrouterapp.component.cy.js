import SubRouterApp from './subrouterapp';

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
      'patient:workflow': 'showWorkflow',
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
  showWorkflow(patientId) {
    this.calls.push(['workflow', patientId]);
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
  onBeforeStart() {
    this.loaded = deferred();
    return this.loaded.promise;
  },
  onStart() {
    this.startCurrentRoute();
  },
});

const workflow = { event: 'patient:workflow', eventArgs: ['p1'], definition: {} };
const action = { event: 'patient:action', eventArgs: ['p1', 'a1'], definition: {} };

context('SubRouterApp', function() {
  let app;

  afterEach(async function() {
    if (app) await app.destroy();
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
    specify('dispatches the current route from onStart with positional args', async function() {
      app = new SyncApp();
      app.setCurrentRoute(action);
      await app.start();

      expect(app.calls).to.deep.equal([['action', 'p1', 'a1']]);
      expect(app.beforeRoutes).to.deep.equal(['patient:action']);
      expect(app.startedRoutes).to.deep.equal(['patient:action']);
    });

    specify('dispatches immediately when a route arrives while running', async function() {
      app = new SyncApp();
      await app.start();
      expect(app.calls).to.deep.equal([]);

      app.startRoute(workflow);
      expect(app.calls).to.deep.equal([['workflow', 'p1']]);
    });
  });

  describe('loading startup', function() {
    specify('retains only the newest route while loading and dispatches it once ready', async function() {
      app = new LoadingApp();
      app.setCurrentRoute(workflow);
      const starting = app.start();

      // still loading: nothing dispatched
      app.startRoute(action);
      expect(app.calls).to.deep.equal([]);

      app.loaded.resolve();
      await starting;

      expect(app.calls).to.deep.equal([['action', 'p1', 'a1']]);
    });
  });

  describe('unmatched routes', function() {
    specify('is a safe no-op and does not fire startRoute', async function() {
      app = new SyncApp();
      app.setCurrentRoute({ event: 'patient:missing', eventArgs: [], definition: {} });
      await app.start();

      expect(app.calls).to.deep.equal([]);
      expect(app.beforeRoutes).to.deep.equal(['patient:missing']);
      expect(app.startedRoutes).to.deep.equal([]);
    });
  });

  describe('stop and restart', function() {
    specify('preserves route state while stopped', async function() {
      app = new SyncApp();
      app.setCurrentRoute(workflow);
      await app.start();
      await app.stop();

      expect(app.getCurrentRoute()).to.deep.equal(workflow);
    });

    specify('preserves the current route across restart', async function() {
      app = new SyncApp();
      app.setCurrentRoute(workflow);
      await app.start();
      await app.restart();

      expect(app.getCurrentRoute()).to.deep.equal(workflow);
      // re-dispatched on restart
      expect(app.calls).to.deep.equal([['workflow', 'p1'], ['workflow', 'p1']]);
    });
  });
});
