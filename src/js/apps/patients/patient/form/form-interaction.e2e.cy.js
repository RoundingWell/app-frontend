import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';

context('Embedded form interaction', function() {
  specify('pointer activation, keyboard focus, and canceled interactions scroll correctly', function() {
    const action = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([]),
      },
    });

    cy
      .viewport(900, 720)
      .routesForDefault()
      .routeWorkspacePatient()
      .routeActionActivity()
      .routeActionComments()
      .routeActionFiles()
      .routeAction(fx => ({ ...fx, data: action }))
      .routePatient()
      .routeFormByAction(fx => ({ ...fx, data: testForm }))
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields();

    cy.fixture('formio-stub.html').then(html => {
      cy.intercept('GET', '/forms/formio/**', {
        body: html.replace('</body>', `
          <button id="tab" type="button" role="tab" aria-selected="false">Second tab</button>
          <input id="checkbox" type="checkbox" aria-label="Confirm">
          <input id="text" type="text" aria-label="Details">
          <script type="module">
            import { initFormServices } from '/shared/forms.js';
            document.querySelector('#tab').addEventListener('click', event => {
              event.currentTarget.setAttribute('aria-selected', 'true');
            });
            window.flushFormInteraction = () => {
              parent.postMessage('interaction-test:flushed', window.origin);
            };
            await initFormServices();
            document.body.dataset.interactionReady = 'true';
          </script>
        </body>`),
      });
    });

    cy
      .visit(`/patient/patient-id/action/${ action.id }`)
      .wait('@routeAction')
      .wait('@routeFormDefinition')
      .iframe()
      .should('have.attr', 'data-interaction-ready', 'true')
      .as('formBody');

    cy.window().then(win => {
      const nativeMatchMedia = win.matchMedia.bind(win);
      const pane = win.document.querySelector('[data-form-viewport-scroll-container]');

      // Immediate scrolling makes a premature focus notification deterministic.
      cy.stub(win, 'matchMedia').callsFake(query => {
        if (query === '(prefers-reduced-motion: reduce)') return { matches: true };

        return nativeMatchMedia(query);
      });
      cy.spy(pane, 'scrollTo').as('scrollForm');
    });

    function resetInteraction() {
      cy.get('@formBody').then($body => {
        $body[0].ownerDocument.activeElement?.blur();
      });
      cy.window().then(win => {
        win.document.querySelector('[data-form-viewport-scroll-container]').scrollTop = 0;
      });
      cy.get('@scrollForm').then(spy => spy.resetHistory());
    }

    function flushInteraction() {
      cy.get('@formBody').then($body => {
        const frameWindow = $body[0].ownerDocument.defaultView;
        const appWindow = frameWindow.parent;

        return new Cypress.Promise(resolve => {
          const onMessage = event => {
            if (event.source !== frameWindow || event.data !== 'interaction-test:flushed') return;

            appWindow.removeEventListener('message', onMessage);
            resolve();
          };
          appWindow.addEventListener('message', onMessage);
          frameWindow.flushFormInteraction();
        });
      });
    }

    ['mouse', 'touch'].forEach(pointerType => {
      const control = pointerType === 'mouse' ? 'tab' : 'checkbox';
      resetInteraction();
      cy.get('@formBody').find(`#${ control }`).trigger('pointerdown', { pointerId: 1, pointerType });

      if (pointerType === 'touch') {
        // Touch releases before the browser generates mousedown and focus.
        cy.get('@formBody').find(`#${ control }`).trigger('pointerup', { pointerId: 1, pointerType });
      }

      cy.get('@formBody').find(`#${ control }`).trigger('mousedown', { button: 0, buttons: 1 }).focus();

      // Flush earlier postMessages while the mouse press is still held.
      flushInteraction();
      cy.get('@scrollForm').should('not.have.been.called');

      if (pointerType === 'mouse') {
        cy.get('@formBody').find(`#${ control }`).trigger('pointerup', { pointerId: 1, pointerType });
      }

      cy
        .get('@formBody')
        .find(`#${ control }`)
        .trigger('mouseup', { buttons: 0 })
        .trigger('click', { eventConstructor: 'MouseEvent' });

      if (control === 'tab') {
        cy.get('@formBody').find('#tab').should('have.attr', 'aria-selected', 'true');
      } else {
        cy.get('@formBody').find('#checkbox').should('be.checked');
      }
      cy.get('@scrollForm').should('have.been.calledOnce');
    });
    resetInteraction();
    cy.get('@formBody').find('#text').focus().should('be.focused');
    cy.get('@scrollForm').should('have.been.calledOnce');

    [1, 2].forEach(button => {
      resetInteraction();
      cy.get('@formBody').find('#text').trigger('mousedown', { button }).focus().should('be.focused');
      cy.get('@scrollForm').should('have.been.calledOnce');
    });
    ['mouseup', 'keydown', 'blur'].forEach(eventName => {
      resetInteraction();
      cy.get('@formBody').find('#tab').trigger('mousedown', { button: 0, buttons: 1 });

      cy.get('@formBody').then($body => {
        const win = $body[0].ownerDocument.defaultView;
        if (eventName === 'blur') {
          win.dispatchEvent(new win.Event('blur'));
          return;
        }

        $body[0].dispatchEvent(new win.Event(eventName, { bubbles: true }));
      });

      cy.get('@formBody').find('#text').focus().should('be.focused');
      cy.get('@scrollForm').should('have.been.calledOnce');
    });

    resetInteraction();
    cy.get('@formBody').find('#text').focus();
    cy.get('@scrollForm').should('have.been.calledOnce');
    cy.get('@formBody').find('#checkbox').focus();
    flushInteraction();
    cy.get('@scrollForm').should('have.been.calledOnce');

    cy.get('.js-expand-button').click();
    cy.get('.form__frame--expanded').should('be.visible');
    resetInteraction();
    cy.get('@formBody').find('#text').focus();
    flushInteraction();
    cy.get('@scrollForm').should('not.have.been.called');

    cy.get('.js-expand-button').click();
    cy.window().then(win => {
      win.matchMedia.withArgs('(prefers-reduced-motion: reduce)').returns({ matches: false });
    });
    resetInteraction();
    cy.get('@formBody').find('#text').focus();
    cy.get('@scrollForm').should('have.been.calledWithMatch', { behavior: 'smooth' });
  });
});
