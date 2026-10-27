import { values } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import localStore from 'js/utils/local-store';

import SubRouterApp from 'js/base/subrouterapp';

import ClinicianSidebarApp from 'js/apps/clinicians/sidebar/clinician/clinician-sidebar_app';
import SearchView from 'js/components/list-search';

import { ListView, LayoutView, StatusFilterView, getStatusFilter, notFound } from 'js/apps/clinicians/clinicians-all/clinicians-all_views';
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
  stateEvents: {
    'change:statusFilter': 'onChangeStatusFilter',
  },
  viewEvents: {
    'click:addClinician': 'showAddModal',
  },
  createState() {
    return new Backbone.Model({
      currentRoute: null,
      statusFilter: 'active',
    });
  },
  onBeforeStart() {
    this.getState().set('statusFilter', this.getStoredStatusFilter());

    const view = this.setView(new LayoutView());

    view.render();
    view.getRegion('list').startPreloader({ variant: 'generic' });

    this.showSearchView();
    this.showStatusFilter();
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
  showStatusFilter() {
    const statusFilterView = this.getView().showChildView('statusFilter', new StatusFilterView({
      statusFilter: this.getState().get('statusFilter'),
    }));

    this.listenTo(statusFilterView, 'change:statusFilter', this.setStatusFilter);
  },
  setStatusFilter(statusFilter) {
    this.getState().set({ statusFilter });
  },
  getStatusFilterKey() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    return `cliniciansStatusFilter_${ currentUser.id }`;
  },
  getStoredStatusFilter() {
    return getStatusFilter(localStore.get(this.getStatusFilterKey()));
  },
  onChangeStatusFilter(state, statusFilter) {
    localStore.set(this.getStatusFilterKey(), statusFilter);
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
