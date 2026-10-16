function setOsTheme(value) {
  return cy.then(() => Cypress.automation('remote:debugger:protocol', {
    command: 'Emulation.setEmulatedMedia',
    params: { features: [{ name: 'prefers-color-scheme', value }] },
  }));
}

function assertTheme(isDark) {
  cy
    .document()
    .should(doc => {
      const style = doc.defaultView.getComputedStyle(doc.documentElement);
      const background = style.backgroundColor.match(/\d+/g).map(Number);
      expect(background[0] < 128, 'canvas follows the OS theme').to.equal(isDark);
      expect(doc.defaultView.matchMedia('(prefers-color-scheme: dark)').matches).to.equal(isDark);
      expect(style.colorScheme, 'native controls support both themes').to.equal('light dark');
    });
}

// Cypress exposes OS media emulation through CDP only in Chromium browsers.
context('OS color scheme', { browser: { family: 'chromium' } }, function() {
  afterEach(function() {
    setOsTheme('light');
  });

  specify('paints before configuration and follows live OS changes without reloading', function() {
    setOsTheme('dark');

    // This test-only route returns before config/auth; the startup shell is real HTML.
    cy.visit('/logout', { isRoot: true, noWait: true });

    cy
      .get('.startup-shell__logo')
      .should('be.visible');

    assertTheme(true);
    setOsTheme('light');
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
});
