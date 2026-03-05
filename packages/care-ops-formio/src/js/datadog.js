import { initLogs, initRum, startRum, addError } from '@roundingwell/care-ops-datadog';
import { getDatadogLogsOptions, getDatadogRumOptions } from '@roundingwell/care-ops-config';

function initDataDog({ isPdfPrinter }) {
  // NOTE: Remove when developing and testing Datadog
  if (location.hostname === 'localhost') return;

  const service = 'care-ops-forms';

  initLogs(getDatadogLogsOptions(service));

  if (isPdfPrinter) return;

  initRum(getDatadogRumOptions(service));

  startRum();
}

export {
  initDataDog,
  addError,
};
