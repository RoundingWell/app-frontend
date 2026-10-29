import { Radio } from 'marionette';

import RouterApp from 'js/base/routerapp';

import ProgramsAllApp from 'js/apps/programs/programs-all/programs-all_app';
import ReportApp from 'js/apps/programs/report/report_app';

export default RouterApp.extend({
  routerAppName: 'ProgramsApp',
  childApps: {
    programsAll: ProgramsAllApp,
    report: ReportApp,
  },
  eventRoutes: {
    'programs:all': {
      action: 'showProgramsAll',
      route: 'programs',
      meta: { isList: true },
    },
    'program:details': {
      action: 'showProgram',
      route: 'program/:programId',
    },
    'program:action': {
      action: 'showProgram',
      route: 'program/:programId/action/:actionId',
    },
    'programFlow': {
      action: 'showProgramFlow',
      route: 'program-flow/:flowId',
    },
    'programFlow:action': {
      action: 'showProgramFlow',
      route: 'program-flow/:flowId/action/:actionId',
    },
  },
  showProgramsAll() {
    return this.startCurrent('programsAll');
  },
  showProgram(programId) {
    return this.startRoute('report', { programId });
  },
  showProgramFlow(flowId) {
    return this.startRoute('report', { flowId });
  },
  onRouteError(error) {
    if (error?.response?.status === 404) {
      Radio.trigger('event-router', 'notFound');
      return;
    }

    Radio.trigger('event-router', 'unknownError', error?.response?.status);
  },
});
