import Radio from 'backbone.radio';

import * as auth0 from './auth0';
import * as e2e from './e2e';
import * as kinde from './kinde';
import * as none from './none';
import * as workos from './workos';

import 'scss/app-root.scss';

let authAgent;

function getAuthAgent() {
  if (none.should()) return none;

  if (authAgent) return authAgent;

  // These should be ordered by priority lowest to highest
  if (e2e.should()) authAgent = e2e;
  if (auth0.should()) authAgent = auth0;
  if (kinde.should()) authAgent = kinde;
  if (workos.should()) authAgent = workos;

  return authAgent;
}

function setToken(tokenString) {
  getAuthAgent().setToken(tokenString);
}

function getToken() {
  return getAuthAgent().getToken() || '';
}

function logout() {
  getAuthAgent().logout();
}

Radio.reply('auth', {
  logout,
  setToken,
  getToken,
});

async function auth(success) {
  getAuthAgent().auth(success);
}

export {
  auth,
};
