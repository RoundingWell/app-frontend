import { fxCurrentClinician } from 'support/api/clinicians';

const minimizedKey = `isNavMenuMinimized_${ fxCurrentClinician.id }`;

function mouse(x, y, type = 'mouseMoved') {
  cy
    .window()
    .then(win => {
      const frame = cy.state('$autIframe')[0].getBoundingClientRect();
      const scale = frame.width / win.innerWidth;
      return Cypress.automation('remote:debugger:protocol', {
        command: 'Input.dispatchMouseEvent',
        params: { type, x: frame.left + x * scale, y: frame.top + y * scale, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 },
      });
    });
}

function keyboard(key, code, windowsVirtualKeyCode, modifiers = 0) {
  cy
    .then(async() => {
      for (const type of ['keyDown', 'keyUp']) {
        await Cypress.automation('remote:debugger:protocol', { command: 'Input.dispatchKeyEvent', params: { type, key, code, windowsVirtualKeyCode, modifiers } });
      }
    });
}

function switchTabs() {
  cy
    .window()
    .then({ timeout: 10000 }, async win => {
      const target = win.document.activeElement;
      const events = [];
      const observe = type => {
        let cancel;
        const promise = new Cypress.Promise(resolve => {
          const finish = received => {
            clearTimeout(timeout);
            win.removeEventListener(type, handler, true);
            resolve(received);
          };
          const handler = evt => {
            if (evt.target !== target) return;
            events.push({ type, trusted: evt.isTrusted, retained: win.document.activeElement === target });
            finish(true);
          };
          const timeout = setTimeout(() => finish(false), 5000);
          cancel = () => finish(false);
          win.addEventListener(type, handler, true);
        });
        return { promise, cancel: () => cancel() };
      };
      const current = await Cypress.automation('remote:debugger:protocol', { command: 'Target.getTargetInfo', params: {} });
      const lost = observe('focusout');
      const restored = observe('focusin');
      let other;
      try {
        other = await Cypress.automation('remote:debugger:protocol', { command: 'Target.createTarget', params: { url: 'about:blank' } });
        await Cypress.automation('remote:debugger:protocol', { command: 'Target.activateTarget', params: { targetId: other.targetId } });
        expect(await lost.promise, 'native focusout received').to.be.true;
        await Cypress.automation('remote:debugger:protocol', { command: 'Target.activateTarget', params: { targetId: current.targetInfo.targetId } });
        expect(await restored.promise, 'native focusin received').to.be.true;
        expect(events.every(evt => evt.trusted && evt.retained), 'browser restores the retained focus target').to.be.true;
      } finally {
        lost.cancel();
        restored.cancel();
        try {
          await Cypress.automation('remote:debugger:protocol', { command: 'Target.activateTarget', params: { targetId: current.targetInfo.targetId } });
        } finally {
          if (other) await Cypress.automation('remote:debugger:protocol', { command: 'Target.closeTarget', params: { targetId: other.targetId } });
        }
      }
    });
}

context('Navigation browser focus restoration', function() {
  before(function() {
    // Native tab activation requires Chromium's debugger protocol. DOM blur/focus
    // moves activeElement and cannot reproduce retained browser focus.
    if (!Cypress.isBrowser(['chrome', 'chromium', 'edge'])) this.skip();
  });

  beforeEach(function() {
    localStorage.clear();
    localStorage.setItem(minimizedKey, true);
    cy
      .routeActions(() => ({ data: [], included: [] }))
      .routePrograms()
      .visit({ noWait: true });
    cy
      .get('[data-worklists-region] .app-nav__link')
      .first()
      .should('have.class', 'is-selected');
    cy
      .get('.worklist-list-page')
      .should('be.visible');
  });

  specify('keeps a pointer-selected rail closed on repeated tab return and accepts fresh focus', function() {
    cy
      .get('[data-worklists-region] .app-nav__link')
      .eq(1)
      .then($button => {
        const bounds = $button[0].getBoundingClientRect();
        mouse(25, bounds.top + bounds.height / 2, 'mousePressed');
        mouse(25, bounds.top + bounds.height / 2, 'mouseReleased');
      });
    cy
      .location('pathname')
      .should('equal', '/one/schedule');
    mouse(500, 400);
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');
    keyboard('Control', 'ControlLeft', 17);
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');
    switchTabs();
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');
    switchTabs();
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');
    cy
      .get('[data-worklists-region] .app-nav__link')
      .eq(1)
      .blur()
      .focus();
    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');
  });

  specify('preserves keyboard ownership, Escape dismissal and Tab re-entry across tab switches', function() {
    cy
      .get('.js-minimize-menu')
      .focus();
    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');
    switchTabs();
    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');
    cy
      .get('body')
      .type('{esc}');
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');
    switchTabs();
    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');
    cy
      .window()
      .then(win => win
        .focus());
    cy
      .press(Cypress.Keyboard.Keys.TAB);
    cy
      .focused()
      .should($target => expect($target[0].closest('.app-nav')).to.be.null);
    keyboard('Tab', 'Tab', 9, 8);
    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');
    cy
      .focused()
      .should('have.class', 'js-minimize-menu');
    cy
      .press(Cypress.Keyboard.Keys.SPACE);
    cy
      .get('.app-nav')
      .should('not.have.class', 'app-nav--minimized');
    switchTabs();
    cy
      .get('.app-nav')
      .should('not.have.class', 'app-nav--minimized');
  });
});
