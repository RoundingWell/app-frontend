import dayjs from 'dayjs';
import Droplist from 'js/components/droplist';
import DateSelect from './index';

context('DateSelect', function() {
  specify('Setting the date', function() {
    const currentDate = dayjs();
    const pastDate = currentDate.subtract(10, 'years');

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new DateSelect();
      })
      .as('root');

    cy
      .get('@root')
      .find('.date-select__button')
      .should('contain', 'Select Year...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.year())
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', pastDate.year());

    cy
      .get('@root')
      .find('.date-select__button')
      .should('contain', 'Select Month...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.format('MMMM'))
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', pastDate.format('MMM YYYY'));

    cy
      .get('@root')
      .find('.date-select__button')
      .should('contain', 'Select Day...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.date())
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', pastDate.format('MMM DD, YYYY'));

    cy
      .get('@root')
      .find('.date-select__button')
      .should('not.exist');

    cy
      .get('@root')
      .find('.js-cancel')
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('not.exist');

    cy
      .get('@root')
      .find('.date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.year())
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', pastDate.year());

    cy
      .get('@root')
      .find('.date-select__button')
      .should('contain', 'Select Month...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('January')
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', `Jan ${ pastDate.format('YYYY') }`);

    cy
      .get('@root')
      .find('.date-select__button')
      .should('contain', 'Select Day...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('1')
      .click();

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', `Jan 01, ${ pastDate.format('YYYY') }`);
  });

  specify('Prefilled date', function() {
    const currentDate = dayjs();
    const pastDate = currentDate.subtract(10, 'years');

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new DateSelect({
          state: {
            selectedDate: pastDate.format('YYYY-MM-DD'),
          },
        });
      })
      .as('root');

    cy
      .get('@root')
      .find('.date-select__button')
      .should('not.exist');

    cy
      .get('@root')
      .find('.date-select__date')
      .should('contain', pastDate.format('MMM DD, YYYY'))
      .next()
      .should('have.class', 'js-cancel');
  });
});
