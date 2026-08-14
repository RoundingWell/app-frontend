import 'js/base/setup';
import 'js/i18n';

import $ from 'jquery';
import { get } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import { addError } from 'js/datadog';

import 'scss/provider-core.scss';
import 'scss/app-root.scss';

import initPlatform from 'js/utils/platform';

import App from 'js/base/app';

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

const $document = $(document);

const Application = App.extend({
  channelName: 'app',
  radioRequests: {
    'show:pop': 'showPop',
  },

  initialize() {
    initPlatform();
  },

  // Before the application starts make sure:
  // - A root layout is attached
  // - Global services are started
  onBeforeStart() {
    new BootstrapService();
    this.setView(new RootView());
    this.configComponents();
    this.startServices();
    this.setListeners();
    // Ensure Error is the first app initialized
    new ErrorApp({ region: this.getRegion('error') });
  },

  configComponents() {
    Tooltip.setRegion(this.getRegion('tooltip'));
    const popRegion = this.getRegion('pop');
    Datepicker.setRegion(popRegion);
    Droplist.setPopRegion(popRegion);
    Optionlist.setRegion(popRegion);
  },

  showPop(view, opts) {
    const popRegion = this.getRegion('pop');
    return popRegion.show(view, opts);
  },

  startServices() {
    new WSService();
    new AlertService({ region: this.getRegion('alert') });
    new LastestListService();
    new ModalService({
      modalRegion: this.getRegion('modal'),
      modalSmallRegion: this.getRegion('modalSmall'),
    });
    new PatientModalService();
    new DialerService({ region: this.getRegion('overlay') });
  },

  setListeners() {
    $(window).on({
      'resize.app'() {
        Radio.trigger('user-activity', 'window:resize');
      },
      'beforeunload': /* istanbul ignore next: Unloading the window loses coverage reports */ () => {
        this.stop();
      },
    });

    $document.on('keydown.app', function(evt) {
      Radio.trigger('user-activity', 'document:keydown', evt);
    });

    this.setMouseListeners();
    this.setHotkeyListeners();
  },

  setMouseListeners() {
    $document.on('mouseover.app', function(evt) {
      Radio.trigger('user-activity', 'document:mouseover', evt);
    });

    /* istanbul ignore next: No need to test jquery functionality */
    $document.on('mouseleave.app', function(evt) {
      Radio.trigger('user-activity', 'document:mouseleave', evt);
    });

    $('body').on('pointerdown.app', function(evt) {
      Radio.trigger('user-activity', 'body:down', evt);
    });
  },

  setHotkeyListeners() {
    // https://github.com/jeresig/jquery.hotkeys
    $document.on('keydown.app', null, '/', function(evt) {
      Radio.trigger('hotkey', 'search', evt);
    });

    $document.on('keydown.app', null, 'esc', function(evt) {
      Radio.trigger('hotkey', 'close', evt);
    });
  },

  beforeStart() {
    return [
      Radio.request('bootstrap', 'fetch'),
      import('js/apps/globals/app-frame/app-frame_app'),
    ];
  },

  onFail(options, error) {
    addError(get(error, 'responseData', error));

    if (error === 'No workspaces found' || get(error, ['response', 'status']) === 403) {
      this.getRegion('preloader').show(new PreloaderView({ notSetup: true }));
    }
  },

  onStart(options, currentUser, { default: AppFrameApp }) {
    if (!currentUser.hasTeam() || !currentUser.isEnabled()) {
      this.getRegion('preloader').show(new PreloaderView({ notSetup: true }));
      return;
    }

    this.getRegion('preloader').empty();

    const appFrameApp = this.addChildApp('appFrame', AppFrameApp);

    this.listenToOnce(appFrameApp, 'before:start', this.startHistory);

    appFrameApp.start({ view: this.getView().appView });
  },

  startHistory() {
    Backbone.history.start({ pushState: true });

    new HistoryService();
  },
});

function startApp() {
  const app = new Application();

  app.start();
}

export {
  startApp,
  Application,
};
