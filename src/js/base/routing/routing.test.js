import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
import Backbone from 'backbone';

import EventRouter from '../event-router.js';
import { bindRouteApplication } from './application-binding.js';
import { bindApplicationRouter } from './application-router.js';
import { createBackboneRouteTransport } from './backbone-transport.js';

import { createRouteTable, translateRoute } from './route-table.js';
import { createRouteDispatch } from './route-dispatch.js';
import { createChildSelection } from './child-selection.js';
import { createRouteDelivery } from './route-delivery.js';
import { createRouteActions } from './route-actions.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('definitions preserve aliases, workspace prefix, metadata and transient args', () => {
  const table = createRouteTable({
    patient: { route: ['patient/:id/workflow', 'patient/dashboard/:id'], action: 'show' },
    list: { route: 'worklist/:id', action: 'list', meta: { isList: true } },
    root: { root: true, route: '', action: 'root' },
  }, { workspaceSlug: 'one' });
  assert.deepEqual(table.triggers.patient, ['one/patient/:id/workflow', 'one/patient/dashboard/:id']);
  assert.equal(table.href('patient', 'p1'), 'one/patient/p1/workflow');
  assert.equal(table.href('root'), '');
  const info = { clinicianId: 'c1' };
  assert.deepEqual(table.context('list', ['owned-by', info]).eventArgs, ['owned-by', info]);
  assert.equal(table.context('list', []).definition.meta.isList, true);
  assert.equal(translateRoute('program/:id/action/:id', ['p1', 'a1']), 'program/p1/action/a1');
});

test('navigation authority supersedes preparation without stopping shared resource work', async() => {
  const ready = deferred();
  const dispatched = [];
  let firstNavigation;
  const routing = createRouteDispatch({
    prepare: navigation => {
      firstNavigation ||= navigation;
      return ready.promise;
    },
    dispatch: ({ route }) => dispatched.push(route),
    onError: error => {
      throw error;
    },
  });
  const first = routing.accept('first');
  const latest = routing.accept('latest');
  assert.equal(firstNavigation.signal.aborted, true);
  ready.resolve(true);
  await Promise.all([first, latest]);
  assert.deepEqual(dispatched, ['latest']);
  routing.dispose();
  await routing.accept('disposed');
  assert.deepEqual(dispatched, ['latest']);
});

test('synchronous abort navigation owns authority before the outer route can dispatch', async() => {
  const dispatched = [];
  let nested;
  const routing = createRouteDispatch({
    dispatch: navigation => {
      dispatched.push(navigation.route);
      if (navigation.route === 'first') {
        navigation.signal.addEventListener('abort', () => {
          nested = routing.accept('nested');
        });
      }
    },
    onError: error => {
      throw error;
    },
  });
  await routing.accept('first');
  await routing.accept('outer');
  await nested;
  assert.deepEqual(dispatched, ['first', 'nested']);
});

test('obsolete rejection is observed; current failures use the supplied policy', async() => {
  const old = deferred();
  const errors = [];
  const routing = createRouteDispatch({
    dispatch: ({ route }) => route === 'old' ? old.promise : Promise.reject('current'),
    onError: (error, route) => errors.push([error, route]),
  });
  const first = routing.accept('old');
  await routing.accept('new');
  old.reject('obsolete');
  await first;
  assert.deepEqual(errors, [['current', 'new']]);
});

test('plain Application uses child selection independently of URLs', async() => {
  const ready = deferred();
  const owner = new Application();
  const slow = owner.addChildApp('slow', new (Application.extend({ prepareStart: () => ready.promise }))());
  const latest = owner.addChildApp('latest', new Application());
  const selection = createChildSelection({ getChild: name => owner.getChildApp(name), onCleanupError: assert.fail });
  const selecting = selection.select('slow', { start: app => app.start() });
  const replacing = selection.select('latest', { start: app => app.start() });
  ready.resolve();
  assert.equal(await selecting, undefined);
  assert.equal(await replacing, latest);
  assert.equal(slow.isRunning(), false);
  await assert.rejects(selection.select('missing', { start: app => app.start() }));
  assert.equal(selection.getCurrent(), latest);
  selection.invalidate();
  owner.stop();
  selection.clear();
  assert.equal(selection.getCurrent(), null);
  owner.destroy();
});

test('cleanup keeps the original failure and retains failed teardown for retry', async() => {
  const failure = new Error('readiness');
  const cleanupFailure = new Error('teardown');
  const owner = new Application();
  const child = owner.addChildApp('child', new (Application.extend({
    childApps: { nested: Application },
    async prepareStart() {
      await this.getChildApp('nested').start();
      throw failure;
    },
  }))());
  child.getChildApp('nested').onBeforeStop = () => {
    throw cleanupFailure;
  };
  const errors = [];
  const selection = createChildSelection({ getChild: name => owner.getChildApp(name), onCleanupError: error => errors.push(error) });
  await assert.rejects(selection.select('child', { start: app => app.start() }), error => error === failure);
  assert.deepEqual(errors, [cleanupFailure]);
  assert.equal(selection.getCurrent(), child);
  child.getChildApp('nested').onBeforeStop = () => {};
  selection.stop();
  owner.destroy();
});

test('same-resource detail changes share real Application preparation and dispatch once', async() => {
  const ready = deferred();
  let current;
  let preparations = 0;
  const dispatched = [];
  const app = new (Application.extend({
    prepareStart() {
      preparations++;
      return ready.promise;
    },
    onStart() {
      dispatched.push(current);
    },
  }))();
  const delivery = createRouteDelivery({
    start: options => app.start(options), read: () => current,
    write: route => {
      current = route;
    }, dispatch: route => dispatched.push(route),
  });
  app.on('start', () => delivery.activated());
  app.on('before:stop', () => delivery.invalidate());
  const first = delivery.accept('workflow', { patientId: 'p1' });
  const latest = delivery.accept('action', { patientId: 'p1' });
  ready.resolve();
  await Promise.all([first, latest]);
  assert.equal(preparations, 1);
  assert.deepEqual(dispatched, ['action']);
  await delivery.accept('closed');
  assert.deepEqual(dispatched, ['action', 'closed']);
  const overtaken = delivery.accept('obsolete');
  app.stop();
  await overtaken;
  assert.deepEqual(dispatched, ['action', 'closed']);
  app.destroy();
});

test('route actions retain notification order and ignore obsolete async failures', async() => {
  const ready = deferred();
  const steps = [];
  let current = { event: 'show', eventArgs: ['p1'] };
  const dispatch = createRouteActions({
    getActions: () => ({ show: id => {
      steps.push(id);
      return ready.promise;
    } }),
    before: () => steps.push('before'), after: () => steps.push('after'),
    onError: () => steps.push('error'), isCurrent: route => route === current,
  });
  const work = dispatch(current);
  assert.deepEqual(steps, ['before', 'p1', 'after']);
  current = {};
  ready.reject(new Error('obsolete'));
  await work;
  assert.deepEqual(steps, ['before', 'p1', 'after']);
});

test('the standalone Backbone adapter preserves alias matching, splats and raw queries', () => {
  const channel = new Backbone.Model();
  const received = [];
  const table = createRouteTable({
    patient: { route: ['patient/:id/workflow', 'patient/dashboard/:id'] },
    workspace: { root: true, route: ['two', 'two/*route'] },
  }, { workspaceSlug: 'one' });
  const router = new EventRouter({ channel, routeTriggers: table.triggers });
  channel.on('all', (...args) => received.push(args));
  function load(fragment) {
    const handler = Backbone.history.handlers.find(candidate => candidate.cid === router.cid && candidate.route.test(fragment));
    assert.ok(handler);
    handler.callback(fragment);
  }
  load('one/patient/dashboard/p%2F1?source=a%2Fb');
  load('two/patient/p1/workflow?raw=%20');
  load('one/patient/p1/workflow');
  assert.deepEqual(received, [
    ['patient', 'p/1', 'source=a%2Fb'],
    ['workspace', 'patient/p1/workflow', 'raw=%20'],
    ['patient', 'p1', null],
  ]);
  assert.equal(router.getDefaultRoute('patient'), 'one/patient/:id/workflow');
  router.destroy();
  assert.equal(Backbone.history.handlers.some(handler => handler.cid === router.cid), false);
});

function memoryTransport() {
  let table;
  let callbacks;
  let disposed = false;
  const writes = [];
  return {
    writes,
    get disposed() {
      return disposed;
    },
    connect(routes, handlers) {
      table = routes;
      callbacks = handlers;
      return { dispose: () => {
        disposed = true;
      } };
    },
    write(url, options = {}) {
      writes.push([url, options]);
    },
    emit(event, ...args) {
      if (!disposed) return callbacks.onRoute(table.context(event, args));
    },
    leave() {
      return callbacks.onNoMatch();
    },
  };
}

function boundArea({ ready, preparations = [], details = [], errors = [], cleanupErrors = [], transitions = [] } = {}) {
  const preparing = deferred();
  const Resource = Application.extend({
    initialize() {
      this.routing = bindRouteApplication(this, {
        getScope: ({ patientId } = {}) => ({ patientId }),
        getActions: () => ({ detail: (...args) => details.push(args) }),
        onError: error => errors.push(error),
        onCleanupError: error => cleanupErrors.push(error),
      });
    },
    prepareStart(options, { signal }) {
      preparations.push([options, signal]);
      preparing.resolve();
      return ready?.promise;
    },
  });
  const Area = Application.extend({
    childApps: { resource: Resource, list: Application },
    initialize({ transport }) {
      assert.ok(this.getChildApp('resource'));
      assert.ok(this.getState());
      this.routing = bindApplicationRouter(this, {
        definitions: {
          detail: { route: ['patient/:patientId/detail/:id', 'patient/old/:patientId/:id'], action: 'showResource' },
          list: { route: 'worklist/:id', meta: { isList: true }, action: 'showList' },
        },
        workspaceSlug: 'one',
        transport,
        resolveAction: action => this[action].bind(this),
        beforeDispatch: route => transitions.push(['before', route, this.routing.getRoute()]),
        afterDispatch: route => transitions.push(['after', route]),
        onError: (error, route) => errors.push([error, route]),
        onCleanupError: error => cleanupErrors.push(error),
      });
    },
    showResource(patientId) {
      return this.routing.startRoute('resource', { patientId });
    },
    showList() {
      return this.routing.startCurrent('list');
    },
  });
  const transport = memoryTransport();
  const area = new Area({ transport });
  return { area, transport, resource: area.getChildApp('resource'), preparing };
}

test('assembled initialize bindings retain same scope, replace different scope, and preserve notifications', async() => {
  const ready = deferred();
  const preparations = [];
  const details = [];
  const transitions = [];
  const { area, transport, resource, preparing } = boundArea({ ready, preparations, details, transitions });
  const first = transport.emit('detail', 'p1', 'a1');
  await preparing.promise;
  const latest = transport.emit('detail', 'p1', 'a2');
  ready.resolve();
  await Promise.all([first, latest]);
  assert.equal(preparations.length, 1);
  assert.deepEqual(details, [['p1', 'a2']]);
  assert.equal(area.routing.getCurrent(), resource);
  assert.equal(transitions.at(-2)[1], transitions.at(-2)[2]);
  await transport.emit('detail', 'p2', 'a3');
  assert.equal(preparations.length, 2);
  assert.equal(preparations[1][0].patientId, 'p2');
  await transport.emit('list', 'owned-by');
  assert.equal(resource.isRunning(), false);
  assert.equal(area.routing.getRoute().definition.meta.isList, true);
  area.destroy();
  assert.equal(transport.disposed, true);
});

test('assembled binding dispatches after onStart, replays restart, and respects explicit early dispatch', async() => {
  const steps = [];
  const Resource = Application.extend({
    initialize() {
      this.routing = bindRouteApplication(this, { getActions: () => ({ detail: id => steps.push(id) }) });
    },
    onStart() {
      steps.push('shell');
    },
  });
  const resource = new Resource();
  const route = { event: 'detail', eventArgs: ['a1'] };
  await resource.routing.accept(route);
  assert.deepEqual(steps, ['shell', 'a1']);
  await resource.restart();
  assert.deepEqual(steps, ['shell', 'a1', 'shell', 'a1']);
  resource.onStart = () => {
    steps.push('early-shell');
    resource.routing.dispatchCurrent();
  };
  await resource.restart();
  assert.deepEqual(steps.slice(-2), ['early-shell', 'a1']);
  resource.destroy();
});

test('area disposal cancels pending resource preparation and disposes its transport', async() => {
  const ready = deferred();
  const preparations = [];
  const details = [];
  const { area, transport, resource, preparing } = boundArea({ ready, preparations, details });
  const activating = transport.emit('detail', 'p1', 'a1');
  await preparing.promise;
  area.destroy();
  assert.equal(transport.disposed, true);
  assert.equal(preparations[0][1].aborted, true);
  ready.resolve();
  await activating;
  assert.deepEqual(details, []);
  assert.equal(resource.isDestroyed(), true);
  assert.equal(area.routing.getCurrent(), null);
});

test('bound stopped owners retire selected children and block late delivery', async() => {
  const owner = new Application({ childApps: { child: Application } });
  const routing = bindRouteApplication(owner, { dispatchOnStart: false });
  await routing.startCurrent('child');
  assert.equal(owner.isRunning(), false);
  assert.equal(routing.getCurrent().isRunning(), true);
  owner.stop();
  assert.equal(routing.getCurrent(), null);
  owner.destroy();
  assert.throws(() => bindRouteApplication(owner), /already has a routing binding/);
});

test('assembled synchronous reentrant navigation selects only its latest destination', async() => {
  const { area, transport } = boundArea();
  let replacing;
  area.showResource = () => {
    replacing = transport.emit('list', 'owned-by');
    return undefined;
  };
  await transport.emit('detail', 'p1', 'a1');
  await replacing;
  assert.equal(area.routing.getRoute().event, 'list');
  assert.equal(area.routing.getCurrent(), area.getChildApp('list'));
  assert.equal(area.getChildApp('resource').isRunning(), false);
  area.destroy();
});

test('assembled cleanup failure preserves activation error and allows retry', async() => {
  const failure = new Error('load failed');
  const cleanupFailure = new Error('cleanup failed');
  const cleanupErrors = [];
  const owner = new Application();
  const routing = bindRouteApplication(owner, { dispatchOnStart: false, onCleanupError: error => cleanupErrors.push(error) });
  const resource = owner.addChildApp('resource', new (Application.extend({
    childApps: { child: Application },
    async prepareStart() {
      await this.getChildApp('child').start();
      throw failure;
    },
  }))());
  resource.getChildApp('child').onBeforeStop = () => {
    throw cleanupFailure;
  };
  await assert.rejects(routing.startCurrent('resource'), error => error === failure);
  assert.equal(routing.getCurrent(), resource);
  assert.deepEqual(cleanupErrors, [cleanupFailure]);
  resource.getChildApp('child').onBeforeStop = () => {};
  routing.stopCurrent();
  assert.equal(routing.getCurrent(), null);
  owner.destroy();
});

test('replaceable transport keeps silent writes separate from dispatch and supports departure', async() => {
  const details = [];
  const { area, transport, resource } = boundArea({ details });
  await transport.emit('detail', 'p1', 'a1');
  area.routing.replaceRoute('detail', 'p1', 'a2');
  area.routing.navigateRoute('list', 'owned-by');
  assert.deepEqual(transport.writes, [
    ['one/patient/p1/detail/a2', { replace: true }],
    ['one/worklist/owned-by', {}],
  ]);
  assert.deepEqual(details, [['p1', 'a1']]);
  transport.leave();
  assert.equal(area.routing.getRoute(), null);
  assert.equal(resource.isRunning(), false);
  area.destroy();
});

test('Backbone transport borrows an injected history and disposes only its own registrations', () => {
  const history = new Backbone.History();
  const channel = new Backbone.Model();
  const writes = [];
  history.navigate = (...args) => writes.push(args);
  history.route(/^unrelated$/, () => {});
  const transport = createBackboneRouteTransport({ channel, history });
  const received = [];
  const table = createRouteTable({ detail: { route: 'patient/:id' } }, { workspaceSlug: 'one' });
  const connection = transport.connect(table, { onRoute: route => received.push(route), onNoMatch: () => {} });
  history.handlers[0].callback('one/patient/p1?raw=%20');
  assert.deepEqual(received[0].eventArgs, ['p1', 'raw=%20']);
  assert.deepEqual(writes, []);
  channel.trigger('detail', 'p2');
  assert.deepEqual(writes, [['one/patient/p2', { trigger: false }]]);
  transport.write('one/patient/p3', { replace: true });
  assert.deepEqual(writes.at(-1), ['one/patient/p3', { trigger: false, replace: true }]);
  connection.dispose();
  assert.equal(history.handlers.length, 1);
  assert.equal(history.handlers[0].route.source, '^unrelated$');
});

test('assembled route state writes can reenter before shared preparation starts', async() => {
  const calls = [];
  let current;
  let nested;
  const app = new Application();
  const routing = bindRouteApplication(app, {
    readRoute: () => current,
    writeRoute: route => {
      current = route;
      if (route.eventArgs[0] === 'outer') nested = routing.accept({ event: 'detail', eventArgs: ['nested'] });
    },
    getActions: () => ({ detail: id => calls.push(id) }),
  });
  await routing.accept({ event: 'detail', eventArgs: ['outer'] });
  await nested;
  assert.deepEqual(calls, ['nested']);
  app.destroy();
});

test('assembled binding observes stop between active acceptance and deferred delivery', async() => {
  const calls = [];
  const app = new Application();
  const routing = bindRouteApplication(app, { getActions: () => ({ detail: id => calls.push(id) }) });
  await routing.accept({ event: 'detail', eventArgs: ['ready'] });
  const overtaken = routing.accept({ event: 'detail', eventArgs: ['obsolete'] });
  app.stop();
  await overtaken;
  assert.deepEqual(calls, ['ready']);
  app.destroy();
});

test('terminal bound applications ignore new deliveries without writing route state', async() => {
  let writes = 0;
  const app = new Application();
  const routing = bindRouteApplication(app, { writeRoute: () => {
    writes++;
  } });
  app.destroy();
  await routing.accept({ event: 'detail', eventArgs: ['obsolete'] });
  assert.equal(writes, 0);
  const { area, transport } = boundArea();
  area.destroy();
  await area.routing.accept(area.routing.table.context('detail', ['p1', 'a1']));
  assert.equal(area.routing.getRoute(), undefined);
  assert.equal(transport.disposed, true);
});

test('assembled parent starts an unscoped bound child unconditionally but retained selection requires scope', async() => {
  let runs = 0;
  const Child = Application.extend({
    initialize() {
      this.routing = bindRouteApplication(this, {
        getActions: () => ({ detail: () => {} }),
      });
    },
    onStart() {
      runs++;
    },
  });
  const parent = new Application({ childApps: { child: Child } });
  const routing = bindRouteApplication(parent, { dispatchOnStart: false });
  const child = parent.getChildApp('child');
  try {
    assert.equal(await routing.startCurrent('child'), child);
    assert.equal(child.isRunning(), true);
    assert.equal(await routing.startCurrent('child'), child);
    assert.equal(runs, 2);
    assert.throws(() => routing.startRoute('child'), /requires getScope/);
    assert.equal(child.isRunning(), true);
    assert.equal(routing.getCurrent(), child);
  } finally {
    parent.destroy();
  }
});
