import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import WidgetsService from './widgets';

import { Collection as Widgets } from 'js/entities-service/entities/widgets';

import { fxTestWidgets } from 'support/api/widgets';

context('Widgets Service', function() {
  beforeEach(function() {
    const widgets = new Widgets(fxTestWidgets);

    testScope().own(new WidgetsService({ widgets }));
  });

  specify('build', function() {
    const widgets = Radio.request('widgets', 'build', ['dob', 'divider', 'sex']);

    expect(widgets.at(0).get('slug')).to.equal('dob');
    expect(widgets.at(1).get('slug')).to.equal('divider');
    expect(widgets.at(2).get('slug')).to.equal('sex');
    expect(widgets.length).to.equal(3);
  });

  specify('find', function() {
    const widget = Radio.request('widgets', 'find', 'dob');

    expect(widget.get('slug')).to.equal('dob');
  });
});
