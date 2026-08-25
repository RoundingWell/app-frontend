import Radio from 'backbone.radio';

import SidebarsService from './sidebars';
import WidgetsService from './widgets';

import { Collection as Panels } from 'js/entities-service/entities/panels';
import { Collection as Widgets } from 'js/entities-service/entities/widgets';

import { fxTestWidgets } from 'support/api/widgets';

context('Sidebars Service', function() {
  let panels;
  let sidebarsService;
  let widgetsService;

  beforeEach(function() {
    widgetsService = new WidgetsService({ widgets: new Widgets(fxTestWidgets) });
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

  afterEach(function() {
    Radio.reset('settings');
    sidebarsService.destroy();
    widgetsService.destroy();
  });

  function startService(sidebar) {
    Radio.reply('settings', 'get', () => sidebar);
    sidebarsService = new SidebarsService({ panels });

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
