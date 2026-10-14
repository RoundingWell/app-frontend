import { navigationDriver } from '@mnjs/router';

import { driverConformance } from '../../../packages/router/test/conformance';

function documentLoaded() {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
}

driverConformance({
  name: 'navigationDriver',
  async createDriver() {
    await documentLoaded();
    return { driver: navigationDriver(window.navigation) };
  },
  describe,
  it,
  assert,
});
