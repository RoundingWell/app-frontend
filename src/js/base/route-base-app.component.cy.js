import App from './app';
import RouterApp from './routerapp';
import SubRouterApp from './subrouterapp';

function deferred() {
  let resolve;
  let reject;
  const promise = new Cypress.Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Exercise the same selection contract through both public router classes.
[RouterApp, SubRouterApp].forEach((Router, index) => {
  const title = `${ index ? 'SubRouterApp' : 'RouterApp' } child selection`;

  context(title, function() {
    let owner;

    beforeEach(async function() {
      owner = new Router({ workspaceSlug: 'test-ws' });
      await owner.start();
    });

    afterEach(async function() {
      await owner.destroy();
    });

    specify('stops the old child synchronously and completes only the latest replacement', async function() {
      const current = owner.addChildApp('current', new App());
      const first = owner.addChildApp('first', new App());
      const latest = owner.addChildApp('latest', new App());
      await owner.startCurrent('current');
      const firstStart = owner.startCurrent('first');
      expect(current.isRunning()).to.be.false;
      const latestStart = owner.startCurrent('latest');
      expect(await firstStart).to.equal(undefined);
      expect(await latestStart).to.equal(latest);
      expect(first.isRunning()).to.be.false;
      expect(owner.getCurrent()).to.equal(latest);
    });

    specify('cancels replacement preparation when its owner stops', async function() {
      const ready = deferred();
      const next = owner.addChildApp('next', new (App.extend({ prepareStart() {
        return ready.promise;
      } }))());
      const replacing = owner.startCurrent('next');
      expect(owner.stop()).to.equal(true);
      ready.resolve();
      expect(await replacing).to.equal(undefined);
      expect(next.isRunning()).to.be.false;
      expect(owner.getCurrent()).to.equal(null);
    });

    specify('invalidates pending selection even when its owner is already stopped', async function() {
      await owner.stop();
      const child = owner.addChildApp('child', new App());
      const started = cy.spy(child, 'start');
      const selecting = owner.startCurrent('child');
      await owner.stop();

      expect(await selecting).to.equal(undefined);
      expect(started).to.have.been.calledOnce;
      expect(child.isRunning()).to.be.false;
    });

    specify('clears a live child selected beneath an already-stopped owner', async function() {
      await owner.stop();
      const child = owner.addChildApp('child', new App());
      await owner.startCurrent('child');
      expect(child.isRunning()).to.be.true;

      await owner.stop();
      expect(child.isRunning()).to.be.false;
      expect(owner.getCurrent()).to.equal(null);
    });

    specify('cancels child preparation when its owner is destroyed', async function() {
      const readiness = deferred();
      const preparing = deferred();
      const child = owner.addChildApp('child', new (App.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }))());
      const selecting = owner.startCurrent('child');
      await preparing.promise;
      const destroying = owner.destroy();
      readiness.resolve();

      await destroying;
      expect(await selecting).to.equal(undefined);
      expect(child.isDestroyed()).to.be.true;
      expect(owner.getCurrent()).to.equal(null);
    });

    specify('stops partially started descendants after failed child preparation', async function() {
      const failure = new Error('page failed');
      const child = owner.addChildApp('child', new (App.extend({
        childApps: { nested: App },
        async prepareStart() {
          await this.getChildApp('nested').start();
          throw failure;
        },
      }))());
      const next = owner.addChildApp('next', new App());

      expect(await owner.startCurrent('child').catch(error => error)).to.equal(failure);
      expect(child.getChildApp('nested').isRunning()).to.be.false;
      expect(owner.getCurrent()).to.equal(null);
      expect(await owner.startCurrent('next')).to.equal(next);
    });

    specify('preserves the activation error when cleanup throws', async function() {
      const failure = { resource: 'action', error: { response: { status: 410 } } };
      const cleanupFailure = new Error('cleanup failed');
      const reported = cy.stub(owner, 'onChildCleanupError');
      const child = owner.addChildApp('child', new (App.extend({
        childApps: { nested: App },
        async prepareStart() {
          const nested = this.getChildApp('nested');
          await nested.start();
          nested.onBeforeStop = () => {
            throw cleanupFailure;
          };
          throw failure;
        },
      }))());

      const result = await owner.startCurrent('child').catch(error => error);
      child.getChildApp('nested').onBeforeStop = () => {};
      expect(result).to.equal(failure);
      expect(reported).to.have.been.calledOnceWith(cleanupFailure, child);
      expect(owner.getCurrent()).to.equal(child);
    });

    specify('reports cleanup separately without turning cancellation into activation failure', async function() {
      const cleanupFailure = new Error('cleanup failed');
      const reported = cy.stub(owner, 'onChildCleanupError');
      const child = owner.addChildApp('child', new App({ childApps: { nested: App } }));
      const nested = child.getChildApp('nested');
      await nested.start();
      nested.onBeforeStop = () => {
        throw cleanupFailure;
      };

      const result = await owner.selectChild('child', { start: () => false });
      nested.onBeforeStop = () => {};
      expect(result).to.equal(undefined);
      expect(reported).to.have.been.calledOnceWith(cleanupFailure, child);
      expect(owner.getCurrent()).to.equal(child);
    });

    specify('ignores a late startup failure after a newer child has been selected', async function() {
      const readiness = deferred();
      const preparing = deferred();
      const child = owner.addChildApp('child', new (App.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }))());
      const next = owner.addChildApp('next', new App());
      const selecting = owner.startCurrent('child');
      await preparing.promise;
      const replacing = owner.startCurrent('next');
      readiness.reject(new Error('obsolete page failed'));

      expect(await selecting).to.equal(undefined);
      expect(await replacing).to.equal(next);
      expect(owner.getCurrent()).to.equal(next);
      expect(child.isRunning()).to.be.false;
    });

    specify('rejects an unknown child without retiring the selected child', async function() {
      const child = owner.addChildApp('child', new App());
      await owner.startCurrent('child');
      const failure = await owner.startCurrent('missing').catch(error => error);

      expect(failure.message).to.equal('Child application "missing" is not registered');
      expect(owner.getCurrent()).to.equal(child);
      expect(child.isRunning()).to.be.true;
    });
  });
});
