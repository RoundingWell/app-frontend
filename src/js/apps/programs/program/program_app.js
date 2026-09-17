import { Radio } from 'marionette';

import SubRouterApp from 'js/base/subrouterapp';

import { PROGRAM_BEHAVIORS } from 'js/static';

import WorkflowsApp from 'js/apps/programs/program/workflows/workflows_app';
import ActionApp from 'js/apps/programs/program/action/action_app';
import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';
import FlowSidebarApp from 'js/apps/programs/sidebar/flow/flow-sidebar_app';

import { LayoutView } from 'js/apps/programs/program/program_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';

export default SubRouterApp.extend({
  routeScope: ['programId'],

  initialize() {
    this.addChildApp('action', new ActionApp());
    this.addChildApp('programSidebar', new ProgramSidebarApp({
      region: Radio.request('sidebar', 'region'),
    }));
    this.addChildApp('flowSidebar', new FlowSidebarApp({
      region: Radio.request('sidebar', 'region'),
    }));
  },

  routeActions: {
    'program:details': 'showWorkflows',
    'program:action': 'startProgramAction',
    'program:action:new': 'startProgramAction',
    'programFlow:new': 'startFlowSidebar',
  },

  currentAppOptions() {
    return {
      program: this.program,
    };
  },

  onBeforeStart() {
    this.getRegion().startPreloader({ variant: 'generic' });
  },

  prepareStart({ programId }, { signal }) {
    return Radio.request('entities', 'fetch:programs:model', programId, { signal });
  },

  onStart(app, options, program) {
    this.program = program;

    const view = this.setView(new LayoutView({ model: program }));

    view.render();

    this.addChildApp('workflows', new WorkflowsApp({
      region: view.getRegion('content'),
    }));

    this.showSidebar();

    this.startCurrentRoute();

    this.showView();
  },

  prepareStop(options) {
    if (!this.hasChildApp('workflows')) return;

    return this.removeChildApp('workflows', options);
  },

  showWorkflows() {
    const routeContext = this.getCurrentRoute();

    return this.startCurrent('workflows').catch(error => {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },

  startProgramAction(programId, actionId) {
    const actionApp = this.getChildApp('action');
    const routeContext = this.getCurrentRoute();

    actionApp.restart({ actionId, programId })
      .then(started => {
        if (!started || this.getCurrentRoute() !== routeContext) return;

        this.editList(actionApp.action);
      })
      .catch(() => {
        if (this.getCurrentRoute() !== routeContext) return;

        this.showWorkflows();
      });
  },

  // Triggers event on started workflow for marking the edited item
  editList(item) {
    const workflows = this.getChildApp('workflows');

    if (!workflows.isRunning()) {
      this.showWorkflows().then(current => {
        current?.triggerMethod('edit:item', item);
      });
      return;
    }

    workflows.triggerMethod('edit:item', item);
  },

  async startFlowSidebar(programId) {
    const routeContext = this.getCurrentRoute();
    const flow = Radio.request('entities', 'programFlows:model', {
      _program: { id: programId, type: 'programs' },
      _owner: null,
      published_at: null,
      archived_at: null,
      behavior: PROGRAM_BEHAVIORS.STANDARD,
    });

    const flowSidebar = this.getChildApp('flowSidebar');

    const started = await Radio.request('sidebar', 'start', flowSidebar, { flow });

    if (!started || this.getCurrentRoute() !== routeContext) return;

    this.editList(flow);
  },

  showSidebar() {
    const sidebarView = new SidebarView({ model: this.program });

    this.listenTo(sidebarView, {
      'edit': this.onEdit,
    });

    this.getView().showChildView('sidebar', sidebarView);
  },

  onEdit() {
    const programSidebar = this.getChildApp('programSidebar');
    Radio.request('sidebar', 'start', programSidebar, { program: this.program });
  },
});
