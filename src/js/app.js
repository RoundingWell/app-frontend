import 'js/base/setup';
import 'js/i18n';

import { get } from 'underscore';
import Backbone from 'backbone';
import { addError } from 'js/datadog';

import 'scss/provider-core.scss';
import 'scss/app-root.scss';

import initPlatform from 'js/utils/platform';
import handleErrors from 'js/utils/handle-errors';

import App from 'js/base/app';
import listenToUserActivity from 'js/utils/user-activity';

import Datepicker from 'js/components/datepicker';
import Droplist from 'js/components/droplist';
import Optionlist from 'js/components/optionlist';
import Tooltip from 'js/components/tooltip';

import 'js/entities-service';

import AlertService from 'js/services/alert';
import BootstrapService from 'js/services/bootstrap';
import HistoryService from 'js/services/history';
import LastestListService from 'js/services/latest-list';
import ModalService from 'js/services/modal';
import PatientModalService from 'js/services/patient-modal';
import WSService from 'js/services/ws';
import DialerService from 'js/services/dialer';

import ErrorApp from 'js/apps/globals/error/error_app';

import { RootView } from 'js/apps/globals/app-frame/root_views';
import { PreloaderView } from 'js/auth/prelogin/prelogin_views';

const Application = App.extend({
  channelName: 'app',
  childApps: {
    bootstrap: BootstrapService,
    dialer: DialerService,
  },
  radioRequests: {
    'show:pop': 'showPop',
  },

  initialize() {
    initPlatform();
  },

  // Before the application starts make sure:
  // - A root layout is mounted
  // - Global services are started
  onBeforeStart() {
    this.showView(new RootView());
    this.configComponents();
    this.startServices();
    this.setListeners();
    // Ensure Error is the first app initialized
    new ErrorApp({ region: this.getView().getRegion('error') });
  },

  configComponents() {
    const rootView = this.getView();
    Tooltip.setRegion(rootView.getRegion('tooltip'));
    const popRegion = rootView.getRegion('pop');
    Datepicker.setRegion(popRegion);
    Droplist.setPopRegion(popRegion);
    Optionlist.setRegion(popRegion);
  },

  showPop(view, opts) {
    const popRegion = this.getView().getRegion('pop');
    return popRegion.show(view, opts);
  },

  startServices() {
    const rootView = this.getView();
    new WSService();
    new AlertService({ region: rootView.getRegion('alert') });
    new LastestListService();
    new ModalService({
      modalRegion: rootView.getRegion('modal'),
      modalSmallRegion: rootView.getRegion('modalSmall'),
    });
    new PatientModalService();
  },

  setListeners() {
    this._eventListeners?.abort();
    this._eventListeners = listenToUserActivity();
    window.addEventListener('beforeunload', /* istanbul ignore next: Unloading the window loses coverage reports */ () => {
      this.stop();
    }, { signal: this._eventListeners.signal });
  },

  onDestroy() {
    this._eventListeners?.abort();
  },

  async prepareStart(options, { signal }) {
    const bootstrapService = this.getChildApp('bootstrap');

    const [, { default: AppFrameApp }] = await Promise.all([
      bootstrapService.start(),
      import('js/apps/globals/app-frame/app-frame_app'),
    ]);

    signal.throwIfAborted();

    return this.startAppFrame(bootstrapService, AppFrameApp);
  },

  async startAppFrame(bootstrapService, AppFrameApp) {
    const currentUser = bootstrapService.getCurrentUser();

    if (!currentUser.hasTeam() || !currentUser.isEnabled()) return { currentUser };

    const appFrameApp = this.addChildApp('appFrame', new AppFrameApp());
    this.listenToOnce(appFrameApp, 'before:start', this.startHistory);

    const appView = this.getView().appView;
    await this.getChildApp('appFrame').start({
      contentRegion: appView.getRegion('content'),
      navRegion: appView.getRegion('nav'),
      setNavMinimized: appView.setNavMinimized.bind(appView),
      sidebarRegion: appView.getRegion('sidebar'),
    });

    return { currentUser };
  },

  startDialer() {
    return this.getChildApp('dialer').start({
      region: this.getView().getRegion('overlay'),
    });
  },

  showStartFailure(error) {
    const isNotSetup = error === 'No workspaces found' || get(error, ['response', 'status']) === 403;

    if (!isNotSetup && this.getChildApp('bootstrap').isRunning()) {
      return handleErrors(error).catch(reportedError => window.reportError(reportedError));
    }

    addError(get(error, 'responseData', error));

    if (isNotSetup) {
      this.getView().getRegion('preloader').show(new PreloaderView({ notSetup: true }));
      this.showView();
    }
  },

  onStart(app, options, { currentUser }) {
    this.showView();
    this.startDialer().catch(addError);

    if (!currentUser.hasTeam() || !currentUser.isEnabled()) {
      this.getView().getRegion('preloader').show(new PreloaderView({ notSetup: true }));
      return;
    }

    this.getView().getRegion('preloader').empty();
  },

  startHistory() {
    Backbone.history.start({ pushState: true });

    new HistoryService();
  },
});

function startApp() {
  const app = new Application({
    region: {
      el: '#root',
      replaceElement: true,
    },
  });

  return app.start().catch(error => app.showStartFailure(error));
}

export {
  startApp,
  Application,
};
