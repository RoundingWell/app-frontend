import dayjs from 'dayjs';
import parsePhoneNumber from 'libphonenumber-js/min';

// A click's action is attached only when the call number matches and the
// call starts within this long of the click.
export const CALL_ATTACH_WINDOW_MS = 2 * 60 * 1000;

// eventId identifies an event, not a call. Accepted and terminated document
// startTime as the call's initiation time. Do not merge events with partial identity.
export function callKey(event) {
  const start = toTimestamp(event?.startTime);
  const number = toE164(event?.searchContext);
  if (!Number.isFinite(start) || start <= 0 || !number) return null;
  if (event.direction !== 'inbound' && event.direction !== 'outbound') return null;

  return `${ event.direction }:${ number }:${ start }`;
}

export function sameCall(current, event) {
  const key = callKey(current);
  return Boolean(key) && key === callKey(event);
}

function toTimestamp(value) {
  if (value == null || String(value).trim() === '') return NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : dayjs(value).valueOf();
}

function toIso(value) {
  const parsed = dayjs(toTimestamp(value));

  return parsed.isValid() ? parsed.toISOString() : null;
}

export function toE164(number) {
  if (!number) return null;

  const phone = parsePhoneNumber(String(number), 'US');
  if (phone?.isValid()) return phone.number;

  return String(number);
}

// The Call Detail export stores talk time as H:MM:SS, for example 0:00:07.
function talkTime(value) {
  if (!value) return null;

  const match = String(value).match(/^(\d+):(\d{2}):(\d{2})$/);
  if (!match) return String(value);

  return `${ Number(match[1]) }:${ match[2] }:${ match[3] }`;
}

function outcome(session) {
  if (session.accepted) {
    return { answered: 'Answered', lastLeg: 'Connected' };
  }

  // A termination alone does not prove the call was missed or unanswered.
  return { answered: null, lastLeg: null };
}

function reportDirection(direction) {
  if (direction === 'outbound') return 'Outgoing';
  if (direction === 'inbound') return 'Incoming';

  return null;
}

export function attachmentForCall(pending, event) {
  if (!pending || event.direction !== 'outbound') return null;

  const start = toTimestamp(event.startTime);
  const elapsed = start - pending.clickedAt;
  if (!Number.isFinite(start) || elapsed < 0 || elapsed > CALL_ATTACH_WINDOW_MS) return null;
  if (toE164(event.searchContext) !== pending.number) return null;

  return { actionId: pending.actionId, patientId: pending.patientId };
}

function baseCallData(terminated) {
  const phone = terminated.searchContext ? parsePhoneNumber(String(terminated.searchContext), 'US') : null;

  return {
    eventId: terminated.eventId,
    eventName: 'terminated',
    media: 'phone',
    method: 'mapEvent',
    schemaVersion: '1.0.0',
    direction: terminated.direction,
    searchContext: toE164(terminated.searchContext),
    // Match Jump to eligibility without turning raw extensions into patient searches.
    patientSearchNumber: phone?.isValid() ? phone.number : null,
    callDuration: talkTime(terminated.callDuration),
    startTime: toIso(terminated.startTime),
    endTime: toIso(terminated.endTime),
    hasRecording: Boolean(terminated.hasRecording),
  };
}

function callReport(callData, callOutcome) {
  const report = {
    Call_ID: callData.eventId,
    Direction: reportDirection(callData.direction),
    Talk_Time: callData.callDuration,
    Start_Time: callData.startTime,
    Stop_Time: callData.endTime,
    Answered: callOutcome.answered,
    Last_Leg_Disposition: callOutcome.lastLeg,
  };

  if (callData.direction === 'outbound') report.Callee = callData.searchContext;

  return report;
}

export function buildCallLogValues(session, attachment) {
  const callData = baseCallData(session.terminated);

  return {
    callData,
    report: callReport(callData, outcome(session)),
    action_id: attachment?.actionId || null,
    patient_id: attachment?.patientId || null,
  };
}
