#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { buildAppConfig } from './lib/appconfig.js';
import { createSecretsManagerClient, fetchOrganizationSecrets, getOrganizationSecretName } from './lib/aws.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get frontend version for appconfig
 * Prefers release/tag version when available in CI.
 * @returns {string}
 */
function getVersion() {
  const tagVersion = process.env.DEPLOY_TARGET_VERSION || process.env.CIRCLE_TAG;
  if (tagVersion) {
    return tagVersion.trim();
  }

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
      + 'Available organizations should be in AWS Secrets Manager under customer/<stage>/',
    );
  }

  throw err;
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
 * Generate appconfig.json from organization secrets
 * Matches backend AppConfig::toArray() logic
 * @param {Object} secrets - Organization secrets from Secrets Manager
 * @param {string} stage - Deployment stage
 * @param {string} organization - Organization identifier
 * @returns {Object} appconfig object
 */
function generateAppConfig(secrets, stage, organization) {
  return buildAppConfig({
    secrets,
    stage,
    organization,
    version: getVersion(),
    deploymentTime: getDeploymentTime(),
    deploymentSource: getDeploymentSource(),
  });
}

function ensureStage(stage, organization) {
  if (!stage) {
    throw new Error(`Stage is required when generating appconfig for organization: ${ organization }`);
  }
}

async function fetchAppConfigSecrets(client, stage, organization) {
  const secretName = getOrganizationSecretName(stage, organization);

  try {
    return await fetchOrganizationSecrets(client, stage, organization);
  } catch(error) {
    handleSecretsError(error, secretName);
  }
}

/**
 * Generate and write appconfig.json for an organization
 * @param {string} organization - Organization identifier
 * @param {string} stage - Deployment stage
 */
export async function writeAppConfig(
  organization = process.env.ORGANIZATION || process.env.DEPLOY_ORGANIZATION || 'localhost',
  stage = process.env.STAGE || process.env.DEPLOY_STAGE,
) {
  if (organization === 'localhost') {
    return;
  }

  ensureStage(stage, organization);
  const client = createSecretsManagerClient();
  const secrets = await fetchAppConfigSecrets(client, stage, organization);

  const appConfig = generateAppConfig(secrets, stage, organization);

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
