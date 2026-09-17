import { Radio } from 'marionette';

import RouterApp from 'js/base/routerapp';

import ProgramsAllApp from 'js/apps/programs/programs-all/programs-all_app';
import ProgramApp from 'js/apps/programs/program/program_app';
import ProgramFlowApp from 'js/apps/programs/program/flow/flow_app';

export default RouterApp.extend({
  routerAppName: 'ProgramsApp',

  initialize() {
    const region = this.getRegion();

    this.addChildApp('programsAll', new ProgramsAllApp({ region }));
    this.addChildApp('program', new ProgramApp({ region }));
    this.addChildApp('programflow', new ProgramFlowApp({ region }));
  },

  eventRoutes: {
    'programs:all': {
      action: 'showProgramsAll',
      route: 'programs',
      meta: { isList: true },
    },
    'program:details': {
      action: 'showProgram',
      route: 'program/:id',
    },
    'program:action': {
      action: 'showProgram',
      route: 'program/:id/action/:id',
    },
    'program:action:new': {
      action: 'showProgram',
      route: 'program/:id/action',
    },
    'programFlow:new': {
      action: 'showProgram',
      route: 'program/:id/flow',
    },
    'programFlow': {
      action: 'showProgramFlow',
      route: 'program-flow/:id',
    },
    'programFlow:action': {
      action: 'showProgramFlow',
      route: 'program-flow/:id/action/:id',
    },
    'programFlow:action:new': {
      action: 'showProgramFlow',
      route: 'program-flow/:id/action',
    },
  },

  async showProgramsAll() {
    const routeContext = this.getCurrentRoute();

    try {
      return await this.startCurrent('programsAll');
    } catch(error) {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    }
  },
  async showProgram(programId) {
    const routeContext = this.getCurrentRoute();

    try {
      return await this.startRoute('program', { programId });
    } catch(error) {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    }
  },
  async showProgramFlow(flowId) {
    const routeContext = this.getCurrentRoute();

    try {
      return await this.startRoute('programflow', { flowId });
    } catch {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.trigger('event-router', 'notFound');
    }
  },
});
