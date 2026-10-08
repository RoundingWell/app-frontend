import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findSpecs, selectSpecs, splitSpecs } from './run-component-shard.js';

test('CI discovers both product and support component specs without selecting E2E files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'component-shard-'));
  try {
    mkdirSync(join(directory, 'src'), { recursive: true });
    mkdirSync(join(directory, 'test/support'), { recursive: true });
    writeFileSync(join(directory, 'src/product.component.cy.js'), 'product');
    writeFileSync(join(directory, 'test/support/api-guard.component.cy.js'), 'guard');
    writeFileSync(join(directory, 'test/support/api-guard.e2e.cy.js'), 'e2e');

    assert.deepEqual(findSpecs(directory).sort((a, b) => a.path.localeCompare(b.path)), [
      { path: 'src/product.component.cy.js', size: 7 },
      { path: 'test/support/api-guard.component.cy.js', size: 5 },
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const specs = Array.from({ length: 52 }, (_, i) => ({ path: `spec-${ i }.cy.js`, size: (i + 1) * 100 }));

test('four workers cover every spec exactly once and balance estimated work', () => {
  const groups = splitSpecs(specs, 4);
  assert.equal(new Set(groups.flat()).size, specs.length);
  assert.deepEqual(groups.flat().sort(), specs.map(spec => spec.path).sort());
  const sizes = groups.map(group => group.reduce((sum, path) => sum + specs.find(spec => spec.path === path).size, 0));
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 5200);
  assert.deepEqual(splitSpecs([...specs].reverse(), 4), groups);
});

test('single-worker runs cover the full suite', () => {
  assert.deepEqual(selectSpecs(specs, {}), specs.map(spec => spec.path).sort());
});

test('CircleCI worker coordinates select distinct groups', () => {
  const groups = splitSpecs(specs, 4);
  for (let index = 0; index < 4; index++) {
    assert.deepEqual(selectSpecs(specs, { CIRCLE_NODE_TOTAL: '4', CIRCLE_NODE_INDEX: String(index) }), groups[index]);
  }
});

test('invalid or empty worker assignments fail instead of accidentally running all specs', () => {
  for (const count of [0, -1, 1.5, NaN, 53]) assert.throws(() => splitSpecs(specs, count));
  assert.throws(() => splitSpecs([], 1));
  for (const index of ['-1', '4', '1.5', 'invalid']) {
    assert.throws(() => selectSpecs(specs, { CIRCLE_NODE_TOTAL: '4', CIRCLE_NODE_INDEX: index }));
  }
  assert.deepEqual(splitSpecs([{ path: 'a', size: 0 }, { path: 'b', size: 0 }], 2), [['a'], ['b']]);
});
