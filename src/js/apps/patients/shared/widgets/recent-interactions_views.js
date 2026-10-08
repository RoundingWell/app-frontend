import hbs from 'handlebars-inline-precompile';
import { Radio, View, CollectionView } from 'marionette';

import i18n from 'js/i18n';

import { getInteractionChannelLabel, getInteractionIcon } from 'js/apps/patients/shared/interactions/interaction-item_view';
import { InteractionsLoadingView, InteractionsErrorView } from 'js/apps/patients/shared/interactions/interactions-status_views';

import './recent-interactions.scss';

const intl = i18n.patients.shared.widgets.recentInteractionsViews;

function appendDetail(title, detail, separator = ' • ') {
  return detail ? `${ title }${ separator }${ detail }` : title;
}

const RecentInteractionsItemView = View.extend({
  tagName: 'li',
  className() {
    return `patient-interactions-preview__item patient-interactions-preview__item--${ this.model.get('channel') }`;
  },
  template: hbs`
    <button class="patient-interactions-preview__link js-interaction" type="button">
      <span class="patient-interactions-preview__symbol" aria-hidden="true">{{far icon}}</span>
      <span class="patient-interactions-preview__details">
        <strong class="patient-interactions-preview__title">{{ title }}</strong>
        <span class="patient-interactions-preview__sender">{{#if (isValue direction "inbound")}}{{ metadata.from }}{{else}}{{ metadata.clinician_name }}{{/if}}</span>
        <time class="patient-interactions-preview__time" datetime="{{ timestamp }}">{{formatDateTime timestamp "AT_TIME"}}</time>
      </span>
    </button>
  `,
  ui: { interaction: '.js-interaction' },
  triggers: { 'click @ui.interaction': 'click:interaction' },
  onClickInteraction() {
    Radio.trigger('event-router', 'patient:interaction', this.getOption('patientId'), this.model.id);
  },
  getTitle() {
    const group = this.model.getChannelGroup();
    const metadata = this.model.get('metadata') || {};
    const direction = this.model.get('direction') === 'inbound' ? intl.inbound : intl.outbound;
    if (group === 'messages') return `${ direction } ${ intl.message }`;
    if (group === 'calls') {
      const title = `${ direction } ${ getInteractionChannelLabel(this.model) }`;
      return appendDetail(title, metadata.disposition);
    }
    if (group === 'appointments') {
      const status = intl.appointmentStatuses[this.model.getAppointmentStatus()];
      return appendDetail(intl.appointment, status, ' ');
    }
    const title = metadata.discharged_at ? intl.discharged : intl.admitted;
    return appendDetail(title, metadata.facility);
  },
  templateContext() {
    return {
      title: this.getTitle(),
      icon: getInteractionIcon(this.model),
      timestamp: this.model.getTimestamp(),
    };
  },
});

const RecentInteractionsListView = CollectionView.extend({
  tagName: 'ul',
  className: 'patient-interactions-preview__list',
  childView: RecentInteractionsItemView,
  childViewOptions() {
    return {
      patientId: this.getOption('patientId'),
    };
  },
  emptyView: View.extend({
    tagName: 'li',
    template: hbs`{{ @intl.patients.shared.widgets.recentInteractionsViews.empty }}`,
  }),
});

const RecentInteractionsView = View.extend({
  className: 'patient-interactions-preview',
  template: hbs`
    <div data-content-region></div>
    <button class="patient-interactions-preview__all js-all" type="button">{{far "right-left-large"}} {{ @intl.patients.shared.widgets.recentInteractionsViews.interactionsTab }}</button>
  `,
  regions: { content: '[data-content-region]' },
  ui: { all: '.js-all' },
  triggers: { 'click @ui.all': 'click:all' },
  onClickAll() {
    Radio.trigger('event-router', 'patient:interactions', this.model.id);
  },
  showLoading() {
    this.showChildView('content', new InteractionsLoadingView({ className: 'patient-interactions-loading patient-interactions-loading--compact skeleton-loading' }));
  },
  showInteractions(collection) {
    this.showChildView('content', new RecentInteractionsListView({
      collection,
      patientId: this.model.id,
    }));
  },
  showError() {
    this.showChildView('content', new InteractionsErrorView());
  },
});

export { RecentInteractionsView };
