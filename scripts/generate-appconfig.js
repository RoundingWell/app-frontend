#!/usr/bin/env node

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromSSO, fromEnv } from '@aws-sdk/credential-providers';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

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
 * @param {Error} error - The error object
 * @param {string} secretName - The secret name
 */
function handleSecretsError(error, secretName) {
  if (error.name === 'TimeoutError' || error.message.includes('timeout') || error.message.includes('timed out')) {
    throw new Error(`Request timed out while fetching secret: ${ secretName }`);
  }

  if (error.name === 'CredentialsProviderError' || error.message.includes('credentials')) {
    throw new Error('AWS credentials not available');
  }

  if (error.name === 'ResourceNotFoundException') {
    throw new Error(
      `Secret not found: ${ secretName }\n`
      + 'Available stacks should be in AWS Secrets Manager under careops/customer/',
    );
  }

  throw error;
}

/**
 * Fetch stack secrets from AWS Secrets Manager using AWS SDK
 * @param {string} stack - Stack identifier
 * @returns {Promise<Object>} Parsed secret object
 */
async function fetchStackSecrets(stack) {
  const region = process.env.AWS_REGION || 'us-west-2';
  const secretName = `careops/customer/${ stack }`;

  const credentials = process.env.CI ?
    fromEnv() :
    fromSSO({ profile: process.env.AWS_PROFILE || 'default' });

  const client = new SecretsManagerClient({
    region,
    credentials,
  });

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    return JSON.parse(response.SecretString);
  } catch(error) {
    handleSecretsError(error, secretName);
  }
}

/**
 * Determine the stage from stack name
 * Matches backend Stage::fromStack() logic
 * @param {string} stack - Stack identifier
 * @returns {string}
 */
function getStageFromStack(stack) {
  const stageMap = {
    'rw': 'local',
    'test': 'local',
    'derek': 'dev',
    'nick': 'dev',
    'paul': 'dev',
    'sean': 'dev',
    'will': 'dev',
    'woody': 'dev',
    'zak': 'dev',
    'qa2': 'qa',
    'quality-assurance': 'qa',
  };

  return stageMap[stack] || 'prod';
}

/**
 * Parse boolean value from string (matches PHP filter_var FILTER_VALIDATE_BOOL)
 * @param {string|boolean} value - Value to parse
 * @returns {boolean}
 */
function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;

  const truthyValues = ['1', 'true', 'on', 'yes'];
  return truthyValues.includes(value.toLowerCase());
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
 * Create WorkOS config object
 * @param {Object} secrets - Stack secrets
 * @returns {Object}
 */
function createWorkOsConfig(secrets) {
  return {
    clientId: secrets.WorkOsClientId || '',
    createClientOptions: {
      apiHostname: secrets.WorkOsApiDomain || 'login.roundingwell.com',
    },
  };
}

/**
 * Create Auth0 config object
 * @param {Object} secrets - Stack secrets
 * @returns {Object}
 */
function createAuth0Config(secrets) {
  return {
    domain: secrets.Auth0ClientDomain || '',
    clientId: secrets.Auth0ClientID || secrets.Auth0ClientId || '',
    authorizationParams: {
      connection: secrets.Auth0Connection || '',
      organization: secrets.Auth0Organization || secrets.Auth0OrgId || '',
    },
    useRefreshTokens: true,
    cacheLocation: 'localstorage',
  };
}

/**
 * Add WorkOS or Auth0 config based on what's available
 * WorkOS takes priority if clientId exists
 * @param {Object} config - Config object to modify
 * @param {Object} secrets - Stack secrets
 */
function addAuthProvider(config, secrets) {
  const workOsClientId = secrets.WorkOsClientId || '';

  if (workOsClientId) {
    config.workos = createWorkOsConfig(secrets);
    config.auth0 = null;
  } else {
    config.auth0 = createAuth0Config(secrets);
    config.workos = null;
  }
}

/**
 * Remove null/empty values from object (matches PHP nullifyAny)
 * @param {Object} obj - Object to clean
 * @returns {Object}
 */
function removeNullValues(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeNullValues(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Generate appconfig.json from stack secrets
 * Matches backend AppConfig::toArray() logic
 * @param {Object} secrets - Stack secrets from Secrets Manager
 * @param {string} stack - Stack identifier
 * @returns {Object} appconfig object
 */
function generateAppConfig(secrets, stack) {
  const version = getVersion();
  const stage = getStageFromStack(stack);

  // Base config matching PHP AppConfig::toArray()
  const config = {
    app: {
      env: stage,
      stack,
      name: secrets.Auth0Name || '',
      disableLoginPrompt: parseBool(secrets.DisableLoginPrompt || 'false'),
      enableWebsockets: parseBool(secrets.WebsocketsEnabled || 'no'),
    },
    datadog: {
      applicationId: secrets.DatadogAppId || '',
      clientToken: secrets.DatadogClientToken || '',
    },
    deployment: {
      time: getDeploymentTime(),
      source: getDeploymentSource(),
    },
    versions: {
      backend: '',
      frontend: version,
    },
    auth0: null,
    workos: null,
  };

  // Add WorkOS or Auth0 (WorkOS takes priority)
  addAuthProvider(config, secrets);

  // Remove null values (matches PHP nullifyAny)
  return removeNullValues(config);
}

/**
 * Main function
 */
async function main() {
  const stack = process.env.STACK || 'localhost';

  if (stack === 'localhost') {
    return;
  }

  try {
    const secrets = await fetchStackSecrets(stack);
    const appConfig = generateAppConfig(secrets, stack);

    const distDir = path.join(__dirname, '../dist');
    const configPath = path.join(distDir, 'appconfig.json');

    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
  } catch(error) {
    process.stderr.write(`Error: ${ error.message }\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${ process.argv[1] }`) {
  main();
}
