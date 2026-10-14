import { navigationDriver } from '@mnjs/router';

import { driverConformance } from '../../../packages/router/test/conformance';
import { routerConformance } from '../../../packages/router/test/conformance/router';

function documentLoaded() {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
}

async function createDriver() {
  await documentLoaded();
  return { driver: navigationDriver(window.navigation) };
}

driverConformance({
  name: 'navigationDriver',
  createDriver,
  describe,
  it,
  assert,
});

routerConformance({
  name: 'navigationDriver',
  createDriver,
  describe,
  it,
  assert,
});
