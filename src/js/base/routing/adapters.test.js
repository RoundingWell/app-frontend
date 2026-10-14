import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import BackboneApi from '@mnjs/adapters/backbone';

let directory;
let adapters;

// Bundle only the actual base adapters so Node can resolve repository-style
// extensionless imports. Telemetry is replaced; routing/lifecycle code is real.
async function loadAdapters() {
  if (adapters) return adapters;
  const cache = path.resolve('node_modules/.cache');
  await mkdir(cache, { recursive: true });
  directory = await mkdtemp(path.join(cache, 'routing-adapters-'));
  const target = path.join(directory, 'adapters.mjs');
  const result = await build({
    stdin: {
      contents: `export { default as RouterApp } from './src/js/base/routerapp.js';
        export { default as SubRouterApp } from './src/js/base/subrouterapp.js';
        export { default as RouteBaseApp } from './src/js/base/route-base-app.js';`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    plugins: [{
      name: 'test-telemetry',
      setup(builder) {
        builder.onResolve({ filter: /^js\/datadog$/ }, () => ({ path: 'telemetry', namespace: 'test-telemetry' }));
        builder.onLoad({ filter: /.*/, namespace: 'test-telemetry' }, () => ({ contents: 'export function addError() {}' }));
      },
    }],
  });
  await writeFile(target, result.outputFiles[0].text);
  adapters = await import(pathToFileURL(target));
  return adapters;
}

after(async() => {
  if (directory) await rm(directory, { recursive: true });
});

test('optional RouterApp exposes its router before overridden construction hooks', async() => {
  const { RouterApp } = await loadAdapters();
  let routerDuringPreinitialize;
  let routerDuringInitialize;
  const Consumer = RouterApp.extend({
    eventRoutes: { root: { root: true, route: 'root', action: 'showRoot' } },
    preinitialize() {
      routerDuringPreinitialize = this.router;
    },
    initialize() {
      routerDuringInitialize = this.router;
    },
    showRoot() {
      this.shown = true;
    },
  });
  const app = new Consumer();
  assert.equal(routerDuringPreinitialize, app.router);
  assert.equal(routerDuringInitialize, app.router);
  assert.equal(app.router.getDefaultRoute('root'), 'root');
  await app.routeAction('root', 'showRoot');
  assert.equal(app.shown, true);
  app.destroy();
});

test('optional SubRouterApp startup hooks remain extensible without duplicate dispatch', async() => {
  const { SubRouterApp } = await loadAdapters();
  const calls = [];
  const Consumer = SubRouterApp.extend({
    routeScope: ['patientId'],
    routeActions: { detail: 'showDetail' },
    initialize() {
      assert.ok(this.routing);
    },
    onStart() {
      this.startCurrentRoute();
    },
    showDetail(...args) {
      calls.push(args);
    },
  }).setStateApi(BackboneApi);
  const app = new Consumer();
  const route = { event: 'detail', eventArgs: ['p1', 'a1'] };
  await app.startRoute(route, { patientId: 'p1' });
  assert.deepEqual(calls, [['p1', 'a1']]);
  await app.restart();
  assert.deepEqual(calls, [['p1', 'a1'], ['p1', 'a1']]);
  const overtaken = app.startRoute({ event: 'detail', eventArgs: ['p1', 'a2'] });
  app.stop();
  await overtaken;
  assert.equal(calls.length, 2);
  app.destroy();
});
