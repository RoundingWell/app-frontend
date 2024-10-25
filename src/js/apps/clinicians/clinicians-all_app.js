import { values } from 'underscore';
import Radio from 'backbone.radio';

import SubRouterApp from 'js/base/subrouterapp';

import SearchComponent from 'js/views/shared/components/list-search';

import { ListView, LayoutView, notFound } from 'js/views/clinicians/clinicians-all_views';
import { getClinicianModal } from 'js/views/clinicians/clinician-modal/clinician-modal_views';

export default SubRouterApp.extend({
  routerAppName: 'CliniciansApp',
  eventRoutes: {
    'clinician': 'showClinicianSidebar',
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
    this.getRegion('list').startPreloader();

    this.setState({ searchQuery: this.currentSearchQuery });

    this.showSearchView();
  },
  beforeStart() {
    return Radio.request('entities', 'fetch:clinicians:collection');
  },
  onStart({ currentRoute }, clinicians) {
    this.clinicians = clinicians;

    this.showChildView('list', new ListView({
      collection: this.clinicians,
      state: this.getState(),
    }));

    this.startRoute(currentRoute);
  },
  _getClinician(clinicianId) {
    if (!clinicianId) {
      return Radio.request('entities', 'clinicians:model', {
        enabled: true,
        disabled_at: null,
      });
    }

    return this.clinicians.get(clinicianId);
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
    const clinician = this._getClinician(clinicianId);

    if (!clinician) {
      Radio.request('alert', 'show:error', notFound);
      Radio.trigger('event-router', 'clinicians:all');
      return;
    }

    Radio.request('sidebar', 'start', 'clinician', { clinician });

    clinician.trigger('editing', true);
  },
  onClickAddClinician() {
    this.showAddModal();
  },
  showAddModal() {
    const clinician = this._getClinician();
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
        clinicianModal.disableSubmit(!clinicianClone.isValid());
      },
    });
  },
});
