import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import intl from 'js/i18n';

import { LayoutView, ListView, AddActionDroplist } from 'js/apps/programs/program/workflows/workflows_views';

import './workflow-actions.scss';

export default App.extend({
  viewTriggers: {
    'click:add': 'click:add',
  },
  onBeforeStart({ program }) {
    this.program = program;
    this.showView(new LayoutView({ model: program }));
    this.getRegion('content').startPreloader({ variant: 'generic' });
  },
  beforeStart({ program }) {
    return [
      Radio.request('entities', 'fetch:programActions:collection:byProgram', { programId: program.id }),
      Radio.request('entities', 'fetch:programFlows:collection:byProgram', { programId: program.id }),
    ];
  },
  onStart({ program }, actions, flows) {
    this.collection = new Backbone.Collection([...actions.models, ...flows.models]);
    this.showChildView('content', new ListView({ collection: this.collection }));

    const actionDroplistMenu = new Backbone.Collection([
      {
        onSelect: () => {
          Radio.trigger('event-router', 'program:action:new', this.program.id);
        },
        icon: {
          type: 'far',
          icon: 'file-lines',
          classes: 'workflows__add-action-icon',
        },
        text: intl.programs.program.workflows.workflowsApp.newAction,
      },
      {
        onSelect: () => {
          Radio.trigger('event-router', 'programFlow:new', this.program.id);
        },
        icon: {
          type: 'far',
          icon: 'folder',
          classes: 'workflows__add-flow-icon',
        },
        text: intl.programs.program.workflows.workflowsApp.newFlow,
      },
    ]);

    this.showChildView('add', new AddActionDroplist({
      collection: actionDroplistMenu,
    }));
  },
  onEditItem(item) {
    if (item.isNew()) {
      this.collection.unshift(item);
      return;
    }
    item.trigger('editing', true);
  },
});
