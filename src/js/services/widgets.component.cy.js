import Radio from 'backbone.radio';
import { Model } from 'backbone';

import WidgetsService from './widgets';

import { Collection as Widgets } from 'js/entities-service/entities/widgets';
import { buildWidget } from 'js/apps/patients/shared/widgets/widgets';

import { fxTestWidgets } from 'support/api/widgets';

context('Widgets Service', function() {
  let service;

  beforeEach(function() {
    const widgets = new Widgets(fxTestWidgets);

    service = new WidgetsService({ widgets });
  });

  afterEach(function() {
    service.destroy();
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

  specify('builds custom widgets from function and empty templates', function() {
    const patient = new Model({ id: 'patient-1' });
    const values = new Model({ values: {} });
    const functionTemplate = () => 'Custom widget';

    Radio.reply('entities', 'get:widgetValues:model', () => values);

    const functionWidget = buildWidget(new Model({
      category: 'custom-function',
      slug: 'custom-function',
      definition: { template: functionTemplate },
    }), patient);
    const emptyWidget = buildWidget(new Model({
      category: 'custom-empty',
      slug: 'custom-empty',
      definition: {},
    }), patient);

    expect(functionWidget.getOption('template')).to.equal(functionTemplate);
    expect(emptyWidget.getOption('template')({})).to.equal('');
  });
});
