import Backbone from 'backbone';
import dayjs from 'dayjs';
import { filter, groupBy, map } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

import ComposerView from 'js/apps/patients/shared/messaging/composer_view';
import MessageCardView from 'js/apps/patients/shared/messaging/message-card_view';

import LayoutTemplate from './layout.hbs';

import './messages.scss';

const intl = i18n.patients.patient.action.messages.messagesViews;

function getDate(model) {
  return dayjs(model.getTimestamp()).format('YYYY-MM-DD');
}

function isShownInHistory(model, actionId) {
  const upcoming = !model.get('occurred_at') && !model.get('cancelled_at') && dayjs(model.get('expected_at')).isAfter(dayjs());
  return !upcoming || model.get('_action')?.id === actionId;
}

const DayView = View.extend({
  tagName: 'li',
  className: 'messaging-history__day',
  template: hbs`
    <div class="messaging-history__date{{#if isToday}} messaging-history__date--today{{/if}}"><span class="messaging-history__date-label">{{#if isToday}}{{ @intl.patients.patient.action.messages.messagesViews.today }}{{else}}{{formatDateTime id "dddd" nowrap=false}}{{/if}}, {{formatDateTime id "DATE" nowrap=false}}</span></div>
    <ol class="messaging-history__messages" data-messages-region></ol>
  `,
  regions: {
    messages: {
      el: '[data-messages-region]',
      replaceElement: true,
    },
  },
  templateContext() {
    return { isToday: dayjs(this.model.id).isSame(dayjs(), 'day') };
  },
  onRender() {
    this.showChildView('messages', new CollectionView({
      tagName: 'ol',
      className: 'messaging-history__messages',
      collection: this.model.get('interactions'),
      childView: MessageCardView,
      childViewOptions: {
        patient: this.getOption('patient'),
        currentActionId: this.getOption('currentActionId'),
      },
    }));
  },
});

const DayListView = CollectionView.extend({
  tagName: 'ol',
  className: 'messaging-history__days',
  childView: DayView,
  childViewOptions() {
    return {
      patient: this.getOption('patient'),
      currentActionId: this.getOption('currentActionId'),
    };
  },
});

const MessagesLoadingView = View.extend({
  className: 'messaging-history',
  template: hbs`<p class="messaging-history__status">{{ @intl.patients.patient.action.messages.messagesViews.loading }}</p>`,
});

const MessagesErrorView = View.extend({
  className: 'messaging-history',
  template: hbs`<p class="messaging-history__status messaging-history__status--error">{{ @intl.patients.patient.action.messages.messagesViews.error }}</p>`,
});

const MessagesView = View.extend({
  className: 'messaging-history',
  template: LayoutTemplate,
  regions: {
    days: {
      el: '[data-days-region]',
      replaceElement: true,
    },
    composer: '[data-composer-region]',
  },
  ui: { older: '.js-older', status: '.js-status' },
  triggers: { 'click @ui.older': 'click:older' },
  childViewTriggers: { 'send:message': 'send:message' },
  initialize() {
    this.days = new Backbone.Collection();
  },
  onRender() {
    this.showChildView('days', new DayListView({
      collection: this.days,
      patient: this.getOption('patient'),
      currentActionId: this.getOption('currentActionId'),
    }));
    this.showWindow(this.getOption('window'));
    this.showComposer();
  },
  showComposer() {
    const phone = this.getOption('phone');
    if (!phone) return;

    this.showChildView('composer', new ComposerView({ patient: this.getOption('patient'), phone }));
  },
  showWindow({ models, hasOlder }) {
    const shown = filter(models, model => isShownInHistory(model, this.getOption('currentActionId')));
    // Update the existing day and message lists in place so the cards already shown keep their views.
    this.days.set(map(groupBy(shown, getDate), (dayModels, id) => {
      const interactions = this.days.get(id)?.get('interactions') || new Backbone.Collection();
      interactions.set(dayModels);
      return { id, interactions };
    }));
    this.getUI('older')[0].hidden = !hasOlder;
    this.getUI('older')[0].disabled = false;
    this.getUI('status')[0].textContent = shown.length ? '' : intl.empty;
  },
  showOlderError() {
    this.getUI('older')[0].disabled = false;
    this.getUI('status')[0].textContent = intl.olderError;
  },
  onClickOlder() {
    this.getUI('older')[0].disabled = true;
    this.getUI('status')[0].textContent = '';
  },
});

export {
  MessagesLoadingView,
  MessagesErrorView,
  MessagesView,
};
