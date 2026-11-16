import dayjs from 'dayjs';
import { View, CollectionView } from 'marionette';
import hbs from 'handlebars-inline-precompile';

import { formatDate } from 'js/base/dayjs';
import MessageCardView from 'js/apps/patients/shared/messaging/message-card/message-card_view';
import { cardPresentation } from 'js/apps/patients/shared/messaging/presentation';

const RowView = View.extend({
  tagName: 'li',
  className: 'messaging-history__row',
  template: hbs`<div class="patient-interactions__date-divider messaging-history__day js-day"><span class="patient-interactions__date-button js-day-label"></span></div><div data-message-region></div>`,
  ui: { day: '.js-day', dayLabel: '.js-day-label' },
  regions: { message: '[data-message-region]' },
  onRender() {
    const Component = MessageCardView;
    const { patient, currentActionId, labels } = this.options;
    const view = new Component({
      tagName: 'div', model: this.model, currentActionId, labels,
      presentInteraction: model => cardPresentation(model, { patient, currentActionId }),
    });
    this.listenTo(view, 'navigate:action', actionId => this.triggerMethod('navigate:action', this.model, actionId));
    this.listenTo(view, 'navigate:flow', flowId => this.triggerMethod('navigate:flow', flowId));
    this.showChildView('message', view);
  },
  setDay(previous) {
    const timestamp = this.model.getTimestamp();
    const date = dayjs(timestamp).format('YYYY-MM-DD');
    const control = this.getUI('day')[0];
    control.hidden = previous === date;
    this.getUI('dayLabel')[0].textContent = formatDate(dayjs(timestamp), 'LONG');
    this.el.dataset.day = date;
    this.el.dataset.interactionId = this.model.id;
    return date;
  },
});

export const HistoryListView = CollectionView.extend({
  tagName: 'ol',
  className: 'messaging-history__list',
  childView: RowView,
  childViewOptions() {
    return { patient: this.getOption('patient'), currentActionId: this.getOption('currentActionId'), labels: this.getOption('labels') };
  },
  childViewTriggers: { 'navigate:action': 'navigate:action', 'navigate:flow': 'navigate:flow' },
  collectionEvents: { 'update sort reset change': 'updateGrouping' },
  onRenderChildren() {
    this.updateGrouping();
  },
  updateGrouping() {
    let previous;
    this.children.each(view => {
      previous = view.setDay(previous);
    });
  },
  captureAnchor(viewport) {
    const top = viewport.getBoundingClientRect().top;
    const view = this.children.find(child => child.el.getBoundingClientRect().bottom > top);
    return view ? { id: view.model.id, offset: view.el.getBoundingClientRect().top - top } : null;
  },
  restoreAnchor(anchor, viewport) {
    if (!anchor) return;
    const model = this.collection.get(anchor.id);
    const view = model && this.children.findByModel(model);
    if (!view) return;
    viewport.scrollTop += view.el.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset;
  },
  nearBeginning(viewport) {
    const view = this.children.first();
    if (!view) return false;
    const distance = view.el.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    return distance >= -120 && distance <= 120;
  },
  currentDay(viewport) {
    const anchor = this.captureAnchor(viewport);
    const model = anchor && this.collection.get(anchor.id);
    return model ? formatDate(dayjs(model.getTimestamp()), 'LONG') : '';
  },
});
