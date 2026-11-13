import trackNativeViews from './native-view-tracking';

context('native RUM view tracking', function() {
  specify('tracks each committed page change without duplicating refresh, query or fragment updates', function() {
    const navigation = new EventTarget();
    navigation.currentEntry = {
      url: 'https://app.test/one/worklist/owned-by',
    };
    const startView = cy.stub();
    const stop = trackNativeViews(navigation, startView);
    const commit = (path, navigationType) => {
      const from = navigation.currentEntry;
      navigation.currentEntry = {
        url: new URL(path, from.url).href,
      };
      const event = new Event('currententrychange');
      Object.assign(event, {
        from,
        navigationType,
      });
      navigation.dispatchEvent(event);
    };

    expect(startView, 'starts the initial page view before any navigation').to.have.been.calledOnce;

    commit('/one/schedule', 'push');
    expect(startView).to.have.been.calledTwice;

    commit('/one/programs', 'replace');
    expect(startView).to.have.been.calledThrice;

    commit('/one/worklist/owned-by', 'traverse');
    expect(startView).to.have.callCount(4);

    commit('/one/worklist/owned-by', 'reload');
    commit('?filter=mine', 'push');
    commit('#content', 'replace');
    expect(startView, 'same-page changes keep the current view').to.have.callCount(4);

    window.dispatchEvent(new PageTransitionEvent('pageshow', {
      persisted: false,
    }));
    expect(startView, 'ordinary pageshow does not duplicate the initial view').to.have.callCount(4);

    window.dispatchEvent(new PageTransitionEvent('pageshow', {
      persisted: true,
    }));
    expect(startView, 'restoring the cached document starts one new view').to.have.callCount(5);

    stop();
    commit('/one/schedule', 'push');
    window.dispatchEvent(new PageTransitionEvent('pageshow', {
      persisted: true,
    }));
    expect(startView, 'stopped tracking removes both listeners').to.have.callCount(5);
  });
});
