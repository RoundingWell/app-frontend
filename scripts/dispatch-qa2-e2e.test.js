import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClientPayload, resolveInputs } from './dispatch-qa2-e2e.js';

test('resolveInputs requires version, source sha, and source run url', () => {
  assert.throws(() => resolveInputs({
    'version': 'v260327.1',
    'source-sha': 'abc123',
  }), /--version, --source-sha, and --source-run-url are required/);

  assert.throws(() => resolveInputs({
    'source-sha': 'abc123',
    'source-run-url': 'https://circleci.example/run',
  }), /--version, --source-sha, and --source-run-url are required/);

  assert.throws(() => resolveInputs({
    'version': 'v260327.1',
    'source-run-url': 'https://circleci.example/run',
  }), /--version, --source-sha, and --source-run-url are required/);
});

test('resolveInputs reads version, source sha, and source run url', () => {
  const inputs = resolveInputs({
    'version': 'v260327.1',
    'source-sha': 'abc123',
    'source-run-url': 'https://circleci.example/run',
  });

  assert.deepEqual(inputs, {
    version: 'v260327.1',
    sourceSha: 'abc123',
    sourceRunUrl: 'https://circleci.example/run',
  });
});

test('buildClientPayload matches app-tests dispatch contract', () => {
  assert.deepEqual(buildClientPayload({
    version: 'v260327.1',
    sourceSha: 'abc123',
    sourceRunUrl: 'https://circleci.example/run',
  }), {
    source_repo: 'RoundingWell/app-frontend',
    component: 'frontend',
    source_ref: 'refs/tags/v260327.1',
    source_sha: 'abc123',
    source_run_url: 'https://circleci.example/run',
    environment: 'qa2',
    source_system: 'circleci',
  });
});
