import { Radio, View } from 'marionette';
import { createTestScope } from '@mnjs/test';
import { unmount } from '@mnjs/test/cypress';

context('Component app shell', function() {
  let scope;

  beforeEach(function() {
    scope = createTestScope();
  });

  afterEach(function() {
    return scope.cleanup();
  });

  specify('preserves the shell callback, popup routing and root subject', function() {
    let rootView;
    let content;
    let popup;

    cy
      .mount(root => {
        rootView = root;
        content = new View({ template: () => 'Content' });
        return content;
      })
      .then($root => {
        expect($root).to.have.property('jquery');
        expect($root[0]).to.equal(rootView.el);
        expect($root.attr('id')).to.equal('root');
        expect(rootView.appView.getChildView('region')).to.equal(content);

        popup = new View({ template: () => 'Popup' });
        Radio.request('app', 'show:pop', popup, {});

        expect(rootView.getRegion('pop').currentView).to.equal(popup);
        expect($root[0].contains(popup.el)).to.be.true;
      });

    unmount().then(() => {
      expect(rootView.isDestroyed()).to.be.true;
      expect(content.isDestroyed()).to.be.true;
      expect(popup.isDestroyed()).to.be.true;
      const unusedPopup = new View({ template: false });
      scope.defer(() => unusedPopup.destroy());
      expect(Radio.request('app', 'show:pop', unusedPopup, {})).to.equal(undefined);
    });

    cy
      .get('[data-cy-root]')
      .should('be.empty');
  });

  specify('replaces views and user-activity listeners between mounts', function() {
    let previousRoot;
    let previousView;
    const onResize = cy.stub();
    const channel = Radio.channel('user-activity');
    channel.on('window:resize', onResize);
    scope.defer(() => channel.off('window:resize', onResize));

    cy.mount(root => {
      previousRoot = root;
      previousView = new View({ template: false });
      return previousView;
    });

    cy.window().then(win => {
      const before = onResize.callCount;
      win.dispatchEvent(new win.Event('resize'));
      expect(onResize.callCount - before).to.equal(1);
    });

    cy
      .mount()
      .then($root => {
        expect(previousRoot.isDestroyed()).to.be.true;
        expect(previousView.isDestroyed()).to.be.true;
        expect($root[0]).not.to.equal(previousRoot.el);
      });

    cy.window().then(win => {
      const before = onResize.callCount;
      win.dispatchEvent(new win.Event('resize'));
      expect(onResize.callCount - before).to.equal(1);
    });

    unmount();

    cy.window().then(win => {
      const before = onResize.callCount;
      win.dispatchEvent(new win.Event('resize'));
      expect(onResize.callCount - before).to.equal(0);
    });
  });
});
