import { Router } from '@mnjs/router';

// First path segments served by the host, not this app.
const RESERVED_ROOTS = ['login', 'logout', 'authenticated', 'rw', 'formservice', 'api'];

function isAppUrl(url) {
  return !RESERVED_ROOTS.includes(url.pathname.split('/')[1]);
}

export default new Router({
  routes: [],
  intercept: isAppUrl,
  notFound: { name: 'notFound', within: isAppUrl },
});
