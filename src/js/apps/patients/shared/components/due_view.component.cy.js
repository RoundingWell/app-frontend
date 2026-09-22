import dayjs from 'dayjs';

import Datepicker from 'js/components/datepicker';

import DueView from './due_view';

context('Due View', function() {
  specify('labels an empty compact control when requested', function() {
    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        return new DueView({
          date: null,

          showLabel: true,
        });
      })
      .contains('Select Date...');
  });

  specify('selects a due date', function() {
    const onChange = cy.stub();

    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        const view = new DueView({
          date: null,
          showLabel: true,
        });

        view.on('change:due', onChange);

        return view;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Date...')
      .click();

    cy
      .get('.datepicker')
      .contains('Today')
      .click()
      .then(() => {
        expect(onChange).to.be.calledOnce;
        expect(dayjs.isDayjs(onChange.firstCall.args[0])).to.equal(true);
      });

    cy
      .get('.datepicker')
      .should('not.exist');
  });

  specify('closes the datepicker when clicked again', function() {
    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        return new DueView({
          date: null,
          showLabel: true,
        });
      })
      .as('root');

    cy
      .get('@root')
      .find('.due-component')
      .as('button')
      .click()
      .should('have.class', 'is-active');

    cy
      .get('.datepicker')
      .should('exist');

    cy
      .get('@button')
      .then(([button]) => button.click())
      .get('@button')
      .should('not.have.class', 'is-active');

    cy
      .get('.datepicker')
      .should('not.exist');
  });
});
