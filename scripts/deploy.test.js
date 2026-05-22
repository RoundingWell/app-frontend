import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildDeployMarkerEnvironments,
  formatFailedDeploymentsError,
  readDeployMarkerStatus,
  readResolvedDeployTargets,
  shouldIncludeDeployTarget,
  writeDeployMarkerStatus,
  writeResolvedDeployTargets,
} from './deploy.js';

test('buildDeployMarkerEnvironments retains wildcard and adds sorted concrete environments', () => {
  assert.deepEqual(
    buildDeployMarkerEnvironments('qa', '', ['quality-assurance', 'qa2']),
    ['qa:*', 'qa:qa2', 'qa:quality-assurance'],
  );
});

test('buildDeployMarkerEnvironments keeps wildcard when there are no concrete environments', () => {
  assert.deepEqual(
    buildDeployMarkerEnvironments('sandbox', '', []),
    ['sandbox:*'],
  );
});

test('buildDeployMarkerEnvironments returns only the requested concrete environment for single-target deploys', () => {
  assert.deepEqual(
    buildDeployMarkerEnvironments('prod', 'demonstration', ['demonstration', 'other']),
    ['prod:demonstration'],
  );
});

test('shouldIncludeDeployTarget excludes demonstration only from prod wildcard deploys', () => {
  assert.equal(shouldIncludeDeployTarget('prod', '', 'demonstration'), false);
  assert.equal(shouldIncludeDeployTarget('prod', 'demonstration', 'demonstration'), true);
  assert.equal(shouldIncludeDeployTarget('prod', '', 'apple'), true);
  assert.equal(shouldIncludeDeployTarget('sandbox', '', 'demonstration'), true);
});

test('writeDeployMarkerStatus persists marker deployment progress', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-marker-status-'));
  const statusFile = path.join(tempDir, 'status.json');

  writeDeployMarkerStatus(statusFile, {
    failedEnvironments: ['qa:quality-assurance'],
    successfulEnvironments: ['qa:qa2'],
  });

  assert.deepEqual(
    JSON.parse(fs.readFileSync(statusFile, 'utf8')),
    {
      failedEnvironments: ['qa:quality-assurance'],
      successfulEnvironments: ['qa:qa2'],
    },
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('readDeployMarkerStatus preserves existing marker deployment progress', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-marker-status-'));
  const statusFile = path.join(tempDir, 'status.json');

  fs.writeFileSync(statusFile, JSON.stringify({
    failedEnvironments: [],
    successfulEnvironments: ['sandbox:apple'],
  }));

  assert.deepEqual(
    readDeployMarkerStatus(statusFile),
    {
      failedEnvironments: [],
      successfulEnvironments: ['sandbox:apple'],
    },
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('readDeployMarkerStatus defaults missing marker deployment progress', () => {
  assert.deepEqual(
    readDeployMarkerStatus(''),
    {
      failedEnvironments: [],
      successfulEnvironments: [],
    },
  );
});

test('formatFailedDeploymentsError summarizes all failed environments', () => {
  assert.equal(
    formatFailedDeploymentsError(['qa:qa2', 'qa:quality-assurance']),
    'Deployment failed for environments: qa:qa2, qa:quality-assurance',
  );
});

test('writeResolvedDeployTargets persists the resolved deploy target snapshot', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-targets-'));
  const targetsFile = path.join(tempDir, 'targets.json');
  const organizationBuckets = new Map([
    ['qa2', 'bucket-a'],
    ['quality-assurance', 'bucket-b'],
  ]);

  writeResolvedDeployTargets(targetsFile, organizationBuckets);

  assert.deepEqual(
    [...readResolvedDeployTargets(targetsFile).entries()],
    [...organizationBuckets.entries()],
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('readResolvedDeployTargets requires a file path', () => {
  assert.throws(
    () => readResolvedDeployTargets(''),
    /Resolved deploy targets file path is required/,
  );
});

test('readResolvedDeployTargets reports a missing snapshot file clearly', () => {
  const targetsFile = path.join(os.tmpdir(), `missing-deploy-targets-${ process.pid }.json`);

  assert.throws(
    () => readResolvedDeployTargets(targetsFile),
    new RegExp(`Resolved deploy targets file not found: ${ targetsFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }`),
  );
});

test('readResolvedDeployTargets rejects malformed snapshot payloads', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invalid-deploy-targets-'));
  const targetsFile = path.join(tempDir, 'targets.json');
  fs.writeFileSync(targetsFile, JSON.stringify({ organizationBuckets: [['qa2']] }));

  assert.throws(
    () => readResolvedDeployTargets(targetsFile),
    /organizationBuckets must be an array of \[key, value\] entries/,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});
