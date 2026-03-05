let configState = null;

function fetchConfig() {
  return fetch('/appconfig.json', { cache: 'no-store' })
    .then(response => response.json())
    .then(config => {
      configState = config;
    });
}

function getConfigSection(name) {
  return configState[name];
}

function getAppConfig() {
  return getConfigSection('app');
}

function getEnvName() {
  const app = getAppConfig();
  return `${ app.stage }.${ app.stack }`;
}

function getAppVersion() {
  return getAppConfig().version;
}

function getDatadogLogsOptions(service) {
  const datadog = getConfigSection('datadog');
  return {
    env: getEnvName(),
    service,
    clientToken: datadog.clientToken,
    version: getAppVersion(),
  };
}

function getDatadogRumOptions(service) {
  const datadog = getConfigSection('datadog');
  return {
    env: getEnvName(),
    service,
    clientToken: datadog.clientToken,
    version: getAppVersion(),
    applicationId: datadog.applicationId,
  };
}

export {
  fetchConfig,
  getConfigSection,
  getAppConfig,
  getAppVersion,
  getDatadogLogsOptions,
  getDatadogRumOptions,
};
