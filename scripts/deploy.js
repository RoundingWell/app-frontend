#!/usr/bin/env node

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DescribeStacksCommand, ListStacksCommand } from '@aws-sdk/client-cloudformation';
import { parseArgs } from 'node:util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeAppConfig } from './generate-appconfig.js';
import { createAwsClients, fetchSecretJson } from './lib/aws.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get WebsiteBucket output from a CloudFormation stack
 * @param {CloudFormationClient} cfClient - CloudFormation client instance
 * @param {string} stackName - Full CloudFormation stack name
 * @returns {Promise<string|null>} Website bucket name or null
 */
async function getStackWebsiteBucket(cfClient, stackName) {
  try {
    const command = new DescribeStacksCommand({ StackName: stackName });
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
 * Get all stacks for a stage with their website buckets
 * @param {CloudFormationClient} cfClient - CloudFormation client instance
 * @param {string} stage - Deployment stage (dev, qa, prod, sandbox)
 * @param {string} filterStack - Optional specific stack identifier to filter
 * @returns {Promise<Map>} Map of stack identifiers to bucket names
 */
async function getStageStacks(cfClient, stage, filterStack) {
  const stackBuckets = new Map();

  if (filterStack) {
    // Query specific stack
    const stackName = `careops-${ stage }-${ filterStack }`;
    await addStackBucket(stackBuckets, cfClient, filterStack, stackName);
    return stackBuckets;
  }

  const prefix = `careops-${ stage }-`;
  let nextToken;

  do {
    const command = new ListStacksCommand({
      StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'],
      ...(nextToken ? { NextToken: nextToken } : {}),
    });

    const response = await cfClient.send(command);

    for (const stack of response.StackSummaries || []) {
      if (!stack.StackName.startsWith(prefix)) continue;

      const stackIdentifier = stack.StackName.slice(prefix.length);
      await addStackBucket(stackBuckets, cfClient, stackIdentifier, stack.StackName);
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return stackBuckets;
}

/**
 * Resolve and add WebsiteBucket for a stack when available
 * @param {Map<string, string>} stackBuckets - Target map
 * @param {CloudFormationClient} cfClient - CloudFormation client
 * @param {string} stackIdentifier - Stack identifier
 * @param {string} stackName - CloudFormation stack name
 */
async function addStackBucket(stackBuckets, cfClient, stackIdentifier, stackName) {
  const bucketName = await getStackWebsiteBucket(cfClient, stackName);
  if (bucketName) {
    stackBuckets.set(stackIdentifier, bucketName);
  }
}

/**
 * Get content type based on file extension
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
 * Upload a single file to S3
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
 * Upload entire directory to S3 recursively
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
 * Generate appconfig for a specific stack
 * @param {string} stack - The stack name
 */
async function generateAppConfig(stack) {
  process.stdout.write(`Generating appconfig for stack: ${ stack }\n`);
  await writeAppConfig(stack);
}

/**
 * Fetch stack secrets from AWS Secrets Manager
 * @param {SecretsManagerClient} secretsClient - Secrets Manager client instance
 * @param {string} stack - Stack identifier
 * @returns {Promise<Object>} Parsed secret object
 */
async function fetchStackSecrets(secretsClient, stack) {
  const secretName = `careops/customer/${ stack }`;
  return fetchSecretJson(secretsClient, secretName);
}

/**
 * Invalidate CloudFront distribution
 * @param {CloudFrontClient} cloudFrontClient - CloudFront client instance
 * @param {string} stack - Stack name
 * @param {string} distroId - CloudFront distribution ID
 */
async function invalidateCloudFront(cloudFrontClient, stack, distroId) {
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
  process.stdout.write('CloudFront invalidation created\n');
}

/**
 * Deploy to a single stack
 * @param {Object} clients - AWS clients
 * @param {string} stack - Stack name
 * @param {string} bucketName - S3 bucket name
 * @param {string} distDir - Path to dist directory
 */
async function deployToStack(clients, stack, bucketName, distDir) {
  process.stdout.write(`\nDeploying to stack: ${ stack }\n`);

  await generateAppConfig(stack);

  process.stdout.write(`Uploading dist directory to ${ bucketName }...\n`);
  await uploadDirectory(clients.s3, bucketName, distDir);

  // Invalidate CloudFront if distribution exists
  try {
    const secrets = await fetchStackSecrets(clients.secretsManager, stack);
    if (secrets.DistroId) {
      await invalidateCloudFront(clients.cloudFront, stack, secrets.DistroId);
    } else {
      process.stdout.write('No CloudFront distribution found, skipping invalidation\n');
    }
  } catch(error) {
    process.stderr.write(`Warning: Could not invalidate CloudFront: ${ error.message }\n`);
  }

  process.stdout.write(`Deployment to ${ stack } complete\n`);
}

function resolveDeployInputs(values) {
  const stage = values.stage || process.env.DEPLOY_STAGE;
  const filterStack = values.stack || process.env.DEPLOY_STACK;
  const deployAwsProfile = process.env.DEPLOY_AWS_PROFILE;

  if (deployAwsProfile && !process.env.AWS_PROFILE) {
    process.env.AWS_PROFILE = deployAwsProfile;
  }

  if (!stage) {
    process.stderr.write('Error: --stage is required (or set DEPLOY_STAGE)\n');
    process.stderr.write('Usage: npm run deploy -- --stage=prod [--stack=qa2]\n');
    process.stderr.write('   or: npm run deploy:dev (uses .env)\n');
    process.exit(1);
  }

  return { stage, filterStack };
}

function formatStackFilter(filterStack) {
  return filterStack ? ` (stack: ${ filterStack })` : '';
}

function formatNoStacksError(stage, filterStack) {
  const stackMsg = filterStack ? ` with stack: ${ filterStack }` : '';
  return `No stacks found: careops-${ stage }-*${ stackMsg }\n`;
}

/**
 * Main deployment function
 */
async function main() {
  const { values } = parseArgs({
    options: {
      'stage': { type: 'string' },
      'stack': { type: 'string' },
    },
  });

  const { stage, filterStack } = resolveDeployInputs(values);
  const stackFilter = formatStackFilter(filterStack);

  // Create AWS clients once and reuse
  const clients = createAwsClients();

  process.stdout.write(`Querying CloudFormation stacks for stage: ${ stage }${ stackFilter }\n`);

  const stackBuckets = await getStageStacks(clients.cloudFormation, stage, filterStack);

  if (stackBuckets.size === 0) {
    process.stderr.write(formatNoStacksError(stage, filterStack));
    process.exit(1);
  }

  process.stdout.write(`Found ${ stackBuckets.size } stacks to deploy:\n`);
  stackBuckets.forEach((bucketName, stack) => {
    process.stdout.write(`  - ${ stack } -> ${ bucketName }\n`);
  });

  const distDir = path.join(__dirname, '../dist');

  for (const [stack, bucketName] of stackBuckets) {
    await deployToStack(clients, stack, bucketName, distDir);
  }

  process.stdout.write('\nAll deployments complete!\n');
}

main().catch(error => {
  process.stderr.write(`Deployment failed: ${ error.message }\n`);
  process.exit(1);
});
