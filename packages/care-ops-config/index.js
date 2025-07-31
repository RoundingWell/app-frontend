const auth0Config = {};
const e2eConfig = {};
const kindeConfig = {};
const workosConfig = {};
const datadogConfig = {};
const appConfig = {};
const versions = {};

function fetchConfig(cache = Date.now()) {
  return fetch(`/appconfig.json?${ new URLSearchParams({ _: cache }) }`)
    .then(response => response.json())
    .then(config => {
      Object.assign(auth0Config, config.auth0);
      Object.assign(e2eConfig, config.e2e);
      Object.assign(kindeConfig, config.kinde);
      Object.assign(workosConfig, config.workos);
      Object.assign(datadogConfig, config.datadog);
      Object.assign(appConfig, config.app);
      Object.assign(versions, config.versions);
    });
}

export {
  auth0Config,
  e2eConfig,
  fetchConfig,
  kindeConfig,
  workosConfig,
  datadogConfig,
  appConfig,
  versions,
};
