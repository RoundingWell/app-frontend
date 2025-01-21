import Radio from 'backbone.radio';

import { Collection as States } from 'js/entities-service/entities/states';
import { Collection as Workspaces, Model as Workspace } from 'js/entities-service/entities/workspaces';

import { stateInProgress, stateDone, getStates } from 'support/api/states';
import { getWorkspaces } from 'support/api/workspaces';

import StateComponent from './state_component';

const states = new States({ data: getStates() }, { parse: true });
const workspaces = new Workspaces({ data: getWorkspaces() }, { parse: true });

workspaces.at(1).set('_states', [{ id: stateInProgress.id, type: 'states' }]);

context('State Component', function() {
  specify('Display', function() {
    const onChange = cy.stub();

    Radio.reply('workspace', 'current', () => {
      return new Workspace({ id: workspaces.at(0).id });
    });

    cy
      .mount(rootView => {
        StateComponent.setPopRegion(rootView.getRegion('pop'));

        const component = new StateComponent({ stateId: stateInProgress.id });

        component.on('change:state', onChange);

        return component;
      })
      .as('root');

    cy
      .get('@root')
      .contains('In Progress')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .should('contain', 'Update State')
      .and('contain', 'Queued')
      .and('contain', 'Started')
      .and('contain', 'Done')
      .next()
      .should('contain', 'To Do')
      .and('contain', 'In Progress')
      .and('contain', 'Done');

    cy
      .get('@root')
      .find('.js-picklist-item')
      .contains('Done')
      .click()
      .then(() => {
        expect(onChange)
          .to.be.calledOnce
          .and.calledWith(states.get(stateDone.id));
      });
  });

  specify('isCompact', function() {
    Radio.reply('workspace', 'current', () => {
      return new Workspace({ id: workspaces.at(1).id });
    });

    cy
      .mount(rootView => {
        StateComponent.setPopRegion(rootView.getRegion('pop'));

        return new StateComponent({ isCompact: true, stateId: stateInProgress.id });
      })
      .as('root');

    cy
      .get('@root')
      .find('.fa-circle-dot')
      .click();

    cy
      .get('@root')
      .contains('In Progress')
      .invoke('css', 'width')
      .should('equal', '72px');
  });

  specify('Cache testing isCompact', function() {
    Radio.reply('workspace', 'current', () => {
      return new Workspace({ id: workspaces.at(1).id });
    });

    cy
      .mount(rootView => {
        StateComponent.setPopRegion(rootView.getRegion('pop'));

        return new StateComponent({ isCompact: true, stateId: stateInProgress.id });
      })
      .as('root');

    cy
      .get('@root')
      .find('.fa-circle-dot');
  });
});
