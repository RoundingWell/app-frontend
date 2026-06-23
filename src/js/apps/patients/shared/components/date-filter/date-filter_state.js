import Backbone from 'backbone';
import dayjs from 'dayjs';

import { RELATIVE_DATE_RANGES } from 'js/static';

const relativeRanges = new Backbone.Collection(RELATIVE_DATE_RANGES);
const relativeSets = {
  day: 'setDate',
  week: 'setWeek',
  month: 'setMonth',
};

export default Backbone.Model.extend({
  setRelativeDate(relativeDate, dateType) {
    this.set({
      relativeDate,
      selectedDate: null,
      selectedWeek: null,
      selectedMonth: null,
      dateType: dateType,
    });
  },
  setMonth(selectedMonth, dateType) {
    this.set({
      relativeDate: null,
      selectedDate: null,
      selectedWeek: null,
      selectedMonth,
      dateType: dateType || this.get('dateType'),
    });
  },
  setWeek(selectedWeek, dateType) {
    this.set({
      relativeDate: null,
      selectedDate: null,
      selectedWeek,
      selectedMonth: null,
      dateType: dateType || this.get('dateType'),
    });
  },
  setDate(selectedDate, dateType) {
    this.set({
      relativeDate: null,
      selectedDate,
      selectedWeek: null,
      selectedMonth: null,
      dateType: dateType || this.get('dateType'),
    });
  },
  incrementBackward() {
    if (this.dayjs('selectedDate')) {
      this.setDate(this.dayjs('selectedDate').subtract(1, 'day'));
      return;
    }

    if (this.dayjs('selectedMonth')) {
      this.setMonth(this.dayjs('selectedMonth').subtract(1, 'month').startOf('month'));
      return;
    }

    if (this.dayjs('selectedWeek')) {
      this.setWeek(this.dayjs('selectedWeek').subtract(1, 'week').startOf('week'));
      return;
    }

    const relativeDate = this.get('relativeDate') || /* istanbul ignore next: sensible default */ 'thismonth';
    const { prev, unit } = relativeRanges.get(relativeDate).pick('prev', 'unit');
    this[relativeSets[unit]].call(this, dayjs().subtract(prev + 1, unit).startOf(unit));
  },
  incrementForward() {
    if (this.dayjs('selectedDate')) {
      this.setDate(this.dayjs('selectedDate').add(1, 'day'));
      return;
    }

    if (this.dayjs('selectedMonth')) {
      this.setMonth(this.dayjs('selectedMonth').add(1, 'month').startOf('month'));
      return;
    }

    if (this.dayjs('selectedWeek')) {
      this.setWeek(this.dayjs('selectedWeek').add(1, 'week').startOf('week'));
      return;
    }

    const relativeDate = this.get('relativeDate') || /* istanbul ignore next: sensible default */ 'thismonth';
    const { prev, unit } = relativeRanges.get(relativeDate).pick('prev', 'unit');
    this[relativeSets[unit]].call(this, dayjs().add(1 - prev, unit).startOf(unit));
  },
});
