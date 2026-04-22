import Radio from 'backbone.radio';

import {
  getAuthConfig,
  getAuthProvider,
  getAuthDisableLoginPrompt,
} from '@roundingwell/care-ops-config';

import { AuthProvider } from '@roundingwell/care-ops-auth/AuthProvider.js';

import { addAction } from 'js/datadog';

import 'scss/app-root.scss';

import { LoginPromptView } from 'js/views/globals/prelogin/prelogin_views';

let authAgent;

function trackAuthEvent(name, context) {
  addAction(name, context);
}

const defaultAuthProvider = new AuthProvider();

function getLoginView() {
  if (getAuthDisableLoginPrompt()) return;
  return LoginPromptView;
}

async function selectAuthProvider() {
  const providerConfig = getAuthConfig();
  const authProvider = getAuthProvider();

  if (authProvider === 'e2e') {
    return new AuthProvider(providerConfig);
  }

  if (authProvider === 'workos') {
    const { WorkosAuthProvider } = await import('@roundingwell/care-ops-auth/workos.js');
    return new WorkosAuthProvider(providerConfig, getLoginView(), trackAuthEvent);
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

async function handleUnauthorized(retry) {
  const agent = await getAuthAgent();
  return agent.handleUnauthorized(retry);
}

async function logout() {
  const agent = await getAuthAgent();
  return agent.logout();
}

Radio.reply('auth', {
  handleUnauthorized,
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
