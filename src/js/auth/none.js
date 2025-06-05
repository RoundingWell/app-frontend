import { appConfig } from 'js/config';
import { PATH_ROOT, PATH_LOGOUT } from './config';

let token;

function should() {
  return sessionStorage.getItem('cypress') || appConfig.cypress || !navigator.onLine;
}

function setToken(tokenString) {
  token = tokenString;
}

function getToken() {
  const cypress = sessionStorage.getItem('cypress');

  if (cypress) return;

  return `Bearer ${ token }`;
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
