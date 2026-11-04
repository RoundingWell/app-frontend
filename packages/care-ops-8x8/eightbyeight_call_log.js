import dayjs from 'dayjs';
import parsePhoneNumber from 'libphonenumber-js/min';

// A click's action is attached only when the call number matches and the
// call starts within this long of the click.
export const CALL_ATTACH_WINDOW_MS = 2 * 60 * 1000;

// UC embed events are offered, accepted, and terminated. eventId is unique
// per event, so a call is matched on direction plus searchContext.
// https://developer.8x8.com/tech-partner/docs/partner-sdk-maestro-sdk-events/

function sameCall(current, event) {
  if (!current || !event) return false;

  return current.direction === event.direction && current.searchContext === event.searchContext;
}

export function rememberCallEvent(session, event) {
  const next = session ? { ...session } : {};

  if (!event || (event.media && event.media !== 'phone')) return next;

  if (event.eventName === 'offered') return rememberOffered(next, event);
  if (event.eventName === 'accepted') return rememberAccepted(next, event);
  if (event.eventName === 'terminated') return rememberTerminated(next, event);

  return next;
}

function rememberOffered(session, event) {
  const inProgress = session.accepted && !session.terminated;

  if (inProgress && session.offered && !sameCall(session.offered, event)) return session;
  if (session.terminated) return { offered: event };

  return { ...session, offered: event };
}

function rememberAccepted(session, event) {
  if (session.offered && !sameCall(session.offered, event)) return session;

  return { ...session, accepted: event };
}

function eventMismatches(current, event) {
  return Boolean(current) && !sameCall(current, event);
}

function rememberTerminated(session, event) {
  if (eventMismatches(session.offered, event) || eventMismatches(session.accepted, event)) {
    return { terminated: event };
  }

  return { ...session, terminated: event };
}

export function takeTerminated(session, event) {
  const mismatched = session && (
    eventMismatches(session.offered, event) || eventMismatches(session.accepted, event)
  );

  if (mismatched) return { saving: { terminated: event }, session };

  return {
    saving: rememberTerminated(session || {}, event),
    session: null,
  };
}

function toIso(value) {
  if (value == null || value === '') return null;

  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) && String(value).trim() !== '' ? dayjs(numeric) : dayjs(value);

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

  if (session.terminated?.direction === 'inbound') {
    return { answered: null, lastLeg: 'Missed' };
  }

  return { answered: null, lastLeg: 'Not-Connected' };
}

function reportDirection(direction) {
  if (direction === 'outbound') return 'Outgoing';
  if (direction === 'inbound') return 'Incoming';

  return null;
}

function firstValue(...values) {
  return values.find(value => value != null && value !== '') ?? null;
}

function callIdentity(session) {
  const terminated = session.terminated || {};
  const offered = session.offered;
  const accepted = session.accepted;

  return {
    terminated,
    offered,
    accepted,
    direction: firstValue(terminated.direction, offered?.direction, accepted?.direction),
    searchContext: firstValue(terminated.searchContext, offered?.searchContext, accepted?.searchContext),
  };
}

export function attachmentForCall(pending, session) {
  if (!pending) return { actionId: null, clear: false };

  const identity = callIdentity(session || {});
  const start = Number(firstValue(identity.offered?.startTime, identity.terminated.startTime));
  const withinWindow = Number.isFinite(start) && Math.abs(start - pending.clickedAt) <= CALL_ATTACH_WINDOW_MS;

  if (!withinWindow) return { actionId: null, clear: true };
  if (toE164(identity.searchContext) !== pending.number) return { actionId: null, clear: false };

  return { actionId: pending.actionId, clear: true };
}

function baseCallData(identity) {
  const { terminated, offered, direction } = identity;

  return {
    eventId: terminated.eventId || null,
    eventName: 'terminated',
    media: 'phone',
    method: 'mapEvent',
    schemaVersion: '1.0.0',
    direction,
    searchContext: toE164(identity.searchContext),
    callDuration: talkTime(terminated.callDuration),
    startTime: toIso(firstValue(offered?.startTime, terminated.startTime)),
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

export function contextMatchesCall(numbers, session) {
  if (!numbers?.length) return false;

  const number = toE164(callIdentity(session || {}).searchContext);
  if (!number) return false;

  return numbers.includes(number);
}

export function buildCallLogValues(session = {}, { actionId, patientId } = {}) {
  const identity = callIdentity(session);
  const callData = baseCallData(identity);

  return {
    callData,
    report: callReport(callData, outcome(session)),
    action_id: actionId || null,
    patient_id: patientId || null,
  };
}
