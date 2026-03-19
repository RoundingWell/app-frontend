#!/usr/bin/env node

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DescribeStacksCommand, ListStacksCommand } from '@aws-sdk/client-cloudformation';
import { parseArgs } from 'node:util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeAppConfig } from './generate-appconfig.js';
import { createAwsClients, fetchOrganizationSecrets } from './lib/aws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build the CloudFormation stack name for an organization deploy target.
 * @param {string} stage - Deployment stage
 * @param {string} organization - Organization identifier
 * @returns {string}
 */
export function getCloudFormationStackName(stage, organization) {
  return `careops-${ stage }-${ organization }`;
}

function shouldSkipOrganization(stage, organization) {
  return stage.toLowerCase() === 'prod' && organization.endsWith('-sandbox');
}

/**
 * Get WebsiteBucket output from a CloudFormation stack.
 * @param {CloudFormationClient} cfClient - CloudFormation client instance
 * @param {string} cloudFormationStackName - Full CloudFormation stack name
 * @returns {Promise<string|null>} Website bucket name or null
 */
async function getOrganizationWebsiteBucket(cfClient, cloudFormationStackName) {
  try {
    const command = new DescribeStacksCommand({ StackName: cloudFormationStackName });
    const response = await cfClient.send(command);

    const stack = response.Stacks?.[0];
    if (!stack?.Outputs) return null;

    const websiteBucketOutput = stack.Outputs.find(output => output.OutputKey === 'WebsiteBucket');
    return websiteBucketOutput?.OutputValue || null;
  } catch(error) {
    if (error.name === 'ValidationError') {
      return null;
    }
    throw error;
  }
}

/**
 * Get all organizations for a stage with their website buckets.
 * @param {CloudFormationClient} cfClient - CloudFormation client instance
 * @param {string} stage - Deployment stage (dev, qa, prod, sandbox)
 * @param {string} filterOrganization - Optional specific organization identifier to filter
 * @returns {Promise<Map>} Map of organization identifiers to bucket names
 */
async function getStageOrganizations(cfClient, stage, filterOrganization) {
  const organizationBuckets = new Map();

  if (filterOrganization) {
    if (shouldSkipOrganization(stage, filterOrganization)) {
      process.stdout.write(`Skipping sandbox organization for prod stage: ${ filterOrganization }\n`);
      return organizationBuckets;
    }

    const cloudFormationStackName = getCloudFormationStackName(stage, filterOrganization);
    await addOrganizationBucket(organizationBuckets, cfClient, filterOrganization, cloudFormationStackName);
    return organizationBuckets;
  }

  const prefix = `careops-${ stage }-`;
  let nextToken;

  do {
    const command = new ListStacksCommand({
      StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'],
      ...(nextToken ? { NextToken: nextToken } : {}),
    });

    const response = await cfClient.send(command);
    await addOrganizationsFromPage(organizationBuckets, response, cfClient, prefix, stage);

    nextToken = response.NextToken;
  } while (nextToken);

  return organizationBuckets;
}

async function addOrganizationsFromPage(organizationBuckets, response, cfClient, prefix, stage) {
  for (const stack of response.StackSummaries || []) {
    if (!stack.StackName.startsWith(prefix)) continue;

    const organizationIdentifier = stack.StackName.slice(prefix.length);
    if (shouldSkipOrganization(stage, organizationIdentifier)) continue;
    await addOrganizationBucket(organizationBuckets, cfClient, organizationIdentifier, stack.StackName);
  }
}

/**
 * Resolve and add WebsiteBucket for an organization when available.
 * @param {Map<string, string>} organizationBuckets - Target map
 * @param {CloudFormationClient} cfClient - CloudFormation client
 * @param {string} organizationIdentifier - Organization identifier
 * @param {string} cloudFormationStackName - CloudFormation stack name
 */
async function addOrganizationBucket(organizationBuckets, cfClient, organizationIdentifier, cloudFormationStackName) {
  const bucketName = await getOrganizationWebsiteBucket(cfClient, cloudFormationStackName);
  if (bucketName) {
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

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
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
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

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
  process.stdout.write(`CloudFront invalidation created for organization: ${ organization }\n`);
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
  process.stdout.write(`\nDeploying to organization: ${ organization }\n`);

  await generateAppConfig(stage, organization);

  process.stdout.write(`Uploading dist directory to ${ bucketName }...\n`);
  await uploadDirectory(clients.s3, bucketName, distDir);

  try {
    const secrets = await fetchOrganizationSecrets(clients.secretsManager, stage, organization);
    const distroId = secrets.DistroId || secrets.DistroID;
    if (distroId) {
      await invalidateCloudFront(clients.cloudFront, organization, distroId);
    } else {
      process.stdout.write('No CloudFront distribution found, skipping invalidation\n');
    }
  } catch(error) {
    process.stderr.write(`Warning: Could not invalidate CloudFront: ${ error.message }\n`);
  }

  process.stdout.write(`Deployment to ${ organization } complete\n`);
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
    process.stderr.write('Usage: npm run deploy -- --stage=prod [--organization=qa2]\n');
    process.stderr.write('   or: npm run deploy:dev (uses .env)\n');
    process.exit(1);
  }

  return { stage, filterOrganization };
}

export function formatOrganizationFilter(filterOrganization) {
  return filterOrganization ? ` (organization: ${ filterOrganization })` : '';
}

export function formatNoOrganizationsError(stage, filterOrganization) {
  const organizationMsg = filterOrganization ? ` with organization: ${ filterOrganization }` : '';
  return `No organizations found: careops-${ stage }-*${ organizationMsg }\n`;
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

  process.stdout.write(`Querying CloudFormation organizations for stage: ${ stage }${ organizationFilter }\n`);

  const organizationBuckets = await getStageOrganizations(clients.cloudFormation, stage, filterOrganization);

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

if (import.meta.main) {
  main().catch(error => {
    process.stderr.write(`Deployment failed: ${ error.message }\n`);
    process.exit(1);
  });
}
