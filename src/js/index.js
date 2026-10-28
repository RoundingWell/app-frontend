import '@roundingwell/icons/styles.css';

import { Workbox } from 'workbox-window';

import { fetchConfig } from '@roundingwell/care-ops-config';
import { initDataDog, addError } from './datadog';

import 'scss/modules/buttons.scss';

import getRootRoute from 'js/utils/root-route';
import intl from 'js/i18n';

import './apps/globals/app-frame/startup.scss';

if (_PRODUCTION_ && 'serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');

  wb.register();
}

async function startFormService() {
  const { startFormServiceApp } = await import('./formservice');
  startFormServiceApp();
}

async function startAuth() {
  const { auth } = await import('./auth');
  await auth();
}

async function loadApp() {
  return import('./app');
}

async function start({ startApp }) {
  return startApp();
}

function showStartupError(error) {
  addError(error);

  const root = document.getElementById('root');
  const panel = document.createElement('div');
  panel.className = 'startup__error';

  const title = document.createElement('h1');
  title.className = 'startup__error-title';
  title.textContent = intl.globals.startup.errorTitle;

  const message = document.createElement('p');
  message.className = 'startup__error-message';
  message.textContent = intl.globals.startup.errorMessage;

  const retry = document.createElement('button');
  retry.className = 'button startup__retry';
  retry.type = 'button';
  retry.textContent = intl.globals.startup.retry;
  retry.addEventListener('click', () => {
    retry.disabled = true;
    retry.textContent = intl.globals.startup.retrying;
    window.location.reload();
  });

  panel.append(title, message, retry);
  root.className = 'startup-shell startup is-error';
  root.setAttribute('aria-busy', 'false');
  root.setAttribute('role', 'alert');
  root.replaceChildren(panel);
}

async function initialize() {
  const rootRoute = getRootRoute();

  if (_TEST_ && rootRoute === 'logout') return;

  if (rootRoute === 'formservice') {
    await startFormService();
    return;
  }

  await fetchConfig();

  initDataDog();

  const authPromise = startAuth();
  const appPromise = loadApp();
  // Observe speculative failures while auth is pending; report them after readiness.
  appPromise.catch(() => {});

  await authPromise;

  const appModule = await appPromise;

  await start(appModule);
}

document.addEventListener('DOMContentLoaded', () => {
  initialize().catch(showStartupError);
});
