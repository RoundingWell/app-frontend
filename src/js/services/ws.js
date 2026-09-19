import { each, map, values, isArray, isEmpty } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';
import { v7 as uuid } from 'uuid';

import App from 'js/base/app';
import fetcher, { handleJSON } from 'js/base/fetch';

const AdderApp = App.extend({
  prepareStart({ model, dataParams }, { signal }) {
    return model.fetch({ data: dataParams, signal });
  },
  onStart(app, { model, collection }) {
    collection.add(model);
    Radio.request('ws', 'add', model);
    this.destroy();
  },
});

export default App.extend({
  HEART_BEAT_INTERVAL: 50000,
  RECONNECT_BASE_DELAY: 1000,
  RECONNECT_MAX_DELAY: 30000,
  channelName: 'ws',

  radioRequests: {
    'send': 'send',
    'subscribe': 'subscribe',
    'add': 'add',
    'unsubscribe': 'unsubscribe',
    'trigger': 'triggerMessage',
    'manage:add': 'manageAdd',
  },

  initialize() {
    this.resources = new Backbone.Collection();
    this.persistent = {};
    this.managedAdds = new WeakMap();
    this.ws = {};
    this.reconnectAttempts = 0;
  },

  getUrl({ signal } = {}) {
    return fetcher('/api/websockets', { signal })
      .then(handleJSON)
      .then(response => {
        if (!response) return;

        const { data } = response;
        if (!data.is_enabled) return;
        const { token, query_parameter: queryParameter } = data.authentication;

        const url = new URL(data.endpoint);
        url.searchParams.set(queryParameter, token);
        return url;
      });
  },

  prepareStart(options, { signal }) {
    return this.getUrl({ signal });
  },

  onStart(app, { data } = {}, url) {
    /* istanbul ignore next: Essentially avoid offline */
    if (!url) return;
    this.ws = new WebSocket(url.toString());
    this.ws.addEventListener('open', this.onOpen.bind(this, data));
    this.ws.addEventListener('close', this.onClose.bind(this));
    this.ws.addEventListener('message', this.onMessage.bind(this));
  },

  _subscribe() {
    this.subscriptionVersion = uuid();

    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentWorkspace = Radio.request('workspace', 'current');

    const data = {
      clientKey: currentUser.clientKey,
      workspace: currentWorkspace.id,
      resources: this.resources.toJSON(),
      subscriptionVersion: this.subscriptionVersion,
    };

    if (this._hasFilters()) data.filters = this.filters;

    this.send({
      name: 'Subscribe',
      data,
    });
  },

  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.sendData(data);
      return;
    }

    if (this.ws.readyState === WebSocket.CLOSED) {
      this.restart({ data });
      return;
    }

    if (this.ws.readyState !== WebSocket.CONNECTING) {
      this.start({ data });
      return;
    }

    this.ws.addEventListener('open', this.onOpen.bind(this, data));
  },

  sendData(data) {
    this.ws.send(JSON.stringify(data));
  },

  _hasFilters() {
    return !isEmpty(this.filters);
  },

  _hasSubscription() {
    return !!this.resources.length || this._hasFilters();
  },

  onOpen(data) {
    this.stopReconnect();
    this.reconnectAttempts = 0;
    if (data) this.sendData(data);
    this.startHeartbeat();
  },

  startHeartbeat() {
    this.stopHeartbeat();

    this.heartBeat = setInterval(() => {
      this.sendData({ name: 'ping' });
    }, this.HEART_BEAT_INTERVAL);
  },

  stopHeartbeat() {
    if (!this.heartBeat) return;

    clearInterval(this.heartBeat);
    this.heartBeat = null;
  },

  _getReconnectDelay() {
    const backoff = Math.min(this.RECONNECT_MAX_DELAY, this.RECONNECT_BASE_DELAY * (2 ** this.reconnectAttempts));

    return backoff + Math.floor(Math.random() * this.RECONNECT_BASE_DELAY);
  },

  startReconnect() {
    this.stopReconnect();

    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      if (!this.isRunning() || !this._hasSubscription()) return;
      this._subscribe();
    }, this._getReconnectDelay());

    this.reconnectAttempts += 1;
  },

  stopReconnect() {
    if (!this.reconnect) return;

    clearTimeout(this.reconnect);
    this.reconnect = null;
  },

  onClose() {
    this.stopHeartbeat();
    if (!this.isRunning() || !this._hasSubscription()) return;
    this.startReconnect();
  },

  onBeforeStop() {
    this.stopHeartbeat();
    this.stopReconnect();
  },

  triggerMessage(data, model) {
    const channel = this.getChannel();
    if (model) model.trigger('message', data);
    if (data.resource) channel.trigger(`message:${ data.resource.type }`, data, model);
    channel.trigger('message', data, model);
  },

  manageAdd(app, collection, type, dataParams) {
    const channel = this.getChannel();
    const eventName = `message:${ type }`;
    const subscriptions = this.managedAdds.get(app) || new Map();
    const previous = subscriptions.get(type);

    if (previous) {
      app.stopListening(channel, eventName, previous.onMessage);
      app.off('before:stop', previous.onStop);
    }

    const onMessage = (data, model) => {
      if (collection.get(model) || data.category === 'ResourceDeleted') return;

      const appName = `${ model.type }-${ model.id }`;

      if (!app.isRunning() || app.getChildApp(appName)) return;

      const adderApp = app.addChildApp(appName, new AdderApp());
      adderApp.start({ model, collection, dataParams });
    };
    const onStop = () => {
      app.stopListening(channel, eventName, onMessage);
      subscriptions.delete(type);
      if (!subscriptions.size) this.managedAdds.delete(app);
    };

    subscriptions.set(type, { onMessage, onStop });
    this.managedAdds.set(app, subscriptions);
    app.listenTo(channel, eventName, onMessage);
    app.once('before:stop', onStop);
  },

  onMessage(event) {
    /* istanbul ignore next: Can't test this bref functionality in node websockets */
    if (!event.data) return;

    const data = JSON.parse(event.data);

    if (!data.category || data.name === 'pong') return;

    if (data.subscription_version && data.subscription_version !== this.subscriptionVersion) return;

    if (!data.resource) {
      this.triggerMessage(data);
      return;
    }

    const model = Radio.request('entities', 'get:store', data.resource);
    model.handleMessage(data);
  },

  _getResources(resources) {
    resources = isArray(resources) ? resources : [resources];

    return map(resources, ({ id, type }) => ({ id, type }));
  },

  // TODO: We likely want to support a more reboust way of maintaining filters
  subscribe(resources, { shouldPersist, filters } = {}) {
    resources = this._getResources(resources);
    this.filters = filters;

    if (shouldPersist) {
      each(resources, ({ id, type }) => {
        this.persistent[id] = { id, type };
      });

      this.resources.reset(resources);
      this._subscribe();
      return;
    }

    this.resources.reset(resources);
    this.resources.add(values(this.persistent));
    this._subscribe();
  },

  add(resources, { shouldPersist } = {}) {
    resources = this._getResources(resources);

    if (shouldPersist) {
      each(resources, ({ id, type }) => {
        this.persistent[id] = { id, type };
      });
    }

    this.resources.add(resources);
    this._subscribe();
  },

  unsubscribe(resources) {
    resources = this._getResources(resources);

    each(resources, ({ id }) => {
      delete this.persistent[id];
    });
    this.resources.remove(resources);
    this._subscribe();
  },
});
