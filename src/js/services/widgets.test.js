import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import Radio from 'backbone.radio';

import WidgetsService from 'js/services/widgets';

import { Collection as Widgets } from 'js/entities-service/entities/widgets';

import fxTestWidgets from 'fixtures/test/widgets.json';

describe('Widgets Service', () => {
  let service;

  beforeEach(() => {
    Radio.reply('settings', 'get', settingKey => {
      if (settingKey === 'widgets_patient_sidebar') {
        return {
          widgets: ['dob', 'sex'],
        };
      }
    });

    Radio.reply('entities', 'widgets:collection', models => new Widgets(models));

    service = new WidgetsService({
      widgets: new Widgets(fxTestWidgets),
    });
  });

  afterEach(() => {
    Radio.reset('entities');
    Radio.reset('settings');
    service.destroy();
  });

  it('builds sidebar widgets from the configured setting', () => {
    const widgets = Radio.request('widgets', 'sidebarWidgets');

    expect(widgets.at(0).get('slug')).toBe('dob');
    expect(widgets.at(1).get('slug')).toBe('sex');
    expect(widgets).toHaveLength(2);
  });

  it('builds a widget collection from slugs', () => {
    const widgets = Radio.request('widgets', 'build', ['dob', 'divider', 'sex']);

    expect(widgets.at(0).get('slug')).toBe('dob');
    expect(widgets.at(1).get('slug')).toBe('divider');
    expect(widgets.at(2).get('slug')).toBe('sex');
    expect(widgets).toHaveLength(3);
  });

  it('finds a widget by slug', () => {
    const widget = Radio.request('widgets', 'find', 'dob');
    expect(widget.get('slug')).toBe('dob');
  });
});
