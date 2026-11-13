import { Radio } from 'marionette';

import { PROGRAM_BEHAVIORS } from 'js/static';

import RouteApp from 'js/base/route-app';

import WorkflowsApp from 'js/apps/programs/program/workflows/workflows_app';
import ActionApp from 'js/apps/programs/program/action/action_app';
import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';
import FlowSidebarApp from 'js/apps/programs/sidebar/flow/flow-sidebar_app';

import { LayoutView } from 'js/apps/programs/program/program_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';
import { LoadingView } from 'js/regions/preload_region';

export default RouteApp.extend({
  routes: {
    '': {
      name: 'program:details',
      handler: 'showWorkflows',
    },
    'action/:actionId': {
      name: 'program:action',
      handler: 'showAction',
    },
    'action': {
      name: 'program:action:new',
      handler: 'showAction',
    },
    'flow': {
      name: 'programFlow:new',
      handler: 'startFlowSidebar',
    },
  },

  childApps: {
    action: ActionApp,
    content: RouteApp.extend({
      childApps: {
        workflows: WorkflowsApp,
      },
    }),
    programSidebar: ProgramSidebarApp,
    flowSidebar: FlowSidebarApp,
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  async prepareStart({ programId }, { signal }) {
    const program = await Radio.request('entities', 'fetch:programs:model', programId, {
      signal,
    });
    signal.throwIfAborted();
    await this.getChildApp('content').start();
    signal.throwIfAborted();
    return program;
  },

  onStart(app, options, program) {
    this.program = program;

    this.setView(new LayoutView({ model: program }));

    this.showSidebar();

    this.showView();
  },

  onBeforeRoute() {
    this.getChildApp('action').stop();
  },
  showAction(match) {
    const { programId, actionId } = match.params;
    return this.startProgramAction(programId, actionId, match.signal).catch(() => {
      this.getChildApp('action').handleStartFailure();
      return this.showWorkflows(match);
    });
  },

  showWorkflows({ signal }) {
    return this.getChildApp('content').switchTo('workflows', {
      signal,
      restart: true,
      options: {
        program: this.program,
        region: this.getView().getRegion('content'),
      },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },

  async startProgramAction(programId, actionId, signal) {
    const actionApp = this.getChildApp('action');

    const started = await actionApp.showSidebar({
      actionId,
      programId,
    }, {
      signal,
    });

    if (!started || signal.aborted) return;

    return this.editList(actionApp.action, signal);
  },

  // Triggers event on started workflow for marking the edited item
  async editList(item, signal) {
    const workflows = this.getChildApp('content').getChildApp('workflows');

    if (!workflows.isRunning()) {
      const current = await this.showWorkflows({
        signal,
      });
      if (signal.aborted) return;

      current?.triggerMethod('edit:item', item);
      return;
    }

    workflows.triggerMethod('edit:item', item);
  },

  async startFlowSidebar({ params: { programId }, signal }) {
    const flow = Radio.request('entities', 'programFlows:model', {
      _program: { id: programId, type: 'programs' },
      _owner: null,
      published_at: null,
      archived_at: null,
      behavior: PROGRAM_BEHAVIORS.STANDARD,
    });

    const flowSidebar = this.getChildApp('flowSidebar');

    const started = await Radio.request('sidebar', 'start', flowSidebar, { flow });

    if (!started || signal.aborted) return;

    return this.editList(flow, signal);
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
