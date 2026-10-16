import { map } from 'underscore';

import { getCurrentClinician } from 'support/api/clinicians';

function setOsTheme(value) {
  return cy.then(() => Cypress.automation('remote:debugger:protocol', {
    command: 'Emulation.setEmulatedMedia',
    params: { features: [{ name: 'prefers-color-scheme', value }] },
  }));
}

function assertTheme(isOsDark) {
  cy
    .document()
    .should(doc => {
      const style = doc.defaultView.getComputedStyle(doc.documentElement);
      const background = style.backgroundColor.match(/\d+/g).map(Number);
      expect(background[0] < 128, 'canvas stays dark regardless of the OS theme').to.equal(true);
      expect(doc.defaultView.matchMedia('(prefers-color-scheme: dark)').matches).to.equal(isOsDark);
      expect(style.colorScheme, 'native controls stay dark').to.equal('dark');
    });
}

function luminance(color) {
  const [red, green, blue] = map(color.match(/\d+/g), channel => {
    const value = Number(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function assertHeaderContrast(selector) {
  cy
    .get(selector)
    .then($header => {
      const header = $header[0];
      // Flush the OS change and wait for the header's color transition to settle.
      header.ownerDocument.defaultView.getComputedStyle(header).getPropertyValue('background-color');
      return Cypress.Promise.all(map(header.getAnimations(), animation => animation.finished));
    });

  cy
    .get(selector)
    .should($header => {
      const win = $header[0].ownerDocument.defaultView;
      const background = luminance(win.getComputedStyle($header[0]).backgroundColor);

      for (const element of [$header[0], ...$header.find('.icon')]) {
        const foreground = luminance(win.getComputedStyle(element).color);
        const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        expect(ratio, `${ selector } text/icon contrast`).to.be.at.least(4.5);
      }
    });
}

function checkDialerThemes(dialer) {
  cy
    .routesForDefault()
    .routeCurrentClinician(fx => {
      fx.data = getCurrentClinician({ attributes: { settings: { dialer } } });
      return fx;
    })
    .visit();

  setOsTheme('light');
  assertTheme(false);
  assertHeaderContrast(`.${ dialer }-panel__header`);
  setOsTheme('dark');
  assertTheme(true);
  assertHeaderContrast(`.${ dialer }-panel__header`);
}

// Cypress exposes OS media emulation through CDP only in Chromium browsers.
context('Forced dark color scheme', { browser: { family: 'chromium' } }, function() {
  afterEach(function() {
    setOsTheme('light');
  });

  specify('paints dark before configuration and stays dark through live OS changes', function() {
    setOsTheme('light');

    // This test-only route returns before config/auth; the startup shell is real HTML.
    cy.visit('/logout', { isRoot: true, noWait: true });

    cy
      .get('.startup-shell__logo')
      .should('be.visible');

    assertTheme(false);
    setOsTheme('dark');
    assertTheme(true);

    cy
      .routesForDefault()
      .visit();

    cy
      .get('.app-nav')
      .should('be.visible');

    assertTheme(true);

    cy
      .get('.js-patient')
      .first()
      .as('patient');

    setOsTheme('light');
    assertTheme(false);

    cy
      .get('@patient')
      .should('be.visible');

    setOsTheme('dark');
    assertTheme(true);

    cy
      .get('@patient')
      .should('be.visible');

    cy
      .routeClinicians()
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('.js-add-clinician')
      .click();

    cy
      .get('.modal [data-name-region] .js-input')
      .as('name')
      .type('Morgan Example');

    for (const [width, height] of [[1440, 960], [390, 844]]) {
      cy.viewport(width, height);

      setOsTheme('light');
      assertTheme(false);

      cy
        .get('@name')
        .should('have.value', 'Morgan Example')
        .and('be.focused');

      setOsTheme('dark');
      assertTheme(true);

      cy
        .get('@name')
        .should('have.value', 'Morgan Example')
        .and('be.focused');
    }
  });

  specify('five9 header text and icons stay readable in both OS themes', function() {
    checkDialerThemes('five9');
  });

  specify('ringcentral header text and icons stay readable in both OS themes', function() {
    checkDialerThemes('ringcentral');
  });
});
