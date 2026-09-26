import { values } from 'underscore';
import { Radio } from 'marionette';

import SubRouterApp from 'js/base/subrouterapp';

import ClinicianSidebarApp from 'js/apps/clinicians/sidebar/clinician/clinician-sidebar_app';
import SearchView from 'js/components/list-search';

import { ListView, LayoutView, notFound } from 'js/apps/clinicians/clinicians-all/clinicians-all_views';
import { getClinicianModal } from 'js/apps/clinicians/clinicians-all/clinician-modal/clinician-modal_views';

export default SubRouterApp.extend({
  routerAppName: 'CliniciansApp',
  routeScope: [],
  childApps: {
    sidebar: ClinicianSidebarApp,
  },
  routeActions: {
    'clinician': 'showClinicianSidebar',
    'clinicians:all': 'hideCliniciansSidebar',
  },
  onBeforeStart() {
    const view = this.setView(new LayoutView());

    view.render();
    view.getRegion('list').startPreloader({ variant: 'generic' });

    this.listenTo(view, 'click:addClinician', this.showAddModal);

    this.showSearchView();
    this.showView();
  },
  prepareStart(options, { signal }) {
    return Radio.request('entities', 'fetch:clinicians:collection', { signal });
  },
  onStart(app, options, clinicians) {
    this.clinicians = clinicians;

    this.getView().showChildView('list', new ListView({
      collection: this.clinicians,
      state: this.getState(),
    }));

    this.startCurrentRoute();
  },
  showSearchView() {
    const searchView = this.getView().showChildView('search', new SearchView({
      query: this.getState().get('searchQuery'),
    }));

    this.listenTo(searchView, 'change:query', this.setSearchState);
  },
  setSearchState(searchQuery) {
    this.getState().set({
      searchQuery: searchQuery.length > 2 ? searchQuery : '',
    });
  },
  showClinicianSidebar(clinicianId) {
    const clinician = this.clinicians.get(clinicianId);

    if (!clinician) {
      Radio.request('alert', 'show:error', notFound);
      Radio.trigger('event-router', 'clinicians:all');
      return;
    }

    const sidebarApp = this.getChildApp('sidebar');

    this.stopListening(sidebarApp, 'close');
    this.listenTo(sidebarApp, 'close', () => {
      Radio.trigger('event-router', 'clinicians:all');
    });

    return Radio.request('sidebar', 'start', sidebarApp, { clinician });
  },
  hideCliniciansSidebar() {
    return this.getChildApp('sidebar').stop();
  },
  _getNewClinician() {
    return Radio.request('entities', 'clinicians:model', {
      enabled: true,
    });
  },
  showAddModal() {
    const clinician = this._getNewClinician();
    const clinicianClone = clinician.clone();
    const clinicianModal = Radio.request('modal', 'show', getClinicianModal({
      clinician: clinicianClone,
      onSubmit: () => {
        clinicianModal.disableSubmit();
        clinician.saveAll(clinicianClone.attributes)
          .then(() => {
            this.clinicians.add(clinician);
            Radio.trigger('event-router', 'clinician', clinician.id);
            clinicianModal.destroy();
          })
          .catch(error => {
            clinicianModal.disableSubmit();
            const errors = clinician.parseErrors(error.responseData);

            clinicianModal.getChildView('body').showErrors(errors);
            Radio.request('alert', 'show:error', values(errors).join(', '));
          });
      },
    }));

    clinicianModal.disableSubmit();
    clinicianModal.listenTo(clinicianClone, {
      'change'() {
        clinicianModal.disableSubmit(!clinicianClone.isValid({ isManualCreation: true }));
      },
    });
  },
});
