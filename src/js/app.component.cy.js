import { Radio } from 'marionette';

import { Application } from './app';

const ListenerApplication = Application.extend({ childApps: {}, channelName: 'listener-test' });

context('Application listener ownership', function() {
  specify('replaces activity listeners and releases them on destruction', async function() {
    const app = new ListenerApplication();
    const resized = cy.stub();
    Radio.channel('user-activity').on('window:resize', resized);

    try {
      app.setListeners();
      app.setListeners();
      window.dispatchEvent(new Event('resize'));
      expect(resized).to.have.been.calledOnce;
      await app.destroy();
      window.dispatchEvent(new Event('resize'));
      expect(resized).to.have.been.calledOnce;
    } finally {
      Radio.channel('user-activity').off('window:resize', resized);
      await app.destroy();
    }
  });
});
