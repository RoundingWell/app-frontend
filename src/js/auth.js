import { isEmpty } from 'underscore';
import Radio from 'backbone.radio';
import getRootRoute from 'js/utils/root-route';

import {
  getConfigSection,
  getAppConfig,
} from '@roundingwell/care-ops-config';

import { AuthProvider } from '@roundingwell/care-ops-auth/AuthProvider.js';

import 'scss/app-root.scss';

import { LoginPromptView } from 'js/views/globals/prelogin/prelogin_views';

let authAgent;
const defaultAuthProvider = new AuthProvider();

function getLoginView() {
  if (getAppConfig().disableLoginPrompt) return;
  return LoginPromptView;
}

// Provider selection logic based on config
// In order of priority (highest to lowest)
async function selectAuthProvider() {
  if (getRootRoute() === 'outreach') {
    return defaultAuthProvider;
  }

  const e2eConfig = getConfigSection('e2e');
  if (!isEmpty(e2eConfig)) {
    return new AuthProvider(e2eConfig);
  }

  const LoginView = getLoginView();

  const workosConfig = getConfigSection('workos');
  if (!isEmpty(workosConfig)) {
    const { WorkosAuthProvider } = await import('@roundingwell/care-ops-auth/workos.js');
    return new WorkosAuthProvider(workosConfig, LoginView);
  }

  const auth0Config = getConfigSection('auth0');
  if (!isEmpty(auth0Config)) {
    const { Auth0AuthProvider } = await import('@roundingwell/care-ops-auth/auth0.js');
    return new Auth0AuthProvider(auth0Config, LoginView);
  }

  return defaultAuthProvider;
}

async function getAuthAgent() {
  if (_TEST_) {
    defaultAuthProvider.setToken('test-token');
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
  return new Promise(resolve => {
    agent.auth(resolve);
  });
}

export {
  auth,
};
