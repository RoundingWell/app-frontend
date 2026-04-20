import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';

let rumReady = false;

/**
 * Initialise Datadog Logs.
 * @param {Object} opts
 * @param {string} opts.env
 * @param {string} opts.clientToken
 * @param {string} opts.service
 * @param {string} opts.version
 * @param {string} opts.organization
 */
export function initLogs({ env, clientToken, service, version, organization }) {
  datadogLogs.init({
    env,
    clientToken,
    service,
    version,
    forwardErrorsToLogs: false,
    useSecureSessionCookie: true,
    usePartitionedCrossSiteSessionCookie: true,
  });

  if (organization) {
    datadogLogs.logger.addTag('organization', organization);
  }
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
        const { body } = context.requestInit || {};

        let requestBody;
        if (typeof body === 'string') {
          try { requestBody = JSON.parse(body); } catch (e) { requestBody = body; }
        }

        event.context = { ...event.context, requestBody };
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

export function addAction(name, context) {
  if (!rumReady) return;
  datadogRum.addAction(name, context);
}

export function addError(error, context) {
  if (!rumReady) {
    console.error(error); // eslint-disable-line no-console
    return;
  }
  datadogRum.addError(error, context);
}
