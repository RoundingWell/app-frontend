import { Radio } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

import { addError } from 'js/datadog';

import { PROGRAM_BEHAVIORS } from 'js/static';

import App from 'js/base/app';

import WorkflowsApp from 'js/apps/programs/program/workflows/workflows_app';
import ActionApp from 'js/apps/programs/program/action/action_app';
import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';
import FlowSidebarApp from 'js/apps/programs/sidebar/flow/flow-sidebar_app';

import { LayoutView } from 'js/apps/programs/program/program_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';
import { LoadingView } from 'js/regions/preload_region';

export default App.extend({
  childApps: {
    action: ActionApp,
    content: ChildAppSwitcher.extend({ childApps: { workflows: WorkflowsApp }, onCleanupError: addError }),
    programSidebar: ProgramSidebarApp,
    flowSidebar: FlowSidebarApp,
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  async prepareStart({ programId }, { signal }) {
    const program = await Radio.request('entities', 'fetch:programs:model', programId, { signal });
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

  // Activates the detail of a match. The returned promise settles when the
  // detail is ready. The shell above is prepared once per program.
  showRoute(match) {
    this.routeSignal = match.signal;
    const { programId, actionId } = match.params;
    const actionApp = this.getChildApp('action');

    actionApp.stop();

    if (match.name === 'program:details') return this.showWorkflows();
    if (match.name === 'programFlow:new') return this.startFlowSidebar(programId);

    return this.startProgramAction(programId, actionId).catch(() => {
      actionApp.handleStartFailure();
      return this.showWorkflows();
    });
  },

  showWorkflows() {
    return this.getChildApp('content').switchTo('workflows', {
      signal: this.routeSignal,
      reconstruct: true,
      options: {
        program: this.program,
        region: this.getView().getRegion('content'),
      },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },

  async startProgramAction(programId, actionId) {
    const actionApp = this.getChildApp('action');

    const signal = this.routeSignal;
    const started = await actionApp.showSidebar({ actionId, programId }, { signal });

    if (!started || signal.aborted) return;

    return this.editList(actionApp.action);
  },

  // Triggers event on started workflow for marking the edited item
  async editList(item) {
    const workflows = this.getChildApp('content').getChildApp('workflows');

    if (!workflows.isRunning()) {
      const current = await this.showWorkflows();

      current?.triggerMethod('edit:item', item);
      return;
    }

    workflows.triggerMethod('edit:item', item);
  },

  async startFlowSidebar(programId) {
    const flow = Radio.request('entities', 'programFlows:model', {
      _program: { id: programId, type: 'programs' },
      _owner: null,
      published_at: null,
      archived_at: null,
      behavior: PROGRAM_BEHAVIORS.STANDARD,
    });

    const flowSidebar = this.getChildApp('flowSidebar');

    const signal = this.routeSignal;
    const started = await Radio.request('sidebar', 'start', flowSidebar, { flow });

    if (!started || signal.aborted) return;

    return this.editList(flow);
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
