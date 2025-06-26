import { isEmpty } from 'underscore';
import { e2eConfig as config } from 'js/config';
import { PATH_ROOT, PATH_LOGOUT } from './config';

let token = config.token;

/**
 * Determines whether the configuration object is not empty.
 * @return {boolean} True if the configuration contains properties; otherwise, false.
 */
function should() {
  return !isEmpty(config);
}

function setToken(tokenString) {
  token = tokenString;
}

function getToken() {
  return token;
}

function logout() {
  window.location = PATH_LOGOUT;
}

function auth(success) {
  if (location.pathname === PATH_LOGOUT) {
    token = null;
    window.location = PATH_ROOT;
    return;
  }

  return success();
}

export {
  auth,
  logout,
  setToken,
  getToken,
  should,
};
