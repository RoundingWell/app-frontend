import Backbone from 'backbone';
import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import FormsService from './forms';

context('Forms Service', function() {
  let scope;

  beforeEach(function() {
    scope = testScope();
    scope.reply(Radio, 'bootstrap', 'currentUser', new Backbone.Model({ id: 'current-user' }));
  });

  specify('uses the form id channel', function() {
    const formService = scope.own(new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    }));

    expect(formService.channelName()).to.equal('form1');
  });

  specify('releases its replies while preserving other channel owners', function() {
    const formService = scope.own(new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    }));

    const channel = formService.getChannel();
    const refresh = cy.spy(formService, 'refreshForm');
    const viewport = {};
    const interact = cy.stub().returns('interacted');
    scope.reply(channel, 'form:interact', interact, viewport);

    formService.destroy();

    expect(channel.request('form:interact')).to.equal('interacted');
    channel.request('ready:form');
    expect(refresh).not.to.have.been.called;
  });
});
