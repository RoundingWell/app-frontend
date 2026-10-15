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

  onStart(app, { route }, program) {
    this.route = route;
    this.program = program;
    this.listenTo(route, 'change', this.showRoute);

    this.setView(new LayoutView({ model: program }));

    this.showSidebar();

    this.showRoute();

    this.showView();
  },

  onStop() {
    this.stopListening(this.route);
  },

  showRoute() {
    const name = this.route.getName();
    const { programId, actionId } = this.route.getParams();
    const actionApp = this.getChildApp('action');

    actionApp.stop();

    if (name === 'program:details') return this.showWorkflows();
    if (name === 'programFlow:new') return this.startFlowSidebar(programId);

    return this.startProgramAction(programId, actionId).catch(() => {
      actionApp.handleStartFailure();
      return this.showWorkflows();
    });
  },

  showWorkflows() {
    return this.content.show('workflows', {
      match: this.route.getMatch(),
      restart: true,
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

    const started = await actionApp.start({ actionId, programId });

    if (!started) return;

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
