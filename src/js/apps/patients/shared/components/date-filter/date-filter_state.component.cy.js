import dayjs from 'dayjs';

import DateFilter from './index';
import DateFilterState from './date-filter_state';

function expectDate(state, attribute, value) {
  expect(state.dayjs(attribute).format('YYYY-MM-DD')).to.equal(value);
}

context('Date Filter State', function() {
  specify('moves explicit dates, weeks, and months in both directions', function() {
    const state = new DateFilterState();

    state.setDate(dayjs('2026-08-14'), 'updated_at');
    state.incrementBackward();
    expectDate(state, 'selectedDate', '2026-08-13');
    state.incrementForward();
    expectDate(state, 'selectedDate', '2026-08-14');

    state.setWeek(dayjs('2026-08-10'), 'due_date');
    state.incrementBackward();
    expectDate(state, 'selectedWeek', '2026-08-02');
    state.incrementForward();
    expectDate(state, 'selectedWeek', '2026-08-09');

    state.setMonth(dayjs('2026-08-01'));
    state.incrementBackward();
    expectDate(state, 'selectedMonth', '2026-07-01');
    state.incrementForward();
    expectDate(state, 'selectedMonth', '2026-08-01');
    expect(state.get('dateType')).to.equal('due_date');
  });

  specify('converts relative ranges to explicit ranges', function() {
    const state = new DateFilterState();

    state.setRelativeDate('today', 'due_date');
    state.incrementBackward();
    expectDate(state, 'selectedDate', dayjs().subtract(1, 'day').format('YYYY-MM-DD'));

    state.setRelativeDate('thisweek', 'updated_at');
    state.incrementForward();
    expectDate(state, 'selectedWeek', dayjs().add(1, 'week').startOf('week').format('YYYY-MM-DD'));

    state.setRelativeDate('thismonth', 'due_date');
    state.incrementForward();
    expectDate(state, 'selectedMonth', dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'));
  });

  specify('moves the displayed range with its navigation controls', function() {
    let component;

    cy.mount(() => {
      component = new DateFilter({
        state: { dateType: 'due_date', relativeDate: 'today' },
      });
      return component;
    });

    cy.get('.date-filter__nav-button--next').trigger('click');
    cy.then(() => expectDate(component.getState(), 'selectedDate', dayjs().add(1, 'day').format('YYYY-MM-DD')));

    cy.get('.date-filter__nav-button--prev').trigger('click');
    cy.then(() => expectDate(component.getState(), 'selectedDate', dayjs().format('YYYY-MM-DD')));
  });
});
