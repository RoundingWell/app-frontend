import { Radio } from 'marionette';

let requestedPatient;

export function requestComposer(patientId) {
  requestedPatient = patientId;
  Radio.trigger('messaging-prototype', 'composer:requested', patientId);
}

export function consumeComposerRequest(patientId) {
  if (requestedPatient !== patientId) return false;
  requestedPatient = null;
  return true;
}
