import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
import Backbone from 'backbone';

import EventRouter from '../event-router.js';

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
