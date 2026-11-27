import { Radio } from 'marionette';

import i18n from 'js/i18n';

const intl = i18n.patients.shared.interactions.interactionItemView;
export const FAILURE_REASONS = {
  not_opted_in: intl.optedOut,
  RECIPIENT_NOT_OPTED_IN: intl.optedOut,
  RECIPIENT_NOT_REACHABLE: intl.cantReceiveTexts,
};

export function getMessageSender(model, patient) {
  if (model.get('direction') === 'inbound') return `${ patient.get('first_name') } ${ patient.get('last_name') }`;

  return model.getAuthor()?.get('name') || Radio.request('bootstrap', 'organization').get('name');
}

export function getMessageFailure(model) {
  if (model.get('status') !== 'failed') return;

  return { reason: FAILURE_REASONS[model.get('failure_reason')?.code] };
}

export function getSendStatus(model) {
  return model.get('send_status') || (model.get('status') === 'queued' ? 'sending' : undefined);
}
