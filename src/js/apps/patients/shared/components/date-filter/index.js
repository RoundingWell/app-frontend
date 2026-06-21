import { noop } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import collectionOf from 'js/utils/formatting/collection-of';
import Component from 'js/base/component';
import Datepicker from 'js/components/datepicker';

import { ControllerView, ActionsView, FilterTypeView, LayoutView, DateRanges } from './date-filter_views';
import StateModel from './date-filter_state';

import { RELATIVE_DATE_RANGES } from 'js/static';

const relativeRanges = new Backbone.Collection([...RELATIVE_DATE_RANGES, { id: 'calendar' }, { id: 'alltime' }]);

const dateTypes = ['create_at', 'updated_at', 'due_date'];

const DateFilterPickerComponent = Datepicker.extend({
  stateEvents: {
    'change': 'show',
    'change:selectedDate': 'onChangeStateSelectedDate',
    'change:selectedMonth': 'onChangeStateSelectedMonth',
  },
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

export default Component.extend({
  dateTypes,
  StateModel,
  stateEvents: {
    'change': 'show',
  },
  ViewClass: ControllerView,
  viewOptions() {
    return {
      model: this.getState(),
    };
  },
  viewEvents: {
    'click:date'() {
      this.showPop();
    },
    'click:prev'() {
      this.getState().incrementBackward();
    },
    'click:next'() {
      this.getState().incrementForward();
    },
  },
  initialize() {
    this.dateTypes = new Backbone.Collection(collectionOf(this.getOption('dateTypes'), 'id'));
    this.dateTypeState = new Backbone.Model({ dateType: this.getState('dateType') });
  },
  showPop() {
    const position = this.getView().getBounds(this.getView().$el);
    this.popView = new LayoutView();

    this.popView.listenTo(this, 'destroy', this.popView.destroy);
    this.listenTo(this.popView, 'destroy', () => {
      this.setState('dateType', this.dateTypeState.get('dateType'));
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
      model: this.dateTypeState,
    }));
  },
  showRanges() {
    const state = this.getState();
    const { selectedDate, selectedMonth, selectedWeek, relativeDate } = state.pick('selectedDate', 'selectedMonth', 'selectedWeek', 'relativeDate');
    const selectedRange = relativeRanges.get(relativeDate || (!selectedDate && !selectedMonth && !selectedWeek && 'thismonth'));

    const dateRanges = new DateRanges({
      lists: [{ collection: relativeRanges }],
      state: { selected: selectedRange },
    });

    this.listenTo(dateRanges, 'select', selected => {
      if (selected === 'calendar') {
        this.showDatePicker();
        return;
      }
      state.setRelativeDate(selected, this.dateTypeState.get('dateType'));
      this.popView.destroy();
    });

    this.popView.showChildView('component', dateRanges);
  },
  showDatePicker() {
    const state = this.getState();

    const datePicker = new DateFilterPickerComponent({
      state: state.pick('selectedDate', 'selectedMonth'),
      canSelectMonth: true,
    });

    this.listenTo(datePicker, {
      'select:currentWeek'() {
        state.setRelativeDate('thisweek', this.dateTypeState.get('dateType'));
        this.popView.destroy();
      },
      'select:today'() {
        state.setRelativeDate('today', this.dateTypeState.get('dateType'));
        this.popView.destroy();
      },
      'select:currentMonth'() {
        state.setRelativeDate('thismonth', this.dateTypeState.get('dateType'));
        this.popView.destroy();
      },
      'change:selectedDate'(date) {
        state.setDate(date, this.dateTypeState.get('dateType'));
        this.popView.destroy();
      },
      'change:selectedMonth'(month) {
        state.setMonth(month, this.dateTypeState.get('dateType'));
        this.popView.destroy();
      },
    });

    datePicker.showIn(this.popView.getRegion('component'));
  },
});
