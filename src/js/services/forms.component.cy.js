import Backbone from 'backbone';
import { Radio } from 'marionette';
import { createTestScope } from '@mnjs/test';

import FormsService from './forms';

context('Forms Service', function() {
  let scope;

  beforeEach(function() {
    scope = createTestScope();
    Radio.reply('bootstrap', 'currentUser', new Backbone.Model({ id: 'current-user' }), scope);
    scope.defer(() => Radio.channel('bootstrap').stopReplying('currentUser', null, scope));
  });

  afterEach(function() {
    return scope.cleanup();
  });

  specify('uses the form id channel', function() {
    const formService = new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    });
    scope.defer(() => formService.destroy());

    expect(formService.channelName()).to.equal('form1');
  });

  specify('releases its replies while preserving other channel owners', function() {
    const formService = new FormsService({
      form: new Backbone.Model({ id: '1' }),
      patient: new Backbone.Model({ id: 'patient-1' }),
    });
    scope.defer(() => formService.destroy());

    const channel = formService.getChannel();
    const refresh = cy.spy(formService, 'refreshForm');
    const viewport = {};
    const interact = cy.stub().returns('interacted');
    channel.reply('form:interact', interact, viewport);
    scope.defer(() => channel.stopReplying('form:interact', interact, viewport));

    formService.destroy();

    expect(channel.request('form:interact')).to.equal('interacted');
    channel.request('ready:form');
    expect(refresh).not.to.have.been.called;
  });
});
