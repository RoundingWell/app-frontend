import { noop } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import { AddButtonView, i18n } from 'js/apps/patients/shared/add-workflow/add-workflow_views';

export default App.extend({
  beforeStart() {
    return [
      Radio.request('entities', 'fetch:programs:collection'),
      Radio.request('entities', 'fetch:programActions:collection'),
      Radio.request('entities', 'fetch:programFlows:collection'),
    ];
  },
  onStart(options, programs) {
    programs.comparator = 'name';

    const addablePrograms = programs.filter(program => {
      const isPublished = !!program.get('published_at');
      const isArchived = !!program.get('archived_at');

      return isPublished && !isArchived;
    });

    programs.reset(addablePrograms);

    const addButtonView = new AddButtonView({
      lists: this.getProgramsOpts(programs),
    });

    this.listenTo(addButtonView, {
      'add:programAction'(programItem) {
        this.triggerMethod('add:programAction', programItem);
      },
      'add:programFlow'(programItem) {
        this.triggerMethod('add:programFlow', programItem);
      },
    });

    this.showView(addButtonView);
  },
  getProgramsOpts(programs) {
    return programs.map(program => {
      const headingText = program.get('name');
      const programItems = program.getAddable();
      const noResultsOpt = {
        itemType: 'program-actions',
        text: i18n.noResultsText,
        isDisabled: true,
      };

      if (!programItems.length) {
        return {
          itemClassName: 'picklist__message',
          headingText,
          collection: new Backbone.Collection([noResultsOpt]),
          getItemSearchText: noop,
        };
      }

      const itemsOpts = this.getProgramItemsOpts(programItems);

      return {
        headingText,
        collection: new Backbone.Collection(itemsOpts),
      };
    });
  },
  getProgramItemsOpts(programItems) {
    return programItems.map(item => {
      return {
        text: item.get('name'),
        itemType: item.type,
        hasOutreach: item.type === 'program-actions' && item.hasOutreach(),
        customIcon: item.get('options'),
        programItem: item,
      };
    });
  },
});
