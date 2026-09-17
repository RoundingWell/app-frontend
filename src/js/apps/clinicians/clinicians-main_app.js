import RouterApp from 'js/base/routerapp';

import CliniciansAllApp from 'js/apps/clinicians/clinicians-all/clinicians-all_app';

export default RouterApp.extend({
  routerAppName: 'CliniciansApp',

  initialize() {
    const region = this.getRegion();

    this.addChildApp('cliniciansAll', new CliniciansAllApp({ region }));
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
    return this.startRoute('cliniciansAll');
  },
});
