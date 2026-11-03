import dayjs from 'dayjs';

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

function rememberTerminated(session, event) {
  const offeredMismatch = session.offered && !sameCall(session.offered, event);
  const acceptedMismatch = session.accepted && !sameCall(session.accepted, event);

  if (offeredMismatch && acceptedMismatch) return { terminated: event };

  return { ...session, terminated: event };
}

function toIso(value) {
  if (value == null || value === '') return null;

  const numeric = Number(value);
  const parsed = Number.isFinite(numeric) && String(value).trim() !== '' ? dayjs(numeric) : dayjs(value);

  return parsed.isValid() ? parsed.toISOString() : null;
}

function clock(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return [hours, minutes, seconds].map(part => String(part).padStart(2, '0')).join(':');
}

function elapsed(from, to) {
  const start = Number(from);
  const end = Number(to);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  return clock(end - start);
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

function answeredRawTime(offered, accepted) {
  if (!accepted) return null;
  if (accepted.startTime === offered?.startTime) return null;

  return accepted.startTime;
}

function baseCallData(identity) {
  const { terminated, offered, direction, searchContext } = identity;
  const callData = {
    ...terminated,
    eventName: 'terminated',
    media: terminated.media || 'phone',
    method: 'mapEvent',
    schemaVersion: terminated.schemaVersion || '1.0.0',
    direction,
    searchContext,
    startTime: toIso(firstValue(offered?.startTime, terminated.startTime)),
    endTime: toIso(terminated.endTime),
    callDuration: terminated.callDuration || null,
    hasRecording: Boolean(terminated.hasRecording),
  };

  if (!callData.callRecording) delete callData.callRecording;

  return callData;
}

function withDurations(callData, identity) {
  const answeredRaw = answeredRawTime(identity.offered, identity.accepted);
  const answeredTime = toIso(answeredRaw);
  const ringDuration = elapsed(identity.offered?.startTime, answeredRaw);
  const talkFrom = answeredRaw || identity.accepted?.startTime;
  const talkDuration = identity.accepted ? elapsed(talkFrom, identity.terminated.endTime) : null;

  if (answeredTime) callData.answeredTime = answeredTime;
  if (ringDuration) callData.ringDuration = ringDuration;
  if (talkDuration) callData.talkDuration = talkDuration;

  return callData;
}

function callReport(callData, callOutcome) {
  const report = {
    Call_ID: callData.eventId || null,
    Direction: reportDirection(callData.direction),
    Talk_Time: callData.callDuration,
    Start_Time: callData.startTime,
    Stop_Time: callData.endTime,
    Answered: callOutcome.answered,
    Last_Leg_Disposition: callOutcome.lastLeg,
  };

  if (callData.direction === 'outbound') report.Callee = callData.searchContext;
  if (callData.direction === 'inbound') report.Caller = callData.searchContext;
  if (callData.answeredTime) report.Answered_Time = callData.answeredTime;

  return report;
}

export function buildCallLogValues(session = {}, { actionId, patientId } = {}) {
  const identity = callIdentity(session);
  const callData = withDurations(baseCallData(identity), identity);

  return {
    callData,
    report: callReport(callData, outcome(session)),
    events: {
      offered: identity.offered || null,
      accepted: identity.accepted || null,
      terminated: session.terminated || null,
    },
    action_id: actionId || null,
    patient_id: patientId || null,
  };
}
