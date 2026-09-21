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
        anchor: this.ui.button,
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
        if (this.tooltip.isShown()) {
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

  specify('Retains anchor listeners when tooltips replace each other', function() {
    const SwapTestView = View.extend({
      template: hbs`<button class="first">First</button><button class="second">Second</button>`,
      ui: {
        first: '.first',
        second: '.second',
      },
      onRender() {
        new Tooltip({
          message: 'First tooltip',
          uiView: this,
          anchor: this.ui.first,
        });

        new Tooltip({
          message: 'Second tooltip',
          uiView: this,
          anchor: this.ui.second,
        });
      },
    });

    cy.mount(rootView => {
      Tooltip.setRegion(rootView.getRegion('tooltip'));
      return new SwapTestView();
    });

    cy.get('.first').trigger('pointerover');
    cy.get('.tooltip').contains('First tooltip');

    cy.get('.second').trigger('pointerover');
    cy.get('.tooltip').contains('Second tooltip');

    cy.get('.first').trigger('pointerover');
    cy.get('.tooltip').contains('First tooltip');
  });

  specify('Retains the delay across pointer transitions within a raw anchor', function() {
    const RawAnchorView = View.extend({
      template: hbs`<button class="raw-anchor">Raw anchor <span class="icon">Icon</span></button>`,
      onRender() {
        new Tooltip({
          anchor: this.el.querySelector('.raw-anchor'),
          delay: 200,
          message: 'Raw anchor tooltip',
          shouldDelay: true,
          uiView: this,
        });
      },
    });

    cy.mount(rootView => {
      Tooltip.setRegion(rootView.getRegion('tooltip'));
      return new RawAnchorView();
    });
    cy.clock();

    cy.get('.raw-anchor').then(([anchor]) => {
      const { PointerEvent } = anchor.ownerDocument.defaultView;

      anchor.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      cy.tick(150);

      anchor.querySelector('.icon').dispatchEvent(new PointerEvent('pointerover', {
        bubbles: true,
        relatedTarget: anchor,
      }));
      cy.tick(50);
    });

    cy.get('.tooltip').contains('Raw anchor tooltip');
  });
});
