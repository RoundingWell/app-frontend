import Radio from 'backbone.radio';

import {
  getAuthConfig,
  getAuthProvider,
  getAuthDisableLoginPrompt,
} from '@roundingwell/care-ops-config';

import { AuthProvider } from '@roundingwell/care-ops-auth/AuthProvider.js';

import { addAction } from 'js/datadog';

import { clearCache, pruneOtherPartitions } from 'js/base/cache/entity-cache';
import { clearDrafts, pruneOtherDrafts } from 'js/services/form-drafts';

import 'scss/app-root.scss';

import { LoginPromptView } from 'js/auth/prelogin/prelogin_views';

let authAgent;
let cachedUserId;

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

function getUserId() {
  return cachedUserId;
}

Radio.reply('auth', {
  handleUnauthorized,
  logout,
  setToken,
  getToken,
  getUserId,
});

async function auth() {
  if (location.pathname === AuthProvider.PATH_LOGOUT) {
    await Promise.all([clearCache(), clearDrafts()]);
  }

  const agent = await getAuthAgent();

  return new Promise(resolve => {
    agent.auth(async() => {
      try {
        cachedUserId = await agent.getUserId();
        await Promise.all([
          pruneOtherPartitions(cachedUserId),
          pruneOtherDrafts(cachedUserId),
        ]);
      } catch {
        // swallow — boot without cache rather than crash auth.
      }
      resolve();
    });
  });
}

export {
  auth,
};
