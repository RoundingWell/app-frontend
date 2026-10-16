# @mnjs/router

Named, nested routes over the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
and [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern), with an
optional Marionette layer for applications composed of asynchronous Applications.

Incubating in app-frontend; not published yet. The full contract is `DESIGN.md` in the
package source.

```js
import { Router } from '@mnjs/router';

const router = new Router({
  routes: [
    { name: 'home', path: '/' },
    { path: '/:workspace', children: [{ name: 'patient', path: 'patient/:patientId' }] },
  ],
  intercept: url => url.pathname !== '/logout',
  notFound: { name: 'notFound', within: () => true },
  handler: (match, { signal }) => showPage(match, signal),
});

await router.start();
await router.navigate('patient', { workspace: 'one', patientId: '42' }).finished;
```

`navigate()` resolves `{ committed, finished }`; `finished` settles when the handler's
promise does, and both resolve `false` when the navigation is superseded. The router
emits `route`, `route:ready` and `route:error` through `Events` from `@mnjs/utils`, so
`listenTo(router, 'route', …)` works. `memoryDriver()` runs the same router without a
browser, for tests and Node.

`@mnjs/router/outlet` exports `RouteOutlet`, a focused object an Application owns to keep
one selected child Application per route. It is the only entry point that needs the
optional `marionette` peer; `@mnjs/router` itself depends on `@mnjs/utils` only.

## Runtime floor

- Browsers with the Navigation API and URLPattern: Chrome/Edge 102, Firefox 147,
  Safari 26.2 (Baseline Newly available). This is narrower than Marionette core's
  Widely available target.
- Node 24.15 or later (global `URLPattern`) for `memoryDriver` and tests.

## Tests

```sh
npm test                # node:test suites, memory driver
npm run test:browser    # driver and router conformance in Playwright Chromium, Firefox, WebKit
```

The browser run needs the Playwright engines installed (`npx playwright install`).
