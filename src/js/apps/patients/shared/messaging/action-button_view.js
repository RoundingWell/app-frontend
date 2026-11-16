import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import { canShowMessages } from './availability';

import './action-button.scss';

const MessageButtonView = View.extend({
  tagName: 'span',
  className: 'message-action',
  template: hbs`<button class="action-card__count message-action__button js-messages" type="button" aria-label="{{ @intl.patients.messaging.heading }}" title="{{ @intl.patients.messaging.heading }}">{{far "paper-plane-top"}}</button>`,
  ui: { messages: '.js-messages' },
  triggers: { 'click @ui.messages': 'click:messages' },
});

export { canShowMessages };

export function showMessagingButton(view, regionName, { action }) {
  if (!canShowMessages(action)) return;
  const button = new MessageButtonView();
  view.showChildView(regionName, button);
  return button;
}
