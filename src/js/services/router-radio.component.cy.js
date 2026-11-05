import { Radio } from 'marionette';

import router from 'js/router';

import RouterRadioService from './router-radio';

context('RouterRadioService', function() {
  let service;

  beforeEach(function() {
    Radio.reply('workspace', 'current', () => ({ get: () => 'two' }));
    service = new RouterRadioService();
  });

  afterEach(function() {
    service.destroy();
    Radio.reset();
  });

  specify('keeps workspace navigation available after a root error route', function() {
    const finished = Promise.resolve(true);
    const navigate = cy.stub(router, 'navigate').returns({ finished });

    Radio.trigger('event-router', 'schedule');

    expect(navigate).to.have.been.calledOnceWithExactly('schedule', { workspace: 'two' }, {
      focusReset: 'manual', scroll: 'manual', info: { entryTarget: undefined, status: undefined },
    });

    Radio.request('router', 'navigate', 'schedule', { workspace: 'one' });
    expect(navigate.secondCall.args[1]).to.deep.equal({ workspace: 'one' });
  });
});
