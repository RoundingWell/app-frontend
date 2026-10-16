import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { memoryDriver } from '@mnjs/router';
import { routerConformance } from './conformance/router.js';

routerConformance({
  name: 'memoryDriver',
  createDriver: () => ({ driver: memoryDriver() }),
  describe,
  it,
  assert,
});
