const configState = {};

function fetchConfig() {
  return fetch('/appconfig.json', { cache: 'no-store' })
    .then(response => response.json())
    .then(config => {
      configState.app = config.app || {};
      configState.auth = config.auth || {};
      configState.datadog = config.datadog || {};
    });
}

function getAuthConfig() {
  return configState.auth.config;
}

function getAuthProvider() {
  return configState.auth.provider;
}

function getAuthDisableLoginPrompt() {
  return configState.auth.disableLoginPrompt;
}

function getAppName() {
  return configState.app.name;
}

function getEnvName() {
  return `${ configState.app.stage }.${ configState.app.organization }`;
}

function getAppVersion() {
  return configState.app.version;
}

function getDatadogVersion(version) {
  return version || getAppVersion();
}

function getDatadogLogsOptions({ service, version } = {}) {
  const datadog = configState.datadog;
  return {
    env: getEnvName(),
    service,
    clientToken: datadog.clientToken,
    version: getDatadogVersion(version),
  };
}

function getDatadogRumOptions({ service, version } = {}) {
  const datadog = configState.datadog;
  return {
    env: getEnvName(),
    service,
    clientToken: datadog.clientToken,
    version: getDatadogVersion(version),
    applicationId: datadog.applicationId,
  };
}

export {
  fetchConfig,
  getAppName,
  getAppVersion,
  getAuthConfig,
  getAuthProvider,
  getAuthDisableLoginPrompt,
  getDatadogLogsOptions,
  getDatadogRumOptions,
};
