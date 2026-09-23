import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import InputWatcherBehavior from './input-watcher';

context('InputWatcherBehavior', function() {
  specify('uses the host view input binding', function() {
    const onChange = cy.stub();

    cy.mount(() => {
      const view = new View({
        behaviors: [InputWatcherBehavior],
        template: hbs`<textarea class="js-input">Initial</textarea>`,
        ui: {
          input: '.js-input',
        },
      });

      view.on('watch:change', onChange);

      return view;
    });

    cy.get('.js-input')
      .type(' value')
      .then(() => expect(onChange).to.be.calledWith('Initial value'));
  });

  specify('allows a host without an input binding match', function() {
    cy.mount(() => new View({
      behaviors: [InputWatcherBehavior],
      template: hbs`<div>No input</div>`,
    }));

    cy.contains('No input');
  });
});
