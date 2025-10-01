import Backbone from 'backbone';

import keyCodes from 'js/utils/formatting/key-codes';

import Picklist from './index';

const { TAB_KEY } = keyCodes;

function makeItem(num) {
  return {
    text: `This is an item: ${ num }`,
  };
}

context('Picklist', function() {
  const lists = [
    {
      childViewEventPrefix: 'group1',
      collection: new Backbone.Collection([makeItem(1), makeItem(2), makeItem(3)]),
    },
    {
      childViewEventPrefix: 'group2',
      collection: new Backbone.Collection([makeItem(1), makeItem(4)]),
      headingText: 'Group 2',
      infoText: 'Infotext: This is some info text that may wrap because it is a bit long',
    },
  ];

  specify('it should transport on arrow keys', function() {
    cy
      .mount(rootView => {
        return new Picklist({ lists });
      })
      .as('root');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .trigger('mouseover')
      .should('have.class', 'is-highlighted');

    cy
      .get('body')
      .type('{downarrow}{downarrow}');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .next()
      .next()
      .should('have.class', 'is-highlighted');

    cy
      .get('body')
      .type('{uparrow}');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .next()
      .should('have.class', 'is-highlighted');
  });

  specify('it should not transport past the start of the list', function() {
    cy
      .mount(rootView => {
        return new Picklist({ lists });
      })
      .as('root');

    cy
      .get('body')
      .type('{uparrow}{downarrow}{downarrow}{downarrow}{uparrow}{uparrow}{uparrow}{uparrow}{uparrow}');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .should('have.class', 'is-highlighted');
  });

  specify('it should not transport past the end of the list', function() {
    cy
      .mount(rootView => {
        return new Picklist({ lists });
      })
      .as('root');
    cy
      .get('body')
      .type('{downarrow}{downarrow}{downarrow}{downarrow}{downarrow}{downarrow}{downarrow}');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .should('have.class', 'is-highlighted');

    cy
      .get('body')
      .type('{downarrow}{uparrow}{uparrow}');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .trigger('mouseover')
      .should('have.class', 'is-highlighted');
  });

  specify('Picklist API', function() {
    const onClose = cy.stub();
    const onSelect1 = cy.stub();
    const onSelect2 = cy.stub();

    cy
      .mount(rootView => {
        const picklist = new Picklist({
          lists,
          headingText: 'Test Picklist',
          viewEvents: {
            'close': onClose,
            'picklist:group1:select': onSelect1,
            'picklist:group2:select': onSelect2,
          },
        });

        picklist.setState('query', 'this item');

        return picklist;
      })
      .as('root');

    cy
      .get('body')
      .type('{esc}')
      .then(() => {
        expect(onClose).to.be.calledOnce;
        onClose.resetHistory();
      });

    cy
      .get('.picklist')
      .trigger('keydown', { which: TAB_KEY })
      .then(() => {
        expect(onClose).to.be.calledOnce;
        onClose.resetHistory();
      });

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .trigger('mouseover');

    cy
      .get('body')
      .type('{enter}')
      .then(() => {
        expect(onSelect2).to.be.calledOnce;
        onSelect2.resetHistory();
      });

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .trigger('mouseover')
      .click()
      .then(() => {
        expect(onSelect1).to.be.calledOnce;
        onSelect1.resetHistory();
      });

    cy
      .get('.picklist')
      .contains('Infotext:');
  });

  specify('it should show loading then render promise lists', function() {
    let resolveLists;
    const listsPromise = new Promise(resolve => {
      resolveLists = resolve;
    });

    cy
      .mount(() => new Picklist({
        isListsAsync: true,
        lists: listsPromise,
        loadingText: 'Loading Items...',
        noResultsText: 'Nothing Here',
      }))
      .as('root');

    cy.get('.picklist__message-loading').should('contain', 'Loading Items...');

    cy.then(() => resolveLists(lists));

    cy.get('.picklist__message').should('not.exist');
    cy.get('.picklist').find('.js-picklist-item').its('length').should('be.greaterThan', 0);
  });

  specify('it should support custom loading text', function() {
    let resolveLists;
    const listsPromise = new Promise(resolve => {
      resolveLists = resolve;
    });

    cy.mount(() => new Picklist({
      isListsAsync: true,
      lists: listsPromise,
      loadingText: 'Please Wait...',
    }));

    cy.get('.picklist__message-loading').should('contain', 'Please Wait...');
    cy.then(() => resolveLists(lists));
    cy.get('.picklist__message-loading').should('not.exist');
  });

  specify('it should show no results when promise resolves empty', function() {
    let resolveLists;
    const listsPromise = new Promise(resolve => {
      resolveLists = resolve;
    });

    cy.mount(() => new Picklist({
      isListsAsync: true,
      lists: listsPromise,
      loadingText: 'Loading Items...',
      noResultsText: 'No Results Found',
    }));

    cy.get('.picklist__message-loading').should('contain', 'Loading Items...');
    cy.then(() => resolveLists([]));
    cy.get('.picklist__message').should('contain', 'No Results Found');
  });
});
