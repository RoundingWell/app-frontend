import dayjs from 'dayjs';
import timezonePlugin from 'dayjs/plugin/timezone';
import { Radio, View } from 'marionette';

import i18n from 'js/i18n';

import InteractionItemTemplate from './interaction-item.hbs';

import './interaction-item.scss';

dayjs.extend(timezonePlugin);

const intl = i18n.patients.shared.interactions.interactionItemView;
const ICONS = {
  messages: 'paper-plane-top', appointments: 'calendar-day', visits: 'hospital',
};
const CHANNEL_VIA = { sms: intl.viaSms, email: intl.viaEmail, mail: intl.viaMail, fax: intl.viaFax, portal: intl.viaPortal };
const CHANNEL_LABELS = { voice: intl.call, voicemail: intl.voicemail, video: intl.videoCall };
const VISIT_CLASSES = { E: intl.emergency, I: intl.inpatient, O: intl.outpatient, V: intl.observation, Obs: intl.observation, OBS: intl.observation };

export function getInteractionIcon(model) {
  if (model.getChannelGroup() === 'calls') return model.get('direction') === 'inbound' ? 'phone-arrow-down-left' : 'phone-arrow-up-right';
  return ICONS[model.getChannelGroup()];
}

export function getInteractionChannelLabel(model) {
  return CHANNEL_LABELS[model.get('channel')];
}

function getWorkName(model) {
  const action = model.getAction();
  const flow = action?.getFlow() || model.getFlow();
  return action && flow ? `${ flow.get('name') }: ${ action.get('name') }` : action?.get('name') || flow?.get('name');
}

const InteractionItemView = View.extend({
  tagName: 'li',
  className() {
    return `patient-interactions__item patient-interactions__item--${ this.model.get('channel') }`;
  },
  template: InteractionItemTemplate,
  ui: { action: '.js-action', interaction: '.js-interaction' },
  triggers: {
    'click @ui.action': 'click:action',
    'click @ui.interaction': 'click:interaction',
  },
  modelEvents: { change: 'render' },
  setGrouping(continuation, continues) {
    this.el.classList.toggle('patient-interactions__item--continuation', continuation);
    this.el.classList.toggle('patient-interactions__item--continues', continues);
  },
  onClickInteraction() {
    Radio.trigger('event-router', 'patient:interaction', this.getOption('patientId'), this.model.id);
  },
  onClickAction() {
    const action = this.model.getAction();
    const flow = action?.getFlow() || this.model.getFlow();
    const patientId = this.getOption('patientId');

    if (!flow) {
      Radio.trigger('event-router', 'patient:action', patientId, action.id);
      return;
    }
    if (action) {
      Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, action.id);
      return;
    }
    Radio.trigger('event-router', 'patient:flow', patientId, flow.id);
  },
  templateContext() {
    const metadata = this.model.get('metadata') || {};
    const timestamp = this.model.getTimestamp();
    const group = this.model.getChannelGroup();
    const appointmentDate = group === 'appointments' ? this.getAppointmentDate(timestamp, metadata.timezone) : undefined;
    const stayDays = this.model.getLengthOfStay();
    return {
      timestamp,
      group,
      icon: getInteractionIcon(this.model),
      channelLabel: getInteractionChannelLabel(this.model),
      viaLabel: CHANNEL_VIA[this.model.get('channel')],
      appointmentDate,
      appointmentStatus: this.model.getAppointmentStatus(),
      appointmentTimezone: this.getAppointmentTimezone(appointmentDate, metadata.timezone),
      hasDuration: this.model.hasDuration(),
      patientClass: VISIT_CLASSES[metadata.patient_class] || metadata.patient_class,
      stayDays,
      hasStay: stayDays >= 0,
      activity: this.getOption('activity'),
      timeFormat: this.getOption('activity') ? 'AT_TIME' : 'TIME',
      workName: this.getWorkLink(),
    };
  },
  getAppointmentDate(timestamp, timezone) {
    if (!timestamp) return;
    return timezone ? dayjs(timestamp).tz(timezone) : dayjs(timestamp);
  },
  getAppointmentTimezone(date, timezone) {
    if (!date || !timezone || timezone === dayjs.tz.guess()) return;
    return date.offsetName('short');
  },
  getWorkLink() {
    if (this.getOption('activity')) return;
    return getWorkName(this.model);
  },
  stateEvents() {
    if (!this.getOption('state')) return;
    return { 'change:interactionId': 'updateSelection' };
  },
  isSelectedInteraction() {
    if (!this.getOption('state')) return false;
    return this.model.id === this.getState().get('interactionId');
  },
  onRender() {
    this.updateSelection();
  },
  updateSelection() {
    const selected = this.isSelectedInteraction();
    this.el.classList.toggle('is-selected', selected);
    if (!selected) {
      this.el.removeAttribute('tabindex');
      return;
    }
    this.el.tabIndex = -1;
  },
  onAttach() {
    if (this.didFocusInteraction || !this.isSelectedInteraction()) return;
    this.focusInteraction();
  },
  focusInteraction() {
    this.didFocusInteraction = true;
    this.el.scrollIntoView({ block: 'center' });
    this.el.focus({ preventScroll: true });
  },
});

export default InteractionItemView;
