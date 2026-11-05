import { Radio } from 'marionette';

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
    'programFlow': {
      action: 'showProgramFlow',
      route: 'program-flow/:id',
    },
  },

  showProgramsAll() {
    return this.startCurrent('programsAll');
  },
  showProgram(programId) {
    return this.startCurrent('program', { programId });
  },
  showProgramFlow(flowId) {
    return this.startCurrent('programflow', { flowId });
  },
  onRouteError(error, { definition }) {
    if (definition.action === 'showProgramFlow') {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    Radio.trigger('event-router', 'unknownError', error?.response?.status);
  },
});
