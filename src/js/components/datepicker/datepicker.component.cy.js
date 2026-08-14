import Backbone from 'backbone';
import { View } from 'marionette';

import hbs from 'handlebars-inline-precompile';
import { testDate, testDateAdd } from 'helpers/test-date';

import formatDate from 'helpers/format-date';

import Datepicker from './index';

context('Datepicker', function() {
  const TestView = View.extend({
    template: hbs`
      <button class="button button--primary u-margin--t-16 u-margin--l-16">
        {{#if date}}
          {{formatDateTime date "LONG"}}
        {{/if}}
        {{#if selectedMonth}}
          {{formatDateTime selectedMonth "MMM YYYY"}}
        {{/if}}
        {{ defaultText }}
      </button>`,
    templateContext() {
      return {
        defaultText: !this.model.get('date') && !this.model.get('selectedMonth') ? 'Select Date' : null,
      };
    },
    ui: {
      button: 'button',
    },
    triggers: {
      'click button': 'click',
    },
    modelEvents: {
      'change:date change:selectedMonth': 'render',
    },
    dateState: {},
    onClick() {
      const state = this.getOption('dateState');

      const datepicker = new Datepicker({
        ui: this.ui.button,
        uiView: this,
        state,
        canSelectMonth: this.getOption('canSelectMonth'),
      });

      this.datepicker = datepicker;

      this.listenTo(datepicker, {
        'change:selectedDate': date => {
          state.selectedDate = date;
          this.model.set({
            date,
            selectedMonth: null,
          });

          datepicker.destroy();
        },
        'change:selectedMonth': selectedMonth => {
          state.selectedDate = null;
          state.selectedMonth = selectedMonth;
          this.model.set({
            selectedMonth,
            date: null,
          });

          datepicker.destroy();
        },
      });

      datepicker.show();
    },
  });

  specify('Displaying', function() {
    const testView = new TestView({
      model: new Backbone.Model(),
    });

    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        return testView;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Date')
      .click();

    cy
      .get('.datepicker')
      .should('contain', formatDate(testDate(), 'MMM YYYY'))
      .find('.is-today')
      .should('contain', formatDate(testDate(), 'D'));

    cy
      .get('.datepicker')
      .find('.js-month')
      .should('not.exist');

    cy
      .get('.datepicker')
      .contains('Today')
      .click();

    cy
      .get('.datepicker')
      .should('not.exist');

    cy
      .get('@root')
      .contains(formatDate(testDate(), 'LONG'))
      .click();

    cy
      .get('.datepicker')
      .find('.is-selected')
      .should('contain', formatDate(testDate(), 'D'));

    cy
      .get('.datepicker')
      .contains('Tomorrow')
      .click();

    cy
      .get('@root')
      .contains(formatDate(testDateAdd(1), 'LONG'))
      .click();

    cy
      .get('.datepicker')
      .contains('Clear')
      .click();

    cy
      .get('@root')
      .contains('Select Date')
      .click();

    cy
      .get('.datepicker')
      .contains('10')
      .click();

    cy
      .get('@root')
      .contains('10')
      .click();

    cy
      .get('.datepicker')
      .contains(formatDate(testDateAdd(1, 'months'), 'MMM'))
      .click();

    cy
      .get('.datepicker')
      .should('contain', formatDate(testDateAdd(1, 'months'), 'MMM YYYY'))
      .contains(formatDate(testDate(), 'MMM'))
      .click();

    cy
      .get('.datepicker')
      .should('contain', formatDate(testDate(), 'MMM YYYY'));

    cy
      .then(() => {
        testView.datepicker.setState('currentMonth', '01/01/2016');
      });

    cy
      .get('.datepicker')
      .should('contain', 'Jan 2016');

    cy
      .then(() => {
        const state = testView.datepicker.getState();
        state.setSelectedDate('01/05/2016');
        expect(state.get('selectedDate').format('MM/DD/YYYY')).to.equal('01/05/2016');
      });
  });

  specify('Previous month days', function() {
    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        return new TestView({
          model: new Backbone.Model(),
          dateState: {
            beginDate: '02/08/2015',
            endDate: '02/21/2015',
            currentMonth: '02/01/2015',
          },
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Date')
      .click();

    cy
      .get('.datepicker')
      .find('.is-other-month')
      .should('not.exist');

    cy
      .get('.datepicker')
      .find('.datepicker__days li a')
      .should('have.lengthOf', 14);

    cy
      .get('.datepicker')
      .contains('7')
      .should('have.class', 'is-disabled');

    cy
      .get('.datepicker')
      .contains('22')
      .should('have.class', 'is-disabled');
  });

  specify('Month select', function() {
    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        return new TestView({
          model: new Backbone.Model(),
          canSelectMonth: true,
          dateState: {},
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Date')
      .click();

    cy
      .get('.datepicker')
      .find('.js-month')
      .click();

    cy
      .get('@root')
      .contains(formatDate(testDate(), 'MMM YYYY'))
      .click();

    cy
      .get('.datepicker')
      .find('.is-today')
      .click();

    cy
      .get('@root')
      .contains(formatDate(testDate(), 'LONG'))
      .click();

    cy
      .get('.datepicker')
      .find('.js-next')
      .click();

    cy
      .get('.datepicker')
      .find('.js-month')
      .click();

    cy
      .get('@root')
      .contains(formatDate(testDateAdd(1, 'month'), 'MMM YYYY'))
      .click();

    cy
      .get('.datepicker')
      .find('.js-month')
      .contains(formatDate(testDateAdd(1, 'month'), 'MMM YYYY'));

    cy
      .get('.datepicker')
      .find('.js-clear')
      .click();

    cy
      .get('@root')
      .contains('Select Date')
      .click();

    cy
      .get('.datepicker')
      .find('.js-month')
      .contains(formatDate(testDate(), 'MMM YYYY'));
  });

  specify('Displaying from bottom', function() {
    const testView = new TestView({
      model: new Backbone.Model(),
    });

    testView.$el.css({ position: 'fixed', bottom: '10px' });

    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        return testView;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Date')
      .click();

    cy
      .get('.datepicker')
      .should($datepicker => {
        expect($datepicker.position().top).to.be.greaterThan(400);
      });
  });
});
