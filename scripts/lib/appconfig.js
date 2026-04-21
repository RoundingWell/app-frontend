function getDisableLoginPrompt(secrets) {
  return String(secrets.DisableLoginPrompt ?? '').toLowerCase() === 'true';
}

function shouldEnableWorkOsDevMode(stage) {
  return stage === 'dev' || stage === 'qa';
}

/**
 * Create auth config for WorkOS
 * @param {Object} secrets - Stack secrets
 * @param {string} stage - Deployed stage
 * @returns {Object}
 */
function createWorkOsAuthConfig(secrets, stage) {
  return {
    provider: 'workos',
    disableLoginPrompt: getDisableLoginPrompt(secrets),
    config: {
      clientId: secrets.WorkOsClientId || '',
      createClientOptions: {
        apiHostname: secrets.WorkOsApiDomain || 'login.roundingwell.com',
        ...(shouldEnableWorkOsDevMode(stage) ? { devMode: true } : {}),
      },
    },
  };
}

/**
 * Add auth config based on available secrets.
 * @param {Object} config - Config object to modify
 * @param {Object} secrets - Stack secrets
 */
function addAuthProvider(config, secrets) {
  config.auth = createWorkOsAuthConfig(secrets, config.app.stage);
}

/**
 * Remove null/undefined values from object (matches PHP nullifyAny)
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
 * Build appconfig object from organization secrets
 * Matches backend AppConfig::toArray() logic
 * @param {Object} params - Build params
 * @param {Object} params.secrets - Organization secrets from Secrets Manager
 * @param {string} params.stage - Deployed stage
 * @param {string} params.organization - Deployed organization
 * @param {string} params.version - Frontend version string
 * @param {string} params.deploymentTime - Deployment time in ISO8601
 * @param {string} params.deploymentSource - Deployment source
 * @returns {Object} appconfig object
 */
export function buildAppConfig({
  secrets,
  stage,
  organization,
  version,
  deploymentTime,
  deploymentSource,
}) {
  // Base config matching PHP AppConfig::toArray()
  const config = {
    app: {
      stage,
      organization,
      version,
      name: secrets.OrganizationName || '',
    },
    datadog: {
      applicationId: secrets.DatadogAppId || '',
      clientToken: secrets.DatadogClientToken || '',
    },
    deployment: {
      time: deploymentTime,
      source: deploymentSource,
    },
  };

  // Add auth provider
  addAuthProvider(config, secrets);

  // Remove null values (matches PHP nullifyAny)
  return removeNullValues(config);
}
