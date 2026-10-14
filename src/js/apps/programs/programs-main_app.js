import { Radio } from 'marionette';

import RouterApp from 'js/base/routerapp';

import ProgramsAllApp from 'js/apps/programs/programs-all/programs-all_app';
import ProgramApp from 'js/apps/programs/program/program_app';
import ProgramFlowApp from 'js/apps/programs/program/flow/flow_app';

export default RouterApp.extend({
  childApps: {
    programsAll: ProgramsAllApp,
    program: ProgramApp,
    programflow: ProgramFlowApp,
  },

  eventRoutes: {
    'programs:all': {
      action: 'showProgramsAll',
    },
    'program:details': {
      action: 'showProgram',
    },
    'program:action': {
      action: 'showProgram',
    },
    'program:action:new': {
      action: 'showProgram',
    },
    'programFlow:new': {
      action: 'showProgram',
    },
    'programFlow': {
      action: 'showProgramFlow',
    },
    'programFlow:action': {
      action: 'showProgramFlow',
    },
    'programFlow:action:new': {
      action: 'showProgramFlow',
    },
  },

  showProgramsAll() {
    return this.startCurrent('programsAll');
  },
  showProgram(programId) {
    return this.startRoute('program', { programId });
  },
  showProgramFlow(flowId) {
    return this.startRoute('programflow', { flowId });
  },
  onRouteError(error, { definition }) {
    if (definition.action === 'showProgramFlow') {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    Radio.trigger('event-router', 'unknownError', error?.response?.status);
  },
});
