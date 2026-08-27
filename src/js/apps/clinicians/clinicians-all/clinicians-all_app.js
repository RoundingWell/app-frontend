import { values } from 'underscore';
import Radio from 'backbone.radio';

import SubRouterApp from 'js/base/subrouterapp';

import ClinicianSidebarApp from 'js/apps/clinicians/sidebar/clinician/clinician-sidebar_app';
import SearchComponent from 'js/components/list-search';

import { ListView, LayoutView, notFound } from 'js/apps/clinicians/clinicians-all/clinicians-all_views';
import { getClinicianModal } from 'js/apps/clinicians/clinicians-all/clinician-modal/clinician-modal_views';

export default SubRouterApp.extend({
  routerAppName: 'CliniciansApp',
  routeScope: [],
  routeActions: {
    'clinician': 'showClinicianSidebar',
    'clinicians:all': 'hideCliniciansSidebar',
  },
  childApps: {
    sidebar: ClinicianSidebarApp,
  },
  viewEvents: {
    'click:addClinician': 'onClickAddClinician',
  },
  stateEvents: {
    'change:searchQuery': 'onChangSearchQuery',
  },
  onChangSearchQuery(state) {
    this.currentSearchQuery = state.get('searchQuery');
  },
  onBeforeStart() {
    this.showView(new LayoutView());
    this.getRegion('list').startPreloader({ variant: 'generic' });

    this.setState({ searchQuery: this.currentSearchQuery });

    this.showSearchView();
  },
  beforeStart() {
    return Radio.request('entities', 'fetch:clinicians:collection');
  },
  onStart(options, clinicians) {
    this.clinicians = clinicians;

    this.showChildView('list', new ListView({
      collection: this.clinicians,
      state: this.getState(),
    }));

    this.startCurrentRoute();
  },
  showSearchView() {
    const searchComponent = this.showChildView('search', new SearchComponent({
      state: {
        query: this.getState('searchQuery'),
      },
    }));

    this.listenTo(searchComponent.getState(), 'change:query', this.setSearchState);
  },
  setSearchState(state, searchQuery) {
    this.setState({
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

    Radio.request('sidebar', 'start', sidebarApp, { clinician });

    this.stopListening(sidebarApp, 'close');
    this.listenTo(sidebarApp, 'close', () => {
      Radio.trigger('event-router', 'clinicians:all');
    });
  },
  hideCliniciansSidebar() {
    this.stopChildApp('sidebar');
  },
  onClickAddClinician() {
    this.showAddModal();
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

            clinicianModal.getChildView('body').setState({ errors });
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
