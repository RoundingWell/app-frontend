import { isObject } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import Store from 'backbone.store';
import { MnObject } from 'marionette';
import { cacheIncluded } from './jsonapi-mixin';
import fetcher from 'js/base/fetch';

export function getStore(resource) {
  const Model = Store.get(resource.type);
  return new Model({ id: resource.id });
}

Radio.reply('entities', 'get:store', getStore);

export default MnObject.extend({
  channelName: 'entities',

  Entity: Backbone,

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
  fetchModel(modelId, options) {
    const model = new this.Entity.Model({ id: modelId });

    return model.fetch(options);
  },
  async fetchBy(url, options) {
    const response = await fetcher(url, options);

    if (!response || response.status === 204) return Promise.resolve();

    const responseData = await response.json();

    if (!response.ok) return Promise.reject({ response, responseData });

    cacheIncluded(responseData.included);

    const model = new this.Entity.Model({ id: responseData.data.id });
    model.set(model.parseModel(responseData.data));

    return Promise.resolve(model);
  },
});
