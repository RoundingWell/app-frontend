import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import SidebarsService from './sidebars';
import WidgetsService from './widgets';

import { Collection as Panels } from 'js/entities-service/entities/panels';
import { Collection as Widgets } from 'js/entities-service/entities/widgets';

import { fxTestWidgets } from 'support/api/widgets';

context('Sidebars Service', function() {
  let panels;
  let scope;

  beforeEach(function() {
    scope = testScope();
    scope.own(new WidgetsService({ widgets: new Widgets(fxTestWidgets) }));
    panels = new Panels([
      {
        id: 'demographics-panel',
        slug: 'demographics',
        widgets: ['status', 'dob', 'sex', 'dob'],
      },
      {
        id: 'status-panel',
        slug: 'status',
        widgets: ['status'],
      },
      {
        id: 'empty-panel',
        slug: 'empty',
        widgets: ['unknown'],
      },
    ]);
  });

  function startService(sidebar) {
    scope.reply(Radio, 'settings', 'get', () => sidebar);
    scope.own(new SidebarsService({ panels }));

    return Radio.request('sidebars', 'patient');
  }

  specify('uses the sidebar setting for panel membership and order', function() {
    const sidebars = startService(['status', 'demographics']);

    expect(sidebars.pluck('slug')).to.deep.equal(['status', 'demographics']);
    expect(sidebars.at(1).getWidgets().pluck('slug')).to.deep.equal(['status', 'dob', 'sex', 'dob']);
  });

  specify('uses every non-empty panel in collection order when the setting is absent', function() {
    const sidebars = startService();

    expect(sidebars.pluck('slug')).to.deep.equal(['demographics', 'status']);
  });

  specify('uses an explicit empty sidebar instead of every panel', function() {
    const sidebars = startService([]);

    expect(sidebars).to.have.length(0);
  });

  specify('reports unknown panels once and renders the available panels', function() {
    const consoleError = cy.stub(console, 'error');
    const sidebars = startService(['unknown', 'status']);

    expect(sidebars.pluck('slug')).to.deep.equal(['status']);
    expect(consoleError).to.be.calledOnce;
    expect(consoleError.firstCall.args[0]).to.be.an('error')
      .with.property('message', 'Patient sidebar configuration references unavailable panels');

    Radio.request('sidebars', 'patient');

    expect(consoleError).to.be.calledOnce;
  });
});
