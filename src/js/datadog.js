import { initLogs, initRum, setUser, startRum, startView, addError, addAction } from '@roundingwell/care-ops-datadog';

import { getDatadogLogsOptions, getDatadogRumOptions } from '@roundingwell/care-ops-config';

import trackNativeViews from 'js/utils/native-view-tracking';
import getNavigation from 'js/utils/get-navigation';

let initialized = false;

function initDataDog() {
  // NOTE: Remove when developing and testing Datadog
  if (!_PRODUCTION_ || _TEST_ || initialized) return;

  const service = 'app-frontend';
  const navigation = getNavigation();

  initLogs(getDatadogLogsOptions({ service }));
  // Use explicit pathname view boundaries for native navigation. History clients
  // and other consumers, such as shared forms, keep automatic SDK tracking.
  initRum({
    ...getDatadogRumOptions({
      service,
    }),
    trackViewsManually: !!navigation,
  });
  if (navigation) trackNativeViews(navigation, startView);
  initialized = true;
}

export {
  initDataDog,
  setUser,
  startRum,
  addAction,
  addError,
};
