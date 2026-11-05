import { Radio } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

import { addError } from 'js/datadog';

import CliniciansAllApp from 'js/apps/clinicians/clinicians-all/clinicians-all_app';

const PAGES = {
  'clinicians:all': 'cliniciansAll',
  'clinician': 'cliniciansAll',
};

export default ChildAppSwitcher.extend({
  childApps: {
    cliniciansAll: CliniciansAllApp,
  },
  onCleanupError: addError,
  // The list is ready once started. The page then shows the sidebar of the match.
  async showRoute(match) {
    const pageApp = await this.switchTo(PAGES[match.name], {
      signal: match.signal,
      options: { region: this.getRegion() },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });

    if (!pageApp) return;

    return pageApp.showRoute(match);
  },
});
