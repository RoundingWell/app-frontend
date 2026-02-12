import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppConfig, parseBool } from './appconfig.js';

test('parseBool matches expected truthy values', () => {
  assert.equal(parseBool('1'), true);
  assert.equal(parseBool('true'), true);
  assert.equal(parseBool('on'), true);
  assert.equal(parseBool('yes'), true);
  assert.equal(parseBool('TRUE'), true);
});

test('parseBool returns false for non-truthy values', () => {
  assert.equal(parseBool('0'), false);
  assert.equal(parseBool('false'), false);
  assert.equal(parseBool('no'), false);
  assert.equal(parseBool('off'), false);
  assert.equal(parseBool(undefined), false);
  assert.equal(parseBool(null), false);
});

test('buildAppConfig returns Auth0 config when WorkOS client id is missing', () => {
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
    stack: 'customer-a',
    version: 'abc1234',
    deploymentTime: '2026-02-12T00:00:00-06:00',
    deploymentSource: 'Manual Deployment',
  });

  assert.deepEqual(config, {
    app: {
      env: 'prod',
      stack: 'customer-a',
      name: 'Acme',
      disableLoginPrompt: true,
      enableWebsockets: false,
    },
    datadog: {
      applicationId: 'dd-app',
      clientToken: 'dd-token',
    },
    deployment: {
      time: '2026-02-12T00:00:00-06:00',
      source: 'Manual Deployment',
    },
    versions: {
      backend: '',
      frontend: 'abc1234',
    },
    auth0: {
      domain: 'acme.auth0.com',
      clientId: 'auth0-client',
      authorizationParams: {
        connection: 'Username-Password-Authentication',
        organization: 'org_123',
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage',
    },
  });
});

test('buildAppConfig prioritizes WorkOS and strips null provider branch', () => {
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
    stack: 'qa2',
    version: 'def5678',
    deploymentTime: '2026-02-12T08:00:00-06:00',
    deploymentSource: 'Continuous Integration',
  });

  assert.deepEqual(config, {
    app: {
      env: 'qa',
      stack: 'qa2',
      name: 'Acme',
      disableLoginPrompt: false,
      enableWebsockets: true,
    },
    datadog: {
      applicationId: 'dd-app',
      clientToken: 'dd-token',
    },
    deployment: {
      time: '2026-02-12T08:00:00-06:00',
      source: 'Continuous Integration',
    },
    versions: {
      backend: '',
      frontend: 'def5678',
    },
    workos: {
      clientId: 'workos-client',
      createClientOptions: {
        apiHostname: 'workos.example.com',
      },
    },
  });

  assert.equal('auth0' in config, false);
});
