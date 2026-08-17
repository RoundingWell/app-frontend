import dayjs from 'dayjs';
import { v7 as uuid } from 'uuid';

import { getRelationship, getErrors } from 'helpers/json-api';

import { testTs } from 'helpers/test-timestamp';

import { workspaceOne, workspaceTwo, getWorkspace } from 'support/api/workspaces';
import { getClinician, getCurrentClinician, fxCurrentClinician } from 'support/api/clinicians';
import { roleAdmin, roleEmployee } from 'support/api/roles';
import { teamCoordinator } from 'support/api/teams';
import { testForm } from 'support/api/forms';

const navMinimizedKey = `isNavMenuMinimized_${ fxCurrentClinician.id }`;
const whatsNewDismissedKey = `whatsNewDismissed_v6-redesign_${ fxCurrentClinician.id }`;

function expectNavMenuLabel(label, assertion = 'be.visible') {
  cy
    .get('.app-nav__bottom')
    .contains('.app-nav__label', label)
    .should(assertion);
}

function withNavApp(callback) {
  cy
    .getRadio(Radio => {
      callback(Radio.channel('nav')._requests.select.context);
    });
}

context('App Nav', function() {
  beforeEach(function() {
    cy.routesForDefault();
  });

  specify('display non-manager nav', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleEmployee),
          },
        });

        return fx;
      })
      .visit();

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Dashboards')
      .should('not.exist');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Admin Tools')
      .should('not.exist');
  });

  specify('display nav', function() {
    cy
      .routeSettings('help_url', null)
      .routePrograms()
      .routeDashboards()
      .routeClinicians()
      .visit()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem(navMinimizedKey));

        expect(storageItem).to.be.false;
      });

    cy
      .get('.app-nav__header')
      .should('contain', 'Workspace One')
      .should('contain', 'Clinician McTester')
      .as('mainNav');

    cy
      .get('@mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.app-nav__picklist-workspace-name')
      .should('contain', 'Cypress Clinic');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('contain', 'Workspace One')
      .should('have.class', 'is-selected')
      .next()
      .should('contain', 'Workspace Two')
      .should('not.have.class', 'is-selected');

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Help & Support')
      .should('have.attr', 'href')
      .and('contain', 'help.roundingwell.com');

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Sign Out')
      .should('have.attr', 'href')
      .and('contain', '/logout');

    // NOTE: this closes the main nav droplist so it doesn't cover other nav links
    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .click();

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .as('worklists');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .click()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .last()
      .click()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .first()
      .click();

    cy
      .url()
      .should('contain', 'dashboards');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .last()
      .should('not.have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .contains('Admin Tools')
      .as('adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .click();

    cy
      .url()
      .should('contain', 'programs');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('@adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('.js-picklist-item')
      .eq(1)
      .click();

    cy
      .url()
      .should('contain', 'clinicians');

    cy
      .get('@adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('.js-picklist-item')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .click();

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('@adminNav')
      .click();

    cy
      .get('.js-picklist-item')
      .last()
      .should('not.have.class', 'is-selected');
  });

  specify('shows and remembers the redesign announcement', function() {
    cy
      .viewport(1280, 600)
      .routePrograms()
      .visit();

    cy
      .get('.app-nav__announcement')
      .should('be.visible')
      .should('contain', 'RoundingWell has a new design.')
      .then($announcement => {
        cy
          .get('.app-nav__bottom')
          .contains('.app-nav__link', 'Dashboards')
          .then($dashboards => {
            expect($announcement[0].compareDocumentPosition($dashboards[0]))
              .to.equal(Node.DOCUMENT_POSITION_FOLLOWING);
          });
      });

    cy
      .get('.app-nav__announcement')
      .contains('button', 'See what\'s changed.')
      .click();

    cy
      .get('.whats-new-modal')
      .should('contain', 'What\'s new in RoundingWell')
      .find('.whats-new-guide__figure img')
      .should('have.length', 2);

    cy.viewport(1280, 400);

    cy
      .get('.whats-new-modal')
      .should($modal => {
        const bounds = $modal[0].getBoundingClientRect();

        expect(bounds.top).to.be.at.least(0);
        expect(bounds.bottom).to.be.at.most(400);
      })
      .contains('button', 'Done')
      .should('be.visible');

    cy
      .get('.whats-new-modal .modal__body')
      .should($body => {
        expect($body[0].scrollHeight).to.be.greaterThan($body[0].clientHeight);
      })
      .scrollTo('bottom')
      .contains('What moved where')
      .should('be.visible');

    cy
      .get('.app-nav__announcement')
      .should('exist');

    cy
      .get('.whats-new-modal')
      .contains('button', 'Done')
      .click();

    cy.viewport(1280, 600);

    cy
      .get('.app-nav__announcement')
      .find('[aria-label="Dismiss redesign announcement"]')
      .click()
      .then(() => {
        expect(JSON.parse(localStorage.getItem(whatsNewDismissedKey))).to.be.true;
      });

    cy
      .get('.app-nav__announcement')
      .should('not.exist');

    cy.reload();

    cy
      .get('.app-nav__announcement')
      .should('not.exist');

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .contains('.js-picklist-item', 'What\'s New')
      .should('be.visible')
      .then($whatsNew => {
        cy
          .get('.picklist__group')
          .first()
          .should('have.css', 'border-bottom-width', '1px');

        cy
          .get('.app-nav__picklist-bottom')
          .should('have.css', 'border-top-width', '0px')
          .contains('Help & Support')
          .then($help => {
            expect($whatsNew[0].compareDocumentPosition($help[0]))
              .to.equal(Node.DOCUMENT_POSITION_FOLLOWING);
          });
      });

    cy
      .get('.picklist')
      .contains('.js-picklist-item', 'What\'s New')
      .click();

    cy
      .get('.whats-new-modal')
      .should('contain', 'What moved where');
  });

  specify('switch workspaces', function() {
    cy
      .routeActions()
      .routeWorkspaces(fx => {
        fx.data = [
          getWorkspace({ attributes: { settings: { manual_patient_creation: true } } }, { id: workspaceOne.id }),
          getWorkspace({ attributes: { settings: { manual_patient_creation: false } } }, { id: workspaceTwo.id }),
        ];

        return fx;
      })
      .visit()
      .wait('@routeActions')
      .wait('@routeWorkspaces')
      .get('@routeWorkspaceClinicians')
      .its('request.headers')
      .should('have.property', 'workspace', workspaceOne.id)
      .then(() => {
        const storage = JSON.parse(localStorage.getItem('currentWorkspace'));

        expect(storage).to.equal(workspaceOne.id);
      });

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.app-nav')
      .find('.js-add-patient');

    cy
      .get('.app-nav__header')
      .as('mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('have.class', 'is-selected')
      .next()
      .should('not.have.class', 'is-selected')
      .click();

    cy
      .wait('@routeActions')
      .its('request.headers')
      .should('have.property', 'workspace', workspaceTwo.id)
      .then(() => {
        const storage = JSON.parse(localStorage.getItem('currentWorkspace'));

        expect(storage).to.equal(workspaceTwo.id);
      });

    cy
      .url()
      .should('contain', '/two/worklist/owned-by');

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .should('not.exist');

    cy
      .get('.app-nav__header')
      .as('mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('not.have.class', 'is-selected')
      .next()
      .should('have.class', 'is-selected');

    cy
      .go('back');

    cy
      .wait('@routeActions')
      .its('request.headers')
      .should('have.property', 'workspace', workspaceOne.id)
      .then(() => {
        const storage = JSON.parse(localStorage.getItem('currentWorkspace'));

        expect(storage).to.equal(workspaceOne.id);
      });

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.app-nav__header')
      .as('mainNav')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .find('.picklist__item')
      .first()
      .should('have.class', 'is-selected')
      .next()
      .should('not.have.class', 'is-selected');
  });

  specify('minimized nav menu', function() {
    localStorage.setItem(navMinimizedKey, true);

    cy
      .routePrograms()
      .visit();

    cy
      .get('.app-nav__header')
      .find('.app-nav__header-details')
      .should('not.be.visible');

    cy
      .get('.app-nav__announcement')
      .should('not.be.visible');

    cy
      .get('.app-nav__header')
      .find('img')
      .should('have.attr', 'src', '/rwell-logo.svg');

    cy
      .get('.app-nav__header')
      .click()
      .get('.picklist');

    cy
      .get('.app-nav__header')
      .should('have.class', 'is-active');

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('[data-nav-content-region]')
      .find('.js-search')
      .contains('.app-nav__label', 'Search')
      .should('not.be.visible')
      .parents('.js-search')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.js-close')
      .click();

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .as('worklists');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .should('have.length', 6);

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .find('.app-nav__label')
      .should('not.be.visible');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .should('have.length', 1)
      .find('.app-nav__label')
      .should('not.be.visible');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .should('have.length', 3);

    expectNavMenuLabel('Add Patient', 'not.be.visible');
    expectNavMenuLabel('Admin Tools', 'not.be.visible');
    expectNavMenuLabel('Minimize Menu', 'not.be.visible');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .last()
      .find('.fa-square-caret-right');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .eq(1)
      .click();

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('not.have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .last()
      .as('minimizeMenuButton')
      .click()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem(navMinimizedKey));

        expect(storageItem).to.be.false;
      });

    cy
      .get('.app-nav__header')
      .should('contain', 'Workspace One')
      .should('contain', 'Clinician McTester');

    cy
      .get('[data-nav-content-region]')
      .find('.js-search')
      .contains('.app-nav__label', 'Search')
      .should('be.visible');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .find('.app-nav__label')
      .should('be.visible');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__link')
      .should('have.length', 1)
      .should('contain', 'Dashboards');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .should('have.length', 3)
      .should('contain', 'Add Patient')
      .should('contain', 'Admin Tools')
      .should('contain', 'Minimize Menu');

    cy
      .get('.app-nav__bottom')
      .find('.app-nav__bottom-button')
      .last()
      .find('.fa-square-caret-left');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .eq(1)
      .should('have.class', 'is-selected');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom-button')
      .contains('Admin Tools')
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@minimizeMenuButton')
      .click()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem(navMinimizedKey));

        expect(storageItem).to.be.true;
      });

    cy
      .get('.app-nav')
      .find('.app-nav__bottom-button')
      .eq(1)
      .click();

    cy
      .get('.js-picklist-item')
      .first()
      .should('have.class', 'is-selected');
  });

  specify('minimized nav expands as an overlay for focus and droplists', function() {
    localStorage.setItem(navMinimizedKey, true);

    cy
      .routePrograms()
      .visit();

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .get('.app-nav__header')
      .focus();

    cy
      .get('.app-nav')
      .should('have.class', 'is-overlay-expanded')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('.app-nav__announcement')
      .should('be.visible');

    cy
      .get('.app-nav__bottom')
      .find('.js-minimize-menu')
      .should('have.attr', 'aria-label', 'Keep Menu Open')
      .click()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem(navMinimizedKey));

        expect(storageItem).to.be.false;
      });

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-minimized')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('.app-nav__bottom')
      .find('.js-minimize-menu')
      .click();

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.app-nav')
      .should('have.class', 'is-overlay-expanded')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('.picklist')
      .should('be.visible');

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');
  });

  specify('minimized nav closes after selecting a destination', function() {
    localStorage.setItem(navMinimizedKey, true);

    cy
      .routePrograms()
      .visit();

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .focus();

    cy
      .get('.app-nav')
      .should('have.class', 'is-overlay-expanded')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .eq(1)
      .click();

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');
  });

  specify('navigation controls use native buttons', function() {
    cy
      .routePrograms()
      .visit();

    cy
      .get('.js-add-patient')
      .should('have.prop', 'tagName', 'BUTTON')
      .should('have.attr', 'type', 'button')
      .click();

    cy
      .get('.modal')
      .find('.js-close .icon')
      .click();

    cy
      .get('[data-nav-content-region]')
      .find('.js-search')
      .should('have.prop', 'tagName', 'BUTTON')
      .should('have.attr', 'type', 'button')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.js-close')
      .click();

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .last()
      .should('have.prop', 'tagName', 'BUTTON')
      .should('have.attr', 'type', 'button')
      .click();

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .last()
      .should('have.class', 'is-selected');

    cy
      .get('.app-nav__bottom')
      .find('.js-minimize-menu')
      .should('have.prop', 'tagName', 'BUTTON')
      .should('have.attr', 'type', 'button')
      .click();

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');
  });

  specify('narrow nav opens as a touch drawer and closes without pinning', function() {
    cy
      .viewport(800, 768)
      .routePrograms()
      .visit();

    cy
      .get('.app-nav')
      .should('have.class', 'is-narrow')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .get('.app-nav__bottom')
      .find('.js-minimize-menu')
      .as('minimizeMenuButton')
      .should('have.attr', 'aria-label', 'Expand Menu')
      .trigger('pointerdown', { pointerType: 'mouse' })
      .trigger('click');

    cy
      .get('.app-nav')
      .should('have.class', 'is-overlay-expanded')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('@minimizeMenuButton')
      .click();

    cy
      .get('.app-nav')
      .should('have.class', 'is-narrow')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .get('@minimizeMenuButton')
      .trigger('pointerdown', { pointerType: 'touch' })
      .click();

    cy
      .get('.app-nav')
      .should('have.class', 'is-overlay-expanded')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('@minimizeMenuButton')
      .trigger('pointerdown', { pointerType: 'touch' });

    cy
      .get('@minimizeMenuButton')
      .should('have.attr', 'aria-label', 'Close Menu')
      .should('contain', 'Close Menu')
      .find('.fa-xmark');

    cy
      .get('@minimizeMenuButton')
      .click()
      .then(() => {
        const storageItem = JSON.parse(localStorage.getItem(navMinimizedKey));

        expect(storageItem).to.be.false;
      });

    cy
      .get('.app-nav')
      .should('have.class', 'is-narrow')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');
  });

  specify('transient nav app events are covered through e2e', function() {
    cy
      .routePrograms()
      .visit();

    cy
      .getRadio(Radio => {
        Radio.trigger('event-router', 'default');
      });

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .getRadio(Radio => {
        Radio.trigger('hotkey', 'search', { preventDefault() {} });
      });

    cy
      .get('.patient-search__modal')
      .find('.js-close')
      .click();

    cy
      .viewport(800, 768);

    cy
      .get('.app-nav')
      .should('have.class', 'is-narrow');

    cy
      .viewport(1280, 768);

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-narrow');

    cy
      .get('.app-nav__bottom')
      .find('.js-minimize-menu')
      .click();

    cy.viewport(800, 768);

    withNavApp(navApp => {
      navApp.onTouchOpen();
    });

    cy
      .get('.app-nav__bottom')
      .find('.js-minimize-menu')
      .click();

    cy
      .window()
      .then(win => {
        expect(JSON.parse(win.localStorage.getItem(navMinimizedKey))).to.be.true;
      });

    cy.viewport(1280, 768);

    withNavApp(navApp => {
      navApp.onPointerEnter({ pointerType: 'touch' });
      navApp.onPointerLeave({ pointerType: 'touch' });
    });

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .window()
      .then(win => {
        const nativeMatchMedia = win.matchMedia.bind(win);

        cy.stub(win, 'matchMedia').callsFake(query => {
          if (query !== '(hover: hover) and (pointer: fine)') return nativeMatchMedia(query);

          return {
            addEventListener() {},
            addListener() {},
            dispatchEvent() {
              return true;
            },
            matches: true,
            media: query,
            onchange: null,
            removeEventListener() {},
            removeListener() {},
          };
        });
      });

    cy
      .then(() => {
        withNavApp(navApp => {
          navApp.onPointerEnter({ pointerType: 'mouse' });
        });
      });

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy
      .then(() => {
        withNavApp(navApp => {
          navApp.onPointerLeave({ pointerType: 'mouse' });
        });
      });

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    withNavApp(navApp => {
      navApp.onTouchOpen();
    });

    cy
      .get('.app-nav')
      .should('have.class', 'is-full-nav-visible');

    cy
      .get('.app-frame__content')
      .then($el => {
        cy.getRadio(Radio => {
          Radio.trigger('user-activity', 'body:down', { target: $el[0] });
        });
      });

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-full-nav-visible');

    withNavApp(navApp => {
      navApp.onClickAddPatient();
    });

    cy
      .get('.modal')
      .find('.js-close .icon')
      .click();
  });

  specify('nav radio minimize requests are covered through e2e', function() {
    cy
      .routePrograms()
      .visit();

    cy
      .getRadio(Radio => {
        Radio.request('nav', 'setMinimized', true);
      });

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized')
      .should('not.have.class', 'is-full-nav-visible');

    cy
      .getRadio(Radio => {
        Radio.request('nav', 'setMinimized', false);
      });

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-minimized')
      .should('have.class', 'is-full-nav-visible');

    cy
      .getRadio(Radio => {
        Radio.request('nav', 'setMinimized', true);
      });

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .contains('.js-picklist-item', 'Workspace Two')
      .click();

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-minimized')
      .should('have.class', 'is-full-nav-visible');
  });

  specify('add patient success', function() {
    const currentDate = dayjs();
    const pastDate = currentDate.subtract(10, 'years');

    const testNewPatientId = uuid();

    const testClinician = getClinician({
      attributes: {
        name: 'Test Clinician',
        email: 'test.clinician@roundingwell.com',
        enabled: true,
        last_active_at: testTs(),
      },
      relationships: {
        team: getRelationship(teamCoordinator),
        workspaces: getRelationship([workspaceOne]),
        role: getRelationship(roleAdmin),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeSettings('patient_creation_form', null)
      .routeWorkspaceClinicians(fx => {
        fx.data = [testClinician];

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = testClinician;

        return fx;
      })
      .visit('/', { isRoot: true });

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('.modal')
      .as('addPatientModal')
      .should('contain', 'Add Patient');

    cy
      .get('@addPatientModal')
      .contains('First Name')
      .parent()
      .find('.js-input')
      .type('First{enter}');

    cy
      .get('@addPatientModal')
      .contains('Last Name')
      .parent()
      .find('.js-input')
      .type('Last{enter}');

    cy
      .get('@addPatientModal')
      .contains('Date of Birth')
      .parent()
      .find('.date-select__button')
      .click();

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .patient-modal__form-component')
      .should('have.class', 'is-partial');

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.format('MMMM'))
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(pastDate.date())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region]')
      .should('contain', pastDate.format('MMM DD, YYYY'))
      .find('.date-select__button')
      .should('not.exist');

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .patient-modal__form-component')
      .should('not.have.class', 'is-partial');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@addPatientModal')
      .find('[data-sex-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .intercept('PUT', '/api/patients', {
        statusCode: 201,
        body: {
          data: {
            id: testNewPatientId,
            first_name: 'First',
            last_name: 'Last',
          },
        },
      })
      .as('routeAddPatient');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .click()
      .wait('@routeAddPatient')
      .wait('@routePatient');

    cy
      .url()
      .should('contain', `patient/${ testNewPatientId }/workflow`);
  });

  specify('add patient failure', function() {
    const testDate = dayjs().year(2020).month(0).day(1).valueOf();
    const futureDate = dayjs(testDate).add(1, 'day');

    cy
      .visitOnClock({ now: testDate, functionNames: ['Date'] });

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('.modal')
      .as('addPatientModal')
      .find('.js-close .icon')
      .click();

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('@addPatientModal')
      .contains('First Name')
      .parent()
      .find('.js-input')
      .type('First');

    cy
      .get('@addPatientModal')
      .contains('Last Name')
      .parent()
      .find('.js-input')
      .type('Last');

    cy
      .get('@addPatientModal')
      .contains('Date of Birth')
      .parent()
      .find('.date-select__button')
      .click();

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.format('MMMM'))
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.date())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-sex-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('.modal__error')
      .should('contain', 'Date of birth cannot be in the future');

    cy
      .get('@addPatientModal')
      .find('.date-select__date')
      .should('have.class', 'has-error');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .js-cancel')
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(futureDate.subtract(10, 'years').year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-info-region]')
      .should('be.empty');

    cy
      .get('@addPatientModal')
      .find('.date-select__date')
      .should('not.have.class', 'has-error');

    cy
      .intercept('PUT', '/api/patients', {
        statusCode: 400,
        body: {
          errors: getErrors({
            status: '400',
            title: 'Bad Request',
            detail: 'Similar patient exists',
          }),
        },
      })
      .as('routeSimilarPatientError');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .click()
      .wait('@routeSimilarPatientError');

    cy
      .get('@addPatientModal')
      .find('.modal__error')
      .should('contain', 'Similar patient exists');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@addPatientModal')
      .find('[data-first-name-region] .js-input')
      .should('have.class', 'has-error');

    cy
      .get('@addPatientModal')
      .find('[data-last-name-region] .js-input')
      .should('have.class', 'has-error')
      .clear()
      .type('New Last');

    cy
      .get('@addPatientModal')
      .find('.js-submit')
      .click()
      .wait('@routeSimilarPatientError');

    cy
      .get('@addPatientModal')
      .find('.modal__error .js-search')
      .click();

    cy
      .get('.patient-search__modal')
      .find('.patient-search__input')
      .should('have.value', 'First New Last');

    cy
      .get('.patient-search__modal')
      .find('.js-close .icon')
      .click();

    cy
      .get('.patient-search__modal')
      .should('not.exist');
  });

  specify('manual add patient disabled', function() {
    cy
      .routeSettings('manual_patient_creation', false)
      .visit();

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .should('not.exist');
  });

  specify('hidden help link', function() {
    cy
      .routeSettings('help_url', false)
      .visit();

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Help & Support')
      .should('not.exist');
  });

  specify('custom help link url', function() {
    cy
      .visit();

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .find('.app-nav__picklist-bottom')
      .contains('Help & Support')
      .should('have.attr', 'href')
      .and('contain', 'customer-help-url.com');
  });

  specify('add patient custom form', function() {
    const testNewPatientId = uuid();

    cy
      .routeSettings('patient_creation_form', {
        form_id: testForm.id,
        submit_text: `Continue to ${ testForm.attributes.name }`,
      })
      .visit();

    cy
      .get('.app-nav')
      .find('.js-add-patient')
      .click();

    cy
      .get('.modal')
      .as('addPatientModal')
      .contains('First Name')
      .parent()
      .find('.js-input')
      .type('First');

    cy
      .get('@addPatientModal')
      .contains('Last Name')
      .parent()
      .find('.js-input')
      .type('Last');

    cy
      .get('@addPatientModal')
      .contains('Date of Birth')
      .parent()
      .find('.date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains(dayjs().subtract(1, 'years').year())
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-dob-region] .date-select__button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('@addPatientModal')
      .find('[data-sex-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .routePatient(fx => {
        fx.data.id = testNewPatientId;

        return fx;
      })
      .routeWorkspacePatient()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeLatestFormResponse()
      .intercept('PUT', '/api/patients', {
        statusCode: 201,
        body: {
          data: {
            id: testNewPatientId,
            first_name: 'First',
            last_name: 'Last',
          },
        },
      })
      .as('routeAddPatient');

    cy
      .get('@addPatientModal')
      .contains(`Continue to ${ testForm.attributes.name }`)
      .click()
      .wait('@routeAddPatient');

    cy
      .url()
      .should('contain', `/patient/${ testNewPatientId }/form/${ testForm.id }`);

    cy
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routeForm')
      .wait('@routeLatestFormResponse')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields');
  });
});
