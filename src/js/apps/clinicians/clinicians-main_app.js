import RouterApp from 'js/base/routerapp';

import CliniciansAllApp from 'js/apps/clinicians/clinicians-all/clinicians-all_app';

export default RouterApp.extend({
  routerAppName: 'CliniciansApp',

  childApps: {
    cliniciansAll: CliniciansAllApp,
  },

  eventRoutes: {
    'clinicians:all': {
      action: 'showCliniciansAll',
      route: 'clinicians',
      meta: { isList: true },
    },
    'clinician': {
      action: 'showCliniciansAll',
      route: 'clinicians/:id',
    },
  },

  showCliniciansAll() {
    this.startRoute('cliniciansAll');
  },
});
