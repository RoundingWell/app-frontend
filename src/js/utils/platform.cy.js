import initPlatform from './platform';

context('platform', function() {
  specify('initPlatform', function() {
    cy
      .mount()
      .then(() => {
        initPlatform();

        const docEl = document.documentElement;
        const docUa = docEl.getAttribute('data-useragent');
        const docPlat = docEl.getAttribute('data-platform');

        expect(docUa, 'user-agent').to.equal(navigator.userAgent);
        expect(docPlat, 'platform').to.equal(navigator.platform);
      });
  });
});
