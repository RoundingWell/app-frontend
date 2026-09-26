import { compact, isNull, map, range, times } from 'underscore';
import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import dayjs from 'dayjs';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Droplist from 'js/components/droplist';

import DateSelectTemplate from './date-select.hbs';

import './date-select.scss';

const i18n = intl.components.dateSelect;

const monthsCollection = new Backbone.Collection(times(12, idx => {
  const month = dayjs().month(idx);

  return {
    value: idx,
    text: `${ month.format('MMMM') } (${ (idx + 1) })`,
  };
}));

// Possible years someone is still alive in
const thisYear = dayjs().year();
const yearRange = range(thisYear, (thisYear - 120), -1);

const yearsObj = map(yearRange, function(year) {
  return { value: year, text: String(year) };
});

const SelectList = Droplist.extend({
  className: 'button button--secondary date-select__button',
  picklistOptions: {
    isSelectlist: true,
  },
  template: hbs`{{ buttonText }}`,
  getTemplate() {
    return this.getOption('template');
  },
  templateContext() {
    return { buttonText: this.getOption('buttonText') };
  },
  onChangeSelected(selected) {
    this.triggerMethod('change:field', this.getOption('field'), selected);
  },
});

const StateModel = Backbone.Model.extend({
  defaults: {
    year: null,
    month: null,
    day: null,
    selectedDate: null,
    hasError: false,
    isDisabled: false,
  },
  reset() {
    this.set(this.defaults);
  },
});

export default View.extend({
  className() {
    return compact([
      'button-group',
      'button-group--joined',
      'date-select',
      this.getOption('rootClassName'),
    ]).join(' ');
  },
  template: DateSelectTemplate,
  regions: {
    selectRegion: {
      el: '[data-select-region]',
      replaceElement: true,
    },
  },
  ui: {
    cancel: '.js-cancel',
  },
  triggers: {
    'click @ui.cancel': 'click:cancel',
  },
  childViewEvents: {
    'change:field': 'onChangeField',
  },
  createState() {
    return new StateModel(this.stateOptions || {});
  },
  constructor: function(options) {
    this.mergeOptions(options, ['stateOptions']);

    View.apply(this, arguments);

    this.syncStateAttributes();
  },
  stateEvents: {
    'change': 'onChangeState',
    'change:selectedDate': 'onChangeSelectedDate',
  },
  onChangeState() {
    const state = this.getState();

    if (state.get('day') && !state.get('selectedDate')) {
      const date = dayjs()
        .year(state.get('year'))
        .month(state.get('month'))
        .date(state.get('day'));

      state.set({ selectedDate: date });
      return;
    }

    this.render();
  },
  onChangeSelectedDate(state, selectedDate) {
    this.triggerMethod('change:date', state, selectedDate);
  },
  onClickCancel() {
    this.getState().reset();
  },
  onRender() {
    this.syncStateAttributes();

    const state = this.getState();

    if (state.get('selectedDate')) return;

    if (!state.get('year')) {
      this.showChildView('selectRegion', this.getYearSelect());
      return;
    }

    if (isNull(state.get('month'))) {
      this.showChildView('selectRegion', this.getMonthSelect());
      return;
    }

    this.showChildView('selectRegion', this.getDaySelect());
  },
  syncStateAttributes() {
    const state = this.getState();
    const isPartial = !!state.get('year') && !state.get('selectedDate');

    this.el.classList.toggle('is-partial', isPartial);
  },
  formatDate() {
    const state = this.getState();
    const selectedDate = state.get('selectedDate');

    if (selectedDate) {
      return dayjs(selectedDate).format('MMM DD, YYYY');
    }

    const month = state.get('month');
    if (!isNull(month)) {
      return dayjs().month(month).year(state.get('year')).format('MMM YYYY');
    }

    return state.get('year');
  },
  templateContext() {
    const state = this.getState();

    return {
      date: this.formatDate(),
      hasError: state.get('hasError'),
      isDisabled: state.get('isDisabled'),
    };
  },
  getYearSelect() {
    return new SelectList({
      field: 'year',
      collection: new Backbone.Collection(yearsObj),
      buttonText: i18n.yearPlaceholderText,
      template: hbs`{{far "calendar-days"}}<span>{{ buttonText }}</span>`,
    });
  },
  getMonthSelect() {
    return new SelectList({
      field: 'month',
      collection: monthsCollection,
      buttonText: i18n.monthPlaceholderText,
      stateOptions: { isActive: true },
    });
  },
  getDaySelect() {
    return new SelectList({
      field: 'day',
      collection: this.getDayOpts(),
      buttonText: i18n.dayPlaceholderText,
      stateOptions: { isActive: true },
    });
  },
  onChangeField(field, model) {
    this.getState().set(field, model.get('value'));
  },
  getDayOpts() {
    const state = this.getState();
    const date = dayjs().year(state.get('year')).month(state.get('month'));

    const daysInMonth = date.daysInMonth();
    const daysRange = range(1, daysInMonth + 1);

    const daysObj = map(daysRange, function(day) {
      return { value: day, text: String(day) };
    });

    return new Backbone.Collection(daysObj);
  },
});
