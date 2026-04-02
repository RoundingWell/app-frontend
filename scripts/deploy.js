#!/usr/bin/env node

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { parseArgs } from 'node:util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeAppConfig } from './generate-appconfig.js';
import { createAwsClients, fetchOrganizationSecret } from './lib/aws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEPLOYABLE_STATUSES = new Set([
  'CREATE_COMPLETE',
  'UPDATE_COMPLETE',
  'UPDATE_ROLLBACK_COMPLETE',
]);
const SHARED_RUNTIME_CACHE_CONTROL = 'no-cache';

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

function getTargetName(deploymentTarget) {
  return deploymentTarget.StackName || '<unknown-stack>';
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

/**
 * Get all organizations for a stage with their website buckets by CloudFormation tags.
 * @param {CloudFormationClient} cfClient - CloudFormation client instance
 * @param {string} stage - Deployment stage (dev, qa, prod, sandbox)
 * @param {string} filterOrganization - Optional specific organization identifier to filter
 * @returns {Promise<Map>} Map of organization identifiers to bucket names
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
 * @param {Map<string, string>} organizationBuckets - Target map
 * @param {Object} response - DescribeStacks response page
 * @param {string} stage - Deployment stage
 * @param {string} filterOrganization - Optional specific organization identifier to filter
 */
function addOrganizationsFromPage(organizationBuckets, response, stage, filterOrganization) {
  for (const deploymentTarget of response.Stacks || []) {
    if (!isDeployableTarget(deploymentTarget)) continue;
    if (!matchesOrganizationTarget(deploymentTarget, stage, filterOrganization)) continue;

    const bucketName = getWebsiteBucketOutput(deploymentTarget);
    const organizationIdentifier = getTagValue(deploymentTarget, 'organization');

    if (!bucketName) {
      throw new Error(
        `CloudFormation target ${ getTargetName(deploymentTarget) } matched stage=${ stage } and organization=${ organizationIdentifier } but has no WebsiteBucket output`,
      );
    }

    if (organizationBuckets.has(organizationIdentifier)) {
      throw new Error(
        `Duplicate CloudFormation targets found for stage=${ stage } and organization=${ organizationIdentifier }`,
      );
    }

    organizationBuckets.set(organizationIdentifier, bucketName);
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

function shouldSkipUploadEntry(entryName) {
  return entryName.startsWith('.');
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
    .filter(entry => !shouldSkipUploadEntry(entry.name))
    .sort((a, b) => compareUploadEntries(a, b, prefix));
}

function isSharedRuntimeAsset(assetPath) {
  return assetPath.replace(/^\//, '').startsWith('shared/');
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
  const cacheControl = isSharedRuntimeAsset(key) ? SHARED_RUNTIME_CACHE_CONTROL : undefined;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
    ...(cacheControl && { CacheControl: cacheControl }),
  });

  await s3Client.send(command);
}

/**
 * Upload entire directory to S3 recursively.
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - The S3 bucket name
 * @param {string} dirPath - The local directory path
 * @param {string} prefix - The S3 key prefix
 */
async function uploadDirectory(s3Client, bucketName, dirPath, prefix = '') {
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

/**
 * Deploy to a single organization.
 * @param {Object} clients - AWS clients
 * @param {string} stage - Deployment stage
 * @param {string} organization - Organization identifier
 * @param {string} bucketName - S3 bucket name
 * @param {string} distDir - Path to dist directory
 */
async function deployToOrganization(clients, stage, organization, bucketName, distDir) {
  process.stdout.write(`\nDeploying ${ organization } (${ stage })\n`);

  await generateAppConfig(stage, organization);

  process.stdout.write(`Uploading dist directory to ${ bucketName }...\n`);
  await uploadDirectory(clients.s3, bucketName, distDir);

  try {
    const secrets = await fetchOrganizationSecret(clients.secretsManager, stage, organization);
    const distroId = secrets.DistroId || secrets.DistroID;
    if (distroId) {
      await invalidateCloudFront(clients.cloudFront, organization, distroId);
    } else {
      process.stdout.write('No CloudFront distribution found, skipping invalidation\n');
    }
  } catch(error) {
    process.stderr.write(`Warning: Could not invalidate CloudFront: ${ error.message }\n`);
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
    process.stderr.write('Usage: npm run deploy -- --stage=prod [--organization=salvation]\n');
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

/**
 * Main deployment function.
 */
async function main() {
  const { values } = parseArgs({
    options: {
      'stage': { type: 'string' },
      'organization': { type: 'string' },
    },
  });

  const { stage, filterOrganization } = resolveDeployInputs(values);
  const organizationFilter = formatOrganizationFilter(filterOrganization);

  const clients = createAwsClients();

  process.stdout.write(`Querying CloudFormation organizations by tags for stage: ${ stage }${ organizationFilter }\n`);

  const organizationBuckets = await listStageOrganizations(clients.cloudFormation, stage, filterOrganization);

  if (organizationBuckets.size === 0) {
    process.stderr.write(formatNoOrganizationsError(stage, filterOrganization));
    process.exit(1);
  }

  process.stdout.write(`Found ${ organizationBuckets.size } organizations to deploy:\n`);
  organizationBuckets.forEach((bucketName, organization) => {
    process.stdout.write(`  - ${ organization } -> ${ bucketName }\n`);
  });

  const distDir = path.join(__dirname, '../dist');

  for (const [organization, bucketName] of organizationBuckets) {
    await deployToOrganization(clients, stage, organization, bucketName, distDir);
  }

  process.stdout.write('\nAll deployments complete!\n');
}

if (isMainModule()) {
  main().catch(error => {
    process.stderr.write(`Deployment failed: ${ error.message }\n`);
    process.exit(1);
  });
}
