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

/**
 * Registers the Kinde client with application state and authentication parameters for the specified path and connection.
 * @param {string} path - The application path to store in the authentication state.
 * @param {string} connection - The connection ID to use for authentication.
 */
function registerKinde(path, connection) {
  kinde.register({
    app_state: { path },
    authUrlParams: { connection_id: connection },
  });
}

/**
 * Initializes and configures the Kinde OAuth client, handling authentication redirects and user state.
 * 
 * After redirection, invokes the provided callback if the user is authenticated, or triggers the login flow if not. Adjusts application path and local storage for special login cases.
 * 
 * @param {Function} success - Callback invoked after successful authentication and path adjustment.
 * @return {Promise<Object>} A promise that resolves to the initialized Kinde client instance.
 */
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

/**
 * Initiates the login process, handling iframe busting, login prompts, and Kinde registration.
 * 
 * If executed within an iframe, forces navigation to the login path at the top window. Otherwise, updates browser history and either immediately registers the Kinde client or displays a login prompt, depending on application configuration.
 * 
 * @param {string} [path] - The path to redirect to after successful login.
 * @param {string} [connection] - The connection ID to use for authentication.
 */
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
