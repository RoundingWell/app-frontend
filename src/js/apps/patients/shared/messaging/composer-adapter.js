import Backbone from 'backbone';
import dayjs from 'dayjs';
import parsePhoneNumber from 'libphonenumber-js/min';
import { find, get } from 'underscore';
import { Radio } from 'marionette';

import intl from 'js/i18n';
import { formatDate } from 'js/base/dayjs';
import message from './composer/intl';
import ContextSession from './context-session';
import { attemptedSend } from 'js/entities-service/messaging-prototype/send-attempts';

const copy = intl.patients.messaging;

export function eligibilityReason(code, source) {
  if (code === 'opted_out' && source?.kind === 'patient_stop') return copy.patientStopped;
  return {
    opted_out: copy.optedOut, cannot_receive_sms: copy.cannotReceive, do_not_contact: copy.doNotContact,
    no_eligible_mobile: copy.noMobile, action_done: copy.actionDone, scheduled: copy.scheduled,
    refresh_required: copy.loading, load_error: copy.contextError, loading: copy.loading,
    unavailable: copy.contextError, messaging_disabled: copy.contextError,
  }[code] || code || '';
}

function disabledReason(context) {
  const id = context.state.get('scheduledInteractionId');
  if (id && context.state.get('disabledReason') === 'scheduled') {
    const expected = Radio.request('entities', 'interactions:model', id).get('expected_at');
    return expected ? message('scheduledAt', { time: formatDate(dayjs(expected), 'AT_TIME') }) : message('scheduled');
  }
  return eligibilityReason(context.state.get('disabledReason'));
}

function canCompose(state) {
  return state.get('enabled') === true || (state.get('disabledReason') === 'no_eligible_mobile' && state.get('recipients').length > 0);
}

export default function createComposerAdapter({ patient, action = null, context }) {
  const ownedContext = !context;
  context = context || new ContextSession({ patientId: patient.id, action });
  const state = new Backbone.Model();
  const currentUser = Radio.request('bootstrap', 'currentUser');
  const workspace = Radio.request('workspace', 'current');
  const actionId = get(action, 'id', null);
  const update = () => {
    state.set({
      enabled: context.value?.messaging_enabled === true,
      canCompose: canCompose(context.state) && !attemptedSend(patient.id),
      disabledReason: attemptedSend(patient.id) ? copy.uncertain : disabledReason(context),
      scheduled: !!context.state.get('scheduledInteractionId'),
      recipientName: `${ patient.get('first_name') } ${ patient.get('last_name') }`.trim(),
      placeholderName: patient.get('first_name'),
      senderName: currentUser.get('name'),
      numbers: (context.state.get('recipients') || []).map(row => ({
        id: row.number, label: parsePhoneNumber(row.number, 'US')?.formatNational() || row.number, available: row.eligible, reason: eligibilityReason(row.disabledReason, row.source),
      })),
    });
  };
  context.state.on('change', update);
  update();
  const adapter = {
    state, sessionScope: `${ workspace.id }:${ currentUser.id }`, initialNumberId: get(find(context.state.get('recipients'), { eligible: true }), 'number', ''),
    async refreshEligibility() {
      if (!await context.refresh({ fresh: true })) throw new Error(copy.contextError);
    },
    submit({ patientId, actionId: requestedAction, numberId, body }) {
      if (patientId !== patient.id || requestedAction !== actionId) throw new Error('Composer context changed.');
      return Radio.request('entities', 'create:messagingPrototype:interaction', {
        patientId, action, body, recipientNumber: numberId,
      }, { signal: new AbortController().signal });
    },
    reconcile() {
      // The entity service publishes the authoritative confirmation exactly once,
      // including after the originating View has gone. No state PATCH occurs.
    },
    dispose() {
      context.state.off('change', update);
      if (ownedContext) context.destroy();
    },
  };
  adapter.ready = ownedContext ?
    context.refresh().then(() => {
      adapter.initialNumberId = get(find(context.state.get('recipients'), { eligible: true }), 'number', '');
    }) :
    Promise.resolve();
  return adapter;
}
