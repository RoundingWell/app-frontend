import { fxCurrentClinician } from 'support/api/clinicians';

const navMinimizedKey = `isNavMenuMinimized_${ fxCurrentClinician.id }`;

function pointer(type, clientX = 25, options = {}) {
  cy
    .get('.app-nav')
    .trigger(type, {
      eventConstructor: 'PointerEvent',
      pointerType: 'mouse',
      clientX,
      clientY: 140,
      ...options,
    });
}

function expectOverlay(visible) {
  cy
    .get('.app-nav')
    .should(visible ? 'have.class' : 'not.have.class', 'is-full-nav-visible');
}

function expectSettled() {
  cy
    .get('.app-nav')
    .should('not.have.class', 'is-hover-motion')
    .should('have.prop', 'style')
    .its('width')
    .should('equal', '');
}

context('Collapsed navigation hover', function() {
  beforeEach(function() {
    localStorage.setItem(navMinimizedKey, true);

    cy
      .routesForDefault()
      .routePrograms()
      .visit({
        onBeforeLoad(win) {
          const matchMedia = win.matchMedia.bind(win);
          cy.stub(win, 'matchMedia').callsFake(query => {
            if (query === '(hover: hover) and (pointer: fine)') return { matches: true };
            return matchMedia(query);
          });
        },
      });

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');
  });

  specify('rejects rapid crossings, ignores child crossings and stays open at a stationary edge', function() {
    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);

    pointer('pointerover');
    cy.tick(40);
    pointer('pointerout', 250);
    cy.tick(300);
    expectOverlay(false);

    pointer('pointerover');
    cy.tick(50);
    expectOverlay(false);

    cy
      .get('.app-nav__link')
      .first()
      .then($link => {
        const nav = $link[0].closest('.app-nav');
        const PointerEvent = nav.ownerDocument.defaultView.PointerEvent;
        $link[0].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', relatedTarget: nav, clientX: 25 }));
        $link[0].dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: nav, clientX: 25 }));
      });

    cy.tick(10);
    expectOverlay(true);
    expectSettled();

    pointer('pointerout', 250);
    expectOverlay(false);
    expectSettled();

    // The rail is 61px; x=49 is exactly 12px inside its edge.
    pointer('pointerover', 49);
    cy.tick(200);
    expectOverlay(false);
    cy.tick(10);
    expectOverlay(true);
    expectSettled();
    cy.tick(1000);
    expectOverlay(true);
    expectSettled();

    cy
      .window()
      .then(win => {
        expect(JSON.parse(win.localStorage.getItem(navMinimizedKey))).to.be.true;
      });
  });

  specify('measures horizontal speed from entry and speeds entry after moving away from the edge', function() {
    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);

    pointer('pointerover', 55);
    cy.tick(50);
    pointer('pointermove', 25);
    cy.tick(70);
    // 30px / 120ms is exactly 0.25px/ms, so it must still wait.
    expectOverlay(false);
    cy.tick(10);
    expectOverlay(true);
    expectSettled();

    pointer('pointerout', 250);
    expectSettled();
    pointer('pointerover', 55);
    cy.tick(150);
    expectOverlay(false);
    pointer('pointermove', 25);
    cy.tick(10);
    expectOverlay(true);
  });

  specify('clicks during the intent delay navigate without revealing or leaving a timer', function() {
    const classHistory = [];
    let observer;

    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);

    cy
      .get('.app-nav')
      .then($nav => {
        const win = $nav[0].ownerDocument.defaultView;
        observer = new win.MutationObserver(records => {
          records.forEach(record => classHistory.push(record.oldValue));
        });
        observer.observe($nav[0], { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
      });

    pointer('pointerover');
    cy.tick(20);

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .click();

    cy
      .url()
      .should('contain', '/schedule');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .first()
      .click();

    cy
      .url()
      .should('contain', '/worklist/owned-by');

    cy.tick(1000);
    expectOverlay(false);
    expectSettled();

    cy.then(() => {
      observer.disconnect();
      expect(classHistory.join(' ')).not.to.contain('is-full-nav-visible');
    });

    // Navigation suppresses reopening until the pointer leaves and reenters.
    pointer('pointermove');
    cy.tick(300);
    expectOverlay(false);
    pointer('pointerout', 250);
    pointer('pointerover');
    cy.tick(60);
    expectOverlay(true);
  });

  specify('reverses motion, preserves content layout and traverses the admin droplist', function() {
    let contentBounds;

    cy
      .get('.app-frame__content')
      .then($content => {
        const { left, width } = $content[0].getBoundingClientRect();
        contentBounds = { left, width };
      });

    pointer('pointerover');
    expectOverlay(true);
    pointer('pointerout', 250);
    expectOverlay(false);
    pointer('pointerover');
    expectOverlay(true);
    expectSettled();

    cy
      .get('.app-frame__content')
      .then($content => {
        const { left, width } = $content[0].getBoundingClientRect();
        expect({ left, width }).to.deep.equal(contentBounds);
      });

    cy
      .get('.app-nav__bottom')
      .contains('button', 'Admin Tools')
      .click();

    pointer('pointerout', 250);
    expectOverlay(true);

    cy
      .get('.picklist')
      .contains('.js-picklist-item', 'Programs')
      .should('be.visible')
      .click();

    cy
      .url()
      .should('contain', '/programs');

    expectOverlay(false);
    expectSettled();
  });

  specify('keeps a clicked closing label under the pointer until it navigates', function() {
    pointer('pointerover');
    expectOverlay(true);
    expectSettled();

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .then($button => {
        const button = $button[0];
        const doc = button.ownerDocument;
        const win = doc.defaultView;
        const nav = button.closest('.app-nav');
        const bounds = button.getBoundingClientRect();
        const x = bounds.left + 90;
        const y = bounds.top + bounds.height / 2;
        nav.dispatchEvent(new win.PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', clientX: 250 }));
        expect(nav.classList.contains('is-hover-motion')).to.be.true;
        expect(nav.classList.contains('is-full-nav-visible')).to.be.false;
        button.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', clientX: x, clientY: y }));
        expect(doc.elementFromPoint(x, y)?.closest('button')).to.equal(button);
        button.click();
      });

    cy
      .url()
      .should('contain', '/schedule');

    expectOverlay(false);
    expectSettled();
  });

  specify('opens immediately for keyboard focus and suppresses hover after Escape and explicit collapse', function() {
    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .focus();

    expectOverlay(true);
    expectSettled();

    cy
      .get('body')
      .type('{esc}');

    expectOverlay(false);
    pointer('pointerout', 250);
    pointer('pointerover');
    cy.tick(60);
    expectOverlay(true);
    expectSettled();

    cy
      .get('.js-minimize-menu')
      .click();

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-minimized');

    cy
      .get('.js-minimize-menu')
      .click();

    expectOverlay(false);
    pointer('pointermove');
    cy.tick(1000);
    expectOverlay(false);

    cy
      .window()
      .then(win => {
        expect(JSON.parse(win.localStorage.getItem(navMinimizedKey))).to.be.true;
      });
  });

  specify('uses no hover motion for reduced motion and never previews a touch pointer', function() {
    cy
      .window()
      .then(win => {
        const matchMedia = win.matchMedia.wrappedMethod.bind(win);
        win.matchMedia.callsFake(query => {
          if (query === '(prefers-reduced-motion: reduce)' || query === '(hover: hover) and (pointer: fine)') return { matches: true };
          return matchMedia(query);
        });
      });

    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);

    pointer('pointerover', 25, { pointerType: 'touch' });
    cy.tick(300);
    expectOverlay(false);
    pointer('pointerdown', 25, { pointerType: 'touch' });
    pointer('pointerout', 250, { pointerType: 'touch' });
    pointer('pointerover');
    cy.tick(60);

    cy
      .get('.app-nav')
      .then($nav => {
        expect($nav).to.have.class('is-full-nav-visible');
        expect($nav).not.to.have.class('is-hover-motion');
      });

    pointer('pointerout', 250);
    expectOverlay(false);
    expectSettled();
  });
});
