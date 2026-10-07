import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { transformSync } from '@babel/core';
import coverageConfig from '../config/coverage.cjs';
import { assertCompleteInventory, completeCoverage } from './report-coverage.js';
import { deferCoverageReport } from './cypress-coverage-events.js';

const config = JSON.parse(readFileSync(resolve('.nycrc.json'), 'utf8'));

function fixture(t) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'coverage-inventory-test-')));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (file, text) => {
    mkdirSync(join(cwd, file, '..'), { recursive: true });
    writeFileSync(join(cwd, file), text);
  };
  write('.nycrc.json', JSON.stringify(config));
  write('src/js/loaded.js', 'export const value = 1;\n');
  write('src/js/unloaded.js', 'export function select(value) { return value ? 1 : 2; }\n');
  write('src/js/components/index.js', 'export { value } from \'./loaded.js\';\n');
  write('src/js/ignored.js', '/* istanbul ignore file */\nexport const ignored = 1;\n');
  write('src/js/auth.js', 'export const excluded = 1;\n');
  write('src/js/index.js', 'export const excluded = 1;\n');
  write('src/js/datadog.js', 'export const excluded = 1;\n');
  write('src/js/base/excluded.js', 'export const excluded = 1;\n');
  write('src/js/example.e2e.cy.js', 'export const excluded = 1;\n');
  return { cwd, write };
}

function collected(cwd, file, count = 1) {
  let coverage;
  transformSync(readFileSync(join(cwd, file), 'utf8'), {
    ...coverageConfig.coverageBabelOptions({ cwd, config, onCover: (path, value) => {
      coverage = value;
    } }),
    filename: join(cwd, file),
  });
  for (const key of Object.keys(coverage.s)) coverage.s[key] = count;
  for (const key of Object.keys(coverage.f)) coverage.f[key] = count;
  for (const key of Object.keys(coverage.b)) coverage.b[key].fill(count);
  return coverage;
}

function input(coverage, path = coverage.path) {
  return { [path]: { ...coverage, path } };
}

test('adds accurate unloaded maps, detects omission, and preserves existing counts', t => {
  const { cwd } = fixture(t);
  const covered = collected(cwd, 'src/js/loaded.js', 7);
  const { map, files } = completeCoverage(cwd, [input(covered)], config);
  assert.equal(files.length, 4);
  assert.deepEqual(map.fileCoverageFor(covered.path).s, covered.s);
  const unloaded = map.fileCoverageFor(join(cwd, 'src/js/unloaded.js'));
  assert.deepEqual(Object.values(unloaded.s), [0]);
  assert.deepEqual(Object.values(unloaded.f), [0]);
  assert.deepEqual(Object.values(unloaded.b), [[0, 0]]);
  assert.equal(unloaded.toSummary().lines.total, 1);
  // Controlled omission must fail the intended completeness assertion.
  map.filter(path => path !== unloaded.path);
  assert.throws(() => assertCompleteInventory(map, files), /inventory is missing.*unloaded/);
  const restored = completeCoverage(cwd, [input(covered)], config);
  assert.doesNotThrow(() => assertCompleteInventory(restored.map, restored.files));
});

test('retains exclusions, inline ignores, and legitimate zero-executable barrels', t => {
  const { cwd, write } = fixture(t);
  write('src/js/arm.js', 'export function choose(value) {\n/* istanbul ignore else */\nif (value) return 1; else return 2;\n}\n');
  const { map, files } = completeCoverage(cwd, [], config);
  assert.ok(!files.some(file => file.endsWith('.cy.js') || file.includes('/base/')));
  for (const file of ['auth.js', 'index.js', 'datadog.js']) {
    assert.ok(!files.includes(join(cwd, 'src/js', file)));
  }
  assert.equal(map.fileCoverageFor(join(cwd, 'src/js/components/index.js')).toSummary().lines.total, 0);
  assert.equal(map.fileCoverageFor(join(cwd, 'src/js/ignored.js')).toSummary().lines.total, 0);
  const arm = map.fileCoverageFor(join(cwd, 'src/js/arm.js'));
  assert.equal(arm.toSummary().branches.total, 1);
  assert.equal(arm.toSummary().lines.total, 1);
});

test('merges E2E and component inputs once across relative, foreign, and Windows paths', t => {
  const { cwd } = fixture(t);
  const coverage = collected(cwd, 'src/js/loaded.js', 2);
  const relative = 'src/js/loaded.js';
  const foreign = 'C:\\other-checkout\\src\\js\\loaded.js';
  const { map } = completeCoverage(cwd, [input(coverage, relative), input(coverage, foreign)], config);
  assert.equal(map.files().filter(file => file.endsWith('/loaded.js')).length, 1);
  assert.deepEqual(Object.values(map.fileCoverageFor(coverage.path).s), [4]);
});

test('aggregate reporting retains E2E app hits and only permitted component hits', t => {
  const { cwd, write } = fixture(t);
  write('src/js/apps/example.js', 'export const app = 1;\n');
  const inputs = [];
  for (const [testingType, count] of [['component', 3], ['e2e', 2]]) {
    const events = {};
    deferCoverageReport((event, handlers) => {
      events[event] = handlers;
    }, { testingType, isTextTerminal: true })('task', {
      combineCoverage: value => inputs.push(JSON.parse(value)),
      coverageReport: () => null,
    });
    const unit = collected(cwd, 'src/js/loaded.js', count);
    const app = collected(cwd, 'src/js/apps/example.js', count);
    events.task.combineCoverage(JSON.stringify({ ...input(unit), ...input(app) }));
  }
  const { map } = completeCoverage(cwd, inputs, config);
  assert.deepEqual(Object.values(map.fileCoverageFor(join(cwd, 'src/js/loaded.js')).s), [5]);
  assert.deepEqual(Object.values(map.fileCoverageFor(join(cwd, 'src/js/apps/example.js')).s), [2]);
});

test('rejects incompatible source maps instead of merging coverage from changed source', t => {
  const { cwd, write } = fixture(t);
  const coverage = collected(cwd, 'src/js/loaded.js');
  write('src/js/loaded.js', 'export const value = 1;\nexport const changed = 2;\n');
  assert.throws(() => completeCoverage(cwd, [input(coverage)], config), /source map differs/);
});

test('the custom report command includes unloaded files and leaves raw collection untouched', t => {
  const { cwd, write } = fixture(t);
  const raw = JSON.stringify(input(collected(cwd, 'src/js/loaded.js', 3)));
  write('.nyc_output/out.json', raw);
  const script = resolve('scripts/report-coverage.js');
  for (const mode of [[], ['--ci']]) {
    const run = spawnSync(process.execPath, [script, ...mode, '--reporter=json', '--reporter=json-summary'], { cwd, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(join(cwd, 'coverage/coverage-final.json')));
    assert.equal(Object.keys(report).length, 4);
    assert.ok(report[join(cwd, 'src/js/unloaded.js')]);
    const summary = JSON.parse(readFileSync(join(cwd, 'coverage/coverage-summary.json'))).total;
    assert.equal(summary.lines.covered, 1);
    assert.equal(summary.lines.total, 2);
    assert.equal(readFileSync(join(cwd, '.nyc_output/out.json'), 'utf8'), raw);
  }
});

test('empty collection cannot be mistaken for completed tests', t => {
  const { cwd, write } = fixture(t);
  write('.nyc_output/empty.json', '{}');
  rmSync(join(cwd, '.nyc_output/empty.json'));
  const run = spawnSync(process.execPath, [resolve('scripts/report-coverage.js')], { cwd, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /No collected coverage input/);
});
