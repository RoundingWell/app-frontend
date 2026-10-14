import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Application } from 'marionette';
import { RouteOutlet, RouteState } from '../outlet.js';

function deferred() {
  const result = {};
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
}

function createMatch(name, params = {}, extra = {}) {
  return {
    name,
    params,
    query: new URLSearchParams(),
    meta: {},
    branch: [{ name }],
    info: undefined,
    ...extra,
  };
}

const RecordingPage = Application.extend({
  initialize() {
    this.runs = [];
  },
  onStart(app, options) {
    this.runs.push(options);
  },
});

describe('RouteState', () => {
  it('exposes the parts of its match', () => {
    const query = new URLSearchParams('a=1');
    const match = createMatch('patient:flow', { patientId: '1' }, {
      query,
      meta: { area: 'patients' },
      info: { entryTarget: 'form' },
      branch: [{ name: 'patient' }, { name: 'patient:flow' }],
    });
    const route = new RouteState(match);

    assert.equal(route.getMatch(), match);
    assert.equal(route.getName(), 'patient:flow');
    assert.deepEqual(route.getParams(), { patientId: '1' });
    assert.equal(route.getQuery(), query);
    assert.deepEqual(route.getMeta(), { area: 'patients' });
    assert.deepEqual(route.getInfo(), { entryTarget: 'form' });
  });

  it('includes a name found anywhere in the match branch', () => {
    const route = new RouteState(createMatch('patient:flow', {}, {
      branch: [{ name: undefined }, { name: 'patient' }, { name: 'patient:flow' }],
    }));

    assert.equal(route.includes('patient'), true);
    assert.equal(route.includes('patient:flow'), true);
    assert.equal(route.includes('worklist'), false);
  });

  it('triggers change with the new and previous match when the match changes', () => {
    const first = createMatch('worklist');
    const second = createMatch('schedule');
    const route = new RouteState(first);
    const changes = [];
    route.on('change', (...args) => changes.push(args));

    route.set(second);

    assert.equal(route.getMatch(), second);
    assert.equal(route.getName(), 'schedule');
    assert.deepEqual(changes, [[route, second, first]]);
  });

  it('does not trigger change for the same match object', () => {
    const match = createMatch('worklist');
    const route = new RouteState(match);
    let changes = 0;
    route.on('change', () => changes++);

    route.set(match);
    route.set({ ...match });

    assert.equal(changes, 1);
  });

  it('ignores set after it is destroyed and releases its listeners', () => {
    const first = createMatch('worklist');
    const route = new RouteState(first);
    let changes = 0;
    route.on('change', () => changes++);

    route.destroy();
    route.set(createMatch('schedule'));

    assert.equal(route.isDestroyed(), true);
    assert.equal(route.getMatch(), first);
    assert.equal(changes, 0);
  });
});

describe('RouteOutlet', () => {
  let owner;
  let outlet;
  let cleanupErrors;

  beforeEach(async() => {
    cleanupErrors = [];
    owner = new Application();
    await owner.start();
    outlet = new RouteOutlet({ owner, onCleanupError: (error, app) => cleanupErrors.push([error, app]) });
  });

  afterEach(() => {
    owner.destroy();
  });

  function addPage(name, Page = RecordingPage) {
    return owner.addChildApp(name, new Page());
  }

  function show(name, params = {}, selection = {}) {
    return outlet.show(name, { match: createMatch(name, params), ...selection });
  }

  describe('selection', () => {
    it('starts the child with a route seeded with the match and the caller options', async() => {
      const page = addPage('page');
      const match = createMatch('page', { id: '1' });
      const feature = {};

      const shown = await outlet.show('page', { match, options: { feature } });

      assert.equal(shown, page);
      assert.equal(outlet.getCurrent(), page);
      assert.equal(page.isRunning(), true);
      const [{ route, feature: passed }] = page.runs;
      assert.ok(route instanceof RouteState);
      assert.equal(route.getMatch(), match);
      assert.equal(passed, feature);
    });

    it('rejects an unknown child without retiring the selected child', async() => {
      const page = addPage('page');
      await show('page');

      await assert.rejects(show('missing'), { message: 'Child application "missing" is not registered' });

      assert.equal(outlet.getCurrent(), page);
      assert.equal(page.isRunning(), true);
    });

    it('stops the old child synchronously and completes only the latest replacement', async() => {
      const current = addPage('current');
      const first = addPage('first');
      const latest = addPage('latest');
      await show('current');

      const firstShow = show('first');
      assert.equal(current.isRunning(), false);
      const latestShow = show('latest');

      assert.equal(await firstShow, undefined);
      assert.equal(await latestShow, latest);
      assert.equal(first.isRunning(), false);
      assert.equal(outlet.getCurrent(), latest);
    });

    it('creates a new route for a replacement and destroys the replaced route', async() => {
      const first = addPage('first');
      const second = addPage('second');
      await show('first');
      const [{ route: firstRoute }] = first.runs;

      await show('second');
      const [{ route: secondRoute }] = second.runs;

      assert.equal(first.isRunning(), false);
      assert.notEqual(secondRoute, firstRoute);
      assert.equal(firstRoute.isDestroyed(), true);
      assert.equal(secondRoute.isDestroyed(), false);
    });

    it('replaces the child when the key changes', async() => {
      const page = addPage('page');
      await show('page', { id: '1' }, { key: { id: '1' } });
      const [{ route: firstRoute }] = page.runs;

      await show('page', { id: '2' }, { key: { id: '2' } });

      assert.equal(page.runs.length, 2);
      assert.notEqual(page.runs[1].route, firstRoute);
      assert.equal(page.runs[1].route.getParams().id, '2');
    });

    it('replaces the child when restart is requested', async() => {
      const page = addPage('page');
      await show('page', {}, { key: { id: '1' } });
      let stops = 0;
      page.on('stop', () => stops++);

      await show('page', {}, { key: { id: '1' }, restart: true });

      assert.equal(stops, 1);
      assert.equal(page.runs.length, 2);
    });
  });

  describe('reuse', () => {
    it('updates the route of the running child when the key is equal', async() => {
      const page = addPage('page');
      await show('page', { id: '1' }, { key: { id: '1', scope: ['a'] } });
      const [{ route }] = page.runs;
      const changes = [];
      route.on('change', (...args) => changes.push(args));
      const next = createMatch('page', { id: '1' }, { query: new URLSearchParams('tab=2') });

      const shown = await outlet.show('page', { key: { id: '1', scope: ['a'] }, match: next });

      assert.equal(shown, page);
      assert.equal(page.runs.length, 1);
      assert.equal(route.getMatch(), next);
      assert.equal(changes.length, 1);
    });

    it('reuses the child when the key is omitted', async() => {
      const page = addPage('page');
      await show('page', { id: '1' });
      const second = createMatch('page', { id: '2' });

      await outlet.show('page', { match: second });

      assert.equal(page.runs.length, 1);
      assert.equal(page.runs[0].route.getMatch(), second);
    });

    it('starts a reused child that stopped independently, with the retained route', async() => {
      const page = addPage('page');
      await show('page');
      const [{ route }] = page.runs;
      page.stop();
      const next = createMatch('page', { id: '2' });

      const shown = await outlet.show('page', { match: next });

      assert.equal(shown, page);
      assert.equal(page.isRunning(), true);
      assert.equal(page.runs.length, 2);
      assert.equal(page.runs[1].route, route);
      assert.equal(route.getMatch(), next);
    });

    it('gives a still-preparing child the latest match before it starts', async() => {
      const ready = deferred();
      const Slow = RecordingPage.extend({ prepareStart: () => ready.promise });
      const page = addPage('page', Slow);
      const first = show('page');
      const latest = createMatch('page', { id: '2' });

      const second = outlet.show('page', { match: latest });
      ready.resolve();

      assert.equal(await first, undefined);
      assert.equal(await second, page);
      assert.equal(page.runs.length, 1);
      assert.equal(page.runs[0].route.getMatch(), latest);
    });
  });

  describe('owner lifecycle', () => {
    it('cancels replacement preparation when its owner stops', async() => {
      const ready = deferred();
      const next = addPage('next', Application.extend({ prepareStart: () => ready.promise }));
      const replacing = show('next');

      assert.equal(owner.stop(), true);
      ready.resolve();

      assert.equal(await replacing, undefined);
      assert.equal(next.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });

    it('invalidates pending selection even when its owner is already stopped', async() => {
      owner.stop();
      const child = addPage('child');
      let starts = 0;
      const { start } = child;
      child.start = options => {
        starts++;
        return start.call(child, options);
      };
      const selecting = show('child');

      owner.stop();

      assert.equal(await selecting, undefined);
      assert.equal(starts, 1);
      assert.equal(child.isRunning(), false);
    });

    it('clears a live child selected beneath an already-stopped owner', async() => {
      owner.stop();
      const child = addPage('child');
      await show('child');
      assert.equal(child.isRunning(), true);

      owner.stop();

      assert.equal(child.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });

    it('cancels child preparation when its owner is destroyed', async() => {
      const readiness = deferred();
      const preparing = deferred();
      const child = addPage('child', Application.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }));
      const selecting = show('child');
      await preparing.promise;

      owner.destroy();
      readiness.resolve();

      assert.equal(await selecting, undefined);
      assert.equal(child.isDestroyed(), true);
      assert.equal(outlet.getCurrent(), null);
      assert.equal(outlet.isDestroyed(), true);
    });

    it('invalidates pending selection when its owner restarts', async() => {
      const ready = deferred();
      const child = addPage('child', RecordingPage.extend({ prepareStart: () => ready.promise }));
      const selecting = show('child');

      await owner.restart();
      ready.resolve();

      assert.equal(await selecting, undefined);
      assert.equal(child.isRunning(), true);
      assert.equal(outlet.getCurrent(), child);
    });

    it('invalidates pending selection and stops the current child on stop()', async() => {
      const current = addPage('current');
      const ready = deferred();
      const next = addPage('next', Application.extend({ prepareStart: () => ready.promise }));
      await show('current');
      const selecting = show('next');

      assert.equal(outlet.stop(), true);
      ready.resolve();

      assert.equal(await selecting, undefined);
      assert.equal(current.isRunning(), false);
      assert.equal(next.isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
    });
  });

  describe('failure', () => {
    it('stops partially started descendants after failed child preparation', async() => {
      const failure = new Error('page failed');
      const child = addPage('child', Application.extend({
        childApps: { nested: Application },
        async prepareStart() {
          await this.getChildApp('nested').start();
          throw failure;
        },
      }));
      const next = addPage('next');

      const error = await show('child').catch(thrown => thrown);

      assert.equal(error, failure);
      assert.equal(child.getChildApp('nested').isRunning(), false);
      assert.equal(outlet.getCurrent(), null);
      assert.equal(await show('next'), next);
    });

    it('preserves the activation error when cleanup throws', async() => {
      const failure = { resource: 'action', error: { response: { status: 410 } } };
      const cleanupFailure = new Error('cleanup failed');
      const child = addPage('child', Application.extend({
        childApps: { nested: Application },
        async prepareStart() {
          const nested = this.getChildApp('nested');
          await nested.start();
          nested.onBeforeStop = () => {
            throw cleanupFailure;
          };
          throw failure;
        },
      }));

      const error = await show('child').catch(thrown => thrown);
      child.getChildApp('nested').onBeforeStop = () => {};

      assert.equal(error, failure);
      assert.deepEqual(cleanupErrors, [[cleanupFailure, child]]);
      assert.equal(outlet.getCurrent(), child);
    });

    it('reports cleanup separately without turning cancellation into activation failure', async() => {
      const cleanupFailure = new Error('cleanup failed');
      const child = addPage('child', Application.extend({
        childApps: { nested: Application },
        start: () => Promise.resolve(false),
      }));
      const nested = child.getChildApp('nested');
      await nested.start();
      nested.onBeforeStop = () => {
        throw cleanupFailure;
      };

      const shown = await show('child');
      nested.onBeforeStop = () => {};

      assert.equal(shown, undefined);
      assert.deepEqual(cleanupErrors, [[cleanupFailure, child]]);
      assert.equal(outlet.getCurrent(), child);
    });

    it('clears the selection when a canceled child start leaves it stopped', async() => {
      addPage('child', Application.extend({ start: () => Promise.resolve(false) }));

      assert.equal(await show('child'), undefined);
      assert.equal(outlet.getCurrent(), null);
    });

    it('keeps a canceled child selected while it is still running', async() => {
      const child = addPage('child');
      await child.start();
      child.start = () => Promise.resolve(false);

      assert.equal(await show('child'), undefined);
      assert.equal(outlet.getCurrent(), child);
      assert.equal(child.isRunning(), true);
    });

    it('ignores a late startup failure after a newer child has been selected', async() => {
      const readiness = deferred();
      const preparing = deferred();
      const child = addPage('child', Application.extend({
        prepareStart() {
          preparing.resolve();
          return readiness.promise;
        },
      }));
      const next = addPage('next');
      const selecting = show('child');
      await preparing.promise;
      const replacing = show('next');

      readiness.reject(new Error('obsolete page failed'));

      assert.equal(await selecting, undefined);
      assert.equal(await replacing, next);
      assert.equal(outlet.getCurrent(), next);
      assert.equal(child.isRunning(), false);
    });

    it('rejects only the newest selection when a reused start fails', async() => {
      const failure = new Error('page failed');
      const ready = deferred();
      addPage('page', Application.extend({ prepareStart: () => ready.promise }));
      const first = show('page');
      const second = show('page');
      ready.reject(failure);

      assert.equal(await first, undefined);
      await assert.rejects(second, failure);
      assert.equal(outlet.getCurrent(), null);
    });
  });

  describe('asynchronous child stop', () => {
    function addStubbornPage(name, stop) {
      const page = addPage(name);
      const stopPage = page.stop;
      page.stop = () => {
        stopPage.call(page);
        return stop();
      };
      return page;
    }

    it('shares one in-flight stop between overlapping replacements', async() => {
      const gate = deferred();
      let stops = 0;
      addStubbornPage('slow', () => {
        stops++;
        return gate.promise;
      });
      const first = addPage('first');
      const latest = addPage('latest');
      await show('slow');

      const firstShow = show('first');
      const latestShow = show('latest');
      gate.resolve(true);

      assert.equal(await firstShow, undefined);
      assert.equal(await latestShow, latest);
      assert.equal(stops, 1);
      assert.equal(first.isRunning(), false);
      assert.equal(outlet.getCurrent(), latest);
    });

    it('does not reuse a child that is being retired', async() => {
      const gate = deferred();
      const slow = addStubbornPage('slow', () => gate.promise);
      addPage('next');
      await show('slow', {}, { key: { id: 1 } });

      const leaving = show('next');
      const returning = show('slow', {}, { key: { id: 1 } });
      gate.resolve(true);

      assert.equal(await leaving, undefined);
      assert.equal(await returning, slow);
      assert.equal(slow.runs.length, 2);
    });

    it('does not authorize replacement when the stop resolves false', async() => {
      const gate = deferred();
      const slow = addStubbornPage('slow', () => gate.promise);
      const next = addPage('next');
      await show('slow');

      const replacing = show('next');
      gate.resolve(false);

      assert.equal(await replacing, undefined);
      assert.equal(next.isRunning(), false);
      assert.equal(outlet.getCurrent(), slow);
    });

    it('keeps the selection and rejects the newest call when the stop rejects', async() => {
      const gate = deferred();
      const failure = new Error('stop failed');
      const slow = addStubbornPage('slow', () => gate.promise);
      addPage('first');
      const latest = addPage('latest');
      await show('slow');

      const firstShow = show('first');
      const latestShow = show('latest');
      gate.reject(failure);

      assert.equal(await firstShow, undefined);
      await assert.rejects(latestShow, failure);
      assert.equal(latest.isRunning(), false);
      assert.equal(outlet.getCurrent(), slow);
    });

    it('keeps the selection and rejects when the stop throws', async() => {
      const failure = new Error('stop failed');
      let failing = false;
      const slow = addStubbornPage('slow', () => {
        if (failing) throw failure;
        return true;
      });
      addPage('next');
      await show('slow');
      failing = true;

      await assert.rejects(show('next'), failure);
      failing = false;

      assert.equal(outlet.getCurrent(), slow);
    });

    it('returns the in-flight stop from stop()', async() => {
      const gate = deferred();
      const slow = addStubbornPage('slow', () => gate.promise);
      await show('slow');

      const stopping = outlet.stop();
      gate.resolve(true);

      assert.equal(await stopping, true);
      assert.equal(outlet.getCurrent(), null);
      assert.equal(slow.isRunning(), false);
    });
  });
});
