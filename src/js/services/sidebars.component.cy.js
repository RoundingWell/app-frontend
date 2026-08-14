import Radio from 'backbone.radio';

import SidebarsService from './sidebars';
import WidgetsService from './widgets';

import { Collection as Sidebars } from 'js/entities-service/entities/sidebars';
import { Collection as Widgets } from 'js/entities-service/entities/widgets';

import { fxTestWidgets } from 'support/api/widgets';

context('Sidebars Service', function() {
  let sidebarsService;
  let widgetsService;

  beforeEach(function() {
    Radio.reply('settings', 'get', () => ({ widgets: ['dob', 'sex'] }));

    widgetsService = new WidgetsService({ widgets: new Widgets(fxTestWidgets) });
    sidebarsService = new SidebarsService({
      sidebars: new Sidebars([
        {
          id: 'demographics',
          widgets: ['status', 'dob', 'sex', 'dob'],
        },
        {
          id: 'status',
          widgets: ['status'],
        },
      ]),
    });
  });

  afterEach(function() {
    Radio.reset('settings');
    sidebarsService.destroy();
    widgetsService.destroy();
  });

  specify('scopes patient sidebars to the current workspace widgets', function() {
    const sidebars = Radio.request('sidebars', 'patient');

    expect(sidebars.pluck('id')).to.deep.equal(['demographics']);
    expect(sidebars.at(0).getWidgets().pluck('slug')).to.deep.equal(['dob', 'sex', 'dob']);
  });
});
