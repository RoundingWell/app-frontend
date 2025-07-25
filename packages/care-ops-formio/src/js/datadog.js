import { initLogs, initRum, startRum, addError } from '@roundingwell/care-ops-datadog';

import { datadogConfig as config, versions, appConfig } from '@roundingwell/care-ops-config';

function initDataDog({ isPdfPrinter }) {
  // NOTE: Remove when developing and testing Datadog
  if (location.hostname === 'localhost') return;

  const env = `${ appConfig.env }.${ appConfig.stack }`;
  const service = 'care-ops-forms';

  initLogs({
    env,
    service,
    clientToken: config.clientToken,
    version: versions.frontend,
  });

  if (isPdfPrinter) return;

  initRum({
    env,
    service,
    applicationId: config.applicationId,
    clientToken: config.clientToken,
    version: versions.frontend,
  });

  startRum();
}

export {
  initDataDog,
  addError,
};
