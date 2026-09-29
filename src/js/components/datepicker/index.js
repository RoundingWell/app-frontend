/*
    Datepicker Component init API

    uiView:                   // required - the View containing the anchor
    anchor: element           // if not defined uiView.el will be used
    position: {                // set by default to uiView.getBounds(anchor)
        top: 1,
        left: 1,
    }

    stateOptions: {
        beginDate dayjs(),    // No dates selectable before this date
        endDate: dayjs(),     // No dates selectable after this date
        currentMonth: dayjs(),
        selectedDate: dayjs()
    }
*/

import { extend, result, times } from 'underscore';

import dayjs from 'dayjs';
import { Region, View } from 'marionette';

import StateModel from './datepicker_state.js';

import { ActionsView, MonthPickerView, CalendarView } from './datepicker_views';

import LayoutTemplate from './layout.hbs';

import './datepicker.scss';

const CLASS_OPTIONS = [
  'anchor',
  'canSelectMonth',
  'position',
  'stateOptions',
  'uiView',
];

export default View.extend({
  className: 'datepicker',
  regionClass: Region.extend({ replaceElement: true }),
  regions: {
    calendar: '[data-calendar-region]',
    monthPicker: '[data-month-picker-region]',
    actions: '[data-actions-region]',
  },
  childViewEvents: {
    'click:nextMonth': 'onSelectNextMonth',
    'click:prevMonth': 'onSelectPrevMonth',
    'click:month': 'onSelectMonth',
    'click:today': 'onSelectToday',
    'click:tomorrow': 'onSelectTomorrow',
    'click:clear': 'onSelectClear',
    'select:date': 'onSelectDate',
  },
  template: LayoutTemplate,
  templateContext() {
    const dayOfWeek = times(7, index => {
      return dayjs().weekday(index);
    });

    return { dayOfWeek };
  },
  createState({ stateOptions }) {
    return new StateModel(stateOptions);
  },
  stateEvents: {
    'change': 'render',
    'change:selectedDate': 'onChangeStateSelectedDate',
    'change:selectedMonth': 'onChangeStateSelectedMonth',
  },
  onChangeStateSelectedDate(state, selectedDate) {
    this.triggerMethod('change:selectedDate', selectedDate);
  },
  onChangeStateSelectedMonth(state, selectedMonth) {
    this.triggerMethod('change:selectedMonth', selectedMonth);
  },
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);

    this.listenTo(this.uiView, 'render', this.destroy);
    this.listenTo(this.uiView, 'destroy', this.destroy);

    View.apply(this, arguments);
  },
  onSelectToday() {
    const state = this.getState();
    state.setSelectedDate(dayjs());
  },
  onSelectTomorrow() {
    const state = this.getState();
    state.setSelectedDate(dayjs().add(1, 'days'));
  },
  onSelectClear() {
    const state = this.getState();
    state.setSelectedDate(null);
    state.setSelectedMonth(null);
  },
  onRender() {
    this.showChildView('monthPicker', this.getMonthPickerView());
    this.showChildView('actions', this.getActionsView());
    this.showChildView('calendar', this.getCalendarView());
  },
  getMonthPickerView() {
    return new MonthPickerView({
      model: this.getState(),
      canSelectMonth: this.canSelectMonth,
    });
  },
  getActionsView() {
    return new ActionsView();
  },
  onSelectNextMonth() {
    const state = this.getState();
    state.setCurrentMonth(state.getNextMonth());
  },
  onSelectPrevMonth() {
    const state = this.getState();
    state.setCurrentMonth(state.getPrevMonth());
  },
  onSelectMonth() {
    const state = this.getState();
    state.setSelectedMonth(state.getCurrentMonth());
  },
  onSelectDate({ model }) {
    const state = this.getState();
    const date = model.get('date');
    const currentMonth = this.getState().getCurrentMonth();

    state.setSelectedDate(currentMonth.date(date));
  },
  getCalendarView() {
    const model = this.getState();

    return new CalendarView({
      model,
      collection: model.getCalendar(),
    });
  },
  position() {
    return this.uiView.getBounds(this.anchor);
  },
  regionOptions() {
    return extend({ popWidth: 256 }, result(this, 'position'));
  },
  showIn(region) {
    region.show(this, this.regionOptions());

    return this;
  },
  show() {
    return this.showIn(this.region);
  },
}, {
  setRegion(region) {
    this.prototype.region = region;
  },
});
