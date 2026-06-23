import { compact, isEqual, noop, partial, defer } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import localStore from 'js/utils/local-store';

import RouterApp from 'js/base/routerapp';

import SearchApp from 'js/apps/globals/search/search_app';
import { AppNavView, AppNavCollectionView, MainNavDroplist, PatientsAppNav, BottomNavView, NavItemView, AdminToolsDroplist, i18n } from 'js/apps/globals/nav/app-nav/app-nav_views';
import { getPatientModal, ErrorView } from 'js/apps/globals/nav/patient-modal/patient-modal_views';

const StateModel = Backbone.Model.extend({
  defaults: {
    isMinimized: false,
  },
});

const dashboardsNav = new Backbone.Model({
  text: i18n.dashboardsNav.dashboards,
  icons: [{
    type: 'far',
    icon: 'gauge',
  }],
  event: 'dashboards:all',
  eventArgs: [],
});

const adminNavMenu = new Backbone.Collection([
  {
    onSelect() {
      Radio.trigger('event-router', 'programs:all');
    },
    id: 'ProgramsApp',
    text: i18n.adminNav.programs,
    icon: {
      type: 'far',
      icon: 'screwdriver-wrench',
    },
  },
  {
    onSelect() {
      Radio.trigger('event-router', 'clinicians:all');
    },
    id: 'CliniciansApp',
    text: i18n.adminNav.clinicians,
    icon: {
      type: 'far',
      icon: 'users-gear',
    },
  },
]);

const patientsAppWorkflowsNav = new Backbone.Collection([
  {
    text: i18n.patientsAppNav.ownedBy,
    icons: [{
      type: 'fas',
      icon: 'list',
    }],
    event: 'worklist',
    eventArgs: ['owned-by'],
  },
  {
    text: i18n.patientsAppNav.schedule,
    icons: [{
      type: 'fas',
      icon: 'calendar-star',
    }],
    event: 'schedule',
    eventArgs: [],
  },
  {
    text: i18n.patientsAppNav.sharedBy,
    icons: [{
      type: 'fas',
      icon: 'arrow-right-arrow-left',
    }],
    event: 'worklist',
    eventArgs: ['shared-by'],
  },
  {
    text: i18n.patientsAppNav.newPastDay,
    icons: [
      {
        type: 'fas',
        icon: 'angle-left',
      },
      {
        type: 'fas',
        icon: '1',
      },
    ],
    event: 'worklist',
    eventArgs: ['new-past-day'],
  },
  {
    text: i18n.patientsAppNav.updatedPastThree,
    icons: [
      {
        type: 'fas',
        icon: 'angle-left',
      },
      {
        type: 'fas',
        icon: '3',
      },
    ],
    event: 'worklist',
    eventArgs: ['updated-past-three-days'],
  },
  {
    text: i18n.patientsAppNav.doneLastThirty,
    icons: [
      {
        type: 'fas',
        icon: '3',
      },
      {
        type: 'fas',
        icon: '0',
      },
    ],
    event: 'worklist',
    eventArgs: ['done-last-thirty-days'],
  },
]);

export default RouterApp.extend({
  eventRoutes() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const workspaces = currentUser.getWorkspaces();

    const rootRoute = {
      action: 'setWorkspace',
      route: '',
      root: true,
    };

    // Add a root route for each user workspace
    return workspaces.reduce((routes, workspace) => {
      const route = workspace.get('slug');
      routes[`workspace:${ route }`] = {
        action: partial(this.setWorkspace, route),
        root: true,
        route: [route, `${ route }/*route`],
      };
      return routes;
    }, { 'root': rootRoute });
  },
  setWorkspace(slug, route) {
    const workspace = Radio.request('workspace', 'current', slug);
    const workspaceSlug = workspace && workspace.get('slug');

    if (!workspaceSlug || route) return;

    defer(() => {
      this.replaceUrl(this.getDefaultRoute());
    });
  },
  getDefaultRoute() {
    const workspace = Radio.request('workspace', 'current');
    const workspaceSlug = workspace.get('slug');

    return `/${ workspaceSlug }/worklist/owned-by`;
  },
  // NOTE: Don't stop this app on no match
  onNoMatch: noop,
  StateModel,
  startAfterInitialized: true,
  channelName: 'nav',
  initialize() {
    const workspaceCh = Radio.channel('workspace');

    this.listenTo(workspaceCh, 'change:workspace', () => {
      this.setCanPatientCreate();
      this.showNav();
    });

    const routerCh = Radio.channel('event-router');

    this.listenTo(routerCh, 'default', () => {
      defer(() => {
        Backbone.history.navigate(this.getDefaultRoute(), { trigger: true });
      });
    });
  },
  radioRequests: {
    'search': 'showSearch',
    'patient': 'showPatientModal',
    'select': 'selectNav',
  },
  stateEvents: {
    'change:currentApp': 'onChangeCurrentApp',
    'change:isMinimized': 'onChangeIsMinimized',
  },
  viewEvents: {
    'click:addPatient': 'onClickAddPatient',
    'click:minimizeMenu': 'onClickMinimizeMenu',
  },
  childApps: {
    search: SearchApp,
  },
  selectNav(appName, event, eventArgs) {
    this.setState('currentApp', appName);

    this.navMatch = this.getNavMatch(appName, event, compact(eventArgs));

    if (event === 'dashboards:all' && !this.navMatch) this.navMatch = dashboardsNav;

    if (this.navMatch) {
      this.getView().removeSelected();
      this.navMatch.trigger('selected');
    }
  },
  onChangeCurrentApp(state, appName) {
    this.setSelectedAdminNavItem(appName);

    this.getView().removeSelected();
  },
  onChangeIsMinimized() {
    this.showNav();

    if (this.navMatch) {
      this.getView().removeSelected();
      this.navMatch.trigger('selected');
    }

    const currentAppName = this.getState('currentApp');
    this.setSelectedAdminNavItem(currentAppName);

    localStore.set('isNavMenuMinimized', this.getState('isMinimized'));
  },
  getNavMatch(appName, event, eventArgs) {
    return this._navMatch(patientsAppWorkflowsNav, event, eventArgs);
  },
  _navMatch(navCollection, event, eventArgs) {
    return navCollection.find(model => {
      return model.get('event') === event && isEqual(model.get('eventArgs')[0], eventArgs[0]);
    });
  },
  onBeforeStart() {
    const storedState = localStore.get('isNavMenuMinimized');

    if (storedState) {
      this.setState('isMinimized', storedState);
      return;
    }

    localStore.set('isNavMenuMinimized', this.getState('isMinimized'));
  },
  onStart() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (!currentUser.can('clinicians:manage')) {
      adminNavMenu.remove('CliniciansApp');
    }

    if (!currentUser.can('programs:manage')) {
      adminNavMenu.remove('ProgramsApp');
    }

    this.setView(new AppNavView({ model: this.getState() }));

    this.setCanPatientCreate();
    this.showNav();

    this.showView();
  },
  setCanPatientCreate() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const hasManualPatientCreate = Radio.request('settings', 'get', 'manual_patient_creation');
    this.canPatientCreate = hasManualPatientCreate && currentUser.can('patients:manage');
  },
  setSelectedAdminNavItem(appName) {
    if (!adminNavMenu.length) return;

    const selectedApp = adminNavMenu.get(appName);

    if (!selectedApp) this.adminNavMenu.setState('selected', null);

    this.adminNavMenu.setState('selected', selectedApp);
  },
  showBottomNavView() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    const bottomNavView = new BottomNavView({
      model: this.getState(),
      canPatientCreate: this.canPatientCreate,
    });

    this.showChildView('bottomNavContent', bottomNavView);

    if (currentUser.can('dashboards:view')) {
      this.dashboardsNavView = new NavItemView({ model: dashboardsNav, state: this.getState() });
      bottomNavView.showChildView('dashboards', this.dashboardsNavView);
    }

    if (adminNavMenu.length) {
      this.adminNavMenu = new AdminToolsDroplist({ collection: adminNavMenu, state: this.getState() });
      bottomNavView.showChildView('adminTools', this.adminNavMenu);
    }
  },
  showMainNavDroplist() {
    const currentWorkspace = Radio.request('workspace', 'current');
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const workspaces = currentUser.getWorkspaces();

    const workspacesMenu = new Backbone.Collection(
      workspaces.map(workspace => {
        return {
          id: workspace.id,
          onSelect() {
            Radio.trigger('event-router', `workspace:${ workspace.get('slug') }`);
          },
          text: workspace.get('name'),
          icon: {
            type: 'far',
            icon: 'window',
          },
        };
      }),
    );

    this.showChildView('navMain', new MainNavDroplist({
      collection: workspacesMenu,
      state: {
        selected: workspacesMenu.get(currentWorkspace.id),
        isMinimized: this.getState('isMinimized'),
      },
    }));
  },
  showNav() {
    this.showMainNavDroplist();

    const navView = new PatientsAppNav({
      model: this.getState(),
    });

    const workflowsCollectionView = new AppNavCollectionView({ collection: patientsAppWorkflowsNav, model: this.getState() });

    navView.showChildView('worklists', workflowsCollectionView);

    this.listenTo(navView, 'search', () => {
      this.showSearch();
    });

    const hotkeyCh = Radio.channel('hotkey');
    navView.listenTo(hotkeyCh, 'search', evt => {
      evt.preventDefault();
      this.showSearch();
    });

    this.showChildView('navContent', navView);

    this.showBottomNavView();
  },
  showSearch(prefillText) {
    const navView = this.getChildView('navContent');

    const searchApp = this.startChildApp('search', {
      prefillText,
      canPatientCreate: this.canPatientCreate,
    });

    this.listenTo(searchApp, {
      'stop'() {
        navView.triggerMethod('search:active', false);
      },
      'click:addPatient': this.onClickAddPatient,
    });

    navView.triggerMethod('search:active', true);
  },
  onClickAddPatient() {
    this.showPatientModal();
  },
  onClickMinimizeMenu() {
    this.toggleState('isMinimized');
  },
  getNewPatient() {
    const currentClinician = Radio.request('bootstrap', 'currentUser');
    const workspaces = currentClinician.getWorkspaces();

    if (workspaces.length === 1) {
      return Radio.request('entities', 'patients:model', {
        _workspaces: [workspaces.first().getResource()],
      });
    }

    return Radio.request('entities', 'patients:model');
  },
  showPatientModal(patient) {
    const { form_id: patientFormId } = Radio.request('settings', 'get', 'patient_creation_form') || {};

    patient = patient || this.getNewPatient();
    const patientClone = patient.clone();
    const patientModal = Radio.request('modal', 'show', getPatientModal({
      patient: patientClone,
      onSubmit: () => {
        if (!patient.canEdit()) {
          patientModal.destroy();
          return;
        }

        patientModal.disableSubmit();
        patient.saveAll(patientClone.attributes)
          .then(() => {
            patientModal.destroy();

            if (patientFormId && patientClone.isNew()) {
              Radio.trigger('event-router', 'form:patient', patient.id, patientFormId);
              return;
            }

            Radio.trigger('event-router', 'patient:dashboard', patient.id);
          })
          .catch(({ responseData }) => {
            // This assumes that only the similar patient error is handled on the server
            const error = responseData.errors[0].detail;

            patientModal.getChildView('body').setState({
              errors: {
                name: error,
              },
            });

            const errorView = new ErrorView({ hasSearch: true, error });

            patientModal.listenTo(errorView, 'click:search', () => {
              const query = `${ patientClone.get('first_name') } ${ patientClone.get('last_name') }`;
              this.showSearch(query);
            });

            patientModal.showChildView('info', errorView);
          });
      },
    }));

    patientModal.disableSubmit(patient.canEdit());
    patientModal.listenTo(patientClone, {
      'change'() {
        patientModal.getRegion('info').empty();
        patientModal.disableSubmit(!patientClone.isValid());
      },
      'invalid'(model, errors) {
        const errorCode = errors.birth_date;
        if (errorCode === 'invalidDate') {
          patientModal.showChildView('info', new ErrorView({ errorCode }));
        }
      },
    });
  },
});
