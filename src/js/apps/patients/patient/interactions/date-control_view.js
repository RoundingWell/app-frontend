import Backbone from 'backbone';
import dayjs from 'dayjs';
import hbs from 'handlebars-inline-precompile';
import { Radio, View } from 'marionette';

import i18n from 'js/i18n';
import Datepicker from 'js/components/datepicker';
import Optionlist from 'js/components/optionlist';

import './interactions.scss';

const intl = i18n.patients.patient.interactions.dateControlView;

const InteractionDateModalView = View.extend({
  className: 'modal patient-interactions__calendar-modal',
  attributes: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': intl.specificDate },
  template: hbs`
    <div class="patient-interactions__calendar-heading">
      <h2 class="patient-interactions__calendar-title">{{ @intl.patients.patient.interactions.dateControlView.specificDate }}</h2>
      <button class="patient-interactions__calendar-close js-close" type="button" aria-label="{{ @intl.patients.patient.interactions.dateControlView.closeDate }}">×</button>
    </div>
    <div data-calendar-region></div>
  `,
  regions: { calendar: '[data-calendar-region]' },
  ui: { close: '.js-close' },
  triggers: { 'click @ui.close': 'close' },
  onRender() {
    // The Region owns this embedded calendar; uiView is for popup lifetime.
    const datepicker = new Datepicker({
      hideActions: true,
      stateOptions: { currentMonth: dayjs(this.getOption('date')) },
    });
    this.listenTo(datepicker, 'change:selectedDate', date => {
      this.triggerMethod('select:date', date.format('YYYY-MM-DD'));
      this.destroy();
    });
    this.showChildView('calendar', datepicker);
  },
  onAttach() {
    this.el.tabIndex = -1;
    this.el.focus();
  },
  onClose() {
    this.destroy();
  },
});

const InteractionDateControlView = View.extend({
  className: 'patient-interactions__date-control',
  template: hbs`
    <button class="patient-interactions__date-button js-date-button" type="button" aria-label="{{ @intl.patients.patient.interactions.dateControlView.jumpToDate }} {{ dateLabel }}" aria-haspopup="listbox" aria-expanded="false">
      <span class="js-date-label">{{ dateLabel }}</span> {{far "angle-down"}}
    </button>
  `,
  ui: { dateButton: '.js-date-button', dateLabel: '.js-date-label' },
  triggers: { 'click @ui.dateButton': 'date:button:click' },
  modelEvents: { 'change:id': 'updateDate' },
  templateContext() {
    return { dateLabel: this.getDateLabel() };
  },
  getDateLabel() {
    const date = dayjs(this.model.id);
    const day = date.isSame(dayjs(), 'day') ? intl.today : date.format('dddd');
    return `${ day }, ${ date.format('MMM D') }`;
  },
  onRender() {
    this.updateDate();
  },
  updateDate() {
    this.el.classList.toggle('is-today', dayjs(this.model.id).isSame(dayjs(), 'day'));
    const label = this.getDateLabel();
    this.getUI('dateLabel')[0].textContent = label;
    this.getUI('dateButton')[0].setAttribute('aria-label', `${ intl.jumpToDate } ${ label }`);
  },
  focusDate() {
    this.getUI('dateButton')[0].focus({ preventScroll: true });
  },
  onDateButtonClick() {
    if (this.dateMenu) {
      this.dateMenu.destroy();
      return;
    }
    const anchor = this.getUI('dateButton')[0];
    const menu = new Optionlist({
      anchor,
      uiView: this,
      headingText: intl.jumpTo,
      popWidth: 220,
      lists: [{ collection: new Backbone.Collection([
        { id: 'today', text: intl.today },
        { id: 'yesterday', text: intl.yesterday },
        { id: 'lastWeek', text: intl.lastWeek },
        { id: 'lastMonth', text: intl.lastMonth },
        { id: 'beginning', text: intl.beginning },
        { id: 'specificDate', text: intl.specificDate, hasDivider: true },
      ]) }],
    });
    this.dateMenu = menu;
    this.listenTo(menu, 'select', this.onJumpSelect);
    this.listenTo(menu, 'destroy', () => {
      this.dateMenu = null;
      anchor.setAttribute('aria-expanded', 'false');
    });
    menu.show();
    anchor.setAttribute('aria-expanded', 'true');
  },
  onJumpSelect(model) {
    const jump = model.id;
    if (jump === 'specificDate') {
      this.showDateCalendar();
      return;
    }
    if (jump === 'beginning') {
      this.triggerMethod('select:beginning');
      return;
    }
    const offsets = { yesterday: [1, 'day'], lastWeek: [1, 'week'], lastMonth: [1, 'month'] };
    const [amount, unit] = offsets[jump] || [0, 'day'];
    this.triggerMethod('select:date', dayjs().subtract(amount, unit).format('YYYY-MM-DD'));
  },
  showDateCalendar() {
    const modal = new InteractionDateModalView({ date: this.model.id });
    this.dateModal = modal;
    this.listenTo(modal, 'select:date', date => this.triggerMethod('select:date', date));
    this.listenToOnce(modal, 'destroy', () => {
      this.dateModal = null;
      this.focusDate();
    });
    Radio.request('modal', 'show:custom', modal);
  },
  onBeforeDestroy() {
    this.stopListening(this.dateModal);
    this.dateModal?.destroy();
  },
});

export default InteractionDateControlView;
