function getDisableLoginPrompt(secrets) {
  return String(secrets.DisableLoginPrompt ?? '').toLowerCase() === 'true';
}

/**
 * Create auth config for WorkOS
 * @param {Object} secrets - Stack secrets
 * @returns {Object}
 */
function createWorkOsAuthConfig(secrets) {
  return {
    provider: 'workos',
    disableLoginPrompt: getDisableLoginPrompt(secrets),
    config: {
      clientId: secrets.WorkOsClientId || '',
      createClientOptions: {
        apiHostname: secrets.WorkOsApiDomain || 'login.roundingwell.com',
      },
    },
  };
}

/**
 * Create auth config for Auth0
 * @param {Object} secrets - Stack secrets
 * @returns {Object}
 */
function createAuth0AuthConfig(secrets) {
  return {
    provider: 'auth0',
    disableLoginPrompt: getDisableLoginPrompt(secrets),
    config: {
      domain: secrets.Auth0ClientDomain || '',
      clientId: secrets.Auth0ClientID || secrets.Auth0ClientId || '',
      authorizationParams: {
        connection: secrets.Auth0Connection || '',
        organization: secrets.Auth0Organization || secrets.Auth0OrgId || '',
        audience: secrets.Auth0Audience || 'care-ops-backend',
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
    },
  };
}

/**
 * Add auth config based on available secrets.
 * WorkOS takes priority if clientId exists.
 * @param {Object} config - Config object to modify
 * @param {Object} secrets - Stack secrets
 */
function addAuthProvider(config, secrets) {
  config.auth = secrets.WorkOsClientId ?
    createWorkOsAuthConfig(secrets) :
    createAuth0AuthConfig(secrets);
}

function addLegacyAuthKeys(config) {
  if (!config.auth || !config.auth.provider) return;
  const legacyAuth = {
    provider: config.auth.provider,
    disableLoginPrompt: config.auth.disableLoginPrompt,
    ...(config.auth.config || {}),
  };

  if (config.auth.provider === 'workos') {
    config.workos = legacyAuth;
    return;
  }

  if (config.auth.provider === 'auth0') {
    config.auth0 = legacyAuth;
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
 * Build appconfig object from organization secrets
 * Matches backend AppConfig::toArray() logic
 * @param {Object} params - Build params
 * @param {Object} params.secrets - Organization secrets from Secrets Manager
 * @param {string} params.stage - Deployment stage
 * @param {string} params.organization - Organization identifier
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

  // Add WorkOS or Auth0 (WorkOS takes priority)
  addAuthProvider(config, secrets);

  // TEMP legacy compatibility block.
  // Remove after downstream consumers fully migrate to app.stage/app.version.
  config.app.env = stage;
  config.app.stack = organization;
  config.app.disableLoginPrompt = config.auth.disableLoginPrompt;
  config.versions = {
    frontend: version,
  };

  // TEMP legacy auth compatibility keys.
  // Remove after downstream consumers fully migrate to the `auth` block.
  addLegacyAuthKeys(config);

  // Remove null values (matches PHP nullifyAny)
  return removeNullValues(config);
}
