import Backbone from 'backbone';
import dayjs from 'dayjs';
import { filter, groupBy, map } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

import InteractionDateControlView from 'js/apps/patients/shared/interactions/date-control_view';
import ComposerView from 'js/apps/patients/shared/messaging/composer_view';
import MessageCardView from 'js/apps/patients/shared/messaging/message-card_view';

import LayoutTemplate from './layout.hbs';

import './messages.scss';

const intl = i18n.patients.patient.action.messages.messagesViews;

// How far below the header a day's divider counts as the day being read.
const DATE_GAP = 16;

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
    <div class="messaging-history__date{{#if isToday}} messaging-history__date--today{{/if}}" data-date-region></div>
    <ol class="messaging-history__messages" data-messages-region></ol>
  `,
  regions: {
    date: '[data-date-region]',
    messages: {
      el: '[data-messages-region]',
      replaceElement: true,
    },
  },
  childViewTriggers: { 'select:date': 'select:date' },
  templateContext() {
    return { isToday: dayjs(this.model.id).isSame(dayjs(), 'day') };
  },
  onRender() {
    this.showChildView('date', new InteractionDateControlView({ model: this.model }));
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
  childViewTriggers: { 'select:date': 'select:date' },
  // The last day whose top has scrolled up to `top`; the first day before any has.
  getCurrentDate(top) {
    let date = this.collection.first()?.id;
    this.children.each(view => {
      if (Math.round(view.el.getBoundingClientRect().top) <= Math.round(top)) date = view.model.id;
    });
    return date;
  },
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
    currentDate: '[data-current-date-region]',
  },
  ui: { header: '.js-header', older: '.js-older', beginning: '.js-beginning', status: '.js-status', interactions: '.js-interactions' },
  triggers: { 'click @ui.older': 'click:older', 'click @ui.interactions': 'click:interactions' },
  childViewTriggers: { 'send:message': 'send:message', 'select:date': 'select:date' },
  initialize() {
    this.days = new Backbone.Collection();
    this.currentDate = new Backbone.Model();
    this.onViewportScroll = this.updateCurrentDate.bind(this);
  },
  onAttach() {
    this.getOption('viewport').addEventListener('scroll', this.onViewportScroll, { passive: true });
    this.updateCurrentDate();
  },
  onBeforeDetach() {
    this.getOption('viewport').removeEventListener('scroll', this.onViewportScroll);
  },
  updateCurrentDate() {
    if (!this.isAttached()) return;

    const date = this.getChildView('days').getCurrentDate(this.getUI('header')[0].getBoundingClientRect().bottom + DATE_GAP);
    this.getChildView('currentDate').getState().set('isVisible', !!date);
    if (date) this.currentDate.set('id', date);
  },
  // Scrolls the first day on or after `date` (or the newest day) to just under the sticky header.
  scrollToDate(date) {
    const day = this.days.find(model => model.id >= date) || this.days.last();
    if (!day) return;
    const viewport = this.getOption('viewport');
    const dayTop = this.getChildView('days').children.findByModel(day).el.getBoundingClientRect().top;
    viewport.scrollTop += dayTop - viewport.getBoundingClientRect().top - this.getUI('header')[0].offsetHeight;
  },
  templateContext() {
    const patient = this.getOption('patient');

    return { patientName: `${ patient.get('first_name') } ${ patient.get('last_name') }` };
  },
  onRender() {
    this.showChildView('currentDate', new InteractionDateControlView({ model: this.currentDate, stateOptions: { isVisible: false } }));
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

    this.showChildView('composer', new ComposerView({ model: this.getOption('draft'), patient: this.getOption('patient'), phone }));
  },
  showWindow({ models, hasOlder }) {
    const shown = filter(models, model => isShownInHistory(model, this.getOption('currentActionId')));
    // Update the existing day and message lists in place so the cards already shown keep their views.
    this.days.set(map(groupBy(shown, getDate), (dayModels, id) => {
      const interactions = this.days.get(id)?.get('interactions') || new Backbone.Collection();
      interactions.set(dayModels);
      return { id, interactions };
    }));
    this.updateCurrentDate();
    this.getUI('older')[0].hidden = !hasOlder;
    this.getUI('older')[0].disabled = false;
    this.getUI('beginning')[0].hidden = hasOlder || !shown.length;
    this.getUI('status')[0].textContent = shown.length ? '' : intl.empty;
  },
  showOlderError() {
    this.getUI('older')[0].disabled = false;
    this.getUI('status')[0].textContent = intl.olderError;
  },
  showOlderLoading() {
    this.getUI('older')[0].disabled = true;
    this.getUI('status')[0].textContent = '';
  },
});

export {
  MessagesLoadingView,
  MessagesErrorView,
  MessagesView,
};
