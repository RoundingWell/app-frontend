import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppConfig } from './appconfig.js';

test('buildAppConfig returns auth.provider=auth0 when WorkOS client id is missing', () => {
  const config = buildAppConfig({
    secrets: {
      OrganizationName: 'Acme',
      DisableLoginPrompt: 'true',
      WebsocketsEnabled: 'no',
      DatadogAppId: 'dd-app',
      DatadogClientToken: 'dd-token',
      Auth0ClientDomain: 'acme.auth0.com',
      Auth0ClientID: 'auth0-client',
      Auth0Connection: 'Username-Password-Authentication',
      Auth0Organization: 'org_123',
    },
    stage: 'prod',
    organization: 'customer-a',
    version: 'abc1234',
    deploymentTime: '2026-02-12T00:00:00-06:00',
    deploymentSource: 'Manual Deployment',
  });

  assert.deepEqual(config, {
    app: {
      stage: 'prod',
      organization: 'customer-a',
      stack: 'customer-a',
      version: 'abc1234',
      env: 'prod',
      name: 'Acme',
      disableLoginPrompt: true,
    },
    versions: {
      frontend: 'abc1234',
    },
    datadog: {
      applicationId: 'dd-app',
      clientToken: 'dd-token',
    },
    deployment: {
      time: '2026-02-12T00:00:00-06:00',
      source: 'Manual Deployment',
    },
    auth: {
      provider: 'auth0',
      disableLoginPrompt: true,
      config: {
        domain: 'acme.auth0.com',
        clientId: 'auth0-client',
        authorizationParams: {
          connection: 'Username-Password-Authentication',
          organization: 'org_123',
          audience: 'care-ops-backend',
        },
        useRefreshTokens: true,
        cacheLocation: 'localstorage',
      },
    },
    auth0: {
      provider: 'auth0',
      disableLoginPrompt: true,
      domain: 'acme.auth0.com',
      clientId: 'auth0-client',
      authorizationParams: {
        connection: 'Username-Password-Authentication',
        organization: 'org_123',
        audience: 'care-ops-backend',
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
    },
  });
});

test('buildAppConfig prioritizes WorkOS and sets auth.provider=workos', () => {
  const config = buildAppConfig({
    secrets: {
      OrganizationName: 'Acme',
      DisableLoginPrompt: 'false',
      WebsocketsEnabled: 'yes',
      DatadogAppId: 'dd-app',
      DatadogClientToken: 'dd-token',
      WorkOsClientId: 'workos-client',
      WorkOsApiDomain: 'workos.example.com',
      Auth0ClientDomain: 'acme.auth0.com',
      Auth0ClientID: 'auth0-client',
    },
    stage: 'qa',
    organization: 'qa2',
    version: 'def5678',
    deploymentTime: '2026-02-12T08:00:00-06:00',
    deploymentSource: 'Continuous Integration',
  });

  assert.deepEqual(config, {
    app: {
      stage: 'qa',
      organization: 'qa2',
      stack: 'qa2',
      version: 'def5678',
      env: 'qa',
      name: 'Acme',
      disableLoginPrompt: false,
    },
    versions: {
      frontend: 'def5678',
    },
    datadog: {
      applicationId: 'dd-app',
      clientToken: 'dd-token',
    },
    deployment: {
      time: '2026-02-12T08:00:00-06:00',
      source: 'Continuous Integration',
    },
    auth: {
      provider: 'workos',
      disableLoginPrompt: false,
      config: {
        clientId: 'workos-client',
        createClientOptions: {
          apiHostname: 'workos.example.com',
        },
      },
    },
    workos: {
      provider: 'workos',
      disableLoginPrompt: false,
      clientId: 'workos-client',
      createClientOptions: {
        apiHostname: 'workos.example.com',
      },
    },
  });
});
