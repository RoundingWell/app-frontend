import { Radio } from 'marionette';
import { RouteOutlet } from '@mnjs/router/outlet';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import CliniciansAllApp from 'js/apps/clinicians/clinicians-all/clinicians-all_app';

const PAGES = {
  'clinicians:all': 'cliniciansAll',
  'clinician': 'cliniciansAll',
};

export default App.extend({
  childApps: {
    cliniciansAll: CliniciansAllApp,
  },
  initialize() {
    this.pages = new RouteOutlet({ owner: this, onCleanupError: addError });
  },
  // The list is ready once started. The page then shows the sidebar of the match.
  async showRoute(match) {
    const pageApp = await this.pages.show(PAGES[match.name], {
      options: { region: this.getRegion() },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });

    if (!pageApp) return;

    return pageApp.showRoute(match);
  },
});
