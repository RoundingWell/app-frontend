import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

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
    workflows: WorkflowsApp,
    programSidebar: ProgramSidebarApp,
    flowSidebar: FlowSidebarApp,
  },

  initialize() {
    this.content = new RouteOutlet({ owner: this, onCleanupError: addError });
  },

  onBeforeStart() {
    this.showView(new LoadingView({ variant: 'generic' }));
  },

  prepareStart({ programId }, { signal }) {
    return Radio.request('entities', 'fetch:programs:model', programId, { signal });
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
    const { programId, actionId } = match.params;
    const actionApp = this.getChildApp('action');

    actionApp.stop();

    if (match.name === 'program:details') return this.showWorkflows(match);
    if (match.name === 'programFlow:new') return this.startFlowSidebar(match, programId);

    return this.startProgramAction(match, programId, actionId).catch(() => {
      actionApp.handleStartFailure();
      return this.showWorkflows(match);
    });
  },

  showWorkflows(match) {
    return this.content.show('workflows', {
      match,
      restart: true,
      options: {
        program: this.program,
        region: this.getView().getRegion('content'),
      },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },

  async startProgramAction(match, programId, actionId) {
    const actionApp = this.getChildApp('action');

    const started = await actionApp.start({ actionId, programId });

    if (!started) return;

    return this.editList(match, actionApp.action);
  },

  // Triggers event on started workflow for marking the edited item
  async editList(match, item) {
    const workflows = this.getChildApp('workflows');

    if (!workflows.isRunning()) {
      const current = await this.showWorkflows(match);

      current?.triggerMethod('edit:item', item);
      return;
    }

    workflows.triggerMethod('edit:item', item);
  },

  async startFlowSidebar(match, programId) {
    const flow = Radio.request('entities', 'programFlows:model', {
      _program: { id: programId, type: 'programs' },
      _owner: null,
      published_at: null,
      archived_at: null,
      behavior: PROGRAM_BEHAVIORS.STANDARD,
    });

    const flowSidebar = this.getChildApp('flowSidebar');

    const started = await Radio.request('sidebar', 'start', flowSidebar, { flow });

    if (!started) return;

    return this.editList(match, flow);
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
