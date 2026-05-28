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

async function loadApp() {
  return import('./app');
}

async function start({ startApp }) {
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

  const authPromise = startAuth();
  const appPromise = loadApp();

  const [, appModule] = await Promise.all([authPromise, appPromise]);

  await start(appModule);
});
