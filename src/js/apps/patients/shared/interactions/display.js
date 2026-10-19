import { has, some } from 'underscore';
import { Radio } from 'marionette';

import i18n from 'js/i18n';

const intl = i18n.patients.shared.interactions.interactionItemView;
const ICONS = { messages: 'paper-plane-top', appointments: 'calendar-day', visits: 'hospital' };
const CHANNEL_LABELS = { voice: intl.call, voicemail: intl.voicemail, video: intl.videoCall };
const CHANNEL_VIA = { sms: intl.viaSms, email: intl.viaEmail, mail: intl.viaMail, fax: intl.viaFax, portal: intl.viaPortal };

export function getInteractionIcon(model) {
  if (model.getChannelGroup() === 'calls') return model.get('direction') === 'inbound' ? 'phone-arrow-down-left' : 'phone-arrow-up-right';
  return ICONS[model.getChannelGroup()];
}

export function getInteractionChannelLabel(model) {
  return CHANNEL_LABELS[model.get('channel')];
}

export function getInteractionViaLabel(model) {
  const source = model.get('metadata')?.source;
  if (model.getChannelGroup() === 'visits' && source) return `${ intl.via } ${ source }`;
  return CHANNEL_VIA[model.get('channel')];
}

export function getAppointmentStatusLabel(model) {
  const status = model.getAppointmentStatus();
  return has(intl.appointmentStatuses, status) ? intl.appointmentStatuses[status] : undefined;
}

export function getInteractionSummary(model) {
  const metadata = model.get('metadata') || {};
  if (model.getChannelGroup() === 'appointments') return;
  if (model.get('channel') !== 'sms') return metadata.note;
  const message = model.get('direction') === 'inbound' ? metadata.body : metadata.message;
  return message || metadata.note;
}

export function hasInteractionCardContent(model) {
  const group = model.getChannelGroup();
  if (group === 'calls' || group === 'appointments' || getInteractionSummary(model)) return true;
  if (group !== 'visits') return false;
  const metadata = model.get('metadata') || {};
  return some([metadata.patient_class, metadata.facility, metadata.admitted_at,
    metadata.admit_reason, metadata.discharged_at], Boolean);
}

export function getSenderName(model, metadata) {
  if (metadata.clinician_name || model.get('direction') !== 'outbound') return metadata.clinician_name;
  return Radio.request('bootstrap', 'organization').get('name');
}

function getMessageDescription(model, metadata) {
  const inbound = model.get('direction') === 'inbound';
  const name = inbound ? metadata.from : getSenderName(model, metadata);
  return { name, text: name ? undefined : `${ intl.inbound } ${ intl.message }` };
}

export function getInteractionDescription(model) {
  const group = model.getChannelGroup();
  const metadata = model.get('metadata') || {};
  if (group === 'appointments') {
    return { name: intl.appointment, text: getAppointmentStatusLabel(model) };
  }
  if (group === 'visits') return { name: intl.visit, text: intl.added };
  if (group === 'messages') return getMessageDescription(model, metadata);
  const isOutboundVoicemail = model.get('channel') === 'voicemail' && model.get('direction') === 'outbound';
  return { name: getSenderName(model, metadata), text: isOutboundVoicemail ? intl.leftVoicemail : intl.loggedCall };
}
