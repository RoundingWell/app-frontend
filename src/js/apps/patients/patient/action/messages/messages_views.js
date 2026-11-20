import Backbone from 'backbone';
import dayjs from 'dayjs';
import { filter, groupBy, isEqual, map } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View, CollectionView } from 'marionette';

import 'scss/modules/buttons.scss';

import i18n from 'js/i18n';

import { getDeliveryFailure, getSenderName } from 'js/apps/patients/shared/interactions/display';
import InteractionDateControlView from 'js/apps/patients/shared/interactions/date-control_view';
import ComposerView from 'js/apps/patients/shared/messaging/composer_view';
import MessageCardView from 'js/apps/patients/shared/messaging/message-card_view';

import LayoutTemplate from './layout.hbs';

import './messages.scss';

const intl = i18n.patients.patient.action.messages.messagesViews;

const DayMessagesView = CollectionView.extend({
  tagName: 'ol',
  className: 'messaging-history__messages',
  childView: MessageCardView,
  collectionEvents: {
    change: 'updateGrouping',
  },
  onRenderChildren() {
    this.updateGrouping();
  },
  updateGrouping() {
    const keys = this.collection.map(model => {
      if (!model.get('occurred_at') || model.get('cancelled_at')) return false;

      const workId = model.get('_action')?.id || model.get('_flow')?.id;

      return [model.get('direction'), getSenderName(model, model.get('metadata')), workId];
    });

    const canGroup = (left, right) => {
      const model = this.collection.at(left);
      const failed = model.get('send_status') === 'failed' || !!getDeliveryFailure(model);

      return !!keys[left] && !!keys[right] && !failed && isEqual(keys[left], keys[right]);
    };

    this.children.each(view => {
      const index = this.collection.indexOf(view.model);

      view.setGrouping(index > 0 && canGroup(index - 1, index), canGroup(index, index + 1));
    });
  },
});

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
  childViewTriggers: {
    'select:date': 'select:date',
  },
  templateContext() {
    return { isToday: dayjs(this.model.id).isSame(dayjs(), 'day') };
  },
  onRender() {
    this.showChildView('date', new InteractionDateControlView({ model: this.model }));
    this.showChildView('messages', new DayMessagesView({
      collection: this.model.get('interactions'),
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
  childViewTriggers: {
    'select:date': 'select:date',
  },
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
  ui: {
    header: '.js-header',
    older: '.js-older',
    beginning: '.js-beginning',
    status: '.js-status',
    interactions: '.js-interactions',
  },
  triggers: {
    'click @ui.older': 'click:older',
    'click @ui.interactions': 'click:interactions',
  },
  childViewTriggers: {
    'send:message': 'send:message',
    'select:date': 'select:date',
  },
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

    const date = this.getChildView('days').getCurrentDate(this.getUI('header')[0].getBoundingClientRect().bottom + 16);
    this.getChildView('currentDate').getState().set('isVisible', !!date);
    if (date) this.currentDate.set('id', date);
  },
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
    this.showChildView('currentDate', new InteractionDateControlView({
      model: this.currentDate,
      stateOptions: { isVisible: false },
    }));

    this.showChildView('days', new DayListView({
      collection: this.days,
      patient: this.getOption('patient'),
      currentActionId: this.getOption('currentActionId'),
    }));

    this.showWindow(this.getOption('window'));

    this.showComposer();
  },
  showComposer() {
    const draft = this.getOption('draft');
    if (!draft) return;

    this.showChildView('composer', new ComposerView({
      model: draft,
      patient: this.getOption('patient'),
      phone: this.getOption('phone'),
    }));
  },
  showWindow({ models, hasOlder }) {
    const currentActionId = this.getOption('currentActionId');
    const shown = filter(models, model => {
      const upcoming = !model.get('occurred_at') && !model.get('cancelled_at') && dayjs(model.get('expected_at')).isAfter(dayjs());

      return !upcoming || model.getAction()?.id === currentActionId;
    });

    this.days.set(map(groupBy(shown, model => dayjs(model.getTimestamp()).format('YYYY-MM-DD')), (dayModels, id) => {
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
