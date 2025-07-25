import { extend, isEmpty } from 'underscore';
import Radio from 'backbone.radio';
import { createAuth0Client } from '@auth0/auth0-spa-js';

import { auth0Config as config, appConfig } from '@roundingwell/care-ops-config';

import { LoginPromptView } from 'js/views/globals/prelogin/prelogin_views';

import { PATH_ROOT, PATH_RWELL, PATH_AUTHD, PATH_LOGIN, PATH_LOGOUT } from './config';

const RWELL_CONNECTION = 'google-oauth2';

let auth0;
let token;

function should() {
  return !isEmpty(config);
}

function setAuth0(auth0Client) {
  auth0 = auth0Client;
  return auth0.isAuthenticated();
}

function setToken(tokenString) {
  token = tokenString;
}

function getToken() {
  if (token) return token;
  if (!auth0 || !navigator.onLine) return;

  return auth0
    .getTokenSilently()
    .then(tk => `Bearer ${ tk }`)
    .catch(() => {
      logout();
    });
}

/*
 * Modifies the current history state
 */
function replaceState(state) {
  window.history.replaceState({}, document.title, state);
}

/*
 * authenticate parses the implicit flow hash to determine the token
 * if there is an error it forces a new authorization with a new login
 * If successful, redirects to the initial path and sends the app
 * the token and config org name
 */
function authenticate(success) {
  return auth0.handleRedirectCallback()
    .then(({ appState }) => {
      if (appState === PATH_LOGIN) appState = PATH_ROOT;

      if (appState === PATH_RWELL) {
        appState = PATH_ROOT;
        localStorage.setItem(PATH_RWELL, 1);
      }

      replaceState(appState);
      success();
    })
    .catch(() => {
      login();
    });
}

/*
 *  Take appconfig.auth0 and extend it with the default config
 */
function getConfig() {
  config.authorizationParams = extend({
    redirect_uri: location.origin + PATH_AUTHD,
    audience: 'care-ops-backend',
  }, config.authorizationParams);

  if (localStorage.getItem(PATH_RWELL)) {
    config.authorizationParams.connection = RWELL_CONNECTION;
  }

  return config;
}

function logout() {
  window.location = PATH_LOGOUT;
}

function loginWithRedirect(opts) {
  auth0.loginWithRedirect(extend({ prompt: 'login' }, opts));
}

function login(appState = PATH_ROOT) {
  // iframe buster
  if (top !== self) {
    top.location = PATH_LOGIN;
    return;
  }

  if (appConfig.disableLoginPrompt) {
    return loginWithRedirect({ appState });
  }

  replaceState(PATH_LOGIN);

  const loginPromptView = new LoginPromptView();

  loginPromptView.on('click:login', () => {
    loginWithRedirect({ appState });
  });

  loginPromptView.render();
}

/*
 * login will occur for any pre-auth flow
 * initially requesting auth0 authorization
 * And authenticating authorization if auth0 redirected to AUTHD_PATH
 */
function auth(success) {
  createAuth0Client(getConfig())
    .then(setAuth0)
    .then(isAuthenticated => {
      if (location.pathname === PATH_LOGOUT) {
        token = null;
        const federated = Radio.request('settings', 'get', 'federated_logout');
        auth0.logout({ logoutParams: { returnTo: location.origin, federated } });
        return;
      }

      // RWell specific login
      if (location.pathname === PATH_RWELL) {
        loginWithRedirect({
          appState: PATH_RWELL,
          authorizationParams: {
            connection: RWELL_CONNECTION,
          },
        });
        return;
      }

      if (location.pathname === PATH_AUTHD) {
        authenticate(success);
        return;
      }

      if (!isAuthenticated) {
        login(location.pathname);
        return;
      }

      if (location.pathname === PATH_LOGIN) {
        replaceState(PATH_ROOT);
      }

      success();
    });
}

export {
  auth,
  logout,
  setToken,
  getToken,
  should,
};
