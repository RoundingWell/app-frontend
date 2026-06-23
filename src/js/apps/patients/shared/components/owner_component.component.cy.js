import Radio from 'backbone.radio';

import 'js/entities-service/index';
import { Collection as Roles } from 'js/entities-service/entities/roles';
import { Collection as Teams } from 'js/entities-service/entities/teams';
import { Collection as Clinicians, Model as Clinician } from 'js/entities-service/entities/clinicians';
import { Collection as Workspaces, Model as Workspace } from 'js/entities-service/entities/workspaces';

import { getRelationship } from 'helpers/json-api';

import { getRoles, roleTeamEmployee } from 'support/api/roles';
import { getTeams, teamNurse } from 'support/api/teams';
import { getClinicians, getClinician, getCurrentClinician } from 'support/api/clinicians';
import { getWorkspaces, workspaceOne, workspaceTwo } from 'support/api/workspaces';

import OwnerComponent from './owner_component';

const currentClinician = getCurrentClinician();

// Cache resources in backbone.store
new Roles({ data: getRoles() }, { parse: true });
const teams = new Teams({ data: getTeams() }, { parse: true });
const clinicians = new Clinicians({ data: [currentClinician, ...getClinicians()] }, { parse: true });
const workspaces = new Workspaces({ data: getWorkspaces() }, { parse: true });

context('Owner Component', function() {
  beforeEach(function() {
    Radio.reply('bootstrap', 'currentUser', () => {
      return clinicians.get(currentClinician.id);
    });

    // Clear the cache
    Radio.reply('workspace', 'current', () => {
      return new Workspace({ id: workspaceTwo.id });
    });

    new OwnerComponent({
      owner: clinicians.get(currentClinician.id),
    });

    Radio.reply('workspace', 'current', () => {
      return new Workspace({ id: workspaceOne.id, name: 'Current Workspace' });
    });
  });

  specify('displaying', function() {
    const onChange = cy.stub();

    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        // Cache the elements
        new OwnerComponent({
          owner: clinicians.get(currentClinician.id),
        });

        const component = new OwnerComponent({
          owner: clinicians.get(currentClinician.id),
          infoText: 'Info Text',
          headingText: 'Heading Text',
          placeholderText: 'Placeholder Text',
        });

        component.on('change:owner', onChange);

        return component;
      })
      .as('root');

    cy
      .get('@root')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@root')
      .find('.picklist')
      .should('contain', 'Heading Text')
      .should('contain', 'Info Text')
      .should('contain', 'Current Workspace')
      .should('contain', 'Teams')
      .find('.js-input')
      .should('have.attr', 'placeholder', 'Placeholder Text');

    cy
      .get('@root')
      .find('.picklist')
      .invoke('css', 'width')
      .should('equal', '1280px');

    cy
      .get('@root')
      .find('.picklist .is-selected')
      .should('contain', 'Clinician McTester')
      .and('contain', 'NUR');

    cy
      .get('@root')
      .find('.picklist')
      .contains('Nurse')
      .click()
      .then(() => {
        expect(onChange)
          .to.be.calledOnce
          .and.calledWith(teams.find({ name: 'Nurse' }));
        onChange.reset();
      });

    cy
      .get('@root')
      .find('.picklist')
      .should('not.exist');

    cy
      .get('@root')
      .contains('Nurse')
      .click();

    cy
      .get('@root')
      .find('.picklist .js-clear')
      .should('contain', 'Clinician McTester')
      .click()
      .then(() => {
        expect(onChange)
          .to.be.calledOnce
          .and.calledWith(clinicians.get(currentClinician.id));
      });
  });

  specify('isCompact', function() {
    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          isCompact: true,
          owner: clinicians.get(currentClinician.id),
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@root')
      .find('.picklist')
      .contains('Nurse')
      .click();

    cy
      .get('@root')
      .contains('NUR')
      .invoke('css', 'width')
      .should('equal', '80px');
  });

  specify('without Current User', function() {
    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          owner: clinicians.get(currentClinician.id),
          hasCurrentClinician: false,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@root')
      .find('.js-clear')
      .should('not.exist');
  });

  specify('Current User is not in workspaces', function() {
    const notInWorkspace = getClinician({ attributes: { name: 'Not in Workspace' } });
    const owner = new Clinician({ data: notInWorkspace }, { parse: true });

    Radio.reply('bootstrap', 'currentUser', () => {
      return owner;
    });

    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          owner,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Not in Workspace')
      .click();

    cy
      .get('@root')
      .find('.picklist')
      .should('not.contain', 'Not in Workspace');
  });

  specify('specified workspaces', function() {
    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          owner: clinicians.get(currentClinician.id),
          workspaces: new Workspaces([
            ...workspaces.models,
            new Workspace({ id: '12345', name: 'No Clinicians' }),
          ]),
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@root')
      .find('.picklist')
      .should('contain', 'Current Workspace')
      .and('contain', 'Workspace Two')
      .and('not.contain', 'No Clinicians');
  });

  specify('without hasClinicians', function() {
    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          owner: clinicians.get(currentClinician.id),
          hasClinicians: false,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@root')
      .find('.picklist')
      .should('not.contain', 'Teams')
      .should('contain', 'Nurse');

    cy
      .get('@root')
      .find('.picklist__group')
      .should('have.length', 1);
  });

  specify('without hasTeams', function() {
    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          owner: clinicians.get(currentClinician.id),
          hasTeams: false,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@root')
      .find('.picklist')
      .should('not.contain', 'Teams')
      .should('not.contain', 'Nurse')
      .should('contain', 'Current Workspace');
  });

  specify('currentUser can work:team:manage', function() {
    const employee = getClinician({
      attributes: { name: 'Employee' },
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamNurse),
      },
    });
    const owner = new Clinician({ data: employee }, { parse: true });

    Radio.reply('bootstrap', 'currentUser', () => {
      return owner;
    });

    cy
      .mount(rootView => {
        OwnerComponent.setPopRegion(rootView.getRegion('pop'));

        return new OwnerComponent({
          owner,
        });
      })
      .as('root');

    cy
      .get('@root')
      .contains('Employee')
      .click();

    cy
      .get('@root')
      .find('.picklist__item:not(.js-clear)')
      .should('contain', 'NUR');
  });
});
