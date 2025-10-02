import Backbone from 'backbone';
import { View } from 'marionette';

import hbs from 'handlebars-inline-precompile';

import Optionlist from './index';

context('Optionlist', function() {
  const TestView = View.extend({
    template: hbs`<button class="button--blue u-margin--t-16 u-margin--l-16">Test Menu</button>`,
    ui: {
      button: 'button',
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
      });

      optionlist.show();
    },
  });

  specify('Displaying', function() {
    const onSelect = cy.stub();
    const collection = new Backbone.Collection([
      {
        text: 'Test 1',
        onSelect,
      },
      {
        text: 'Test 2',
        isDisabled: true,
        hasDivider: true,
      },
      {
        text: 'Test 3',
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
        expect(onSelect).to.be.calledOnce;
        expect(picklistItem).to.not.exist;
        onSelect.resetHistory();
      });

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
        expect(onSelect).to.not.be.called;
        expect(picklistItem).to.exist;
      });

    cy
      .get('@root')
      .contains('Test Menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .click()
      .then(picklistItem => {
        expect(onSelect).to.not.be.called;
        expect(picklistItem).to.not.exist;
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
  });
});
