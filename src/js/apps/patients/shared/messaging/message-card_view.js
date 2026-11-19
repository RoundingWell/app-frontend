import { Radio, View } from 'marionette';

import { getDeliveryFailure, getInteractionChannelLabel, getInteractionSummary, getInteractionViaLabel, getSenderName, hasInteractionCardContent } from 'js/apps/patients/shared/interactions/display';

import MessageCardTemplate from './message-card.hbs';

import './message-card.scss';

function getStatus(model) {
  if (model.get('cancelled_at')) return 'cancelled';
  if (!model.get('occurred_at')) return 'scheduled';

  return 'occurred';
}

const MessageCardView = View.extend({
  tagName: 'li',
  className() {
    const newClass = this.model.get('send_status') === 'sending' ? ' messaging-card--new' : '';

    return `messaging-card messaging-card--${ this.model.get('direction') }${ newClass }`;
  },
  template: MessageCardTemplate,
  modelEvents: { change: 'render' },
  ui: { work: '.js-work', body: '.js-body', showMore: '.js-show-more' },
  triggers: { 'click @ui.work': 'click:work', 'click @ui.showMore': 'click:show:more', 'animationend': 'animation:end' },
  templateContext() {
    const patient = this.getOption('patient');
    const inbound = this.model.get('direction') === 'inbound';
    const summary = getInteractionSummary(this.model);

    return {
      senderName: inbound ? `${ patient.get('first_name') } ${ patient.get('last_name') }` : getSenderName(this.model, this.model.get('metadata')),
      viaLabel: getInteractionViaLabel(this.model),
      status: getStatus(this.model),
      sendStatus: this.model.get('send_status'),
      deliveryFailure: getDeliveryFailure(this.model),
      timestamp: this.model.getTimestamp(),
      hasContent: hasInteractionCardContent(this.model),
      channelLabel: getInteractionChannelLabel(this.model),
      summary,
      // Same rule as long call notes on the Interactions page (FE-241).
      collapsible: summary?.length > 900,
      expanded: this.isExpanded,
      bodyId: `message-body-${ this.cid }`,
      workName: this.getWorkName(),
    };
  },
  getWorkName() {
    const action = this.model.getAction();
    if (!action) return this.model.getFlow()?.get('name');
    if (action.id === this.getOption('currentActionId')) return;

    return action.get('name');
  },
  onRender() {
    const status = getStatus(this.model);
    this.el.classList.toggle('messaging-card--scheduled', status === 'scheduled');
    this.el.classList.toggle('messaging-card--cancelled', status === 'cancelled');
  },
  // The fade-in runs once; later renders must not replay it.
  onAnimationEnd() {
    this.el.classList.remove('messaging-card--new');
  },
  onClickShowMore() {
    this.isExpanded = true;
    this.render();
    this.getUI('body')[0].focus({ preventScroll: true });
  },
  onClickWork() {
    const patientId = this.getOption('patient').id;
    const action = this.model.getAction();
    const flow = action ? action.getFlow() : this.model.getFlow();

    if (!action) {
      Radio.trigger('event-router', 'patient:flow', patientId, flow.id);
      return;
    }

    if (!flow) {
      Radio.trigger('event-router', 'patient:action', patientId, action.id);
      return;
    }

    Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, action.id);
  },
});

export default MessageCardView;
