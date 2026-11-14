import { View } from 'marionette';

import { messageSegments, presentMessage } from './presentation';
import MessageCardTemplate from './message-card.hbs';

import './message-card.scss';

const MessageCardView = View.extend({
  tagName: 'li',
  className: 'messaging-card',
  template: MessageCardTemplate,
  ui: { body: '.js-body', showMore: '.js-show-more', action: '.js-action' },
  triggers: { 'click @ui.showMore': 'click:show:more', 'click @ui.action': 'click:action' },
  modelEvents: { change: 'render' },
  templateContext() {
    this.presentation = presentMessage(this.getOption('interaction') || this.model,
      this.getOption('currentActionId'), this.getOption('presentInteraction'));
    return {
      message: this.presentation,
      segments: messageSegments(this.presentation.body),
      expanded: this.expanded,
      bodyId: `messaging-body-${ this.cid }`,
      labels: this.getOption('labels'),
    };
  },
  onRender() {
    const message = this.presentation;
    this.el.hidden = message.hidden;
    this.el.classList.toggle('messaging-card--scheduled', message.scheduled);
    this.el.classList.toggle('messaging-card--failed', message.failed);
    this.el.classList.toggle('messaging-card--muted', message.muted);
    this.el.classList.toggle('messaging-card--patient', message.patient);
    this.el.classList.toggle('messaging-card--cancelled', message.status === 'cancelled');
    this.el.classList.toggle('messaging-card--not-sent', message.status === 'not-sent');
    this.el.classList.toggle('messaging-card--auto-reply', message.kind === 'auto-reply');
    if (this.isAttached()) this.measureOverflow();
  },
  onAttach() {
    this.resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(this.overflowFrame);
      this.overflowFrame = requestAnimationFrame(() => this.measureOverflow());
    });
    this.resizeObserver.observe(this.el);
    this.measureOverflow();
  },
  onBeforeDetach() {
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.overflowFrame);
  },
  measureOverflow() {
    const body = this.getUI('body')[0];
    const button = this.getUI('showMore')[0];
    if (!button) return;
    button.hidden = body.scrollHeight <= body.clientHeight;
  },
  onClickShowMore() {
    this.expanded = true;
    this.render();
    this.getUI('body')[0].focus({ preventScroll: true });
  },
  onClickAction() {
    this.triggerMethod('navigate:action', this.presentation.action.id);
  },
});

export default MessageCardView;
