import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { memoryDriver } from '../src/drivers/memory.js';
import { routerConformance } from './conformance/router.js';

routerConformance({
  name: 'memoryDriver',
  createDriver: () => ({ driver: memoryDriver() }),
  describe,
  it,
  assert,
});
