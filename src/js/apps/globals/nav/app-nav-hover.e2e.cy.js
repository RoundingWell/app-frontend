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

  specify('uses a cancellable opening delay without restarting on child crossings', function() {
    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);

    pointer('pointerover');
    cy.tick(100);
    pointer('pointerout', 250);
    cy.tick(500);
    expectOverlay(false);

    pointer('pointerover');
    cy.tick(149);
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

    cy.tick(1);
    expectOverlay(true);
    expectSettled();
    pointer('pointerout', 250);
    expectOverlay(false);
    expectSettled();

    cy
      .window()
      .then(win => {
        expect(JSON.parse(win.localStorage.getItem(navMinimizedKey))).to.be.true;
      });
  });

  specify('clicks during the opening delay navigate without revealing or leaving a timer', function() {
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
    cy.tick(75);

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
    pointer('pointerout', 250);
    pointer('pointerover');
    cy.tick(150);
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
    cy.tick(150);
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
    cy.tick(1000);
    expectOverlay(false);

    cy
      .window()
      .then(win => {
        expect(JSON.parse(win.localStorage.getItem(navMinimizedKey))).to.be.true;
      });
  });

  specify('keeps the pin affordance stable through hover motion and changes only when pinned', function() {
    let iconPosition;
    const inspect = (button, pinned = false) => {
      const win = button.ownerDocument.defaultView;
      const icons = [...button.querySelectorAll('.app-nav__minimize-icon')]
        .filter(icon => win.getComputedStyle(icon).display !== 'none');
      expect(icons, 'one stable action icon').to.have.length(1);
      const svg = icons[0].querySelector('svg');
      expect(svg.classList.contains(pinned ? 'fa-square-caret-left' : 'fa-square-caret-right'), `visible ${ svg.getAttribute('class') }; pinned=${ pinned }`).to.be.true;
      const { left, top } = svg.getBoundingClientRect();
      expect({ left, top }, 'icon remains in its grid cell').to.deep.equal(iconPosition);
      const label = pinned ? 'Minimize Menu' : 'Keep Menu Open';
      expect(button.getAttribute('aria-label')).to.equal(label);
      const labels = [...button.querySelectorAll('.app-nav__label')]
        .filter(element => win.getComputedStyle(element).display !== 'none');
      labels.forEach(element => expect(element.textContent).to.equal(label));
      expect(JSON.parse(win.localStorage.getItem(navMinimizedKey))).to.equal(!pinned);
    };

    cy
      .get('.js-minimize-menu')
      .find('.fa-square-caret-right')
      .then($icon => {
        const { left, top } = $icon[0].getBoundingClientRect();
        iconPosition = { left, top };
      });

    cy.clock(Date.now(), ['Date', 'setTimeout', 'clearTimeout']);
    pointer('pointerover');
    cy.tick(150);

    cy
      .get('.js-minimize-menu')
      .then($button => inspect($button[0]));

    pointer('pointerout', 250);

    cy
      .get('.js-minimize-menu')
      .then($button => {
        expect($button[0].closest('.app-nav')).to.have.class('is-hover-motion');
        inspect($button[0]);
      });

    pointer('pointerover');
    cy.tick(150);

    cy
      .get('.js-minimize-menu')
      .then($button => inspect($button[0]));

    expectSettled();

    cy
      .get('.js-minimize-menu')
      .click()
      .then($button => inspect($button[0], true));

    cy
      .get('.js-minimize-menu')
      .click()
      .blur()
      .focus()
      .then($button => inspect($button[0]));

    cy
      .window()
      .then(win => win.focus());

    cy.press(Cypress.Keyboard.Keys.SPACE);

    cy
      .get('.js-minimize-menu')
      .should('have.attr', 'aria-label', 'Minimize Menu');

    cy
      .get('.js-minimize-menu')
      .then($button => inspect($button[0], true));
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
    cy.tick(150);

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
