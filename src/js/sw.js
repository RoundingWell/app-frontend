import { clientsClaim } from 'workbox-core';
import { registerRoute, Route } from 'workbox-routing';
import { enable as enableNavigationPreload } from 'workbox-navigation-preload';
import { NetworkOnly, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { PrecacheFallbackPlugin, precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

const SHARED_RUNTIME_PREFIX = '/shared/';
const ICONS_PREFIX = '/icons/';

// Ensure that updates to the underlying service worker take effect immediately
// for both the current client and all other active clients.
self.skipWaiting();
clientsClaim();

if (self.location.hostname !== 'localhost') {
  cleanupOutdatedCaches();

  precacheAndRoute(self.__WB_MANIFEST);
  enableNavigationPreload();

  // Any navigation loads the precached index.html
  const networkOnlyNavigationRoute = new Route(({ request }) => {
    return request.mode === 'navigate';
  }, new NetworkOnly({
    plugins: [
      new PrecacheFallbackPlugin({ fallbackURL: '/index.html' }),
    ],
  }));

  registerRoute(networkOnlyNavigationRoute);

  const staticAssetsRoute = new Route(({ request }) => {
    return ['image'].includes(request.destination);
  }, new CacheFirst({ cacheName: 'cache-static-assets' }));

  registerRoute(staticAssetsRoute);

  // Hashing cache names that are unique per build for cache clean up
  function getHashedCacheName(name) {
    return `hashed-${ _NOW_ }-${ name }`;
  }

  // Delete all hashed caches except the current one
  async function deleteHashedCache() {
    const cacheNames = await self.caches.keys();

    const cacheNamesToDelete = cacheNames.filter(cacheName => {
      return (
        cacheName.startsWith('hashed-')
        && !cacheName.startsWith(`hashed-${ _NOW_ }`)
      );
    });

    await Promise.all(
      cacheNamesToDelete.map(cacheName => self.caches.delete(cacheName)),
    );

    return cacheNamesToDelete;
  }

  deleteHashedCache();

  const staticHashedAssetsRoute = new Route(({ request, url }) => {
    return (
      ['script', 'style'].includes(request.destination)
      && !url.pathname.startsWith(SHARED_RUNTIME_PREFIX)
      && !url.pathname.startsWith(ICONS_PREFIX)
    );
  }, new CacheFirst({ cacheName: getHashedCacheName('static-hashed-assets') }));

  registerRoute(staticHashedAssetsRoute);

  registerRoute(
    ({ url }) => url.pathname.includes('appconfig.json'),
    new NetworkFirst({
      cacheName: 'cache-appconfig',
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({
          statuses: [200],
        }),
      ],
    }),
  );

  // Caches api GET responses for the listed status codes
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
      cacheName: 'cache-api',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200, 204, 404, 410],
        }),
      ],
    }),
  );
}
