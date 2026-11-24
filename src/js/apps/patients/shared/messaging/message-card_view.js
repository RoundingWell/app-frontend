import { Radio, View } from 'marionette';

import { getMessageFailure, getMessageSender, getSendStatus } from './message-display';

import MessageCardTemplate from './message-card.hbs';

import './message-card.scss';

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
    const body = this.model.get('body');

    return {
      senderName: getMessageSender(this.model, this.getOption('patient')),
      isScheduled: this.model.get('status') === 'scheduled',
      sendStatus: getSendStatus(this.model),
      deliveryFailure: getMessageFailure(this.model),
      timestamp: this.model.get('sort_at'),
      // Same rule as long call notes on the Interactions page (FE-241).
      collapsible: body?.length > 900,
      expanded: this.isExpanded,
      bodyId: `message-body-${ this.cid }`,
      workName: this.getWorkName(),
    };
  },
  getWorkName() {
    const action = this.model.getAction();
    if (!action || action.id === this.getOption('currentActionId')) return;

    return action.get('name');
  },
  setGrouping(continuation, continues) {
    this.el.classList.toggle('messaging-card--continuation', continuation);
    this.el.classList.toggle('messaging-card--continues', continues);
  },
  onRender() {
    this.el.classList.toggle('messaging-card--scheduled', this.model.get('status') === 'scheduled');
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
    const flow = action.getFlow();

    if (!flow) {
      Radio.trigger('event-router', 'patient:action', patientId, action.id);
      return;
    }

    Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, action.id);
  },
});

export default MessageCardView;
