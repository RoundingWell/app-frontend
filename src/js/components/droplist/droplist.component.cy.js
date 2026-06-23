import Backbone from 'backbone';

import Droplist from './index';

context('Droplist', function() {
  const collection = new Backbone.Collection([
    { text: 'Option 1' },
    { text: 'Option 2' },
    { text: 'Option 3' },
  ]);

  specify('Displaying', function() {
    const headingText = 'Test Options';
    let droplist;

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        droplist = new Droplist({
          picklistOptions: {
            headingText,
          },
          collection,
          state: { isDisabled: true },
        });

        return droplist;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .should('be.disabled')
      .then(() => {
        droplist.setState({ isDisabled: false });
      });

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .contains(headingText);

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@root')
      .contains('Option 1')
      .then(() => {
        droplist.setState({ selected: null });
      });

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .click();

    cy
      .get('@root')
      .contains('Option 3')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');
  });

  specify('isSelectlist', function() {
    const headingText = 'Test Options Very very long title';

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({
          picklistOptions: {
            headingText,
            isSelectlist: true,
          },
          collection,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@root')
      .contains('Option 1')
      .click();

    cy
      .get('.picklist__input')
      .type('Opt 3');

    cy
      .get('.picklist__item')
      .find('div')
      .should('have.html', '<span><strong>Opt</strong>ion <strong>3</strong></span>');

    cy
      .get('.picklist__input')
      .type('{enter}');

    cy
      .get('@root')
      .contains('Option 3')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');
  });

  specify('isCheckable', function() {
    const headingText = 'Test Options';

    cy
      .mount(rootView => {
        Droplist.setPopRegion(rootView.getRegion('pop'));

        return new Droplist({
          picklistOptions: {
            headingText,
            isCheckable: true,
          },
          collection,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Choose One...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@root')
      .contains('Option 1')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .find('.icon')
      .should('have.class', 'fa-check');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .find('.icon')
      .should('not.exist');
  });
});
