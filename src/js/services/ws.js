import { map, reject, isArray, isEmpty } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';
import { v7 as uuid } from 'uuid';

import { addError } from 'js/datadog';

import App from 'js/base/app';
import fetcher, { handleJSON } from 'js/base/fetch';

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
    this.managedAdds = new WeakMap();
    this.ws = {};
    this.pendingMessages = [];
    this.reconnectAttempts = 0;
  },

  getUrl({ signal }) {
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

  onStart(app, options, url) {
    /* istanbul ignore next: Essentially avoid offline */
    if (!url) return;
    this.ws = new WebSocket(url.toString());
    this.ws.addEventListener('open', this.onOpen.bind(this));
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

    // UI callers queue subscriptions only; heartbeat messages use sendData directly.
    /* istanbul ignore else */
    if (data.name === 'Subscribe') {
      this.pendingMessages = reject(this.pendingMessages, { name: 'Subscribe' });
    }
    this.pendingMessages.push(data);

    if (this.ws.readyState === WebSocket.CLOSED) {
      this.restart();
      return;
    }

    if (this.ws.readyState !== WebSocket.CONNECTING) {
      this.start();
      return;
    }
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

  onOpen() {
    this.stopReconnect();
    this.reconnectAttempts = 0;
    const messages = this.pendingMessages;
    this.pendingMessages = [];
    messages.forEach(message => this.sendData(message));
    this.startHeartbeat();
  },

  startHeartbeat() {
    this.stopHeartbeat();

    this.heartBeat = setInterval(() => {
      this.sendData({ name: 'ping' });
    }, this.HEART_BEAT_INTERVAL);
  },

  stopHeartbeat() {
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
      this._subscribe();
    }, this._getReconnectDelay());

    this.reconnectAttempts += 1;
  },

  stopReconnect() {
    clearTimeout(this.reconnect);
    this.reconnect = null;
  },

  onClose() {
    this.stopHeartbeat();
    if (!this.isRunning() || !this._hasSubscription()) return;
    this.startReconnect();
  },

  onStop() {
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
    subscriptions.get(type)?.();

    const requests = new Map();
    let released = false;

    const onMessage = (data, model) => {
      if (released || collection.get(model) || data.category === 'ResourceDeleted') return;

      const requestId = `${ model.type }-${ model.id }`;
      if (requests.has(requestId)) return;

      const controller = new AbortController();
      requests.set(requestId, controller);

      Promise.resolve(model.fetch({ data: dataParams, signal: controller.signal }))
        .then(() => {
          if (controller.signal.aborted) return;

          collection.add(model);
          Radio.request('ws', 'add', model);
        })
        .catch(error => {
          if (!controller.signal.aborted) addError(error);
        })
        .finally(() => requests.delete(requestId));
    };
    const release = () => {
      // Release unregisters itself; retain idempotence for an already-queued cleanup.
      /* istanbul ignore if */
      if (released) return;
      released = true;
      requests.forEach(controller => controller.abort());
      requests.clear();
      app.stopListening(channel, eventName, onMessage);
      app.off('stop', release);
      subscriptions.delete(type);
      if (!subscriptions.size) this.managedAdds.delete(app);
    };

    subscriptions.set(type, release);
    this.managedAdds.set(app, subscriptions);
    app.listenTo(channel, eventName, onMessage);
    app.once('stop', release);

    return release;
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

  subscribe(resources, { filters } = {}) {
    this.filters = filters;
    this.resources.reset(this._getResources(resources));
    this._subscribe();
  },

  add(resources) {
    this.resources.add(this._getResources(resources));
    this._subscribe();
  },

  unsubscribe(resources) {
    this.resources.remove(this._getResources(resources));
    this._subscribe();
  },
});
