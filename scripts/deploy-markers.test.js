import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarkerName, buildMarkerUpdates } from './deploy-markers.js';

test('buildMarkerName normalizes wildcard environments', () => {
  assert.equal(buildMarkerName('qa:*', 'v260406.1'), 'deploy-qa-all-v260406.1');
  assert.equal(buildMarkerName('qa:quality-assurance', 'v260406.1'), 'deploy-qa-quality-assurance-v260406.1');
});

test('buildMarkerUpdates marks every planned environment successful on complete success', () => {
  assert.deepEqual(
    buildMarkerUpdates({
      deployResult: 'success',
      failedEnvironments: [],
      plannedEnvironments: ['qa:*', 'qa:qa2', 'qa:quality-assurance'],
      successfulEnvironments: ['qa:qa2', 'qa:quality-assurance'],
      targetEnvironment: 'qa:*',
    }),
    [
      { environment: 'qa:*', status: 'SUCCESS' },
      { environment: 'qa:qa2', status: 'SUCCESS' },
      { environment: 'qa:quality-assurance', status: 'SUCCESS' },
    ],
  );
});

test('buildMarkerUpdates preserves partial success for stage-wide failures', () => {
  assert.deepEqual(
    buildMarkerUpdates({
      deployResult: 'failure',
      failedEnvironments: ['qa:quality-assurance'],
      plannedEnvironments: ['qa:*', 'qa:qa2', 'qa:quality-assurance'],
      successfulEnvironments: ['qa:qa2'],
      targetEnvironment: 'qa:*',
    }),
    [
      { environment: 'qa:*', status: 'FAILED' },
      { environment: 'qa:qa2', status: 'SUCCESS' },
      { environment: 'qa:quality-assurance', status: 'FAILED' },
    ],
  );
});

test('buildMarkerUpdates marks a failed specific environment when nothing succeeded', () => {
  assert.deepEqual(
    buildMarkerUpdates({
      deployResult: 'failure',
      failedEnvironments: [],
      plannedEnvironments: ['prod:demonstration'],
      successfulEnvironments: [],
      targetEnvironment: 'prod:demonstration',
    }),
    [
      { environment: 'prod:demonstration', status: 'FAILED' },
    ],
  );
});

test('buildMarkerUpdates marks every failed concrete environment after a continued stage-wide rollout', () => {
  assert.deepEqual(
    buildMarkerUpdates({
      deployResult: 'failure',
      failedEnvironments: ['qa:qa2', 'qa:quality-assurance'],
      plannedEnvironments: ['qa:*', 'qa:qa2', 'qa:quality-assurance', 'qa:qa3'],
      successfulEnvironments: ['qa:qa3'],
      targetEnvironment: 'qa:*',
    }),
    [
      { environment: 'qa:*', status: 'FAILED' },
      { environment: 'qa:qa3', status: 'SUCCESS' },
      { environment: 'qa:qa2', status: 'FAILED' },
      { environment: 'qa:quality-assurance', status: 'FAILED' },
    ],
  );
});
