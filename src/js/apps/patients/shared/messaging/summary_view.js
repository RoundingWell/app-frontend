import hbs from 'handlebars-inline-precompile';
import { View, Radio } from 'marionette';

import { prototypeTarget } from 'js/entities-service/messaging-prototype';
import { isPrototypeTarget, isMessageAction, presentInteraction } from 'js/entities-service/messaging-prototype/contract';
import intl from 'js/i18n';
import Tooltip from 'js/components/tooltip';
import ContextSession from './context-session';

import './summary.scss';

export const SummaryView = View.extend({
  className: 'messaging-summary',
  template: hbs`{{#if summary}}<button class="action-card__count messaging-summary__count js-messages" type="button" aria-label="{{formatMessage (intlGet "patients.messaging.messageCount") count=summary.messageCount}}">{{far "paper-plane-top"}} <span>{{ summary.messageCount }}</span></button>{{/if}}`,
  ui: { messages: '.js-messages' },
  triggers: { 'click @ui.messages': 'click:messages' },
  modelEvents: { change: 'render' },
  initialize({ action }) {
    this.context = new ContextSession({ patientId: action.getPatient().id, action });
    this.model = this.context.state;
    this.listenTo(this.model, 'change:summary', () => {
      this.latestBody = null;
    });
  },
  onRender() {
    this.addLatestTooltip();
  },
  onAttach() {
    if (this.started) return;
    this.started = true;
    this.context.refresh();
  },
  addLatestTooltip() {
    const summary = this.model.get('summary');
    if (!this.getOption('showPreview') || !summary?.latestText) return;
    const anchor = this.getUI('messages')[0];
    const id = `messaging-latest-${ this.cid }`;
    anchor.setAttribute('aria-describedby', id);
    const tooltip = new Tooltip({ id, className: 'tooltip messaging-summary-tooltip', uiView: this, anchor, message: `${ intl.patients.messaging.previewOnly }: ${ summary.latestText }`, shouldDelay: true });
    this.listenTo(tooltip, 'attach', async() => {
      if (!summary.latestInteractionId) return;
      this.tooltipController?.abort();
      const controller = this.tooltipController = new AbortController();
      try {
        const body = await this.readPreviewBody(summary.latestInteractionId, controller.signal);
        if (controller.signal.aborted || tooltip.isDestroyed() || this.isDestroyed()) return;
        tooltip.message = body;
        tooltip.render();
      } catch {
        // Keep an explicitly labelled preview if the full linked text is unavailable.
      }
    });
  },
  async readPreviewBody(id, signal) {
    if (this.latestBody?.id === id) return this.latestBody.body;
    const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', { patientId: this.getOption('action').getPatient().id, at: id, limit: 1 }, { signal });
    signal.throwIfAborted();
    const body = presentInteraction(collection.get(id))?.body;
    if (!body) throw new Error('The full latest text was not available.');
    this.latestBody = { id, body };
    return body;
  },
  onBeforeDestroy() {
    this.tooltipController?.abort();
    this.context.destroy();
  },
});

export function showMessagingSummary(view, regionName, { action, showPreview = false }) {
  if (!canShowMessagingSummary(action)) return;
  const summary = new SummaryView({ action, showPreview, tagName: 'span' });
  view.showChildView(regionName, summary);
  return summary;
}

export function canShowMessagingSummary(action) {
  const patientId = action.get('_patient')?.id;
  return isPrototypeTarget(prototypeTarget(patientId)) && isMessageAction(action, patientId);
}
