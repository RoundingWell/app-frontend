import { has, some } from 'underscore';
import { Radio } from 'marionette';

import i18n from 'js/i18n';

import { FAILURE_REASONS, getMessageFailure } from 'js/apps/patients/shared/messaging/message-display';

const intl = i18n.patients.shared.interactions.interactionItemView;
const ICONS = { messages: 'paper-plane-top', appointments: 'calendar-day', visits: 'hospital' };
const CHANNEL_LABELS = { voice: intl.call, voicemail: intl.voicemail, video: intl.videoCall, message: intl.sms };
const CHANNEL_VIA = { message: intl.viaSms, email: intl.viaEmail, mail: intl.viaMail, fax: intl.viaFax, portal: intl.viaPortal };

export function getDeliveryFailure(model) {
  const metadata = model.get('metadata') || {};
  const message = model.getMessage();
  if (message) {
    if (metadata.failed_at) return { reason: FAILURE_REASONS[metadata.failure_reason?.code], phone: message.get('phone') };
    const failure = getMessageFailure(message);
    return failure && { ...failure, phone: message.get('phone') };
  }
  if (metadata.delivery?.status !== 'failed') return;
  return { reason: FAILURE_REASONS[metadata.delivery.reason.code], phone: metadata.phone_number };
}

export function getInteractionIcon(model) {
  if (model.getChannelGroup() === 'calls') return model.get('direction') === 'inbound' ? 'phone-arrow-down-left' : 'phone-arrow-up-right';
  return ICONS[model.getChannelGroup()];
}

export function getInteractionChannelLabel(model) {
  return CHANNEL_LABELS[model.get('channel')];
}

export function hasInteractionChannelHeading(model) {
  return model.getChannelGroup() === 'calls' || (model.get('channel') === 'message' && !!model.get('metadata')?.disposition);
}

export function getInteractionViaLabel(model) {
  const metadata = model.get('metadata') || {};
  if (model.getChannelGroup() === 'visits') {
    if (metadata.manual) return;
    if (metadata.source) return `${ intl.via } ${ metadata.source }`;
  }
  return CHANNEL_VIA[model.get('channel')];
}

export function getAppointmentStatusLabel(model) {
  const status = model.getAppointmentStatus();
  return has(intl.appointmentStatuses, status) ? intl.appointmentStatuses[status] : undefined;
}

export function getInteractionSummary(model) {
  const metadata = model.get('metadata') || {};
  if (model.getChannelGroup() === 'appointments') return;
  if (model.get('channel') !== 'message') return metadata.note;
  const body = model.getMessage()?.get('body');
  if (body) return body;
  const message = model.get('direction') === 'inbound' ? metadata.body : metadata.message;
  return message || metadata.note;
}

export function hasInteractionCardContent(model) {
  const group = model.getChannelGroup();
  if (hasInteractionChannelHeading(model) || group === 'appointments' || getInteractionSummary(model)) return true;
  if (group !== 'visits') return false;
  const metadata = model.get('metadata') || {};
  return some([metadata.patient_class, metadata.facility, metadata.admitted_at,
    metadata.admit_reason, metadata.discharged_at], Boolean);
}

export function getSenderName(model, metadata) {
  const name = metadata.clinician_name || model.getMessage()?.getAuthor()?.get('name');
  if (name || model.get('direction') !== 'outbound') return name;
  return Radio.request('bootstrap', 'organization').get('name');
}

export function getInboundFrom(model, metadata) {
  return model.getMessage()?.get('phone') || metadata.from;
}

function getMessageDescription(model, metadata) {
  const inbound = model.get('direction') === 'inbound';
  const name = inbound ? getInboundFrom(model, metadata) : getSenderName(model, metadata);
  return { name, text: name ? undefined : `${ intl.inbound } ${ intl.message }` };
}

export function getInteractionDescription(model) {
  const group = model.getChannelGroup();
  const metadata = model.get('metadata') || {};
  if (group === 'appointments') {
    return { name: intl.appointment, text: getAppointmentStatusLabel(model) };
  }
  if (group === 'visits') return { name: intl.visit, text: metadata.manual ? intl.addedManually : intl.added };
  if (group === 'messages') return getMessageDescription(model, metadata);
  const isOutboundVoicemail = model.get('channel') === 'voicemail' && model.get('direction') === 'outbound';
  return { name: getSenderName(model, metadata), text: isOutboundVoicemail ? intl.leftVoicemail : intl.loggedCall };
}
