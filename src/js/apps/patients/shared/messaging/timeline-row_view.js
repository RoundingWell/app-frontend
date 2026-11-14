import hbs from 'handlebars-inline-precompile';
import { View, Radio } from 'marionette';

import intl from 'js/i18n';
import { prototypeTarget } from 'js/entities-service/messaging-prototype';
import { isPrototypeTarget, presentInteraction } from 'js/entities-service/messaging-prototype/contract';
import { cardPresentation, auditPresentation } from './presentation';
import MessageCardView from './message-card/message-card_view';
import ConsentAuditView from './consent-audit/consent-audit_view';

export function useMessagingRow(patientId, model) {
  return isPrototypeTarget(prototypeTarget(patientId)) && (model.get('channel') === 'sms' || !!presentInteraction(model));
}

export const TimelineRowView = View.extend({
  tagName: 'li',
  className: 'messaging-timeline-row',
  template: hbs`<div data-card-region></div>`,
  regions: { card: '[data-card-region]' },
  stateEvents: { 'change:interactionId': 'updateSelection' },
  onRender() {
    const patientId = this.getOption('patientId');
    const patient = Radio.request('entities', 'patients:model', patientId);
    const audit = presentInteraction(this.model)?.kind === 'consent_audit';
    const Component = audit ? ConsentAuditView : MessageCardView;
    const view = new Component({
      tagName: 'div', model: this.model, presentInteraction: model => cardPresentation(model, { patient }),
      presentAudit: model => auditPresentation(model, { patient }), labels: { sms: intl.patients.messaging.sms, showMore: intl.patients.messaging.showMore },
    });
    this.listenTo(view, 'navigate:action', this.navigateToAction);
    this.showChildView('card', view);
    this.updateSelection();
  },
  navigateToAction(actionId) {
    const flow = this.model.getAction()?.getFlow();
    const patientId = this.getOption('patientId');
    if (flow) Radio.trigger('event-router', 'patient:flow:action', patientId, flow.id, actionId);
    else Radio.trigger('event-router', 'patient:action', patientId, actionId);
  },
  setGrouping() {},
  updateSelection() {
    this.el.classList.toggle('is-selected', this.getState().get('interactionId') === this.model.id);
  },
  focusInteraction() {
    this.el.tabIndex = -1;
    this.el.scrollIntoView({ block: 'center' });
    this.el.focus({ preventScroll: true });
  },
  onAttach() {
    if (this.getState().get('interactionId') === this.model.id) this.focusInteraction();
  },
});
