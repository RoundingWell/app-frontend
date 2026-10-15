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
  // The list is ready once started. A program or flow shows the detail of the match next.
  async showRoute(match) {
    const page = PAGES[match.name];

    const pageApp = await this.pages.show(page, this.getPageSelection(page, match)).catch(error => {
      if (page === 'programflow') {
        Radio.trigger('event-router', 'notFound');
        return;
      }

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });

    if (!pageApp || page === 'programsAll') return;

    return pageApp.showRoute(match);
  },
  getPageSelection(page, match) {
    const { programId, flowId } = match.params;
    const region = this.getRegion();

    if (page === 'program') return { key: { programId }, options: { programId, region } };
    if (page === 'programflow') return { key: { flowId }, options: { flowId, region } };

    return { restart: true, options: { region } };
  },
});
