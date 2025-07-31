import { isEmpty } from 'underscore';
import Radio from 'backbone.radio';
import getRootRoute from 'js/utils/root-route';

import {
  auth0Config,
  e2eConfig,
  kindeConfig,
  workosConfig,
  appConfig,
} from '@roundingwell/care-ops-config';

import 'scss/app-root.scss';

import { AuthProvider } from './AuthProvider.js';
import { LoginPromptView } from 'js/views/globals/prelogin/prelogin_views';

let authAgent;
const defaultAuthProvider = new AuthProvider();

function getLoginView() {
  if (appConfig.disableLoginPrompt) return;
  return LoginPromptView;
}

// Provider selection logic based on config
// In order of priority (highest to lowest)
async function selectAuthProvider() {
  if (getRootRoute() === 'outreach') {
    return defaultAuthProvider;
  }

  if (!isEmpty(e2eConfig)) {
    return new AuthProvider(e2eConfig);
  }

  const LoginView = getLoginView();

  if (!isEmpty(workosConfig)) {
    const { WorkosAuthProvider } = await import('./workos.js');
    return new WorkosAuthProvider(workosConfig, LoginView);
  }

  if (!isEmpty(auth0Config)) {
    const { Auth0AuthProvider } = await import('./auth0.js');
    return new Auth0AuthProvider(auth0Config, LoginView);
  }

  if (!isEmpty(kindeConfig)) {
    const { KindeAuthProvider } = await import('./kinde.js');
    return new KindeAuthProvider(kindeConfig, LoginView);
  }

  return defaultAuthProvider;
}

async function getAuthAgent() {
  if (_TEST_) {
    return defaultAuthProvider;
  }

  if (authAgent) return authAgent;

  authAgent = await selectAuthProvider();
  return authAgent;
}

async function setToken(tokenString) {
  const agent = await getAuthAgent();
  agent.setToken(tokenString);
}

async function getToken() {
  const agent = await getAuthAgent();
  return agent.getToken();
}

async function logout() {
  const agent = await getAuthAgent();
  agent.logout();
}

Radio.reply('auth', {
  logout,
  setToken,
  getToken,
});

async function auth() {
  const agent = await getAuthAgent();
  return agent.auth();
}

export {
  auth,
};
