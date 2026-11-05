# Local router candidate

Source repository: <https://github.com/marionettejs/marionette>, package `packages/router`.

Exact reviewed revision: `c4a7134d8d37322c31e1595ecad037ba64ce2356` on the private upstream branch `codex/router-independent-improvements`. That upstream branch has not been publicly pushed. It adds `a1f5aefb` (structural key snapshots and contract corrections) and `c4a7134d` (installed two-feature example) over public candidate `a613f8de3a7c5a9a4d9aebe42a5f04b64b3ac6d0`, based on Marionette master `2828aebdc928a2e8121ee5f601a2d5012412068e`.

The reviewed source arrived as the private Library bundle `marionette-router-independent-c4a7134d.bundle`, 23,577,393 bytes, SHA-256 `cc5d2ebb21729f12b40f958d6a9d6207e0922af49f413fdb259030c646e3d64a`. Its bytes, commit and Git object integrity were verified before vendoring. This remains the reconstructed Application-based candidate, not the missing original e14 implementation or the previous Events/RouteOutlet vendor copy.

`src/**` is that revision's router source with TypeScript syntax erased by the app's pinned esbuild, retaining ESM and changing relative `.ts` import extensions to `.js`. There are no behavioral patches. `source-manifest.json` records the tool version and source/output SHA-256 hashes, plus hashes for the unchanged upstream documentation and example files. The vendor script removes obsolete generated modules. Reproduce from a clean checkout at that exact revision:

```sh
node packages/router/vendor.mjs /path/to/marionette
npm test --workspace @mnjs/router
```

The local private workspace exports JavaScript source directly. Vite resolves the workspace through its ordinary package exports; it needs no library build, generated dist directory, registry publication, or TypeScript app toolchain. `package.json` is app-specific packaging. The original README, DESIGN, PROVENANCE, desk example and MIT license are retained. Upstream README build/CJS/type instructions describe the upstream repository, not this JavaScript-only private workspace. The example is reference material; it does not change the app's startup or Interactions ownership.

The only upstream runtime change from the previous vendor is structural selection-key identity: keys are snapshotted before lifecycle effects, sparse arrays compare correctly, and invalid key containers reject before changing selection. There are no new public functions, options or methods. This app uses fresh one-field records with scalar workspace/patient/program/flow IDs or omits keys; it passes rich startup state only through `options`. See the [app key audit](../../src/js/base/routing.md#readiness-and-cancellation).

The local package smoke/regression command above is separate from Cypress. CircleCI currently omits that workspace test command; local results must not be described as CI certification. The upstream source-rights provenance remains a package release gate, and other browser engines require their own verification.

Runtime peers are pinned to `marionette`, `@mnjs/adapters`, `@mnjs/radio` and `@mnjs/utils` 5.0.1 in the app lockfile. The upstream candidate requires Node 24.15+ and a browser with Navigation API, URLPattern and AbortSignal.any; no History API fallback is added. The separate PDF form-service keeps its Backbone router.
