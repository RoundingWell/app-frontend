# Local router candidate

Source: <https://github.com/marionettejs/marionette/tree/codex/router-latest-origin/packages/router>

Exact revision: `a613f8de3a7c5a9a4d9aebe42a5f04b64b3ac6d0`, based on Marionette master `2828aebdc928a2e8121ee5f601a2d5012412068e`.
This is the reconstructed, reviewed Application-based candidate; it is not the missing original e14 implementation or the previous Events/RouteOutlet vendor copy.

`src/**` is that revision's router source with TypeScript syntax erased by the app's pinned esbuild, retaining ESM and changing relative `.ts` import extensions to `.js`. There are no behavioral patches. `source-manifest.json` records the tool version and source/output SHA-256 hashes. Reproduce from a clean checkout at that exact revision:

```sh
node packages/router/vendor.mjs /path/to/marionette
npm test --workspace @mnjs/router
```

The local private workspace exports JavaScript source directly. Vite resolves the workspace through its ordinary package exports; it needs no library build, generated dist directory, registry publication, or TypeScript app toolchain. `package.json` is app-specific packaging. The original README, DESIGN, PROVENANCE and MIT license are retained. Upstream README build/CJS/type instructions describe the upstream repository, not this JavaScript-only private workspace.

Runtime peers are pinned to `marionette`, `@mnjs/adapters`, `@mnjs/radio` and `@mnjs/utils` 5.0.1 in the app lockfile. The upstream candidate requires Node 24.15+ and a browser with Navigation API, URLPattern and AbortSignal.any; no History API fallback is added. The separate PDF form-service keeps its Backbone router.
