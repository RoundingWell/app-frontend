# Datadog worker

RUM uses the Datadog deflate worker for Session Replay compression. It also
supports intake compression when `compressIntakeRequests` is enabled; this app
leaves that option unchanged. Recording still starts manually, with the existing
privacy, sampling, tracing, cookies, and event enrichment settings.

`index.js` imports `@datadog/browser-worker?url&no-inline` for RUM's supported
`workerUrl` option. Vite serves the package asset locally during development.
The shared-runtime build emits `/shared/assets/worker-<hash>.js` and resolves it relative
to `/shared/datadog.js` with `import.meta.url`, so nested app routes use the same
origin and path. `no-inline` is required even for the shared Vite library build.

Keep `browser-rum`, `browser-logs`, and `browser-worker` on the same exact version
when upgrading, and update the lockfile together. The content hash prevents an
older worker from being reused for different bytes. Existing deploy ordering
uploads the `shared/assets/` directory before `shared/datadog.js`, and shared assets
before the root shell. Retain previous hashed worker assets
for open tabs/rollbacks. Shared assets currently revalidate and are excluded from
service-worker precaching.

This prepares [FE-237](https://linear.app/roundingwell/issue/FE-237/self-host-the-datadog-rum-worker)
for [OPS-205](https://linear.app/roundingwell/issue/OPS-205/add-content-security-policy-to-tenant-cloudfront-distributions).
It does not change live CSP. Validate all other worker users and integrations
before removing `blob:` from the deployed policy. Intake proxying remains separate.

References: [Datadog CSP guidance](https://docs.datadoghq.com/integrations/content_security_policy_logs/#web-worker)
and [SDK 7.0.0 worker implementation](https://github.com/DataDog/browser-sdk/blob/v7.0.0/packages/rum/src/domain/deflate/deflateWorker.ts).
