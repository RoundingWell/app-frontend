import App from './app';
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
  prepareStart() {
    this.loaded = deferred();
    return this.loaded.promise;
  },
  onStart() {
    this.startCurrentRoute();
  },
});

const workflow = { event: 'patient:workflow', eventArgs: ['p1'], definition: {} };
const action = { event: 'patient:action', eventArgs: ['p1', 'a1'], definition: {} };

const SelectedApp = SubRouterApp.extend({
  initialize() {
    this.addChildApp('child', new App());
  },
});

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

    specify('requires an explicit scope declaration', function() {
      app = new (BaseApp.extend({ routeScope: undefined }))();
      expect(() => app.getRouteScope()).to.throw('SubRouterApp requires a routeScope array');
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

      await app.startRoute(workflow);
      expect(app.calls).to.deep.equal([['workflow', 'p1']]);
    });
  });

  describe('loading startup', function() {
    specify('retains only the newest route while loading and dispatches it once ready', async function() {
      app = new LoadingApp();
      app.setCurrentRoute(workflow);
      const starting = app.start();

      // still loading: nothing dispatched
      const routing = app.startRoute(action);
      expect(app.calls).to.deep.equal([]);

      app.loaded.resolve();
      await Promise.all([starting, routing]);

      expect(app.calls).to.deep.equal([['action', 'p1', 'a1']]);
    });
  });

  describe('route action failures', function() {
    specify('observes async action failure during initial and subsequent dispatch', async function() {
      const failure = new Error('content failed');
      const reported = [];
      app = new (SyncApp.extend({
        showAction() {
          return Promise.reject(failure);
        },
        onRouteError(error) {
          reported.push(error);
        },
      }))();
      app.setCurrentRoute(action);
      await app.start();
      await app.startRoute(action);
      await Promise.resolve();

      expect(reported).to.deep.equal([failure, failure]);
    });
  });

  describe('route failure reporting', function() {
    specify('reports synchronous throws during initial and running dispatch', async function() {
      const failure = new Error('synchronous route failure');
      const reported = [];
      app = new (SyncApp.extend({
        showAction() {
          throw failure;
        },
        onRouteError(error) {
          reported.push(error);
        },
      }))();
      app.setCurrentRoute(action);
      expect(await app.start()).to.be.true;
      await app.startRoute(action);
      await Promise.resolve();

      expect(reported).to.deep.equal([failure, failure]);
      expect(app.startedRoutes).to.deep.equal(['patient:action', 'patient:action']);
    });

    specify('reports a current route failure even after the action stops its owner', async function() {
      const failure = new Error('route stopped itself');
      const reported = [];
      app = new (SyncApp.extend({
        async showAction() {
          await this.stop();
          throw failure;
        },
        onRouteError(error) {
          reported.push(error);
        },
      }))();
      await app.start();
      app.setCurrentRoute(action);
      await app.startCurrentRoute();

      expect(app.isRunning()).to.be.false;
      expect(reported).to.deep.equal([failure]);
    });

    specify('ignores an action failure once a newer route takes over', async function() {
      const readiness = deferred();
      const reported = [];
      app = new (SyncApp.extend({
        showAction() {
          return readiness.promise.then(() => {
            throw new Error('stale failure');
          });
        },
        onRouteError(error) {
          reported.push(error);
        },
      }))();
      await app.start();
      app.setCurrentRoute(action);
      const dispatching = app.startCurrentRoute();
      await app.startRoute(workflow);
      readiness.resolve();
      await dispatching;
      expect(reported).to.deep.equal([]);
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

    specify('dispatches a route after a pending stop is superseded', async function() {
      const PendingApp = SyncApp.extend({
        prepareStop() {
          return this.stopReadiness.promise;
        },
      });
      app = new PendingApp();
      app.stopReadiness = deferred();
      app.setCurrentRoute(workflow);
      await app.start();

      const stopping = app.stop();
      const routing = app.startRoute(action);

      expect(app.calls).to.deep.equal([['workflow', 'p1']]);

      app.stopReadiness.resolve();
      expect(await stopping).to.equal(false);
      await routing;

      expect(app.calls).to.deep.equal([
        ['workflow', 'p1'],
        ['action', 'p1', 'a1'],
      ]);
    });

    specify('does not dispatch a route overtaken by a later stop', async function() {
      app = new SyncApp();
      app.setCurrentRoute(workflow);
      await app.start();

      const routing = app.startRoute(action);
      const stopping = app.stop();

      await Promise.all([routing, stopping]);

      expect(app.calls).to.deep.equal([['workflow', 'p1']]);
      expect(app.isRunning()).to.be.false;
    });
  });

  describe('selected child lifecycle', function() {
    specify('rejects an unregistered child without stopping the current child', async function() {
      app = new SelectedApp();
      const child = await app.startCurrent('child');
      let failure;

      try {
        await app.startCurrent('missing');
      } catch(error) {
        failure = error;
      }

      expect(failure.message).to.equal('Child application "missing" is not registered');
      expect(child.isRunning()).to.be.true;
      expect(app.getCurrent()).to.equal(child);
    });

    specify('starts a registered child and clears it when the owner stops', async function() {
      app = new SelectedApp();
      await app.start();

      const child = await app.startCurrent('child');

      expect(child).to.equal(app.getChildApp('child'));
      expect(child.isRunning()).to.be.true;
      expect(app.getCurrent()).to.equal(child);

      await app.stop();

      expect(child.isRunning()).to.be.false;
      expect(app.getCurrent()).to.equal(null);
    });

    specify('clears a child whose startup rejects', async function() {
      const BrokenApp = App.extend({
        prepareStart() {
          throw new Error('failed to start');
        },
      });
      app = new SubRouterApp();
      app.addChildApp('child', new BrokenApp());

      let failure;

      try {
        await app.startCurrent('child');
      } catch(error) {
        failure = error;
      }

      expect(failure.message).to.equal('failed to start');
      expect(app.getCurrent()).to.equal(null);
    });

    specify('clears a child whose startup is canceled', async function() {
      const readiness = deferred();
      const preparing = deferred();
      const child = new (App.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }))();

      app = new SubRouterApp();
      app.addChildApp('child', child);

      const starting = app.startCurrent('child');

      await preparing.promise;
      const stopping = child.stop();
      readiness.resolve();
      await stopping;

      expect(await starting).to.equal(undefined);
      expect(app.getCurrent()).to.equal(null);
    });

    specify('serializes overlapping child replacements', async function() {
      const stopReadiness = deferred();
      const current = new (App.extend({
        prepareStop() {
          return stopReadiness.promise;
        },
      }))();
      const first = new App();
      const latest = new App();

      app = new SubRouterApp();
      app.addChildApp('current', current);
      app.addChildApp('first', first);
      app.addChildApp('latest', latest);

      await app.startCurrent('current');

      const firstStart = app.startCurrent('first');
      const latestStart = app.startCurrent('latest');

      expect(first.isRunning()).to.be.false;
      expect(latest.isRunning()).to.be.false;

      stopReadiness.resolve();

      expect(await firstStart).to.equal(undefined);
      expect(await latestStart).to.equal(latest);
      expect(first.isRunning()).to.be.false;
      expect(latest.isRunning()).to.be.true;
      expect(app.getCurrent()).to.equal(latest);
    });
  });
});
