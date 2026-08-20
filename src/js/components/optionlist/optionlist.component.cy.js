import Backbone from 'backbone';
import { View } from 'marionette';

import hbs from 'handlebars-inline-precompile';

import Optionlist from './index';

context('Optionlist', function() {
  const TestView = View.extend({
    template: hbs`
      <button class="button button--primary js-menu u-margin--t-16 u-margin--l-16">Test Menu</button>
      <button class="button button--secondary js-after">After menu</button>
    `,
    ui: {
      button: '.js-menu',
    },
    triggers: {
      'click button': 'click',
    },
    dateState: {},
    onClick() {
      const optionlist = new Optionlist({
        ui: this.ui.button,
        uiView: this,
        lists: [{ collection: this.collection }],
        isSelectlist: true,
      });

      optionlist.show();
    },
  });

  specify('Displaying', function() {
    const collection = new Backbone.Collection([
      {
        text: 'Test 1',
      },
      {
        text: 'Test 2',
        isDisabled: true,
        hasDivider: true,
      },
    ]);

    cy
      .mount(rootView => {
        Optionlist.setRegion(rootView.getRegion('pop'));

        return new TestView({
          collection,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Test Menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click()
      .then(picklistItem => {
        expect(picklistItem).to.not.exist;
      })
      .get('@root')
      .contains('Test Menu')
      .should('be.focused');

    cy
      .get('@root')
      .contains('Test Menu')
      .click();

    cy
      .get('.picklist')
      .find('.is-disabled')
      .first()
      .click()
      .then(picklistItem => {
        expect(picklistItem).to.exist;
      });

    cy
      .get('@root')
      .contains('Test Menu')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Test Menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-input')
      .type('Test 1');

    cy
      .get('.picklist')
      .find('.picklist__item')
      .should('have.length', 1);

    cy
      .get('.picklist__input')
      .focus()
      .trigger('keydown', { key: 'Tab', keyCode: 9, which: 9 });

    cy
      .get('@root')
      .find('.js-after')
      .should('be.focused');
  });
});
