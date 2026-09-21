import { compact, isEqual, noop, partial, defer } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import localStore from 'js/utils/local-store';

import RouterApp from 'js/base/routerapp';

import SearchApp from 'js/apps/globals/search/search_app';
import StateModel from 'js/apps/globals/nav/nav_state';
import { AppNavView, AppNavCollectionView, MainNavDroplist, PatientsAppNav, BottomNavView, NavItemView, AdminToolsDroplist, i18n } from 'js/apps/globals/nav/app-nav/app-nav_views';
import { AnnouncementView, WHATS_NEW_VERSION, showWhatsNew } from 'js/apps/globals/nav/whats-new/whats-new_views';

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

const whatsNewMenu = new Backbone.Collection([{
  id: 'WhatsNew',
  text: i18n.mainNavDroplist.whatsNew,
  icon: { type: 'far', icon: 'circle-info' },
  event: 'whats-new',
}]);

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
  startOnRoute: false,
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
  createState() {
    return new StateModel();
  },
  initialize() {
    this.listenTo(Radio.channel('event-router'), 'default', () => {
      defer(() => {
        Backbone.history.navigate(this.getDefaultRoute(), { trigger: true });
      });
    });

    this._narrowQuery = window.matchMedia(NAV_COLLAPSE_QUERY);
    this._onNarrowQueryChange = () => {
      this.getState().set('isNarrow', this._narrowQuery.matches);
    };

    this.listenTo(Radio.channel('user-activity'), 'body:down', this.onBodyDown);
    this.listenTo(Radio.channel('hotkey'), 'close', () => this.getState().closeOverlay());

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

    this.getState().set('userMinimized', Boolean(storedState));
  },
  onBeforeStart() {
    this._narrowQuery.addEventListener('change', this._onNarrowQueryChange);

    this.getState().set({
      isFocusWithin: false,
      isHovering: false,
      isNarrow: this._narrowQuery.matches,
      isNavDroplistOpen: false,
      isTouchDrawerOpen: false,
      temporaryMinimized: false,
    });
  },
  onStop() {
    this._narrowQuery.removeEventListener('change', this._onNarrowQueryChange);
  },
  onStart() {
    // Rebuild the shell every start so it's bound to the current state — a
    // restart otherwise leaves a preserved view wired to a stale model.
    const view = this.setView(new AppNavView({ model: this.getState() }));

    this.listenTo(view, {
      'focus:in': this.onFocusIn,
      'focus:out': this.onFocusOut,
      'pointer:enter': this.onPointerEnter,
      'pointer:leave': this.onPointerLeave,
    });

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
    this.getState().set('currentApp', appName);

    const selectedNav = this.findNavItem(event, compact(eventArgs));

    this.getState().set('selectedNav', selectedNav);

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

    this.adminNavDroplist.getState().set('selected', adminNavMenu.get(appName));
  },
  setTemporarilyMinimized(isMinimized) {
    this.getState().set('temporaryMinimized', isMinimized);
  },
  onPointerEnter(evt) {
    if (!this.canHoverExpand(evt)) return;

    this.getState().set('isHovering', true);
  },
  onPointerLeave(evt) {
    if (!this.canHoverExpand(evt)) return;

    this.getState().set('isHovering', false);
  },
  onFocusIn() {
    if (!this.getState().get('isMinimized')) return;

    this.getState().set('isFocusWithin', true);
  },
  onFocusOut() {
    this.getState().set('isFocusWithin', false);
  },
  toggleTouchDrawer() {
    const shouldOpen = !this.getState().get('isTouchDrawerOpen');

    this.getState().closeOverlay();
    this.getState().set('isTouchDrawerOpen', shouldOpen);
  },
  closeTouchDrawer() {
    this.getState().set('isTouchDrawerOpen', false);
  },
  getNavMenuMinimizedKey() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    return `isNavMenuMinimized_${ currentUser.id }`;
  },
  getWhatsNewDismissedKey() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    return `whatsNewDismissed_${ WHATS_NEW_VERSION }_${ currentUser.id }`;
  },
  onBodyDown(evt) {
    if (!this.getState().get('isTouchDrawerOpen')) return;

    const view = this.getView();
    if (view && (view.el === evt.target || view.Dom.hasEl(view.el, evt.target))) return;

    this.closeTouchDrawer();
  },
  onClickAddPatient() {
    Radio.request('patient-modal', 'show');
  },
  onClickMinimizeMenu() {
    const state = this.getState();
    const isNarrow = state.get('isNarrow');

    if (isNarrow) {
      this.toggleTouchDrawer();
      return;
    }

    // A visible minimized nav is being previewed, so clicking pins it open.
    // Otherwise the click toggles the persisted minimized preference.
    const isPinningOpen = state.get('isMinimized') && state.get('isFullNavVisible');

    state.closeOverlay();

    if (!isPinningOpen) {
      state.set('userMinimized', !state.get('userMinimized'));
    } else {
      state.set({
        temporaryMinimized: false,
        userMinimized: false,
      });
    }

    localStore.set(this.getNavMenuMinimizedKey(), state.get('userMinimized'));
  },
  onNavDroplistActiveChange() {
    this.getState().set('isNavDroplistOpen', this.hasActiveNavDroplist());
  },
  canHoverExpand(evt) {
    if (!evt || evt.pointerType !== 'mouse') return false;

    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  },
  hasActiveNavDroplist() {
    return Boolean(
      (this.mainNavDroplist && this.mainNavDroplist.getState().get('isActive'))
      || (this.adminNavDroplist && this.adminNavDroplist.getState().get('isActive')),
    );
  },
  updateCanPatientCreate() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const hasManualPatientCreate = Radio.request('settings', 'get', 'manual_patient_creation');
    const canPatientCreate = hasManualPatientCreate && currentUser.can('patients:manage');

    this.getState().set('canPatientCreate', canPatientCreate);
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
      lists: [
        { collection: workspacesMenu },
        { collection: whatsNewMenu },
      ],
      stateOptions: {
        selected: workspacesMenu.get(currentWorkspace.id),
      },
    });
    this.listenTo(this.mainNavDroplist, 'show:whatsNew', this.showWhatsNew);
    this.listenTo(this.mainNavDroplist.getState(), 'change:isActive', this.onNavDroplistActiveChange);
    this.getView().showChildView('navMain', this.mainNavDroplist);
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

    this.getView().showChildView('navContent', navView);
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

    this.showWhatsNewAnnouncement();
    this.showDashboardsNav();
    this.showAdminTools();

    this.getView().showChildView('bottomNavContent', this.bottomNavView);
  },
  showWhatsNewAnnouncement() {
    if (localStore.get(this.getWhatsNewDismissedKey())) return;

    const announcementView = new AnnouncementView();

    this.listenTo(announcementView, {
      'dismiss': this.onDismissWhatsNewAnnouncement,
      'show:update': this.showWhatsNew,
    });

    this.bottomNavView.showChildView('announcement', announcementView);
  },
  onDismissWhatsNewAnnouncement(view) {
    localStore.set(this.getWhatsNewDismissedKey(), true);
    view.destroy();
  },
  showWhatsNew() {
    showWhatsNew();
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
      stateOptions: {
        selected: adminNavMenu.get(this.getState().get('currentApp')),
      },
    });

    this.listenTo(this.adminNavDroplist.getState(), 'change:isActive', this.onNavDroplistActiveChange);
    this.bottomNavView.showChildView('adminTools', this.adminNavDroplist);
  },
  showSearch(prefillText) {
    const navView = this.getView().getChildView('navContent');

    const searchApp = this.getChildApp('search');
    searchApp.start({
      prefillText,
      canPatientCreate: this.getState().get('canPatientCreate'),
    });

    this.listenToOnce(searchApp, 'stop', () => {
      navView.triggerMethod('search:active', false);
    });

    navView.triggerMethod('search:active', true);
  },
});
