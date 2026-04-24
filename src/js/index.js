import { Workbox } from 'workbox-window';

import { fetchConfig } from '@roundingwell/care-ops-config';
import { initDataDog } from './datadog';

import getRootRoute from 'js/utils/root-route';

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

async function start() {
  const { startApp } = await import('./app');
  startApp();
}

document.addEventListener('DOMContentLoaded', async() => {
  const rootRoute = getRootRoute();

  if (_TEST_ && rootRoute === 'logout') return;

  if (rootRoute === 'formservice') {
    await startFormService();
    return;
  }

  await fetchConfig();

  initDataDog();

  await startAuth();

  await start();
});
