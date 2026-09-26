import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import SubRouterApp from 'js/base/subrouterapp';

import { PROGRAM_BEHAVIORS } from 'js/static';

import WorkflowsApp from 'js/apps/programs/program/workflows/workflows_app';
import ActionApp from 'js/apps/programs/program/action/action_app';
import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';
import FlowSidebarApp from 'js/apps/programs/sidebar/flow/flow-sidebar_app';

import { LayoutView } from 'js/apps/programs/program/program_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';
import { LoadingView } from 'js/regions/preload_region';

export default SubRouterApp.extend({
  routeScope: ['programId'],
  childApps: {
    action: ActionApp,
    workflows: WorkflowsApp,
    programSidebar: ProgramSidebarApp,
    flowSidebar: FlowSidebarApp,
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

  onBeforeStartRoute() {
    this.getChildApp('action').stop().catch(addError);
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  prepareStart({ programId }, { signal }) {
    return Radio.request('entities', 'fetch:programs:model', programId, { signal });
  },

  onStart(app, options, program) {
    this.program = program;

    const view = this.setView(new LayoutView({ model: program }));

    view.render();

    this.showSidebar();

    this.startCurrentRoute();

    this.showView();
  },

  showWorkflows() {
    const routeContext = this.getCurrentRoute();

    return this.startCurrent('workflows', {
      region: this.getView().getRegion('content'),
    }).catch(error => {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },

  onRouteError(error, { event }) {
    if (event === 'program:action' || event === 'program:action:new') {
      this.getChildApp('action').handleStartFailure();
      return this.showWorkflows();
    }

    Radio.trigger('event-router', 'unknownError', error?.response?.status);
  },

  async startProgramAction(programId, actionId) {
    const actionApp = this.getChildApp('action');
    const routeContext = this.getCurrentRoute();
    const stopped = await actionApp.stop();

    if (!stopped || this.getCurrentRoute() !== routeContext || !this.isRunning()) return;

    const started = await actionApp.start({ actionId, programId });

    if (!started || this.getCurrentRoute() !== routeContext || !this.isRunning()) return;

    this.editList(actionApp.action);
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
