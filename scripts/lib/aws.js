import { S3Client } from '@aws-sdk/client-s3';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromSSO } from '@aws-sdk/credential-providers';

/**
 * Get the credential provider to use for AWS clients.
 * Local development uses the configured AWS SSO profile, while CI falls back
 * to the AWS SDK's default credential resolution.
 * @returns {Object|undefined} AWS credentials provider
 */
export function getCredentials() {
  return process.env.CI ? undefined : fromSSO({ profile: process.env.AWS_PROFILE || 'default' });
}

/**
 * Get AWS region
 * @returns {string}
 */
export function getRegion() {
  return process.env.AWS_REGION || 'us-west-2';
}

/**
 * Create AWS clients for deployment workflow
 * @returns {Object} AWS clients
 */
export function createAwsClients() {
  const region = getRegion();
  const credentials = getCredentials();

  return {
    s3: new S3Client({ region, credentials }),
    cloudFront: new CloudFrontClient({ region, credentials }),
    cloudFormation: new CloudFormationClient({ region, credentials }),
    secretsManager: new SecretsManagerClient({ region, credentials }),
  };
}

/**
 * Create a Secrets Manager client
 * @returns {SecretsManagerClient}
 */
export function createSecretsManagerClient() {
  return new SecretsManagerClient({
    region: getRegion(),
    credentials: getCredentials(),
  });
}

/**
 * Fetch and parse JSON secret value
 * @param {SecretsManagerClient} secretsClient - Secrets Manager client
 * @param {string} secretName - Secret name
 * @returns {Promise<Object>} Parsed secret object
 */
export async function fetchSecretJson(secretsClient, secretName) {
  const command = new GetSecretValueCommand({
    SecretId: secretName,
  });

  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret value is empty for secret: ${ secretName }`);
  }

  return JSON.parse(response.SecretString);
}

/**
 * Build stack secret name
 * @param {string} stage - Deployment stage
 * @param {string} stack - Stack identifier
 * @returns {string} Secret name
 */
export function getStackSecretName(stage, stack) {
  return `customer/${ stage }/${ stack }`;
}

/**
 * Fetch stack secrets from AWS Secrets Manager
 * @param {SecretsManagerClient} secretsClient - Secrets Manager client
 * @param {string} stage - Deployment stage
 * @param {string} stack - Stack identifier
 * @returns {Promise<Object>} Parsed secret object
 */
export async function fetchStackSecrets(secretsClient, stage, stack) {
  const secretName = getStackSecretName(stage, stack);
  return fetchSecretJson(secretsClient, secretName);
}
