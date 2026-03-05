import { initLogs, initRum, setUser, startRum, addError, logResponse } from '@roundingwell/care-ops-datadog';

import { getDatadogLogsOptions, getDatadogRumOptions } from '@roundingwell/care-ops-config';

function initDataDog() {
  // NOTE: Remove when developing and testing Datadog
  if (!_PRODUCTION_ || _TEST_) return;

  const service = 'app-frontend';

  initLogs(getDatadogLogsOptions(service));
  initRum(getDatadogRumOptions(service));
}

export {
  initDataDog,
  setUser,
  startRum,
  addError,
  logResponse,
};
