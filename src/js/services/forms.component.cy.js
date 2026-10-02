import Backbone from 'backbone';
import { Radio } from 'marionette';

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

  specify('releases its replies while preserving other channel owners', function() {
    formService = new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    });

    const channel = formService.getChannel();
    const refresh = cy.spy(formService, 'refreshForm');
    const viewport = {};
    const interact = cy.stub().returns('interacted');
    channel.reply('form:interact', interact, viewport);

    formService.destroy();
    formService = null;

    expect(channel.request('form:interact')).to.equal('interacted');
    channel.request('ready:form');
    expect(refresh).not.to.have.been.called;
  });
});
