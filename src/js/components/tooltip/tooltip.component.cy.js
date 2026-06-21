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
    template: hbs`<button class="button--blue" style="position:absolute; width:10%; height:10%; {{ style }}">{{ id }}</button>`,
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

  specify('Manual trigger', function() {
    const ManualTestView = View.extend({
      tagName: 'button',
      attributes: {
        style: 'margin: 20px;',
      },
      className: 'button--blue',
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
