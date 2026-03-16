import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

let logsReady = false;
let rumReady = false;

/**
 * Initialise Datadog Logs.
 * @param {Object} opts
 * @param {string} opts.env          – appConfig.stage+'.'+appConfig.stack
 * @param {string} opts.clientToken
 * @param {string} opts.service
 * @param {string} opts.version
 */
export function initLogs({ env, clientToken, service, version }) {
  datadogLogs.init({
    env,
    clientToken,
    service,
    version,
    useSecureSessionCookie: true,
    usePartitionedCrossSiteSessionCookie: true,
    beforeSend(log) {
      const msg = String(log.message);
      if (msg.includes('Uncaught "[Response]"')) return false;
      if (msg.includes('Failed to fetch')) return false;
      return log?.http?.status_code !== 0;
    },
  });
  logsReady = true;
}

/**
 * Initialise Datadog RUM.
 * @param {Object} opts
 * @param {string} opts.env
 * @param {string} opts.clientToken
 * @param {string} opts.applicationId
 * @param {string} opts.service
 * @param {string} opts.version
 */
export function initRum({
  env,
  clientToken,
  applicationId,
  service,
  version,
}) {
  datadogRum.init({
    env,
    clientToken,
    applicationId,
    service,
    version,
    useSecureSessionCookie: true,
    usePartitionedCrossSiteSessionCookie: true,
    allowedTracingUrls: [window.origin],
    defaultPrivacyLevel: 'allow',
    startSessionReplayRecordingManually: true,
    sessionReplaySampleRate: 100,
    beforeSend(event, context) {
      if (
        event.type === 'resource'
        && event.resource.type === 'fetch'
        && context?.response?.status >= 400
      ) {
        event.context = { ...event.context, context };
      }
    },
  });
  rumReady = true;
}

export function setUser(attrs) {
  if (!rumReady) return;
  datadogRum.setUser(attrs);
}

export function startRum() {
  if (!rumReady) return;
  datadogRum.startSessionReplayRecording();
}

export function addError(error, context) {
  if (!rumReady) {
    console.error(error); // eslint-disable-line no-console
    return;
  }
  datadogRum.addError(error, context);
}

/**
 * Log a fetch response (clones so you can still read it later).
 */
export async function logResponse(url, options, response) {
  if (!logsReady) return;

  const clone = response.clone();
  const contentType = String(clone.headers.get('Content-Type'));
  const responseBody = contentType.includes('json') ? await clone.json() : await clone.text();
  const responseHeads = Object.fromEntries(clone.headers);

  datadogLogs.logger.info(`Response status ${ clone.status }`, {
    url,
    options,
    status: clone.status,
    responseHeaders: responseHeads,
    responseBody,
  });
}
