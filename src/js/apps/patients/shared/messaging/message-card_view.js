import { Radio, View } from 'marionette';

import { getInteractionChannelLabel, getInteractionSummary, getInteractionViaLabel, getSenderName, hasInteractionCardContent } from 'js/apps/patients/shared/interactions/display';

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
    return `messaging-card messaging-card--${ this.model.get('direction') } messaging-card--${ getStatus(this.model) }`;
  },
  template: MessageCardTemplate,
  ui: { work: '.js-work', interaction: '.js-interaction' },
  triggers: { 'click @ui.work': 'click:work', 'click @ui.interaction': 'click:interaction' },
  templateContext() {
    const patient = this.getOption('patient');
    const inbound = this.model.get('direction') === 'inbound';

    return {
      senderName: inbound ? `${ patient.get('first_name') } ${ patient.get('last_name') }` : getSenderName(this.model, this.model.get('metadata')),
      viaLabel: getInteractionViaLabel(this.model),
      status: getStatus(this.model),
      timestamp: this.model.getTimestamp(),
      hasContent: hasInteractionCardContent(this.model),
      channelLabel: getInteractionChannelLabel(this.model),
      summary: getInteractionSummary(this.model),
      workName: this.getWorkName(),
    };
  },
  getWorkName() {
    const action = this.model.getAction();
    if (!action) return this.model.getFlow()?.get('name');
    if (action.id === this.getOption('currentActionId')) return;

    const flow = action.getFlow();
    return flow ? `${ flow.get('name') }: ${ action.get('name') }` : action.get('name');
  },
  onClickInteraction() {
    Radio.trigger('event-router', 'patient:interaction', this.getOption('patient').id, this.model.id);
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
