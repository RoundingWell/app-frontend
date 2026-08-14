import Radio from 'backbone.radio';

import 'js/entities-service';
import { Collection as Teams } from 'js/entities-service/entities/teams';
import { teamCoordinator, getTeams } from 'support/api/teams';
import TeamComponent from './index';

context('Team Component', function() {
  afterEach(function() {
    Radio.channel('bootstrap').reset();
  });

  specify('No Default', function() {
    Radio.reply('bootstrap', 'teams', () => {
      return new Teams();
    });

    cy
      .mount(rootView => {
        TeamComponent.setPopRegion(rootView.getRegion('pop'));

        return new TeamComponent();
      })
      .as('root');

    cy
      .get('@root')
      .contains('Select Team...')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .contains('Update Team');

    cy
      .get('.picklist')
      .find('.picklist__message');
  });

  specify('isCompact', function() {
    Radio.reply('bootstrap', 'teams', () => {
      return new Teams({ data: getTeams() }, { parse: true });
    });

    cy
      .mount(rootView => {
        TeamComponent.setPopRegion(rootView.getRegion('pop'));

        return new TeamComponent({ isCompact: true });
      })
      .as('root');

    cy
      .get('@root')
      .find('.button.button--compact')
      .should('be.visible')
      .click();

    cy
      .get('.picklist')
      .contains('Physician PHS')
      .click();

    cy
      .get('@root')
      .find('.button.button--compact')
      .contains('PHS');
  });

  specify('with data', function() {
    const changeTeamStub = cy.stub().as('changeTeam');
    const teams = new Teams({ data: getTeams() }, { parse: true });

    Radio.reply('bootstrap', 'teams', () => {
      return teams;
    });

    cy
      .mount(rootView => {
        TeamComponent.setPopRegion(rootView.getRegion('pop'));

        const teamComponent = new TeamComponent({ team: teams.get(teamCoordinator.id), canClear: true });

        teamComponent.on('change:team', changeTeamStub);

        return teamComponent;
      })
      .as('root');

    cy
      .get('@root')
      .find('.button.button--secondary')
      .contains('Coordinator')
      .click();

    cy
      .get('.picklist')
      .find('.js-input')
      .type('p');

    cy
      .get('.picklist')
      .find('.picklist__item')
      .its('length')
      .should('eq', 3);

    cy
      .get('.picklist')
      .contains('Physician PHS')
      .click();

    cy
      .get('@changeTeam')
      .should('be.called.with', teams.find({ abbr: 'PHS' }));

    cy
      .get('@root')
      .find('.button.button--secondary')
      .contains('Physician')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Selection')
      .click();

    cy
      .get('@changeTeam')
      .should('be.called.with', null);
  });
});
