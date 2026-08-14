import { compact, isEqual, noop, partial, defer } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import localStore from 'js/utils/local-store';

import RouterApp from 'js/base/routerapp';

import SearchApp from 'js/apps/globals/search/search_app';
import StateModel from 'js/apps/globals/nav/nav_state';
import { AppNavView, AppNavCollectionView, MainNavDroplist, PatientsAppNav, BottomNavView, NavItemView, AdminToolsDroplist, i18n } from 'js/apps/globals/nav/app-nav/app-nav_views';

// Viewport width at/below which the nav auto-collapses to the rail.
const NAV_COLLAPSE_QUERY = '(max-width: 900px)';

const dashboardsNav = new Backbone.Model({
  text: i18n.dashboardsNav.dashboards,
  icons: [{
    type: 'far',
    icon: 'gauge',
    classes: 'app-nav__link-icon',
  }],
  event: 'dashboards:all',
  eventArgs: [],
});

const adminNavMenu = new Backbone.Collection([
  {
    id: 'ProgramsApp',
    text: i18n.adminNav.programs,
    icon: {
      type: 'far',
      icon: 'screwdriver-wrench',
    },
    event: 'programs:all',
  },
  {
    id: 'CliniciansApp',
    text: i18n.adminNav.clinicians,
    icon: {
      type: 'far',
      icon: 'users-gear',
    },
    event: 'clinicians:all',
  },
]);

const patientsAppWorkflowsNav = new Backbone.Collection([
  {
    text: i18n.patientsAppNav.ownedBy,
    icons: [{
      type: 'far',
      icon: 'user',
      classes: 'app-nav__link-icon app-nav__link-icon--compact',
    }],
    event: 'worklist',
    eventArgs: ['owned-by'],
  },
  {
    text: i18n.patientsAppNav.schedule,
    icons: [{
      type: 'far',
      icon: 'calendar-star',
      classes: 'app-nav__link-icon app-nav__link-icon--compact',
    }],
    event: 'schedule',
    eventArgs: [],
  },
  {
    text: i18n.patientsAppNav.sharedBy,
    icons: [{
      type: 'far',
      icon: 'users',
      classes: 'app-nav__link-icon',
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
        classes: 'app-nav__link-icon app-nav__link-icon--back',
      },
      {
        type: 'fas',
        icon: '1',
        classes: 'app-nav__link-icon app-nav__link-icon--one',
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
        classes: 'app-nav__link-icon app-nav__link-icon--back',
      },
      {
        type: 'fas',
        icon: '3',
        classes: 'app-nav__link-icon app-nav__link-icon--three',
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
        classes: 'app-nav__link-icon app-nav__link-icon--three',
      },
      {
        type: 'fas',
        icon: '0',
        classes: 'app-nav__link-icon app-nav__link-icon--zero',
      },
    ],
    event: 'worklist',
    eventArgs: ['done-last-thirty-days'],
  },
]);

export default RouterApp.extend({
  // NOTE: Don't stop this app on no match
  onNoMatch: noop,
  StateModel,
  startAfterInitialized: true,
  channelName: 'nav',
  childApps: {
    search: SearchApp,
  },
  radioRequests: {
    search: 'showSearch',
    setMinimized: 'setTemporarilyMinimized',
    select: 'selectNav',
  },
  stateEvents: {
    'change:currentApp': 'onChangeCurrentApp',
  },
  viewEvents: {
    'focus:in': 'onFocusIn',
    'focus:out': 'onFocusOut',
    'pointer:enter': 'onPointerEnter',
    'pointer:leave': 'onPointerLeave',
  },
  initialize() {
    this.listenTo(Radio.channel('workspace'), 'change:workspace', () => this.restart());

    this.listenTo(Radio.channel('event-router'), 'default', () => {
      defer(() => {
        Backbone.history.navigate(this.getDefaultRoute(), { trigger: true });
      });
    });

    this._narrowQuery = window.matchMedia(NAV_COLLAPSE_QUERY);
    this._onNarrowQueryChange = () => {
      this.setState('isNarrow', this._narrowQuery.matches);
    };

    this.listenTo(Radio.channel('user-activity'), 'body:down', this.onBodyDown);
    this.listenTo(Radio.channel('hotkey'), 'close', () => this.getState().closeOverlay());
  },
  onBeforeStart() {
    this._narrowQuery.addEventListener('change', this._onNarrowQueryChange);

    const isRestarting = this.isRestarting();
    let userMinimized = this.getState('userMinimized');

    if (!isRestarting) {
      // Drop admin items the current user can't access — permissions are stable.
      const currentUser = Radio.request('bootstrap', 'currentUser');

      if (!currentUser.can('clinicians:manage')) {
        adminNavMenu.remove('CliniciansApp');
      }

      if (!currentUser.can('programs:manage')) {
        adminNavMenu.remove('ProgramsApp');
      }

      const storedState = localStore.get(this.getNavMenuMinimizedKey());

      if (storedState === undefined) {
        localStore.set(this.getNavMenuMinimizedKey(), false);
      }

      userMinimized = Boolean(storedState);
    }

    this.setState({
      isFocusWithin: false,
      isHovering: false,
      isNarrow: this._narrowQuery.matches,
      isNavDroplistOpen: false,
      isTouchDrawerOpen: false,
      temporaryMinimized: false,
      userMinimized,
    });
  },
  onStop() {
    this._narrowQuery.removeEventListener('change', this._onNarrowQueryChange);
  },
  onStart() {
    // Rebuild the shell every start so it's bound to the current state — a
    // restart otherwise leaves a preserved view wired to a stale model.
    this.setView(new AppNavView({ model: this.getState() }));

    this.updateCanPatientCreate();
    this.showMainNavDroplist();
    this.showNavContent();
    this.showBottomNavView();

    this.showView();
  },
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
  selectNav(appName, event, eventArgs) {
    this.setState('currentApp', appName);

    const selectedNav = this.findNavItem(event, compact(eventArgs));

    this.setState('selectedNav', selectedNav);

    // Navigating dismisses any transient expansion without changing the
    // persisted minimized preference.
    this.getState().closeOverlay();
  },
  findNavItem(event, eventArgs) {
    if (event === 'dashboards:all') return dashboardsNav;

    return patientsAppWorkflowsNav.find(model => {
      return (
        model.get('event') === event
        && isEqual(model.get('eventArgs')[0], eventArgs[0])
      );
    });
  },
  onChangeCurrentApp(state, appName) {
    if (!this.adminNavDroplist) return;

    this.adminNavDroplist.setState('selected', adminNavMenu.get(appName));
  },
  setTemporarilyMinimized(isMinimized) {
    this.setState('temporaryMinimized', isMinimized);
  },
  onPointerEnter(evt) {
    if (!this.canHoverExpand(evt)) return;

    this.setState('isHovering', true);
  },
  onPointerLeave(evt) {
    if (!this.canHoverExpand(evt)) return;

    this.setState('isHovering', false);
  },
  onFocusIn() {
    if (!this.getState('isMinimized')) return;

    this.setState('isFocusWithin', true);
  },
  onFocusOut() {
    this.setState('isFocusWithin', false);
  },
  toggleTouchDrawer() {
    const shouldOpen = !this.getState('isTouchDrawerOpen');

    this.getState().closeOverlay();
    this.setState('isTouchDrawerOpen', shouldOpen);
  },
  closeTouchDrawer() {
    this.setState('isTouchDrawerOpen', false);
  },
  getNavMenuMinimizedKey() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    return `isNavMenuMinimized_${ currentUser.id }`;
  },
  onBodyDown(evt) {
    if (!this.getState('isTouchDrawerOpen')) return;

    const view = this.getView();
    if (view && (view.el === evt.target || view.Dom.hasEl(view.el, evt.target))) return;

    this.closeTouchDrawer();
  },
  onClickAddPatient() {
    Radio.request('patient-modal', 'show');
  },
  onClickMinimizeMenu() {
    const isNarrow = this.getState('isNarrow');

    if (isNarrow) {
      this.toggleTouchDrawer();
      return;
    }

    // A visible minimized nav is being previewed, so clicking pins it open.
    // Otherwise the click toggles the persisted minimized preference.
    const isPinningOpen = this.getState('isMinimized') && this.getState('isFullNavVisible');

    this.getState().closeOverlay();

    if (!isPinningOpen) {
      this.toggleState('userMinimized');
    } else {
      this.setState({
        temporaryMinimized: false,
        userMinimized: false,
      });
    }

    localStore.set(this.getNavMenuMinimizedKey(), this.getState('userMinimized'));
  },
  onNavDroplistActiveChange() {
    this.setState('isNavDroplistOpen', this.hasActiveNavDroplist());
  },
  canHoverExpand(evt) {
    if (!evt || evt.pointerType !== 'mouse') return false;

    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  },
  hasActiveNavDroplist() {
    return Boolean(
      (this.mainNavDroplist && this.mainNavDroplist.getState('isActive'))
      || (this.adminNavDroplist && this.adminNavDroplist.getState('isActive')),
    );
  },
  updateCanPatientCreate() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const hasManualPatientCreate = Radio.request('settings', 'get', 'manual_patient_creation');
    const canPatientCreate = hasManualPatientCreate && currentUser.can('patients:manage');

    this.setState('canPatientCreate', canPatientCreate);
  },
  showMainNavDroplist() {
    const currentWorkspace = Radio.request('workspace', 'current');
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const workspaces = currentUser.getWorkspaces();

    const workspacesMenu = new Backbone.Collection(
      workspaces.map(workspace => {
        return {
          id: workspace.id,
          text: workspace.get('name'),
          icon: { type: 'far', icon: 'window' },
          event: `workspace:${ workspace.get('slug') }`,
        };
      }),
    );

    if (this.mainNavDroplist) {
      this.stopListening(this.mainNavDroplist.getState());
    }

    this.mainNavDroplist = new MainNavDroplist({
      collection: workspacesMenu,
      state: {
        selected: workspacesMenu.get(currentWorkspace.id),
      },
    });
    this.listenTo(this.mainNavDroplist.getState(), 'change:isActive', this.onNavDroplistActiveChange);
    this.showChildView('navMain', this.mainNavDroplist);
  },
  showNavContent() {
    const navView = new PatientsAppNav({
      model: this.getState(),
    });

    const workflowsCollectionView = new AppNavCollectionView({
      collection: patientsAppWorkflowsNav,
      model: this.getState(),
    });

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
  },
  showBottomNavView() {
    if (this.bottomNavView) {
      this.stopListening(this.bottomNavView);
    }

    this.bottomNavView = new BottomNavView({
      model: this.getState(),
    });

    this.listenTo(this.bottomNavView, {
      'click:addPatient': this.onClickAddPatient,
      'click:minimizeMenu': this.onClickMinimizeMenu,
    });

    this.showDashboardsNav();
    this.showAdminTools();

    this.showChildView('bottomNavContent', this.bottomNavView);
  },
  showDashboardsNav() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    if (!currentUser.can('dashboards:view')) return;

    this.bottomNavView.showChildView('dashboards', new NavItemView({
      model: dashboardsNav,
      state: this.getState(),
    }));
  },
  showAdminTools() {
    if (this.adminNavDroplist) {
      this.stopListening(this.adminNavDroplist.getState());
    }

    if (!adminNavMenu.length) return;

    this.adminNavDroplist = new AdminToolsDroplist({
      collection: adminNavMenu,
      state: {
        selected: adminNavMenu.get(this.getState().get('currentApp')),
      },
    });

    this.listenTo(this.adminNavDroplist.getState(), 'change:isActive', this.onNavDroplistActiveChange);
    this.bottomNavView.showChildView('adminTools', this.adminNavDroplist);
  },
  showSearch(prefillText) {
    const navView = this.getChildView('navContent');

    const searchApp = this.startChildApp('search', {
      prefillText,
      canPatientCreate: this.getState('canPatientCreate'),
    });

    this.listenToOnce(searchApp, 'stop', () => {
      navView.triggerMethod('search:active', false);
    });

    navView.triggerMethod('search:active', true);
  },
});
