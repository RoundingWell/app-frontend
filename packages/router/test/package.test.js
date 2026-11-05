import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
import { Router, RouteApplication, ChildAppSwitcher, memoryDriver } from '@mnjs/router';

test('the local source shares the pinned Application family and awaits selected content', async () => {
  const driver = memoryDriver({ url: 'https://router.test/' });
  const router = new Router({ driver });
  const pages = new ChildAppSwitcher();
  let release;
  const page = pages.addChildApp('page', new (Application.extend({
    prepareStart() { return new Promise(resolve => { release = resolve; }); },
  }))());
  const feature = new (RouteApplication.extend({
    routes: { page: { path: '/page/:id', handler: 'showPage' } },
    showPage(match) { return pages.switchTo('page', { key: match.params, signal: match.signal }); },
  }))({ router });
  assert.ok(router instanceof Application);
  assert.ok(feature instanceof Application);
  await pages.start();
  await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'unmatched');
  const ready = [];
  router.on('route:ready', match => ready.push(match.params.id));
  const first = router.navigate('page', { id: 'one' });
  await first.committed;
  assert.deepEqual(ready, []);
  const newer = router.navigate('page', { id: 'one' });
  await newer.committed;
  release();
  assert.equal(await first.finished, false);
  assert.equal(await newer.finished, true);
  assert.deepEqual(ready, ['one']);
  assert.equal(pages.getCurrent(), page);
  pages.stop();
  assert.equal(page.isRunning(), false);
  router.destroy();
  feature.destroy();
  pages.destroy();
});

test('initial route failure is observable separately from Application activation', async () => {
  const error = new Error('failed page');
  const router = new Router({
    driver: memoryDriver({ url: 'https://router.test/page' }),
    routes: { page: { path: '/page', handler() { throw error; } } },
  });
  const errors = [];
  router.on('route:error', failure => errors.push(failure));
  await router.start();
  const result = await router.getInitialDispatch();
  assert.equal(result.status, 'failed');
  assert.equal(result.error, error);
  assert.deepEqual(errors, [error]);
  router.destroy();
});
