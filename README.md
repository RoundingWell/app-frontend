# FE-284 rendered evidence

These are Chromium screenshots of the actual InteractionItemView and RecentInteractionsView, rendered with the application's Backbone interaction models, Marionette setup, Handlebars templates, icon assets, Figtree font, and production SCSS. The small fixture page supplies the outer two-column preview shell only. It is not a full authenticated patient workflow screenshot.

All data is synthetic. No backend or SMS service is used; the browser aborts API requests. The `before.png` capture was made before changing application sources on develop commit b3b2244d3bf874c8db16707385ed1f7addcfd2b5. The `after.png` capture uses the same fixture and Chromium viewport (1280 × 950, UTC) after the FE-284 change. `after-mobile.png` exercises content at 390px.

Cases in the comparison: outbound campaign disposition only, inbound disposition and body, outbound Text Sent and note, genuinely empty SMS metadata, and unchanged outbound voicemail.

To reproduce: copy preview.html and preview.js to the repository root as .fe284-preview.html and .fe284-preview.js; run `npx vite --host 0.0.0.0 --port 8081`, then run capture.cjs with before/after. The scripts expect the environment's Playwright installation and /usr/bin/chromium. check-render.cjs also checks ordinary messages, missing/null metadata, direction-specific payload selection, note fallback, literal HTML-like payloads, call preservation, and mobile overflow.

Cypress was not run under the existing deferral. Browser checks are focused rendered-view evidence, not a Cypress E2E or full coverage result.
