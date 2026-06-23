import RouterApp from 'js/base/routerapp';

import ProgramsAllApp from 'js/apps/programs/programs-all/programs-all_app';
import ProgramApp from 'js/apps/programs/program/program_app';
import ProgramFlowApp from 'js/apps/programs/program/flow/flow_app';

export default RouterApp.extend({
  routerAppName: 'ProgramsApp',

  childApps: {
    programsAll: ProgramsAllApp,
    program: ProgramApp,
    programflow: ProgramFlowApp,
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

  showProgramsAll() {
    this.startCurrent('programsAll');
  },
  showProgram(programId) {
    this.startRoute('program', { programId });
  },
  showProgramFlow(flowId) {
    this.startRoute('programflow', { flowId });
  },
});
