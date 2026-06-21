import { partial } from 'underscore';
import Radio from 'backbone.radio';

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

  routeActions() {
    return {
      'program:details': partial(this.startCurrent, 'workflows'),
      'program:action': this.startProgramAction,
      'program:action:new': this.startProgramAction,
      'programFlow:new': this.startFlowSidebar,
    };
  },

  childApps: {
    workflows: WorkflowsApp,
    action: ActionApp,
    programSidebar: ProgramSidebarApp,
    flowSidebar: FlowSidebarApp,
  },

  currentAppOptions() {
    return {
      region: this.getRegion('content'),
      program: this.getOption('program'),
    };
  },

  onBeforeStart() {
    this.getRegion().startPreloader();
  },

  beforeStart({ programId }) {
    return Radio.request('entities', 'fetch:programs:model', programId);
  },

  onStart(options, program) {
    this.program = program;

    this.setView(new LayoutView({ model: program }));

    this.showSidebar();

    this.startCurrentRoute();

    this.showView();
  },

  startProgramAction(programId, actionId) {
    const actionApp = this.getChildApp('action');

    this.listenToOnce(actionApp, {
      'start'(options, action) {
        this.editList(action);
      },
      'fail'() {
        this.startCurrent('workflows');
      },
    });

    this.startChildApp('action', { actionId, programId });
  },

  // Triggers event on started workflow for marking the edited item
  editList(item) {
    const currentWorkflow = this.getCurrent() || this.startCurrent('workflows');

    if (!currentWorkflow.isRunning()) {
      this.listenToOnce(currentWorkflow, 'start', () => {
        currentWorkflow.triggerMethod('edit:item', item);
      });
      return;
    }

    currentWorkflow.triggerMethod('edit:item', item);
  },

  startFlowSidebar(programId) {
    const flow = Radio.request('entities', 'programFlows:model', {
      _program: { id: programId, type: 'programs' },
      _owner: null,
      published_at: null,
      archived_at: null,
      behavior: PROGRAM_BEHAVIORS.STANDARD,
    });

    const flowSidebar = this.getChildApp('flowSidebar');

    Radio.request('sidebar', 'start', flowSidebar, { flow });

    this.editList(flow);
  },

  showSidebar() {
    const sidebarView = new SidebarView({ model: this.program });

    this.listenTo(sidebarView, {
      'edit': this.onEdit,
    });

    this.showChildView('sidebar', sidebarView);
  },

  onEdit() {
    const programSidebar = this.getChildApp('programSidebar');
    Radio.request('sidebar', 'start', programSidebar, { program: this.program });
  },
});
