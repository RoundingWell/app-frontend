/**
 * Parse boolean value from string (matches PHP filter_var FILTER_VALIDATE_BOOL)
 * @param {string|boolean} value - Value to parse
 * @returns {boolean}
 */
export function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;

  const truthyValues = ['1', 'true', 'on', 'yes'];
  return truthyValues.includes(value.toLowerCase());
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
 * Build appconfig object from stack secrets
 * Matches backend AppConfig::toArray() logic
 * @param {Object} params - Build params
 * @param {Object} params.secrets - Stack secrets from Secrets Manager
 * @param {string} params.stage - Deployment stage
 * @param {string} params.stack - Stack identifier
 * @param {string} params.version - Frontend version string
 * @param {string} params.deploymentTime - Deployment time in ISO8601
 * @param {string} params.deploymentSource - Deployment source
 * @returns {Object} appconfig object
 */
export function buildAppConfig({
  secrets,
  stage,
  stack,
  version,
  deploymentTime,
  deploymentSource,
}) {
  // Base config matching PHP AppConfig::toArray()
  const config = {
    app: {
      stage,
      stack,
      version,
      name: secrets.OrganizationName || '',
      disableLoginPrompt: parseBool(secrets.DisableLoginPrompt || 'false'),
    },
    datadog: {
      applicationId: secrets.DatadogAppId || '',
      clientToken: secrets.DatadogClientToken || '',
    },
    deployment: {
      time: deploymentTime,
      source: deploymentSource,
    },
    auth0: null,
    workos: null,
  };

  // TEMP legacy compatibility block.
  // Remove after downstream consumers fully migrate to app.stage/app.version.
  config.app.env = stage;
  config.versions = {
    frontend: version,
  };

  // Add WorkOS or Auth0 (WorkOS takes priority)
  addAuthProvider(config, secrets);

  // Remove null values (matches PHP nullifyAny)
  return removeNullValues(config);
}
