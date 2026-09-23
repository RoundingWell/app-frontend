import assert from 'node:assert/strict';
import test from 'node:test';
import { deferCoverageReport } from './cypress-coverage-events.js';

test('headless runs collect every spec but generate one report after the run', async() => {
  const events = {};
  const collected = [];
  let reports = 0;
  const register = deferCoverageReport((name, handler) => {
    events[name] = handler;
  }, { isTextTerminal: true, isInteractive: true });
  register('task', {
    combineCoverage: value => {
      collected.push(value);
      return null;
    },
    coverageReport: async() => {
      reports++;
      return 'coverage';
    },
  });
  for (let spec = 0; spec < 52; spec++) {
    events.task.combineCoverage(spec);
    assert.equal(events.task.coverageReport(), null);
  }
  assert.equal(reports, 0);
  assert.equal(collected.length, 52);
  assert.equal(await events['after:run'](), 'coverage');
  assert.equal(reports, 1);
});

test('interactive runs retain per-spec reporting and other events pass through', () => {
  const events = {};
  const on = (name, handler) => {
    events[name] = handler;
  };
  const task = { coverageReport: () => 'coverage' };
  deferCoverageReport(on, { isTextTerminal: false, isInteractive: true })('task', task);
  assert.equal(events.task, task);
  assert.equal(events['after:run'], undefined);
  const preprocess = () => {};
  deferCoverageReport(on, { isTextTerminal: true, isInteractive: true })('file:preprocessor', preprocess);
  assert.equal(events['file:preprocessor'], preprocess);
});

test('report failures reject run completion instead of silently dropping coverage', async() => {
  const events = {};
  deferCoverageReport((name, handler) => {
    events[name] = handler;
  }, { isTextTerminal: true, isInteractive: true })('task', {
    coverageReport: async() => {
      throw new Error('report failed');
    },
  });
  await assert.rejects(events['after:run'], /report failed/);
});

test('only E2E contributes coverage for apps, entity services, and services', () => {
  const coverage = {
    '/workspace/src/js/apps/patients/example.js': { s: { 0: 1 } },
    'src/js/entities-service/actions.js': { s: { 0: 1 } },
    'C:\\workspace\\src\\js\\services\\sidebar.js': { s: { 0: 1 } },
    '/workspace/src/js/components/tooltip/index.js': { s: { 0: 1 } },
    '/workspace/src/js/behaviors/iframe-form.js': { s: { 0: 1 } },
  };

  for (const testingType of ['component', 'e2e']) {
    const events = {};
    let collected;
    const register = deferCoverageReport((event, handler) => {
      events[event] = handler;
    }, { isTextTerminal: true, testingType });
    register('task', {
      combineCoverage: value => {
        collected = JSON.parse(value);
        return null;
      },
      coverageReport: () => null,
    });
    assert.equal(events.task.combineCoverage(JSON.stringify(coverage)), null);
    const expected = testingType === 'component' ? Object.keys(coverage).slice(3) : Object.keys(coverage);
    assert.deepEqual(Object.keys(collected), expected);
  }
});
