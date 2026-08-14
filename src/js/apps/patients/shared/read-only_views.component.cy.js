import Backbone from 'backbone';

import {
  ReadOnlyStateView,
  ReadOnlyOwnerView,
  ReadOnlyDueDateTimeView,
  ReadOnlyDurationView,
} from './read-only_views';

function getAction(attributes = {}) {
  const action = new Backbone.Model({
    due_date: '2026-08-14',
    due_time: '12:30:00',
    duration: 5,
    ...attributes,
  });

  action.getState = () => new Backbone.Model({
    name: 'In Progress',
    options: {
      color: 'blue',
      icon: 'circle-dot',
      iconType: 'fas',
    },
  });
  action.isOverdue = () => true;

  return action;
}

context('Read-only action views', function() {
  specify('renders icon-only and labeled states', function() {
    const action = getAction();

    cy
      .mount(() => new ReadOnlyStateView({
        model: action,
      }))
      .should('not.contain', 'In Progress');

    cy
      .mount(() => new ReadOnlyStateView({
        model: action,
        showLabel: true,
      }))
      .should('contain', 'In Progress');
  });

  specify('renders clinician owner names', function() {
    const clinician = new Backbone.Model({ name: 'Clinician McTester' });

    clinician.type = 'clinicians';

    cy
      .mount(() => {
        const action = getAction();
        action.getOwner = () => clinician;

        return new ReadOnlyOwnerView({
          model: action,
        });
      })
      .should('contain', 'Clinician McTester');
  });

  specify('renders team abbreviations', function() {
    const team = new Backbone.Model({ abbr: 'NUR' });

    team.type = 'teams';

    cy
      .mount(() => {
        const action = getAction();
        action.getOwner = () => team;

        return new ReadOnlyOwnerView({
          model: action,
        });
      })
      .should('contain', 'NUR');
  });

  specify('renders due values', function() {
    const action = getAction();

    cy
      .mount(() => new ReadOnlyDueDateTimeView({
        model: action,
      }))
      .should('contain', 'Aug 14')
      .and('contain', '12:30 PM');
  });

  specify('renders durations', function() {
    const action = getAction();

    cy
      .mount(() => new ReadOnlyDurationView({
        model: action,
      }))
      .should('contain', '5 mins');
  });
});
