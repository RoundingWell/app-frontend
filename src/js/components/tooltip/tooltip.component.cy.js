import 'js/base/setup';
import Backbone from 'backbone';
import { View, CollectionView } from 'marionette';

import hbs from 'handlebars-inline-precompile';

import Tooltip from './index';

context('Tooltip', function() {
  const testCollection = new Backbone.Collection([
    { id: 'Top Left', style: 'left: 5px; top: 5px' },
    { id: 'Top Center', style: 'left: 45%; top: 5px' },
    { id: 'Top Right', style: 'right: 5px; top: 5px' },
    { id: 'Bottom Left', style: 'left: 5px; bottom: 5px' },
    { id: 'Bottom Center', style: 'left: 45%; bottom: 5px' },
    { id: 'Bottom Right', style: 'right: 5px; bottom: 5px' },
    { id: 'Center Left', style: 'top: 45%; left: 5px' },
    { id: 'Center Right', style: 'top: 45%; right: 5px;' },
  ]);

  const ButtonView = View.extend({
    template: hbs`<button class="button button--primary" style="position:absolute; width:10%; height:10%; {{ style }}">{{ id }}</button>`,
    ui: {
      'button': 'button',
    },
    onRender() {
      new Tooltip({
        message: this.model.id,
        uiView: this,
        ui: this.ui.button,
        orientation: this.getOption('orientation'),
      });
    },
  });

  const TestView = CollectionView.extend({
    childView: ButtonView,
    collection: testCollection,
  });

  specify('Displaying vertical positioning', function() {
    cy
      .mount(rootView => {
        Tooltip.setRegion(rootView.getRegion('tooltip'));
        return new TestView();
      })
      .as('root');

    testCollection.each(model => {
      cy
        .get('@root')
        .contains(model.id)
        .as('button')
        .trigger('pointerover');

      cy
        .get('.tooltip')
        .contains(model.id);

      cy
        .get('@button')
        .trigger('mouseout');

      cy
        .get('@root')
        .contains(model.id)
        .as('button')
        .trigger('pointerdown');

      cy
        .get('.tooltip')
        .contains(model.id);

      cy
        .get('@button')
        .trigger('mouseout');
    });
  });

  specify('Displaying horizontal positioning', function() {
    cy
      .mount(rootView => {
        Tooltip.setRegion(rootView.getRegion('tooltip'));
        return new TestView({
          childViewOptions: { orientation: 'horizontal' },
        });
      })
      .as('root');

    testCollection.each(model => {
      cy
        .get('@root')
        .contains(model.id)
        .as('button')
        .trigger('pointerover');

      cy
        .get('.tooltip')
        .contains(model.id);

      cy
        .get('@button')
        .trigger('mouseout');

      cy
        .get('@root')
        .contains(model.id)
        .as('button')
        .trigger('pointerdown');

      cy
        .get('.tooltip')
        .contains(model.id);

      cy
        .get('@button')
        .trigger('mouseout');
    });
  });

  specify('Delaying pointer hover but not touch or keyboard triggers', function() {
    const TriggerTestTooltip = Tooltip.extend({
      delay(event) {
        return event && event.type === 'pointerenter' ? 100 : 0;
      },
    });
    const TriggerTestView = View.extend({
      template: hbs`<button type="button">Show details</button>`,
      ui: {
        button: 'button',
      },
      onRender() {
        new TriggerTestTooltip({
          message: 'More information',
          uiView: this,
          ui: this.ui.button,
        });
      },
    });

    cy.clock();

    cy.mount(rootView => {
      Tooltip.setRegion(rootView.getRegion('tooltip'));
      return new TriggerTestView();
    });

    cy
      .contains('button', 'Show details')
      .as('trigger')
      .trigger('pointerover');

    cy.get('.tooltip').should('not.exist');
    cy.tick(99);
    cy.get('.tooltip').should('not.exist');
    cy.tick(1);
    cy.get('.tooltip').should('contain', 'More information');

    cy
      .get('@trigger')
      .trigger('mouseout')
      .trigger('pointerdown', { pointerType: 'touch' });

    cy.tick(0);
    cy.get('.tooltip').should('contain', 'More information');

    cy
      .get('@trigger')
      .trigger('mouseout')
      .focus();

    cy.tick(0);
    cy.get('.tooltip').should('contain', 'More information');
  });

  specify('Dismissing with Escape without moving focus', function() {
    cy.mount(rootView => {
      Tooltip.setRegion(rootView.getRegion('tooltip'));
      return new ButtonView({ model: testCollection.first() });
    });

    cy
      .contains('button', 'Top Left')
      .focus()
      .should('be.focused');

    cy
      .get('.tooltip')
      .should('contain', 'Top Left');

    cy
      .contains('button', 'Top Left')
      .type('{esc}')
      .should('be.focused');

    cy.get('.tooltip').should('not.exist');
  });

  specify('Manual trigger', function() {
    const ManualTestView = View.extend({
      tagName: 'button',
      attributes: {
        style: 'margin: 20px;',
      },
      className: 'button button--primary',
      template: hbs`Click Me`,
      triggers: {
        'click': 'click',
      },
      onRender() {
        this.tooltip = new Tooltip({
          messageHtml: '<strong>Clicked</strong> it',
          uiView: this,
          ignoreEl: this.el,
        });
      },
      onClick() {
        if (this.tooltip.getView()) {
          this.tooltip.hideTooltip();
          return;
        }
        this.tooltip.showTooltip();
      },
    });

    cy
      .mount(rootView => {
        Tooltip.setRegion(rootView.getRegion('tooltip'));
        return new ManualTestView();
      })
      .as('root');

    cy
      .get('@root')
      .contains('Click Me')
      .click();

    cy
      .get('.tooltip')
      .contains('Clicked it');

    cy
      .get('@root')
      .contains('Click Me')
      .click();

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Click Me')
      .click();

    cy
      .get('.tooltip')
      .contains('Clicked it');

    cy
      .get('@root')
      .click('center');

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Click Me')
      .click();

    cy
      .get('.tooltip')
      .contains('Clicked it');

    cy
      .viewport(1234, 567);

    cy
      .get('.tooltip')
      .should('not.exist');
  });
});
