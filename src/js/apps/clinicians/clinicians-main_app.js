import { Radio } from 'marionette';

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

  async showCliniciansAll() {
    const routeContext = this.getCurrentRoute();

    try {
      return await this.startRoute('cliniciansAll');
    } catch(error) {
      if (this.getCurrentRoute() !== routeContext) return;

      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    }
  },
});
