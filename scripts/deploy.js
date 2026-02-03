#!/usr/bin/env node

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { CloudFormationClient, DescribeStacksCommand, ListStacksCommand } from '@aws-sdk/client-cloudformation';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromSSO, fromEnv } from '@aws-sdk/credential-providers';
import { execFileSync } from 'child_process';
import { parseArgs } from 'node:util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get AWS credentials based on environment
 * @returns {Object} AWS credentials
 */
function getCredentials() {
  return process.env.CI ?
    fromEnv() :
    fromSSO({ profile: process.env.AWS_PROFILE || 'default' });
}

/**
 * Create AWS clients
 * @returns {Object} AWS clients
 */
function createAwsClients() {
  const region = process.env.AWS_REGION || 'us-west-2';
  const credentials = getCredentials();

  return {
    s3: new S3Client({ region, credentials }),
    cloudFront: new CloudFrontClient({ region, credentials }),
    cloudFormation: new CloudFormationClient({ region, credentials }),
    secretsManager: new SecretsManagerClient({ region, credentials }),
  };
}

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
    const bucketName = await getStackWebsiteBucket(cfClient, stackName);
    if (bucketName) {
      stackBuckets.set(filterStack, bucketName);
    }
    return stackBuckets;
  }

  // List all stacks for the stage
  const command = new ListStacksCommand({
    StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE'],
  });

  const response = await cfClient.send(command);
  const prefix = `careops-${ stage }-`;

  for (const stack of response.StackSummaries || []) {
    if (!stack.StackName.startsWith(prefix)) continue;

    const stackIdentifier = stack.StackName.slice(prefix.length);

    const bucketName = await getStackWebsiteBucket(cfClient, stack.StackName);
    if (bucketName) {
      stackBuckets.set(stackIdentifier, bucketName);
    }
  }

  return stackBuckets;
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
function generateAppConfig(stack) {
  process.stdout.write(`Generating appconfig for stack: ${ stack }\n`);
  execFileSync('node', [path.join(__dirname, 'generate-appconfig.js')], {
    stdio: 'inherit',
    env: { ...process.env, STACK: stack },
  });
}

/**
 * Fetch stack secrets from AWS Secrets Manager
 * @param {SecretsManagerClient} secretsClient - Secrets Manager client instance
 * @param {string} stack - Stack identifier
 * @returns {Promise<Object>} Parsed secret object
 */
async function fetchStackSecrets(secretsClient, stack) {
  const secretName = `careops/customer/${ stack }`;

  const command = new GetSecretValueCommand({
    SecretId: secretName,
  });

  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret value is empty for stack: ${ stack }`);
  }

  return JSON.parse(response.SecretString);
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

  generateAppConfig(stack);

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

  const { stage, stack: filterStack } = values;

  if (!stage) {
    process.stderr.write('Error: --stage is required\n');
    process.stderr.write('Usage: npm run deploy -- --stage=prod [--stack=qa2]\n');
    process.exit(1);
  }

  const stackFilter = filterStack ? ` (stack: ${ filterStack })` : '';

  // Create AWS clients once and reuse
  const clients = createAwsClients();

  process.stdout.write(`Querying CloudFormation stacks for stage: ${ stage }${ stackFilter }\n`);

  const stackBuckets = await getStageStacks(clients.cloudFormation, stage, filterStack);

  if (stackBuckets.size === 0) {
    const stackMsg = filterStack ? ` with stack: ${ filterStack }` : '';
    process.stderr.write(`No stacks found: careops-${ stage }-*${ stackMsg }\n`);
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
