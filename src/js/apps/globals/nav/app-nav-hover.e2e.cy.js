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
    cy.tick(119);
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
      .location('pathname')
      .should('equal', '/one/schedule');

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
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');

    cy.tick(1000);
    expectOverlay(false);
    expectSettled();

    cy.then(() => {
      observer.disconnect();
      expect(classHistory.join(' ')).not.to.contain('is-full-nav-visible');
    });

    // A revealed mouse preview survives navigation until the pointer exits.
    pointer('pointerout', 250);
    pointer('pointerover');
    cy.tick(120);
    expectOverlay(true);

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .click();

    cy
      .location('pathname')
      .should('equal', '/one/schedule');

    expectOverlay(true);
    pointer('pointerout', 250);
    expectOverlay(false);
    pointer('pointerover');
    cy.tick(120);
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
      .location('pathname')
      .should('equal', '/one/programs');

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
      .location('pathname')
      .should('equal', '/one/schedule');

    expectOverlay(true);
    pointer('pointerout', 250);
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
    cy.tick(120);
    expectOverlay(true);
    expectSettled();

    cy
      .get('.js-minimize-menu')
      .click();

    cy
      .get('.app-nav')
      .should('not.have.class', 'app-nav--minimized');

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
    cy.tick(120);

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
    cy.tick(120);

    cy
      .get('.js-minimize-menu')
      .then($button => inspect($button[0]));

    expectSettled();

    cy
      .get('.js-minimize-menu')
      .click()
      .then($button => inspect($button[0], true));

    pointer('pointerout', 250);
    pointer('pointerover');
    cy.tick(120);
    expectOverlay(true);
    expectSettled();

    cy
      .get('.js-minimize-menu')
      .then($button => inspect($button[0], true));

    cy.viewport(900, 768);

    cy
      .get('.app-nav')
      .should('have.class', 'is-narrow')
      .should('have.class', 'app-nav--minimized')
      .should('not.have.class', 'is-full-nav-visible');

    cy.viewport(1280, 768);
    expectOverlay(true);

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
    cy.tick(60);

    cy
      .get('.app-frame__content')
      .trigger('pointerdown', { eventConstructor: 'PointerEvent', pointerType: 'touch' });

    cy.tick(300);
    expectOverlay(false);
    pointer('pointerout', 250);
    pointer('pointerover');
    cy.tick(120);

    cy
      .get('.app-nav')
      .then($nav => {
        expect($nav).to.have.class('is-full-nav-visible');
        expect($nav).not.to.have.class('is-hover-motion');
      });

    cy
      .get('.app-nav__announcement')
      .should('have.css', 'opacity', '1');

    // A touch taking over an existing mouse preview dismisses on selection.
    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .trigger('pointerdown', { eventConstructor: 'PointerEvent', pointerType: 'touch' })
      .then($button => $button[0].click());

    cy
      .location('pathname')
      .should('equal', '/one/schedule');

    expectOverlay(false);

    pointer('pointerout', 250);
    expectOverlay(false);
    expectSettled();

    pointer('pointerover');
    cy.tick(120);
    expectOverlay(true);

    cy
      .get('.app-nav__bottom')
      .contains('button', 'Admin Tools')
      .click();

    cy
      .get('.picklist')
      .contains('.js-picklist-item', 'Programs')
      .trigger('pointerdown', { eventConstructor: 'PointerEvent', pointerType: 'touch' })
      .then($item => $item[0].click());

    cy
      .location('pathname')
      .should('equal', '/one/programs');

    expectOverlay(false);
  });

  specify('keeps hover ownership when returning from a picklist before dismissing it', function() {
    pointer('pointerover');
    expectOverlay(true);
    expectSettled();

    cy
      .get('.app-nav__bottom')
      .contains('button', 'Admin Tools')
      .click();

    cy
      .get('.picklist')
      .should('be.visible')
      .then($list => {
        pointer('pointerout', 250, { relatedTarget: $list[0] });
        pointer('pointerover', 25, { relatedTarget: $list[0] });
      });

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('.app-nav__header-details')
      .should('be.visible');

    cy
      .get('.app-nav__bottom')
      .contains('button', 'Admin Tools')
      .click();

    cy
      .get('.picklist')
      .should('be.visible');

    cy
      .get('body')
      .type('{downarrow}{enter}');

    cy
      .location('pathname')
      .should('equal', '/one/programs');

    expectOverlay(false);
    pointer('pointerout', 250);
    expectOverlay(false);
  });

  specify('keeps hover ownership when keyboard focus leaves a nav under the pointer', function() {
    cy
      .get('.js-minimize-menu')
      .focus();

    expectOverlay(true);
    pointer('pointerover');

    cy
      .window()
      .then(win => win.focus());

    cy.press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should($focused => {
        expect($focused[0].closest('.app-nav')).to.be.null;
      });

    cy
      .get('.app-nav__header-details')
      .should('be.visible');

    pointer('pointerout', 250);
    expectOverlay(false);
  });

  specify('fades the announcement without moving lower rows on a short viewport', function() {
    let railWidth;
    let stopOpeningSamples;
    const openingOpacities = [];

    cy.viewport(1280, 600);

    cy
      .get('.app-nav')
      .then($nav => {
        const nav = $nav[0];
        const win = nav.ownerDocument.defaultView;
        const announcement = nav.querySelector('.app-nav__announcement');
        let sampling = true;
        railWidth = nav.getBoundingClientRect().width;
        stopOpeningSamples = () => {
          sampling = false;
        };

        const sample = () => {
          if (!sampling) return;

          if (announcement.getBoundingClientRect().height) {
            openingOpacities.push(parseFloat(win.getComputedStyle(announcement).opacity));
          }

          win.requestAnimationFrame(sample);
        };

        sample();
      });

    pointer('pointerover');
    expectOverlay(true);
    expectSettled();

    cy.then(() => {
      stopOpeningSamples();
      expect(openingOpacities.some(opacity => opacity > 0 && opacity < 1), 'card fades during opening').to.be.true;
    });

    cy
      .get('.app-nav__announcement')
      .should('be.visible');

    cy
      .get('.app-nav')
      .then($nav => {
        const nav = $nav[0];
        const win = nav.ownerDocument.defaultView;
        const announcement = nav.querySelector('.app-nav__announcement');
        const dashboards = nav.querySelector('[aria-label="Dashboards"]');
        const rowTop = dashboards.getBoundingClientRect().top;
        const frames = [];

        nav.dispatchEvent(new win.PointerEvent('pointerout', {
          bubbles: true,
          pointerType: 'mouse',
          relatedTarget: win.document.body,
          clientX: 250,
        }));

        expect(win.getComputedStyle(nav.querySelector('.app-nav__header-details')).display, 'workspace details hide when closing starts').to.equal('none');
        expect(win.getComputedStyle(nav.querySelector('.app-nav__header-logo--compact')).display, 'compact logo appears when closing starts').to.equal('block');
        expect(nav.querySelector('.app-nav__header').getBoundingClientRect().width, 'header hit area uses rail width during closing').to.equal(railWidth);

        return new Cypress.Promise(resolve => {
          const sample = () => {
            if (nav.getBoundingClientRect().width <= railWidth) {
              resolve(frames);
              return;
            }

            frames.push({
              announcementVisible: announcement.getBoundingClientRect().height > 0,
              opacity: parseFloat(win.getComputedStyle(announcement).opacity),
              rowTop: dashboards.getBoundingClientRect().top,
            });
            win.requestAnimationFrame(sample);
          };

          sample();
        }).then(samples => {
          expect(samples.length, 'visible closing frames sampled').to.be.greaterThan(0);
          expect(samples.some(frame => frame.opacity > 0 && frame.opacity < 1), 'card fades during closing').to.be.true;
          samples.forEach(frame => {
            expect(frame.announcementVisible, 'card remains rendered while the nav is wide').to.be.true;
            expect(frame.rowTop, 'lower rows stay in place while closing').to.equal(rowTop);
          });
        });
      });

    cy
      .get('.app-nav__announcement')
      .should('not.be.visible');
  });
});
