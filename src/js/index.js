import { Workbox } from 'workbox-window';

import { fetchConfig, versions, appConfig } from '@roundingwell/care-ops-config';
import { initDataDog } from './datadog';

import getRootRoute from 'js/utils/root-route';

if (_PRODUCTION_ && 'serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');

  wb.register();
}

function startOutreach() {
  import('./outreach/index')
    .then(({ startOutreachApp }) => {
      startOutreachApp();
    });
}

function start() {
  import('./app')
    .then(({ startApp }) => {
      startApp();
    });
}

function startFormService() {
  import('./formservice')
    .then(({ startFormServiceApp }) => {
      startFormServiceApp();
    });
}

function startAuth() {
  import('./auth/index')
    .then(({ auth }) => {
      auth(start);
    });
}

function startApps({ isOutreach }) {
  if (isOutreach) {
    startOutreach();
    return;
  }

  startAuth();
}

document.addEventListener('DOMContentLoaded', () => {
  const rootRoute = getRootRoute();
  const isFormService = rootRoute === 'formservice';

  if (isFormService) {
    startFormService();
    return;
  }

  const isOutreach = rootRoute === 'outreach';
  await fetchConfig(_NOW_);

  if (_TEST_) {
    versions.frontend = 'develop';
    appConfig.name = 'Cypress Clinic';
    appConfig.cypress = 'cypress';
    appConfig.ws = 'ws://cypress-websocket/ws';

    if (location.pathname === '/logout') return;

    startApps({ isOutreach });
    return;
  }

    initDataDog();

      startApps({ isOutreach });
});
