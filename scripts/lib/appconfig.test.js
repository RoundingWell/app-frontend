import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppConfig } from './appconfig.js';

test('buildAppConfig sets auth.provider=workos', () => {
  const config = buildAppConfig({
    secrets: {
      OrganizationName: 'Acme',
      DisableLoginPrompt: 'false',
      WebsocketsEnabled: 'yes',
      DatadogAppId: 'dd-app',
      DatadogClientToken: 'dd-token',
      WorkOsClientId: 'workos-client',
      WorkOsApiDomain: 'workos.example.com',
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
      version: 'def5678',
      name: 'Acme',
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
          devMode: true,
        },
      },
    },
  });
});

test('buildAppConfig omits WorkOS devMode outside dev and qa', () => {
  const config = buildAppConfig({
    secrets: {
      OrganizationName: 'Acme',
      WorkOsClientId: 'workos-client',
      WorkOsApiDomain: 'workos.example.com',
    },
    stage: 'prod',
    organization: 'customer-a',
    version: 'ghi9012',
    deploymentTime: '2026-02-12T08:00:00-06:00',
    deploymentSource: 'Continuous Integration',
  });

  assert.equal(config.auth.config.createClientOptions.devMode, undefined);
});
