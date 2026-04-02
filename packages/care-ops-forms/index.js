import {
  fetchConfig,
  getAppVersion,
  getDatadogLogsOptions,
  getDatadogRumOptions,
} from '@roundingwell/care-ops-config';
import {
  addError,
  initLogs,
  initRum,
  startRum,
} from '@roundingwell/care-ops-datadog';

let formsConfigPromise;
let formsDatadogPromise;

function getSearchParams() {
  return new URLSearchParams(window.location.search);
}

function isPdfFormRequest() {
  return Boolean(getSearchParams().get('pdf'));
}

function fetchFormsConfig() {
  if (!formsConfigPromise) {
    formsConfigPromise = fetchConfig().catch(error => {
      formsConfigPromise = null;
      throw error;
    });
  }

  return formsConfigPromise;
}

function getFormsVersion() {
  return getAppVersion();
}

function postFormsVersion(targetWindow = parent, targetOrigin = window.origin) {
  targetWindow.postMessage({ message: 'version', args: getFormsVersion() }, targetOrigin);
}

function initFormsDatadog({
  isPdfPrinter,
  service,
}) {
  if (location.hostname === 'localhost') return Promise.resolve();

  if (!formsDatadogPromise) {
    formsDatadogPromise = fetchFormsConfig()
      .then(() => {
        const logOptions = getDatadogLogsOptions(service);

        if (!logOptions.clientToken) return;

        initLogs(logOptions);

        if (isPdfPrinter) return;

        const rumOptions = getDatadogRumOptions(service);

        if (!rumOptions.applicationId) return;

        initRum(rumOptions);
        startRum();
      })
      .catch(error => {
        formsDatadogPromise = null;
        console.error(error); // eslint-disable-line no-console
      });
  }

  return formsDatadogPromise;
}

async function initFormServices({
  ddService = 'customer-forms',
  targetWindow = parent,
  targetOrigin = window.origin,
} = {}) {
  await fetchFormsConfig();
  postFormsVersion(targetWindow, targetOrigin);

  await initFormsDatadog({
    isPdfPrinter: isPdfFormRequest(),
    service: ddService,
  });
}

export {
  addError,
  initFormServices,
};
