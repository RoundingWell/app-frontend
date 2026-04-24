import Backbone from 'backbone';
import Radio from 'backbone.radio';

import FormsService from './forms';

context('Forms Service', function() {
  let formService;

  beforeEach(function() {
    Radio.reply('bootstrap', 'currentUser', new Backbone.Model({ id: 'current-user' }));
  });

  afterEach(function() {
    if (formService && !formService.isDestroyed()) formService.destroy();
    Radio.reset();
    Radio.channel('bootstrap').reset();
  });

  specify('uses the form id channel', function() {
    formService = new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    });

    expect(formService.channelName()).to.equal('form1');
  });

  specify('resets its channel when destroyed', function() {
    formService = new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    });

    const channel = formService.getChannel();
    cy.spy(channel, 'reset').as('reset');

    cy.then(() => {
      formService.destroy();
      formService = null;
    });

    cy.get('@reset').should('have.been.calledOnce');
  });
});
