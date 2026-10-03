import { compact, contains, extend, filter, isString } from 'underscore';
import dayjs from 'dayjs';

import i18n from 'js/i18n';

const intl = i18n.patients.patient.interactions;

function text(value) {
  return isString(value) ? value : '';
}

function formatDate(value) {
  if (!value || !dayjs(value).isValid()) return '';
  return dayjs(value).format('MMM D, YYYY, h:mm A');
}

function getCallStatus(metadata) {
  const outcome = text(metadata.disposition) || text(metadata.outcome) || text(metadata.type);
  if (outcome) return outcome;
  if (metadata.made_contact === true) return intl.madeContact;
  if (metadata.made_contact === false) return intl.noContact;
  return '';
}

function getMessagePresentation({ channel, metadata, inbound, clinician, patientName }) {
  const channelLabels = {
    sms: intl.viaSms,
    email: intl.viaEmail,
    mail: intl.viaMail,
    fax: intl.viaFax,
    portal: intl.viaPortal,
  };
  return {
    kind: 'message',
    icon: inbound ? 'comment' : 'paper-plane',
    actor: inbound ? patientName : clinician || intl.careTeam,
    activityLabel: intl.sentMessage,
    viaLabel: channelLabels[channel] || '',
    title: intl.message,
    summary: text(metadata.message) || text(metadata.note),
    previewTitle: `${ inbound ? intl.inbound : intl.outbound } ${ intl.message }`,
  };
}

function getCallPresentation({ channel, metadata, inbound, clinician }) {
  const callLabels = { voice: intl.call, voicemail: intl.voicemail, video: intl.videoCall };
  const title = `${ inbound ? intl.inbound : intl.outbound } ${ callLabels[channel] }`;
  const status = getCallStatus(metadata);
  return {
    kind: 'call',
    icon: inbound ? 'phone-arrow-down-left' : 'phone-arrow-up-right',
    actor: clinician || intl.careTeam,
    activityLabel: intl.loggedCall,
    title,
    status,
    summary: text(metadata.note),
    previewTitle: compact([title, status]).join(' · '),
  };
}

function getAppointmentPresentation({ model, metadata, timestamp, clinician }) {
  const status = model.get('occurred_at') ? '' : intl.scheduled;
  return {
    kind: 'appointment',
    icon: 'calendar-days',
    activityLabel: intl.addedAppointment,
    title: intl.appointment,
    status,
    summary: text(metadata.note),
    details: filter([
      { label: intl.appointmentDate, value: formatDate(timestamp) },
      { label: intl.clinician, value: clinician },
    ], detail => detail.value),
    previewTitle: compact([intl.appointment, status]).join(' · '),
  };
}

function getVisitPresentation({ metadata }) {
  let title = intl.admitted;
  if (metadata.discharged_at || metadata.event === 'discharge') title = intl.discharged;
  else if (metadata.event === 'transfer') title = intl.transferred;

  return {
    kind: 'visit',
    icon: 'hospital',
    activityLabel: intl.addedVisit,
    title,
    status: compact([
      metadata.patient_class ? `${ intl.classLabel }: ${ text(metadata.patient_class) }` : '',
      text(metadata.facility),
    ]).join(' · '),
    details: filter([
      { label: intl.admitted, value: formatDate(metadata.admitted_at) },
      { label: intl.discharged, value: formatDate(metadata.discharged_at) },
      { label: intl.reason, value: text(metadata.admit_reason) },
      { label: intl.dischargeDisposition, value: text(metadata.discharge_disposition) },
      { label: intl.dischargeLocation, value: text(metadata.discharge_location) },
    ], detail => detail.value),
    previewTitle: compact([title, text(metadata.facility)]).join(' · '),
  };
}

function getChannelPresentation(options) {
  const { channel } = options;
  if (contains(['voice', 'voicemail', 'video'], channel)) return getCallPresentation(options);
  if (channel === 'appointment') return getAppointmentPresentation(options);
  if (channel === 'visit') return getVisitPresentation(options);
  return getMessagePresentation(options);
}

export function getInteractionPresentation(model, patientName) {
  const metadata = model.get('metadata') || {};
  const timestamp = model.get('occurred_at') || model.get('expected_at');
  return extend({
    actor: '',
    viaLabel: '',
    status: '',
    summary: '',
    details: [],
    timestamp,
    displayTime: timestamp ? dayjs(timestamp).format('h:mm A') : '',
  }, getChannelPresentation({
    model,
    patientName,
    metadata,
    timestamp,
    channel: model.get('channel'),
    inbound: model.get('direction') === 'inbound',
    clinician: text(metadata.clinician_name),
  }));
}
