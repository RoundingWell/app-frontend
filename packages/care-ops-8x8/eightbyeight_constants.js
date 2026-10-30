// Unverified Maestro SDK choices. Confirm each one against the live demo:
// https://developer.8x8.com/demos/maestro-sdk/
//
// 1. Events cross the iframe with window.postMessage. The target origin is
//    EIGHTBYEIGHT_ORIGIN. The overview publishes the payload and the CTI host,
//    not the transport.
// 2. The iframe load event means the embed can accept startCall. The UC event
//    catalog has no ready or logged-in event.
// 3. A terminated event's eventId is the call-log identifier. The catalog
//    describes eventId as unique per event, and no call id field is documented.
// 4. The panel uses RingCentral's size (300px wide, 80vh, max 760px). The
//    docs do not give a minimum iframe size. See eightbyeight.scss.

export const EIGHTBYEIGHT_ORIGIN = 'https://cloud8.8x8.com';

export const EIGHTBYEIGHT_CTI_URL = `${ EIGHTBYEIGHT_ORIGIN }/mashell/public/index.html?env=embeddable&nextgen=true`;

export const EIGHTBYEIGHT_CALL_ID_FIELD = 'eventId';

export const UC_EVENT = {
  offered: 'mashell-voice-phone-offered-uc-event-v1',
  accepted: 'mashell-voice-phone-accepted-uc-event-v1',
  terminated: 'mashell-voice-phone-terminated-uc-event-v1',
};

export function buildStartCallMessage(phoneNumber) {
  return {
    eventName: 'maEvent',
    family: 'external',
    content: {
      eventName: 'startCall',
      method: 'mapDirective',
      phoneNumber,
    },
    schemaVersion: '1.0.0',
  };
}
