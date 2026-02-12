#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { buildAppConfig } from './lib/appconfig.js';
import { createSecretsManagerClient, fetchSecretJson } from './lib/aws.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the current git commit SHA
 * @returns {string}
 */
function getVersion() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Handle errors from AWS Secrets Manager
 * @param {unknown} error - The error object
 * @param {string} secretName - The secret name
 */
function handleSecretsError(error, secretName) {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message.toLowerCase();

  if (err.name === 'TimeoutError' || message.includes('timeout') || message.includes('timed out')) {
    throw new Error(`Request timed out while fetching secret: ${ secretName }`);
  }

  if (err.name === 'CredentialsProviderError' || message.includes('credentials')) {
    throw new Error('AWS credentials not available');
  }

  if (err.name === 'ResourceNotFoundException') {
    throw new Error(
      `Secret not found: ${ secretName }\n`
      + 'Available stacks should be in AWS Secrets Manager under careops/customer/',
    );
  }

  throw err;
}

/**
 * Fetch stack secrets from AWS Secrets Manager using AWS SDK
 * @param {string} stack - Stack identifier
 * @returns {Promise<Object>} Parsed secret object
 */
async function fetchStackSecrets(stack) {
  const secretName = `careops/customer/${ stack }`;
  const client = createSecretsManagerClient();

  try {
    return await fetchSecretJson(client, secretName);
  } catch(error) {
    handleSecretsError(error, secretName);
  }
}

/**
 * Get deployment source (Manual or CI)
 * @returns {string}
 */
function getDeploymentSource() {
  return process.env.CI ? 'Continuous Integration' : 'Manual Deployment';
}

/**
 * Get current timestamp in ISO8601 format (Chicago timezone)
 * @returns {string}
 */
function getDeploymentTime() {
  return dayjs().tz('America/Chicago').format('YYYY-MM-DDTHH:mm:ssZ');
}

/**
 * Generate appconfig.json from stack secrets
 * Matches backend AppConfig::toArray() logic
 * @param {Object} secrets - Stack secrets from Secrets Manager
 * @param {string} stack - Stack identifier
 * @returns {Object} appconfig object
 */
function generateAppConfig(secrets, stack) {
  return buildAppConfig({
    secrets,
    stack,
    version: getVersion(),
    deploymentTime: getDeploymentTime(),
    deploymentSource: getDeploymentSource(),
  });
}

/**
 * Generate and write appconfig.json for a stack
 * @param {string} stack - Stack identifier
 */
export async function writeAppConfig(stack = process.env.STACK || 'localhost') {
  if (stack === 'localhost') {
    return;
  }

  const secrets = await fetchStackSecrets(stack);
  const appConfig = generateAppConfig(secrets, stack);

  const distDir = path.join(__dirname, '../dist');
  const configPath = path.join(distDir, 'appconfig.json');

  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
}

/**
 * Main function
 */
async function main() {
  try {
    await writeAppConfig();
  } catch(error) {
    process.stderr.write(`Error: ${ error.message }\n`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
