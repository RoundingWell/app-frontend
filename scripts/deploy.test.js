import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  addOrganizationsFromPage,
  buildDeployMarkerEnvironments,
  cacheControlFor,
  deployOrganizations,
  formatFailedDeploymentsError,
  readDeployMarkerStatus,
  readResolvedDeployTargets,
  resolveInvalidationDistribution,
  shouldIncludeDeployTarget,
  writeDeployMarkerStatus,
  writeResolvedDeployTargets,
} from './deploy.js';

function stack(name, organization, { stage = 'sandbox', websiteBucket } = {}) {
  const outputs = websiteBucket ?
    [{ OutputKey: 'WebsiteBucket', OutputValue: websiteBucket }] :
    [{ OutputKey: 'HttpApiUrl', OutputValue: 'https://example.test' }];

  return {
    StackName: name,
    StackStatus: 'CREATE_COMPLETE',
    Tags: [
      { Key: 'stage', Value: stage },
      { Key: 'organization', Value: organization },
    ],
    Outputs: outputs,
  };
}

test('addOrganizationsFromPage maps a website stack to its WebsiteBucket', () => {
  const organizationBuckets = new Map();
  const response = { Stacks: [stack('careops-sandbox-alpha', 'alpha', { websiteBucket: 'alpha-bucket' })] };

  addOrganizationsFromPage(organizationBuckets, response, 'sandbox', '');

  assert.deepEqual([...organizationBuckets], [[
    'alpha',
    {
      bucketName: 'alpha-bucket',
      stackName: 'careops-sandbox-alpha',
    },
  ]]);
});

test('addOrganizationsFromPage skips a sibling stack that shares the tags but has no WebsiteBucket output', () => {
  const organizationBuckets = new Map();
  const response = {
    Stacks: [
      stack('adit-sandbox-alpha', 'alpha'),
      stack('careops-sandbox-alpha', 'alpha', { websiteBucket: 'alpha-bucket' }),
    ],
  };

  // adit-sandbox-alpha matched stage=sandbox/organization=alpha but is not a website stack.
  addOrganizationsFromPage(organizationBuckets, response, 'sandbox', '');

  assert.deepEqual([...organizationBuckets], [[
    'alpha',
    {
      bucketName: 'alpha-bucket',
      stackName: 'careops-sandbox-alpha',
    },
  ]]);
});

test('addOrganizationsFromPage throws when two website stacks claim the same organization', () => {
  const organizationBuckets = new Map();
  const response = {
    Stacks: [
      stack('careops-sandbox-alpha', 'alpha', { websiteBucket: 'alpha-bucket' }),
      stack('careops-sandbox-alpha-dupe', 'alpha', { websiteBucket: 'other-bucket' }),
    ],
  };

  assert.throws(
    () => addOrganizationsFromPage(organizationBuckets, response, 'sandbox', ''),
    /Duplicate CloudFormation targets/,
  );
});

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

test('readDeployMarkerStatus reports invalid marker deployment progress JSON', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invalid-deploy-marker-status-'));
  const statusFile = path.join(tempDir, 'status.json');

  fs.writeFileSync(statusFile, '');

  assert.throws(
    () => readDeployMarkerStatus(statusFile),
    new RegExp(`Deploy marker status file is not valid JSON: ${ statusFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }\\. Delete it and retry\\.`),
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('readDeployMarkerStatus normalizes malformed marker deployment progress payloads', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'malformed-deploy-marker-status-'));
  const statusFile = path.join(tempDir, 'status.json');

  fs.writeFileSync(statusFile, JSON.stringify({ successfulEnvironments: ['sandbox:apple'] }));

  assert.deepEqual(
    readDeployMarkerStatus(statusFile),
    {
      failedEnvironments: [],
      successfulEnvironments: ['sandbox:apple'],
    },
  );

  fs.writeFileSync(statusFile, JSON.stringify({ failedEnvironments: 'sandbox:apple' }));

  assert.deepEqual(
    readDeployMarkerStatus(statusFile),
    {
      failedEnvironments: [],
      successfulEnvironments: [],
    },
  );

  fs.writeFileSync(statusFile, JSON.stringify([]));

  assert.deepEqual(
    readDeployMarkerStatus(statusFile),
    {
      failedEnvironments: [],
      successfulEnvironments: [],
    },
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
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
    ['qa2', { bucketName: 'bucket-a', stackName: 'stack-a' }],
    ['quality-assurance', { bucketName: 'bucket-b', stackName: 'stack-b' }],
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
    /organizationBuckets must be an array of \[organization, \{ bucketName, stackName \}\] entries/,
  );

  fs.writeFileSync(targetsFile, JSON.stringify({ organizationBuckets: [['qa2', 'bucket-a']] }));

  assert.throws(
    () => readResolvedDeployTargets(targetsFile),
    /Regenerate deploy targets/,
  );

  fs.writeFileSync(targetsFile, JSON.stringify({
    organizationBuckets: [['qa2', { bucketName: 'bucket-a' }]],
  }));

  assert.throws(
    () => readResolvedDeployTargets(targetsFile),
    /Regenerate deploy targets/,
  );

  fs.writeFileSync(targetsFile, JSON.stringify({
    organizationBuckets: [[42, { bucketName: 'bucket-a', stackName: 'stack-a' }]],
  }));

  assert.throws(
    () => readResolvedDeployTargets(targetsFile),
    /Regenerate deploy targets/,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
});

function cloudFormationClient(responseOrError) {
  return {
    async send(command) {
      assert.equal(command.input.StackName, 'careops-sandbox-alpha');
      assert.equal(command.input.LogicalResourceId, 'CloudFrontDistribution');

      if (responseOrError instanceof Error) {
        throw responseOrError;
      }

      return responseOrError;
    },
  };
}

function validationError(message) {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

test('resolveInvalidationDistribution returns the CloudFront physical resource id', async() => {
  const distributionId = await resolveInvalidationDistribution(
    cloudFormationClient({
      StackResourceDetail: {
        PhysicalResourceId: 'E123456789',
      },
    }),
    { stage: 'sandbox', stackName: 'careops-sandbox-alpha' },
  );

  assert.equal(distributionId, 'E123456789');
});

test('resolveInvalidationDistribution skips missing CloudFront resources only for dev', async() => {
  const error = validationError('Resource CloudFrontDistribution does not exist for stack careops-sandbox-alpha');
  const distributionId = await resolveInvalidationDistribution(
    cloudFormationClient(error),
    { stage: 'dev', stackName: 'careops-sandbox-alpha' },
  );

  assert.equal(distributionId, null);
});

test('resolveInvalidationDistribution throws for dev stack-not-found errors', async() => {
  const error = validationError('Stack with id careops-sandbox-alpha does not exist');

  await assert.rejects(
    () => resolveInvalidationDistribution(
      cloudFormationClient(error),
      { stage: 'dev', stackName: 'careops-sandbox-alpha' },
    ),
    /Stack with id careops-sandbox-alpha does not exist/,
  );
});

test('resolveInvalidationDistribution throws for dev permission errors', async() => {
  const error = new Error('User is not authorized to perform: cloudformation:DescribeStackResource');
  error.name = 'AccessDenied';

  await assert.rejects(
    () => resolveInvalidationDistribution(
      cloudFormationClient(error),
      { stage: 'dev', stackName: 'careops-sandbox-alpha' },
    ),
    /not authorized/,
  );
});

test('resolveInvalidationDistribution throws for missing CloudFront resources outside dev', async() => {
  const error = validationError('Resource CloudFrontDistribution does not exist for stack careops-sandbox-alpha');

  await assert.rejects(
    () => resolveInvalidationDistribution(
      cloudFormationClient(error),
      { stage: 'sandbox', stackName: 'careops-sandbox-alpha' },
    ),
    /Resource CloudFrontDistribution does not exist/,
  );
});

test('resolveInvalidationDistribution throws when CloudFormation omits the physical resource id', async() => {
  await assert.rejects(
    () => resolveInvalidationDistribution(
      cloudFormationClient({ StackResourceDetail: {} }),
      { stage: 'sandbox', stackName: 'careops-sandbox-alpha' },
    ),
    /did not include a PhysicalResourceId/,
  );
});

test('deployOrganizations records failed environments and continues deploying remaining targets', async() => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-organizations-'));
  const statusFile = path.join(tempDir, 'status.json');
  const markerStatus = {
    failedEnvironments: [],
    successfulEnvironments: [],
  };
  const deployedOrganizations = [];

  await deployOrganizations({
    clients: {},
    stage: 'sandbox',
    organizationTargets: new Map([
      ['alpha', { bucketName: 'bucket-a', stackName: 'stack-a' }],
      ['beta', { bucketName: 'bucket-b', stackName: 'stack-b' }],
    ]),
    distDir: '/tmp/dist',
    markerStatus,
    statusFile,
    async deployOrganization(clients, stage, organization) {
      deployedOrganizations.push(organization);

      if (organization === 'alpha') {
        throw new Error('Invalidation failed');
      }
    },
  });

  assert.deepEqual(deployedOrganizations, ['alpha', 'beta']);
  assert.deepEqual(markerStatus, {
    failedEnvironments: ['sandbox:alpha'],
    successfulEnvironments: ['sandbox:beta'],
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(statusFile, 'utf8')), markerStatus);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

test('cacheControlFor marks content-hashed bundles immutable', () => {
  // Date-prefixed entry/chunk JS, including hashes that contain - or _.
  assert.equal(cacheControlFor('20260630-app-2ThoSfMB.js'), IMMUTABLE);
  assert.equal(cacheControlFor('20260630-sorting-Bb-sFHyu.js'), IMMUTABLE);
  assert.equal(cacheControlFor('20260630-app-frame_app-Bgxn_W94.js'), IMMUTABLE);
  // Hashed CSS lives under assets/ with no date prefix.
  assert.equal(cacheControlFor('assets/app-CL4oI3p2.css'), IMMUTABLE);
  assert.equal(cacheControlFor('/assets/sidebar-D3caASSO.css'), IMMUTABLE);
});

test('cacheControlFor keeps the rollout shell revalidating', () => {
  assert.equal(cacheControlFor('index.html'), REVALIDATE);
  assert.equal(cacheControlFor('sw.js'), REVALIDATE);
  assert.equal(cacheControlFor('appconfig.json'), REVALIDATE);
  assert.equal(cacheControlFor('/index.html'), REVALIDATE);
});

test('cacheControlFor revalidates stable-named static assets', () => {
  assert.equal(cacheControlFor('favicon.ico'), REVALIDATE);
  assert.equal(cacheControlFor('android-chrome-512x512.png'), REVALIDATE);
  assert.equal(cacheControlFor('site.webmanifest'), REVALIDATE);
  assert.equal(cacheControlFor('rwell-logo.svg'), REVALIDATE);
  assert.equal(cacheControlFor('images/roundingwell-logo.svg'), REVALIDATE);
});

test('cacheControlFor leaves shared runtime modules revalidating', () => {
  // Shared-runtime assets are intentionally never marked immutable.
  assert.equal(cacheControlFor('shared/config.js'), REVALIDATE);
  assert.equal(cacheControlFor('/shared/datadog.js'), REVALIDATE);
});

test('cacheControlFor does not mark sourcemaps immutable', () => {
  assert.equal(cacheControlFor('20260630-app-2ThoSfMB.js.map'), REVALIDATE);
});
