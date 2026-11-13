import { Radio } from 'marionette';
import RouteApp from 'js/base/route-app';

import ProgramsAllApp from 'js/apps/programs/programs-all/programs-all_app';
import ProgramApp from 'js/apps/programs/program/program_app';
import ProgramFlowApp from 'js/apps/programs/program/flow/flow_app';

function unknownError(error) {
  Radio.trigger('event-router', 'unknownError', error?.response?.status);
}

export default RouteApp.extend({
  childApps: {
    programsAll: ProgramsAllApp,
    program: ProgramApp,
    programflow: ProgramFlowApp,
  },
  routes: {
    'programs': {
      name: 'programs:all',
      handler: 'showAll',
      meta: {
        isList: true,
      },
    },
    'program/:programId': {
      mount: 'program',
    },
    'program-flow/:flowId': {
      mount: 'programflow',
    },
  },
  showAll(match) {
    return this.switchTo('programsAll', {
      signal: match.signal,
      restart: true,
      options: {
        region: this.getRegion(),
      },
    }).catch(unknownError);
  },
  handleRouteError(error, match, { mount, phase }) {
    if (phase !== 'start') throw error;
    if (mount === 'programflow') {
      Radio.trigger('event-router', 'notFound');
      return;
    }
    unknownError(error);
  },
});
