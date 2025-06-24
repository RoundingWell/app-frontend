import { extend, isEmpty } from 'underscore';
import createKindeClient from '@kinde-oss/kinde-auth-pkce-js';

import { kindeConfig as config, appConfig } from 'js/config';

import { LoginPromptView } from 'js/views/globals/prelogin/prelogin_views';

import { PATH_ROOT, PATH_RWELL, PATH_AUTHD, PATH_LOGIN, PATH_LOGOUT } from './config';

let kinde;
let token;

function should() {
  return !isEmpty(config);
}

function setToken(tokenString) {
  token = tokenString;
}

function getToken() {
  if (token) return token;
  if (!kinde || !navigator.onLine) return;

  return kinde
    .getToken()
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

function registerKinde(path, connection) {
  kinde.register({
    app_state: { path },
    authUrlParams: { connection_id: connection },
  });
}

async function createKinde(success) {
  const kindeCreateParams = {
    redirect_uri: location.origin + PATH_AUTHD,
    logout_uri: location.origin,
    on_redirect_callback: (user, { path } = {}) => {
      if (!user) {
        login(path);
        return;
      }

      if (path === PATH_LOGIN) path = PATH_ROOT;

      if (path === PATH_RWELL) {
        path = PATH_ROOT;
        localStorage.setItem(PATH_RWELL, 1);
      }

      replaceState(path);

      success();
    },
  };

  return createKindeClient(extend(kindeCreateParams, config.createParams));
}

function logout() {
  window.location = PATH_LOGOUT;
}

function login(path = PATH_ROOT, connection = config.connections.default) {
  // iframe buster
  if (top !== self) {
    top.location = PATH_LOGIN;
    return;
  }

  replaceState(PATH_LOGIN);

  if (appConfig.disableLoginPrompt) {
    registerKinde(path, connection);
    return;
  }

  const loginPromptView = new LoginPromptView();

  loginPromptView.on('click:login', () => {
    registerKinde(path, connection);
  });

  loginPromptView.render();
}

/*
 * Requests kinde authorization
 * And authenticates authorization if kinde redirected to PATH_AUTHD
 */
async function auth(success) {
  // NOTE: Set path before await create to avoid redirect replaceState changing the value
  const pathName = location.pathname;

  kinde = await createKinde(success);

  if (pathName === PATH_AUTHD) return;

  if (pathName === PATH_LOGOUT) {
    token = null;
    kinde.logout();
    return;
  }

  // RWell specific login
  if (pathName === PATH_RWELL || localStorage.getItem(PATH_RWELL)) {
    login(PATH_RWELL, config.connections.roundingwell);
    return;
  }

  if (!await kinde.getUser()) {
    login(pathName);
    return;
  }

  success();
}

export {
  auth,
  logout,
  setToken,
  getToken,
  should,
};
