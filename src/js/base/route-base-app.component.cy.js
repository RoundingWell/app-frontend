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

    specify('waits for stop permission and starts only the latest replacement', async function() {
      const permission = deferred();
      const stopping = deferred();
      const current = owner.addChildApp('current', new (App.extend({
        prepareStop() {
          stopping.resolve();
          return permission.promise;
        },
      }))());
      const first = owner.addChildApp('first', new App());
      const latest = owner.addChildApp('latest', new App());
      await owner.startCurrent('current');

      const firstStart = owner.startCurrent('first');
      await stopping.promise;
      const latestStart = owner.startCurrent('latest');
      await Promise.resolve();

      expect(owner.getCurrent()).to.equal(current);
      expect(first.isRunning()).to.be.false;
      expect(latest.isRunning()).to.be.false;
      permission.resolve();

      expect(await firstStart).to.equal(undefined);
      expect(await latestStart).to.equal(latest);
      expect(current.isRunning()).to.be.false;
      expect(first.isRunning()).to.be.false;
      expect(owner.getCurrent()).to.equal(latest);
    });

    specify('retains a child that rejects stop permission and permits a later retry', async function() {
      const refusal = new Error('stay on this page');
      const current = owner.addChildApp('current', new App());
      const next = owner.addChildApp('next', new App());
      await owner.startCurrent('current');
      current.prepareStop = () => Promise.reject(refusal);

      const failure = await owner.startCurrent('next').catch(error => error);
      expect(failure).to.equal(refusal);
      expect(owner.getCurrent()).to.equal(current);
      expect(current.isRunning()).to.be.true;
      expect(next.isRunning()).to.be.false;

      current.prepareStop = () => {};
      expect(await owner.startCurrent('next')).to.equal(next);
      expect(current.isRunning()).to.be.false;
    });

    specify('does not replace a child whose stop was superseded', async function() {
      const permission = deferred();
      const stopping = deferred();
      const current = owner.addChildApp('current', new (App.extend({
        prepareStop() {
          stopping.resolve();
          return permission.promise;
        },
      }))());
      const next = owner.addChildApp('next', new App());
      await owner.startCurrent('current');
      const replacing = owner.startCurrent('next');
      await stopping.promise;
      const resuming = current.start();
      permission.resolve();

      expect(await replacing).to.equal(undefined);
      await resuming;
      expect(owner.getCurrent()).to.equal(current);
      expect(current.isRunning()).to.be.true;
      expect(next.isRunning()).to.be.false;
    });

    specify('invalidates a queued replacement when its owner stops', async function() {
      const permission = deferred();
      const stopping = deferred();
      owner.addChildApp('current', new (App.extend({
        prepareStop() {
          stopping.resolve();
          return permission.promise;
        },
      }))());
      const next = owner.addChildApp('next', new App());
      const started = cy.spy(next, 'start');
      await owner.startCurrent('current');
      const replacing = owner.startCurrent('next');
      await stopping.promise;
      const shutdown = owner.stop();
      permission.resolve();

      await shutdown;
      expect(await replacing).to.equal(undefined);
      expect(started).not.to.have.been.called;
      expect(owner.getCurrent()).to.equal(null);
    });

    specify('invalidates pending selection even when its owner is already stopped', async function() {
      await owner.stop();
      const child = owner.addChildApp('child', new App());
      const started = cy.spy(child, 'start');
      const selecting = owner.startCurrent('child');
      await owner.stop();

      expect(await selecting).to.equal(undefined);
      expect(started).not.to.have.been.called;
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
