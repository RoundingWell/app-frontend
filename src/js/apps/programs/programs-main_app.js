import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import ProgramsAllApp from 'js/apps/programs/programs-all/programs-all_app';
import ProgramApp from 'js/apps/programs/program/program_app';
import ProgramFlowApp from 'js/apps/programs/program/flow/flow_app';

const PAGES = {
  'programs:all': 'programsAll',
  'program:details': 'program',
  'program:action': 'program',
  'program:action:new': 'program',
  'programFlow:new': 'program',
  'programFlow': 'programflow',
  'programFlow:action': 'programflow',
  'programFlow:action:new': 'programflow',
};

export default App.extend({
  childApps: {
    programsAll: ProgramsAllApp,
    program: ProgramApp,
    programflow: ProgramFlowApp,
  },
  initialize() {
    this.pages = new RouteOutlet({ owner: this, onCleanupError: addError });
  },
  showRoute(match) {
    const page = PAGES[match.name];

    return this.pages.show(page, this.getPageSelection(page, match)).catch(error => {
      if (page === 'programflow') {
        Radio.trigger('event-router', 'notFound');
        return;
      }

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },
  getPageSelection(page, match) {
    const { programId, flowId } = match.params;
    const region = this.getRegion();

    if (page === 'program') return { key: { programId }, match, options: { programId, region } };
    if (page === 'programflow') return { key: { flowId }, match, options: { flowId, region } };

    return { match, restart: true, options: { region } };
  },
});
