import { initLogs, initRum, setUser, startRum, addError, logResponse } from '@roundingwell/care-ops-datadog';

import { datadogConfig as config, versions, appConfig } from './config';

function getEnv() {
  return `${ appConfig.env }.${ appConfig.stack }`;
}

function initDataDog() {
  // NOTE: Remove when developing and testing Datadog
  if (!_PRODUCTION_) return;

  const env = getEnv();
  const service = 'care-ops-frontend';

  initLogs({
    env,
    service,
    clientToken: config.clientToken,
    version: versions.frontend,
  });

  initRum({
    env,
    service,
    applicationId: config.applicationId,
    clientToken: config.clientToken,
    version: versions.frontend,
  });
}

export {
  initDataDog,
  setUser,
  startRum,
  addError,
  logResponse,
};
