import { Radio } from 'marionette';

import SubRouterApp from 'js/base/subrouterapp';

import ActionApp from 'js/apps/programs/program/action/action_app';

import ProgramSidebarApp from 'js/apps/programs/sidebar/program/program-sidebar_app';
import FlowSidebarApp from 'js/apps/programs/sidebar/flow/flow-sidebar_app';

import { LayoutView, ContextTrailView, HeaderView, AddActionView, ListView } from 'js/apps/programs/program/flow/flow_views';
import { SidebarView } from 'js/apps/programs/program/sidebar/sidebar-views';

export default SubRouterApp.extend({
  routerAppName: 'ProgramFlowApp',
  childApps: {
    action: ActionApp,
    programSidebar: ProgramSidebarApp,
    flowSidebar: FlowSidebarApp,
  },
  routeScope: ['flowId'],
  routeActions: {
    'programFlow:action': 'showActionSidebar',
    'programFlow:action:new': 'showActionSidebar',
  },
  onBeforeStart() {
    this.setView(new LayoutView()).render();
  },
  prepareStart({ flowId }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:programs:model:byProgramFlow', flowId, { signal }),
      Radio.request('entities', 'fetch:programFlows:model', flowId, { signal }),
      Radio.request('entities', 'fetch:programActions:collection:byProgramFlow', flowId, { signal }),
    ]);
  },
  onStart(app, options, [program, flow, actions]) {
    this.program = program;
    this.flow = flow;
    this.actions = actions;

    this.maintainFlowActions();

    this.getView().showChildView('contextTrail', new ContextTrailView({
      model: this.flow,
      program: this.program,
    }));

    this.showHeader();
    this.showAddAction();
    this.showActionList();
    this.showProgramSidebar();

    this.startCurrentRoute();
    this.showView();
  },

  maintainFlowActions() {
    this.listenTo(this.actions, {
      'change:id': this.updateFlowActions,
      'destroy': this.updateFlowActions,
    });
  },
  updateFlowActions() {
    this.flow.setActions(this.actions);
  },

  showHeader() {
    const headerView = new HeaderView({
      model: this.flow,
    });

    this.listenTo(headerView, {
      'edit': this.onEditFlow,
    });

    this.getView().showChildView('header', headerView);
  },

  showAddAction() {
    const addActionView = new AddActionView();

    this.listenTo(addActionView, {
      'click:addAction': () => {
        Radio.trigger('event-router', 'programFlow:action:new', this.flow.id);
      },
    });

    this.getView().showChildView('addAction', addActionView);
  },

  showActionList() {
    this.getView().showChildView('actionList', new ListView({
      collection: this.actions,
    }));
  },

  showProgramSidebar() {
    const sidebarView = new SidebarView({ model: this.program });

    this.listenTo(sidebarView, {
      'edit': this.onEditProgram,
    });

    this.getView().showChildView('sidebar', sidebarView);
  },

  showActionSidebar(flowId, actionId) {
    const actionApp = this.getChildApp('action');
    const routeContext = this.getCurrentRoute();

    return actionApp.restart({ actionId, flowId })
      .then(started => {
        if (!started || this.getCurrentRoute() !== routeContext) return;

        this.editAction(actionApp.action);
      })
      .catch(error => {
        if (this.getCurrentRoute() !== routeContext || error?.response) return;

        throw error;
      });
  },

  editAction(action) {
    if (action.isNew()) {
      action.set({ sequence: this.actions.length });
      this.actions.add(action);
      return;
    }

    action.trigger('editing', true);
  },

  onEditProgram() {
    const programSidebar = this.getChildApp('programSidebar');
    Radio.request('sidebar', 'start', programSidebar, { program: this.program });
  },

  onEditFlow() {
    const flowSidebar = this.getChildApp('flowSidebar');
    Radio.request('sidebar', 'start', flowSidebar, { flow: this.flow });
  },
});
