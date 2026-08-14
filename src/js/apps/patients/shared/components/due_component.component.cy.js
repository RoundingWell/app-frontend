import dayjs from 'dayjs';

import Datepicker from 'js/components/datepicker';

import DueComponent from './due_component';

context('Due Component', function() {
  specify('selects a due date', function() {
    const onChange = cy.stub();

    cy
      .mount(rootView => {
        Datepicker.setRegion(rootView.getRegion('pop'));

        const component = new DueComponent({
          date: null,
          isCompact: false,
        });

        component.on('change:due', onChange);

        return component;
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
});
