# Entities & Entity Services

All interfacing with the server goes through this layer. Consumers never fetch
directly — they make requests on the `entities` Radio channel and receive
Backbone models and collections.

## Architecture

Two layers per entity type:

- **`entities/<type>.js`** — the data definitions. Exports `_Model` (domain
  logic: getters, save helpers, validation), `Model` (`Store(_Model, TYPE)` —
  deduplicated by `type` + `id`, so two fetches of the same resource share one
  instance), and `Collection`.
- **`<type>.js`** (this directory) — the service. Extends
  `js/base/entity-service`, binds the entity definitions via `Entity`, maps
  Radio requests to fetch methods, and is instantiated once as a singleton.
  `index.js` imports every service (alphabetically) to register them.

## Radio requests

Channel: `entities`. Naming convention:

- `'<type>:model'` / `'<type>:collection'` — instantiate without fetching
  (`getModel` accepts an id or an attrs object).
- `'fetch:<type>:model'` / `'fetch:<type>:collection'` — fetch by id / fetch a list.
- `'fetch:<type>:collection:by<Parent>'` — custom endpoint variants defined on
  the service (e.g. `'fetch:actions:collection:byFlow'` in `actions.js`).

Base verbs available on every service (`js/base/entity-service.js`):
`getModel`, `getCollection`, `fetchModel`, `fetchCollection`, `fetchBy(url)`,
plus the cached variants `fetchModelCache`, `fetchCollectionCache`, and
`fetchByCache`. All `fetch*` methods return promises.

Typical consumption from an app:

```js
beforeStart() {
  const [patientId] = this.getCurrentRoute().eventArgs;
  return [
    Radio.request('entities', 'fetch:patients:model', patientId),
    Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId }),
  ];
}
```

## JSON:API parsing

`js/base/jsonapi-mixin.js` flattens JSON:API resources onto model attributes:

- `data.attributes` plus `data.id` become plain attributes.
- `data.meta.*` and `data.relationships.*` become `_underscored_key` attributes
  (relationship `patient` → `_patient`). Has-many relationships parse to arrays
  of `{ id, type }` refs; has-one keeps the raw `{ id, type }` data.
- Dereference a has-one ref with `model.getRelationship('_patient')`, which
  returns the shared instance from the Store.
- `included` resources are written into the Store on parse, so fetching an
  action with `include=flow` also populates the flow model.
- Saving relationships is explicit: `model.save(attrs, { relationships })` with
  values built by `toRelation(entity)`. Plain `save(attrs)` sends attributes only.

## Caching (opt-in, stale-while-revalidate)

Only the `fetch*Cache` methods cache; the default `fetch*` methods are always
fresh. The cached variants resolve immediately with the IndexedDB copy when one
exists, then refetch in the background (background failures are swallowed) so
fresh data streams into the shared Store instances. Cache keys combine user id,
workspace id, and the canonical request URL (`js/base/cache/entity-cache.js`);
entries expire after 7 days and per-user partitions are pruned on auth changes.

- `isWorkspaceScoped: true` is the service default — set it to `false` for
  entities whose responses don't vary by workspace, or pass
  `cacheScope: 'user'` per request for mixed-scope entities.
- A model parsed from cache reports `model.isCached()`.

## Checklist: adding an entity

1. `entities/<type>.js` — define and export `_Model`,
   `Model = Store(_Model, TYPE)`, and `Collection`.
2. `<type>.js` — service extending `js/base/entity-service` with `Entity` and
   `radioRequests` following the naming convention above.
3. Register the service with an import in `index.js` (alphabetical).
4. Test support — add `test/support/api/<type>.js` with `get<Type>` /
   `route<Type>` helpers composed from `helpers/json-api`, and import it in
   `test/support/e2e.js`.

## Common mistakes

- Fetching outside this layer. Raw `fetch()` or ad hoc XHR misses auth and
  workspace headers, request dedup, and error handling — Backbone sync is
  globally routed through `js/base/fetch` (`js/base/backbone-fetch.js`), so
  always go through Backbone entities. For new endpoints, add a service method
  and Radio request rather than calling `.fetch()` from apps or views, so the
  endpoint stays discoverable and can adopt caching.
- Mutating Store-shared instances casually. Models are deduplicated by
  `type` + `id` — a `set()` is visible to every consumer of that resource.
- Assuming `fetch*Cache` data is fresh. It resolves with up-to-7-day-old data
  and refreshes silently in the background; refresh failures don't surface.
- Forgetting `{ relationships }` on save and expecting relationship changes to
  persist.
- Reading relationship attrs without the underscore prefix
  (`get('_patient')`, not `get('patient')`).
- Adding a service file but not importing it in `index.js` — the Radio
  requests never register.
