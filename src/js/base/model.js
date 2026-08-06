import { each, extend, isEmpty, isFunction, pick, reduce, result } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';
import JsonApiMixin from './jsonapi-mixin';

import { getStore } from './entity-service';
import { setResponse } from './cache/entity-cache';

export default Backbone.Model.extend(extend({
  getRelationship(key) {
    const relationship = this.get(key);
    if (!relationship) return;
    return getStore(relationship);
  },
  getResource() {
    return {
      id: this.id,
      type: this.type,
    };
  },
  destroy(options) {
    // isDeleted means the model is already deleted from the db
    if (options && options.isDeleted) {
      this.stopListening();
      this.trigger('destroy', this, this.collection, options);
      return;
    }

    if (this.isNew()) {
      Backbone.Model.prototype.destroy.call(this, options);
      return Promise.resolve(options);
    }

    return Backbone.Model.prototype.destroy.call(this, options);
  },
  fetch(options) {
    // Model fetches default to aborting.
    const fetcher = Backbone.Model.prototype.fetch.call(this, extend({ abort: true }, options));

    this._isFetching = true;

    // Resolve with entity if successful
    return fetcher
      .then(response => {
        this._isFetching = false;

        // NOTE: If the response fails, a retry will include notifications results.
        if (!response) {
          this._notifications = null;
          return this;
        }

        each(this._notifications, this._handleMessage, this);
        this._notifications = null;

        if (response.ok) return this;

        return response;
      })
      .catch(error => {
        this._isFetching = false;

        throw error;
      });
  },
  isFetching() {
    return this._isFetching;
  },
  parse(response, options) {
    /* istanbul ignore if */
    if (!response || !response.data) return response;

    if (options && options._cacheKey) setResponse(options._cacheKey, response);

    this.cacheIncluded(response.included);

    return this.parseModel(response.data);
  },
  parseErrors({ errors }) {
    if (!errors) return;

    const attrPointer = '/data/attributes/';

    return reduce(errors, (parsedErrors, { source, detail }) => {
      const key = String(source.pointer).slice(attrPointer.length);
      parsedErrors[key] = detail;
      return parsedErrors;
    }, {});
  },
  removeFEOnly(attrs) {
    // Removes JSON:API identity and frontend _fields for POST/PATCHes
    return pick(attrs, function(value, key) {
      return key !== 'id' && key !== 'type' && /^[^_]/.test(key);
    });
  },
  toJSONApi(attributes = this.attributes) {
    return {
      id: this.id,
      type: this.type,
      attributes: this.removeFEOnly(attributes),
    };
  },
  save(attrs, data = {}, opts) {
    // Supports the prototype overloading
    if (attrs == null) opts = data;

    data = extend(this.toJSONApi(data.attributes || attrs), data);

    if (isEmpty(data.attributes)) delete data.attributes;

    opts = extend({
      patch: !this.isNew(),
      data: JSON.stringify({ data }),
    }, opts);

    return Backbone.Model.prototype.save.call(this, attrs, opts);
  },
  isCached() {
    return this.has('__cached_ts');
  },
  _getMessageHandler(category) {
    const messages = result(this, 'messages', {});

    return isFunction(messages[category]) ? messages[category] : this[messages[category]];
  },
  queueMessage(data) {
    const category = data.category;

    if (!this._notifications) {
      this._notifications = { [category]: data };
      return;
    }

    this._notifications[category] = data;
  },
  _handleMessage({ category, resource, author, payload }) {
    const handler = this._getMessageHandler(category);
    if (handler) handler.call(this, payload, { category, resource, author });
    Radio.request('ws', 'trigger', { category, resource, author, payload }, this);
  },
  handleMessage({ category, resource, author, payload = {} }) {
    payload.attributes = extend({}, payload.attributes, { updated_at: dayjs.utc().format() });

    if (this.isFetching()) {
      this.queueMessage({ category, resource, author, payload });
      return;
    }

    this._handleMessage({ category, resource, author, payload });
  },
}, JsonApiMixin));
