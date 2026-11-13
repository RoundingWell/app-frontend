import { Radio } from 'marionette';
import RouteApp from 'js/base/route-app';

import CliniciansAllApp from 'js/apps/clinicians/clinicians-all/clinicians-all_app';

export default RouteApp.extend({
  childApps: {
    cliniciansAll: CliniciansAllApp,
  },
  routes: {
    'clinicians': {
      mount: 'cliniciansAll',
    },
  },
  handleRouteError(error, match, { phase }) {
    if (phase !== 'start') throw error;
    Radio.trigger('event-router', 'unknownError', error?.response?.status);
  },
});
