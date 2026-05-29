import { isObject, result } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import { MnObject } from 'marionette';
import fetcher, { getData, getUrl } from 'js/base/fetch';
import { getResponse, cacheKey } from 'js/base/cache/entity-cache';

export function getStore(resource) {
  const Model = Store.get(resource.type);
  return new Model({ id: resource.id });
}

Radio.reply('entities', 'get:store', getStore);

export default MnObject.extend({
  channelName: 'entities',

  Entity: Backbone,

  // When true, cache keys include the current workspace id so a workspace
  // switch doesn't replay another workspace's response. Override to false
  // for entities whose responses don't depend on the active workspace, or pass
  // `cacheScope: 'user'` for mixed-scope entities.
  isWorkspaceScoped: true,

  _cacheWorkspaceId(cacheScope) {
    if (cacheScope === 'user' || !this.isWorkspaceScoped) return undefined;
    const ws = Radio.request('workspace', 'current');
    return ws ? ws.id : undefined;
  },

  constructor: function(options) {
    this.mergeOptions(options, ['Entity']);

    MnObject.apply(this, arguments);
  },
  getCollection(models, options = {}) {
    return new this.Entity.Collection(models, options);
  },
  getModel(attrs, options) {
    if (attrs && !isObject(attrs)) attrs = { id: attrs };
    return new this.Entity.Model(attrs, options);
  },
  fetchCollection(options) {
    const collection = new this.Entity.Collection();

    return collection.fetch(options);
  },
  fetchCollectionCache(options = {}) {
    const collection = new this.Entity.Collection();
    const userId = Radio.request('auth', 'getUserId');
    if (!userId) return collection.fetch(options);

    const { cacheScope, ...requestOptions } = options;
    // Canonical GET URL (base + serialized options.data) — mirrors what the
    // fetch layer actually requests, so different params don't collide.
    const url = getUrl(requestOptions.url || result(collection, 'url'), requestOptions.data);
    const dbKey = cacheKey(userId, this._cacheWorkspaceId(cacheScope), url);
    const fetchOptions = { ...requestOptions, _cacheKey: dbKey };

    return getResponse(dbKey).then(cached => {
      if (cached) {
        collection.set(cached, { parse: true });
        collection.fetch(fetchOptions).catch(() => {});
        return collection;
      }
      return collection.fetch(fetchOptions);
    });
  },
  fetchModel(modelId, options) {
    const model = new this.Entity.Model({ id: modelId });

    return model.fetch(options);
  },
  fetchModelCache(modelId, options = {}) {
    const model = new this.Entity.Model({ id: modelId });
    const userId = Radio.request('auth', 'getUserId');
    if (!userId) return model.fetch(options);

    const { cacheScope, ...requestOptions } = options;
    const url = getUrl(requestOptions.url || result(model, 'url'), requestOptions.data);
    const dbKey = cacheKey(userId, this._cacheWorkspaceId(cacheScope), url);
    const fetchOptions = { ...requestOptions, _cacheKey: dbKey };

    return getResponse(dbKey).then(cached => {
      if (cached) {
        model.set(model.parse(cached));
        model.fetch(fetchOptions).catch(() => {});
        return model;
      }
      return model.fetch(fetchOptions);
    });
  },
  async fetchBy(url, options = {}) {
    const response = await fetcher(url, options);

    if (!response || response.status === 204) return Promise.resolve();

    const responseData = await getData(response, 'json');

    if (!response.ok) return Promise.reject({ response, responseData });

    const model = new this.Entity.Model({ id: responseData.data.id });
    model.set(model.parse(responseData, options));

    return Promise.resolve(model);
  },
  fetchByCache(url, options = {}) {
    const userId = Radio.request('auth', 'getUserId');
    if (!userId) return this.fetchBy(url, options);

    const { cacheScope, ...requestOptions } = options;
    const dbKey = cacheKey(userId, this._cacheWorkspaceId(cacheScope), getUrl(url, requestOptions.data));
    const fetchOptions = { ...requestOptions, _cacheKey: dbKey };

    return getResponse(dbKey).then(cached => {
      if (cached) {
        const model = new this.Entity.Model({ id: cached.data.id });
        model.set(model.parse(cached));
        this.fetchBy(url, fetchOptions).catch(() => {});
        return model;
      }
      return this.fetchBy(url, fetchOptions);
    });
  },
});
