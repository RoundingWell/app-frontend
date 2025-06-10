import { extend } from 'underscore';

const auth0Config = {};
const e2eConfig = {};
const kindeConfig = {};
const workosConfig = {};
const datadogConfig = {};
const appConfig = {};
const versions = {};

// Temporary solution for getting env ws url
function fetchWebsocket(success) {
  fetch('/api/websockets')
    .then(response => response.json())
    .then(({ data }) => {
      if (data.is_enabled) appConfig.ws = data.endpoint;
      success();
    });
}

function fetchConfig(success, isForm) {
  fetch(`/appconfig.json?${ new URLSearchParams({ _: _NOW_ }) }`)
    .then(response => response.json())
    .then(config => {
      extend(auth0Config, config.auth0);
      extend(e2eConfig, config.e2e);
      extend(kindeConfig, config.kinde);
      extend(workosConfig, config.workos);
      extend(datadogConfig, config.datadog);
      extend(appConfig, config.app);
      extend(versions, config.versions);

      if (isForm) {
        success();
        return;
      }

      fetchWebsocket(success);
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
