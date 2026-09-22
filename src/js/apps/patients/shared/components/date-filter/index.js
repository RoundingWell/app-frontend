import { noop } from 'underscore';
import Backbone from 'backbone';
import { Radio, View } from 'marionette';
import hbs from 'handlebars-inline-precompile';
import dayjs from 'dayjs';

import 'scss/modules/buttons.scss';

import collectionOf from 'js/utils/formatting/collection-of';
import Datepicker from 'js/components/datepicker';
import Tooltip from 'js/components/tooltip';

import { ActionsView, FilterTypeView, PickerView, DateRanges, DateLabelView } from './date-filter_views';
import StateModel from './date-filter_state';

import { RELATIVE_DATE_RANGES } from 'js/static';

import './date-filter.scss';

const relativeRanges = new Backbone.Collection([...RELATIVE_DATE_RANGES, { id: 'calendar' }, { id: 'alltime' }]);

const dateTypes = ['create_at', 'updated_at', 'due_date'];

const CLASS_OPTIONS = [
  'dateTypes',
  'showPrevNextButtons',
  'stateOptions',
];

const DateFilterPicker = Datepicker.extend({
  getActionsView() {
    const actionsView = new ActionsView();

    this.listenTo(actionsView, {
      'click:today': this.onClickToday,
      'click:currentWeek': this.onClickCurrentWeek,
      'click:currentMonth': this.onClickCurrentMonth,
    });

    return actionsView;
  },
  onClickToday() {
    this.triggerMethod('select:today');
  },
  onClickCurrentWeek() {
    this.triggerMethod('select:currentWeek');
  },
  onClickCurrentMonth() {
    this.triggerMethod('select:currentMonth');
  },
  onSelectToday: noop,
  regionOptions: noop,
});

export default View.extend({
  className: 'date-filter__controls',
  dateTypes,
  showPrevNextButtons: true,
  template: hbs`
    <button class="button date-filter__date-button js-date" type="button">
      {{far "calendar-days"}}{{~ remove_whitespace ~}}
      {{formatMessage (intlGet "patients.shared.components.dateFilter.dateTypes") type=dateType }}{{~ remove_whitespace ~}}:
      <span data-date-picker-label-region></span>
    </button>{{~ remove_whitespace ~}}
    {{#unless hidePrevNextButtons}}
      <span class="button-group button-group--joined date-filter__navigation">
        <button class="button button--compact date-filter__nav-button date-filter__nav-button--prev js-prev" type="button">{{far "angle-left"}}</button>{{~ remove_whitespace ~}}
        <button class="button button--compact date-filter__nav-button date-filter__nav-button--next js-next" type="button">{{far "angle-right"}}</button>
      </span>
    {{/unless}}
  `,
  regions: {
    datepicker: {
      el: '[data-date-picker-label-region]',
      replaceElement: true,
    },
  },
  ui: {
    next: '.js-next',
    prev: '.js-prev',
    date: '.js-date',
  },
  triggers: {
    'click @ui.prev': 'click:prev',
    'click @ui.next': 'click:next',
    'click @ui.date': 'click:date',
  },
  createState({ stateOptions }) {
    return new StateModel(stateOptions);
  },
  stateEvents: {
    'change': 'render',
  },
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);

    this.dateTypes = new Backbone.Collection(collectionOf(this.dateTypes, 'id'));
    this.dateTypeState = new Backbone.Model({ dateType: this.stateOptions?.dateType });

    this.once('before:destroy', () => this.popView?.destroy());

    View.apply(this, arguments);
  },
  templateContext() {
    return {
      dateType: this.getState().get('dateType'),
      hidePrevNextButtons: this.showPrevNextButtons === false || this.getState().get('relativeDate') === 'alltime',
    };
  },
  onRender() {
    this.showChildView('datepicker', new DateLabelView({ state: this.getState() }));

    if (this.showPrevNextButtons === false || this.getState().get('relativeDate') === 'alltime') return;

    this.getTooltips();
  },
  onClickDate() {
    this.showPop();
  },
  onClickPrev() {
    this.getState().incrementBackward();
  },
  onClickNext() {
    this.getState().incrementForward();
  },
  getTooltips() {
    const tooltipMessages = this.getTooltipMessages();

    new Tooltip({
      message: tooltipMessages.prevMessage,
      uiView: this,
      anchor: this.getUI('prev')[0],
    });

    new Tooltip({
      message: tooltipMessages.nextMessage,
      uiView: this,
      anchor: this.getUI('next')[0],
    });
  },
  getTooltipMessages() {
    const state = this.getState();

    if (state.get('selectedDate')) {
      return this._getTooltipDayMessage(state.dayjs('selectedDate'));
    }

    if (state.get('selectedMonth')) {
      return this._getTooltipMonthMessage(state.dayjs('selectedMonth'));
    }

    if (state.get('selectedWeek')) {
      return this._getTooltipWeekMessage(state.dayjs('selectedWeek'));
    }

    const relativeDate = state.get('relativeDate');
    const { prev, unit } = relativeRanges.get(relativeDate || 'thismonth').pick('prev', 'unit');
    const relativeMessages = {
      day: '_getTooltipDayMessage',
      month: '_getTooltipMonthMessage',
      week: '_getTooltipWeekMessage',
    };

    return this[relativeMessages[unit]].call(this, dayjs().subtract(prev, unit).startOf(unit));
  },
  _getTooltipDayMessage(ts) {
    return {
      prevMessage: dayjs(ts).subtract(1, 'day').format('MM/DD/YYYY'),
      nextMessage: dayjs(ts).add(1, 'day').format('MM/DD/YYYY'),
    };
  },
  _getTooltipMonthMessage(ts) {
    return {
      prevMessage: dayjs(ts).subtract(1, 'month').format('MMM YYYY'),
      nextMessage: dayjs(ts).add(1, 'month').format('MMM YYYY'),
    };
  },
  _getTooltipWeekMessage(ts) {
    const prevWeek = dayjs(ts).subtract(1, 'week');
    const nextWeek = dayjs(ts).add(1, 'week');
    return {
      prevMessage: `${ prevWeek.format('MM/DD/YYYY') } - ${ prevWeek.endOf('week').format('MM/DD/YYYY') }`,
      nextMessage: `${ nextWeek.format('MM/DD/YYYY') } - ${ nextWeek.endOf('week').format('MM/DD/YYYY') }`,
    };
  },
  showPop() {
    // Finish the previous picker before its destroy handler updates filter state.
    this.popView?.destroy();
    const position = this.getBounds();
    this.popView = new PickerView();

    this.listenTo(this.popView, {
      'destroy': this.onDestroyPop,
      'select:range': this.onSelectRange,
      'select:currentWeek': this.onSelectCurrentWeek,
      'select:today': this.onSelectToday,
      'select:currentMonth': this.onSelectCurrentMonth,
      'change:selectedDate': this.onChangeSelectedDate,
      'change:selectedMonth': this.onChangeSelectedMonth,
    });

    this.showRanges();
    this.showDateTypes();

    Radio.request('app', 'show:pop', this.popView, {
      popWidth: 256,
      ...position,
    });
  },
  showDateTypes() {
    this.popView.showChildView('dateType', new FilterTypeView({
      collection: this.dateTypes,
      state: this.dateTypeState,
    }));
  },
  showRanges() {
    const state = this.getState();
    const { selectedDate, selectedMonth, selectedWeek, relativeDate } = state.pick('selectedDate', 'selectedMonth', 'selectedWeek', 'relativeDate');
    const selectedRange = relativeRanges.get(relativeDate || (!selectedDate && !selectedMonth && !selectedWeek && 'thismonth'));

    const dateRanges = new DateRanges({
      lists: [{ collection: relativeRanges }],
      model: new Backbone.Model({ selected: selectedRange }),
    });

    this.popView.showChildView('component', dateRanges);
  },
  onSelectRange(selected) {
    if (selected === 'calendar') {
      this.showDatePicker();
      return;
    }

    this.getState().setRelativeDate(selected, this.dateTypeState.get('dateType'));
    this.popView?.destroy();
  },
  showDatePicker() {
    const datePicker = new DateFilterPicker({
      stateOptions: this.getState().pick('selectedDate', 'selectedMonth'),
      canSelectMonth: true,
      uiView: this,
    });

    datePicker.showIn(this.popView.getRegion('component'));
  },
  onSelectCurrentWeek() {
    this.getState().setRelativeDate('thisweek', this.dateTypeState.get('dateType'));
    this.popView?.destroy();
  },
  onSelectToday() {
    this.getState().setRelativeDate('today', this.dateTypeState.get('dateType'));
    this.popView?.destroy();
  },
  onSelectCurrentMonth() {
    this.getState().setRelativeDate('thismonth', this.dateTypeState.get('dateType'));
    this.popView?.destroy();
  },
  onChangeSelectedDate(date) {
    this.getState().setDate(date, this.dateTypeState.get('dateType'));
    this.popView?.destroy();
  },
  onChangeSelectedMonth(month) {
    this.getState().setMonth(month, this.dateTypeState.get('dateType'));
    this.popView?.destroy();
  },
  onDestroyPop(popView) {
    this.stopListening(popView);
    this.getState().set('dateType', this.dateTypeState.get('dateType'));
    this.popView = undefined;
  },
});
