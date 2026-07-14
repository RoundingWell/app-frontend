#!/usr/bin/env node

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DescribeStackResourceCommand, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { parseArgs } from 'node:util';
import fsSync from 'node:fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeAppConfig } from './generate-appconfig.js';
import { createAwsClients } from './lib/aws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEPLOYABLE_STATUSES = new Set([
  'CREATE_COMPLETE',
  'UPDATE_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
]);
// Content-hashed bundles never change for a given URL, so they can be cached
// forever. The rollout shell (index.html, sw.js, appconfig.json) and every
// stable-named asset must revalidate so a deploy is never masked by a stale
// browser/CDN copy.
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const REVALIDATE_CACHE_CONTROL = 'no-cache';
// Vite emits `<name>-<hash>.<ext>` (hashes may contain - or _), date-prefixed
// for entry/chunk JS and under assets/ for CSS. Match that trailing hash only.
const HASHED_ASSET_PATTERN = /-[a-zA-Z0-9_-]{8,}\.(?:js|css)$/;
const PROD_WILDCARD_EXCLUDED_ORGANIZATIONS = new Set(['demonstration']);
const CLOUDFRONT_DISTRIBUTION_LOGICAL_ID = 'CloudFrontDistribution';

function isMainModule() {
  if (!process.argv[1]) {
    return false;
  }

  return path.resolve(process.argv[1]) === __filename;
}

/**
 * Find the WebsiteBucket output on a CloudFormation deploy target.
 * @param {Object} deploymentTarget - DescribeStacks result item
 * @returns {string|null}
 */
function getWebsiteBucketOutput(deploymentTarget) {
  const websiteBucketOutput = deploymentTarget.Outputs?.find(output => output.OutputKey === 'WebsiteBucket');
  return websiteBucketOutput?.OutputValue || null;
}

function getTagValue(deploymentTarget, key) {
  return deploymentTarget.Tags?.find(tag => tag.Key === key)?.Value || '';
}

function isDeployableTarget(deploymentTarget) {
  return DEPLOYABLE_STATUSES.has(deploymentTarget.StackStatus);
}

function matchesOrganizationTarget(deploymentTarget, stage, filterOrganization) {
  const targetStage = getTagValue(deploymentTarget, 'stage');
  const targetOrganization = getTagValue(deploymentTarget, 'organization');

  if (targetStage !== stage) return false;
  if (!targetOrganization) return false;
  if (filterOrganization && targetOrganization !== filterOrganization) return false;

  return true;
}

export function shouldIncludeDeployTarget(stage, filterOrganization, organizationIdentifier) {
  if (filterOrganization) return true;
  if (stage !== 'prod') return true;

  return !PROD_WILDCARD_EXCLUDED_ORGANIZATIONS.has(organizationIdentifier);
}

/**
 * Get all organizations for a stage with their website buckets by CloudFormation tags.
 * @param {CloudFormationClient} cfClient - CloudFormation client instance
 * @param {string} stage - Deployment stage (dev, qa, prod, sandbox)
 * @param {string} filterOrganization - Optional specific organization identifier to filter
 * @returns {Promise<Map>} Map of organization identifiers to deploy targets
 */
async function listStageOrganizations(cfClient, stage, filterOrganization) {
  const organizationBuckets = new Map();
  let nextToken;

  do {
    const command = new DescribeStacksCommand({
      ...(nextToken ? { NextToken: nextToken } : {}),
    });

    const response = await cfClient.send(command);
    addOrganizationsFromPage(organizationBuckets, response, stage, filterOrganization);

    nextToken = response.NextToken;
  } while (nextToken);

  return organizationBuckets;
}

/**
 * Resolve and add WebsiteBucket for organizations in a DescribeStacks page.
 * @param {Map<string, Object>} organizationBuckets - Target map
 * @param {Object} response - DescribeStacks response page
 * @param {string} stage - Deployment stage
 * @param {string} filterOrganization - Optional specific organization identifier to filter
 */
export function addOrganizationsFromPage(organizationBuckets, response, stage, filterOrganization) {
  for (const deploymentTarget of response.Stacks || []) {
    if (!isDeployableTarget(deploymentTarget)) continue;
    if (!matchesOrganizationTarget(deploymentTarget, stage, filterOrganization)) continue;

    const bucketName = getWebsiteBucketOutput(deploymentTarget);
    const organizationIdentifier = getTagValue(deploymentTarget, 'organization');

    if (!shouldIncludeDeployTarget(stage, filterOrganization, organizationIdentifier)) continue;

    // The stage/organization tags are shared across every stack for an org (website,
    // adit, backend, ...), so they cannot identify the website stack on their own.
    // The WebsiteBucket output is the only tag-independent signal of a deploy target,
    // so a matched stack without it is a sibling stack we simply skip.
    if (!bucketName) continue;

    if (organizationBuckets.has(organizationIdentifier)) {
      throw new Error(
        `Duplicate CloudFormation targets found for stage=${ stage } and organization=${ organizationIdentifier }`,
      );
    }

    organizationBuckets.set(organizationIdentifier, {
      bucketName,
      stackName: deploymentTarget.StackName,
    });
  }
}

/**
 * Get content type based on file extension.
 * @param {string} filePath - The file path
 * @returns {string} Content type
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.map': 'application/json',
  };

  return contentTypes[ext] || 'application/octet-stream';
}

function shouldSkipUploadEntry(entry) {
  // Keep sourcemaps in release artifacts for Datadog, but never publish them
  // to a customer-facing website bucket.
  return entry.name.startsWith('.') ||
    (!entry.isDirectory() && path.extname(entry.name).toLowerCase() === '.map');
}

const FINAL_UPLOAD_ORDER = new Map([
  ['appconfig.json', 1],
  ['index.html', 2],
  ['sw.js', 3],
]);

function compareUploadEntries(a, b, prefix = '') {
  const aPriority = prefix === '' ? (FINAL_UPLOAD_ORDER.get(a.name) || 0) : 0;
  const bPriority = prefix === '' ? (FINAL_UPLOAD_ORDER.get(b.name) || 0) : 0;

  // Hold back the stable root files that act as rollout cutover points.
  if (aPriority !== bPriority) return aPriority - bPriority;
  if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;

  return a.name.localeCompare(b.name);
}

export function sortUploadEntries(entries, prefix = '') {
  return [...entries]
    .filter(entry => !shouldSkipUploadEntry(entry))
    .sort((a, b) => compareUploadEntries(a, b, prefix));
}

function isSharedRuntimeAsset(assetPath) {
  return assetPath.replace(/^\//, '').startsWith('shared/');
}

/**
 * Resolve the Cache-Control header for an upload key. Content-hashed bundles
 * are immutable; everything else (shell, shared runtime, stable static assets)
 * must revalidate.
 * @param {string} key - The S3 key (path)
 * @returns {string} Cache-Control header value
 */
export function cacheControlFor(key) {
  const assetPath = key.replace(/^\//, '');

  if (isSharedRuntimeAsset(assetPath)) return REVALIDATE_CACHE_CONTROL;

  return HASHED_ASSET_PATTERN.test(assetPath) ?
    IMMUTABLE_CACHE_CONTROL :
    REVALIDATE_CACHE_CONTROL;
}

/**
 * Upload a single file to S3.
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - The S3 bucket name
 * @param {string} filePath - The local file path
 * @param {string} key - The S3 key (path)
 */
async function uploadFile(s3Client, bucketName, filePath, key) {
  const fileContent = await fs.readFile(filePath);
  const contentType = getContentType(filePath);
  const cacheControl = cacheControlFor(key);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: cacheControl,
  });

  await s3Client.send(command);
}

/**
 * Upload public deployment files to S3 recursively, excluding dot entries and sourcemaps.
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - The S3 bucket name
 * @param {string} dirPath - The local directory path
 * @param {string} prefix - The S3 key prefix
 */
export async function uploadDirectory(s3Client, bucketName, dirPath, prefix = '') {
  const entries = sortUploadEntries(
    await fs.readdir(dirPath, { withFileTypes: true }),
    prefix,
  );

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const s3Key = prefix ? `${ prefix }/${ entry.name }` : entry.name;

    if (entry.isDirectory()) {
      await uploadDirectory(s3Client, bucketName, fullPath, s3Key);
    } else {
      process.stdout.write(`  Uploading ${ s3Key }...\n`);
      await uploadFile(s3Client, bucketName, fullPath, s3Key);
    }
  }
}

/**
 * Generate appconfig for a specific organization.
 * @param {string} stage - Deployment stage
 * @param {string} organization - Organization identifier
 */
async function generateAppConfig(stage, organization) {
  process.stdout.write(`Generating appconfig for organization: ${ organization }\n`);
  await writeAppConfig(organization, stage);
}

/**
 * Invalidate CloudFront distribution.
 * @param {CloudFrontClient} cloudFrontClient - CloudFront client instance
 * @param {string} organization - Organization identifier
 * @param {string} distroId - CloudFront distribution ID
 */
async function invalidateCloudFront(cloudFrontClient, organization, distroId) {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

  process.stdout.write(`Invalidating CloudFront distribution: ${ distroId }\n`);

  const command = new CreateInvalidationCommand({
    DistributionId: distroId,
    InvalidationBatch: {
      CallerReference: `deploy-${ timestamp }`,
      Paths: {
        Items: ['/*'],
        Quantity: 1,
      },
    },
  });

  await cloudFrontClient.send(command);
  process.stdout.write(`CloudFront invalidation created for distribution ${ distroId } of ${ organization }\n`);
}

function isCloudFrontDistributionResourceMissing(error) {
  return error?.name === 'ValidationError'
    && String(error.message || '').includes(`Resource ${ CLOUDFRONT_DISTRIBUTION_LOGICAL_ID } does not exist for stack`);
}

/**
 * Resolve the deploy target's CloudFront distribution from CloudFormation.
 * @param {CloudFormationClient} cloudFormationClient - CloudFormation client instance
 * @param {Object} options - Resolution options
 * @param {string} options.stage - Deployment stage
 * @param {string} options.stackName - CloudFormation stack name
 * @returns {Promise<string|null>} CloudFront distribution id, or null for dev stacks without one
 */
export async function resolveInvalidationDistribution(cloudFormationClient, { stage, stackName }) {
  let response;

  try {
    response = await cloudFormationClient.send(new DescribeStackResourceCommand({
      StackName: stackName,
      LogicalResourceId: CLOUDFRONT_DISTRIBUTION_LOGICAL_ID,
    }));
  } catch(error) {
    if (stage === 'dev' && isCloudFrontDistributionResourceMissing(error)) {
      return null;
    }

    throw error;
  }

  const distributionId = response.StackResourceDetail?.PhysicalResourceId;

  if (!distributionId) {
    throw new Error(`CloudFormation stack ${ stackName } resource ${ CLOUDFRONT_DISTRIBUTION_LOGICAL_ID } did not include a PhysicalResourceId`);
  }

  return distributionId;
}

/**
 * Deploy to a single organization.
 * @param {Object} clients - AWS clients
 * @param {string} stage - Deployment stage
 * @param {string} organization - Organization identifier
 * @param {Object} deployTarget - Deploy target
 * @param {string} deployTarget.bucketName - S3 bucket name
 * @param {string} deployTarget.stackName - CloudFormation stack name
 * @param {string} distDir - Path to dist directory
 */
async function deployToOrganization(clients, stage, organization, deployTarget, distDir) {
  process.stdout.write(`\nDeploying ${ organization } (${ stage })\n`);

  await generateAppConfig(stage, organization);

  process.stdout.write(`Uploading dist directory to ${ deployTarget.bucketName }...\n`);
  await uploadDirectory(clients.s3, deployTarget.bucketName, distDir);

  const distroId = await resolveInvalidationDistribution(clients.cloudFormation, {
    stage,
    stackName: deployTarget.stackName,
  });

  if (distroId) {
    await invalidateCloudFront(clients.cloudFront, organization, distroId);
  } else {
    process.stdout.write(`No CloudFront distribution found for ${ deployTarget.stackName }, skipping invalidation\n`);
  }

  process.stdout.write(`Deployed ${ organization } (${ stage })\n`);
}

export function resolveDeployInputs(values) {
  const stage = values.stage || process.env.DEPLOY_STAGE;
  const filterOrganization = values.organization || process.env.DEPLOY_ORGANIZATION;
  const deployAwsProfile = process.env.DEPLOY_AWS_PROFILE;

  if (deployAwsProfile && !process.env.AWS_PROFILE) {
    process.env.AWS_PROFILE = deployAwsProfile;
  }

  if (!stage) {
    process.stderr.write('Error: --stage is required (or set DEPLOY_STAGE)\n');
    process.stderr.write('Usage: npm run deploy -- --stage=prod [--organization=<organization-id>]\n');
    process.stderr.write('   or: npm run deploy:dev (uses .env)\n');
    process.exit(1);
  }

  return { stage, filterOrganization };
}

export function formatOrganizationFilter(filterOrganization) {
  return filterOrganization ? ` (org: ${ filterOrganization })` : '';
}

export function formatNoOrganizationsError(stage, filterOrganization) {
  const organizationMsg = filterOrganization ? ` org=${ filterOrganization }` : '';
  return `No environments found for stage=${ stage }${ organizationMsg }\n`;
}

export function buildDeployMarkerEnvironments(stage, filterOrganization, organizations) {
  if (filterOrganization) {
    return [`${ stage }:${ filterOrganization }`];
  }

  const concreteEnvironments = [...organizations]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map(organization => `${ stage }:${ organization }`);

  return [`${ stage }:*`, ...concreteEnvironments];
}

export function writeDeployMarkerStatus(statusFile, markerStatus) {
  if (!statusFile) return;
  fsSync.writeFileSync(statusFile, `${ JSON.stringify(markerStatus, null, 2) }\n`);
}

export function readDeployMarkerStatus(statusFile) {
  const defaultStatus = {
    failedEnvironments: [],
    successfulEnvironments: [],
  };

  if (!statusFile || !fsSync.existsSync(statusFile)) {
    return defaultStatus;
  }

  let payload;

  try {
    payload = JSON.parse(fsSync.readFileSync(statusFile, 'utf8'));
  } catch(error) {
    throw new Error(`Deploy marker status file is not valid JSON: ${ statusFile }. Delete it and retry. ${ error.message }`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return defaultStatus;
  }

  return {
    failedEnvironments: Array.isArray(payload.failedEnvironments) ? payload.failedEnvironments : [],
    successfulEnvironments: Array.isArray(payload.successfulEnvironments) ? payload.successfulEnvironments : [],
  };
}

function isResolvedDeployTargetEntry(entry) {
  if (!Array.isArray(entry) || entry.length !== 2) return false;
  if (typeof entry[0] !== 'string' || !entry[0]) return false;

  const deployTarget = entry[1];
  return Boolean(deployTarget)
    && typeof deployTarget === 'object'
    && !Array.isArray(deployTarget)
    && typeof deployTarget.bucketName === 'string'
    && typeof deployTarget.stackName === 'string';
}

function readResolvedDeployTargetsPayload(targetsFile) {
  try {
    return JSON.parse(fsSync.readFileSync(targetsFile, 'utf8'));
  } catch(error) {
    throw new Error(`Resolved deploy targets file is not valid JSON: ${ targetsFile }. ${ error.message }`);
  }
}

function getResolvedDeployTargetEntries(payload, targetsFile) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`Resolved deploy targets payload must be a JSON object: ${ targetsFile }`);
  }

  const { organizationBuckets } = payload;

  if (!Array.isArray(organizationBuckets)) {
    throw new Error(`Resolved deploy targets payload must include an organizationBuckets array: ${ targetsFile }`);
  }

  if (organizationBuckets.some(entry => !isResolvedDeployTargetEntry(entry))) {
    throw new Error(`Resolved deploy targets organizationBuckets must be an array of [organization, { bucketName, stackName }] entries: ${ targetsFile }. Regenerate deploy targets with the current deploy script.`);
  }

  return organizationBuckets;
}

export function readResolvedDeployTargets(targetsFile) {
  if (!targetsFile) {
    throw new Error('Resolved deploy targets file path is required.');
  }

  if (!fsSync.existsSync(targetsFile)) {
    throw new Error(`Resolved deploy targets file not found: ${ targetsFile }`);
  }

  const payload = readResolvedDeployTargetsPayload(targetsFile);
  const organizationBuckets = getResolvedDeployTargetEntries(payload, targetsFile);
  return new Map(organizationBuckets);
}

export function writeResolvedDeployTargets(targetsFile, organizationBuckets) {
  if (!targetsFile) return;
  fsSync.writeFileSync(targetsFile, `${ JSON.stringify({
    organizationBuckets: [...organizationBuckets.entries()],
  }, null, 2) }\n`);
}

export function formatFailedDeploymentsError(failedEnvironments) {
  return `Deployment failed for environments: ${ failedEnvironments.join(', ') }`;
}

export async function deployOrganizations({
  clients,
  stage,
  organizationTargets,
  distDir,
  markerStatus,
  statusFile,
  deployOrganization = deployToOrganization,
}) {
  for (const [organization, deployTarget] of organizationTargets) {
    const environment = `${ stage }:${ organization }`;

    try {
      await deployOrganization(clients, stage, organization, deployTarget, distDir);
      markerStatus.successfulEnvironments.push(environment);
      writeDeployMarkerStatus(statusFile, markerStatus);
    } catch(error) {
      markerStatus.failedEnvironments.push(environment);
      writeDeployMarkerStatus(statusFile, markerStatus);
      process.stderr.write(`Deployment failed for ${ environment }: ${ error.message }\n`);
    }
  }
}

/**
 * Main deployment function.
 */
async function main() {
  const { values } = parseArgs({
    options: {
      'read-targets-file': { type: 'string' },
      'marker-status-file': { type: 'string' },
      'stage': { type: 'string' },
      'organization': { type: 'string' },
      'list-marker-environments': { type: 'boolean' },
      'write-targets-file': { type: 'string' },
    },
  });

  const { stage, filterOrganization } = resolveDeployInputs(values);
  const organizationFilter = formatOrganizationFilter(filterOrganization);
  const isListingMarkerEnvironments = values['list-marker-environments'];
  const clients = createAwsClients();

  let organizationBuckets;
  if (values['read-targets-file']) {
    organizationBuckets = readResolvedDeployTargets(values['read-targets-file']);
    if (!isListingMarkerEnvironments) {
      process.stdout.write(`Loaded deploy targets from ${ values['read-targets-file'] }\n`);
    }
  } else {
    if (!isListingMarkerEnvironments) {
      process.stdout.write(`Querying CloudFormation organizations by tags for stage: ${ stage }${ organizationFilter }\n`);
    }
    organizationBuckets = await listStageOrganizations(clients.cloudFormation, stage, filterOrganization);
    writeResolvedDeployTargets(values['write-targets-file'], organizationBuckets);
  }

  if (organizationBuckets.size === 0) {
    process.stderr.write(formatNoOrganizationsError(stage, filterOrganization));
    process.exit(1);
  }

  if (isListingMarkerEnvironments) {
    const environments = buildDeployMarkerEnvironments(stage, filterOrganization, organizationBuckets.keys());
    process.stdout.write(`${ environments.join('\n') }\n`);
    return;
  }

  const markerStatus = readDeployMarkerStatus(values['marker-status-file']);
  writeDeployMarkerStatus(values['marker-status-file'], markerStatus);

  process.stdout.write(`Found ${ organizationBuckets.size } organizations to deploy:\n`);
  organizationBuckets.forEach((deployTarget, organization) => {
    process.stdout.write(`  - ${ organization } -> ${ deployTarget.bucketName } (${ deployTarget.stackName })\n`);
  });

  const distDir = path.join(__dirname, '../dist');

  await deployOrganizations({
    clients,
    stage,
    organizationTargets: organizationBuckets,
    distDir,
    markerStatus,
    statusFile: values['marker-status-file'],
  });

  if (markerStatus.failedEnvironments.length) {
    throw new Error(formatFailedDeploymentsError(markerStatus.failedEnvironments));
  }

  process.stdout.write('\nAll deployments complete!\n');
}

if (isMainModule()) {
  main().catch(error => {
    process.stderr.write(`Deployment failed: ${ error.message }\n`);
    process.exit(1);
  });
}
