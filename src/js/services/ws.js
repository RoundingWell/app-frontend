import { each, map, values, isArray } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

const AdderApp = App.extend({
  restartWithParent: false,
  beforeStart({ model, dataParams }) {
    return model.fetch({ data: dataParams });
  },
  onStart({ model, collection }) {
    collection.add(model);
  },
});

export default App.extend({
  HEART_BEAT_INTERVAL: 50000,
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
    this.ws = {};
  },

  getUrl() {
    if (this.url) return this.url;

    return fetch('/api/websockets')
      .then(response => response.json())
      .then(({ data }) => {
        if (!data.is_enabled) return;
        this.url = new URL(data.endpoint);
        return this.url;
      });
  },

  beforeStart() {
    return [
      Radio.request('auth', 'getToken'),
      this.getUrl(),
    ];
  },

  onStart({ data }, token) {
    /* istanbul ignore next: Essentially avoid offline */
    if (!token || !this.url) return;
    this.url.searchParams.set('auth', token);
    this.ws = new WebSocket(this.url.toString());
    this.ws.addEventListener('open', this.onOpen.bind(this, data));
    this.ws.addEventListener('close', this.onClose.bind(this));
    this.ws.addEventListener('message', this.onMessage.bind(this));
  },

  _subscribe() {
    const currentUser = Radio.request('bootstrap', 'currentUser');
    const currentWorkspace = Radio.request('workspace', 'current');

    const data = {
      clientKey: currentUser.clientKey,
      workspace: currentWorkspace.id,
      resources: this.resources.toJSON(),
    };

    if (this.filters) data.filters = this.filters;

    this.send({
      name: 'Subscribe',
      data,
    });
  },

  send(data) {
    if (!this.url) return;

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

  onOpen(data) {
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

  onClose() {
    this.stopHeartbeat();
    /* istanbul ignore next: resubscribing in tests causes test leaking */
    if (!_TEST_ && this.resources.length) this._subscribe();
  },

  triggerMessage(data, model) {
    const channel = this.getChannel();
    if (model) model.trigger('message', data);
    if (data.resource) channel.trigger(`message:${ data.resource.type }`, data, model);
    channel.trigger('message', data, model);
  },

  manageAdd(app, collection, type, dataParams) {
    const channel = this.getChannel();

    app.listenTo(channel, `message:${ type }`, (data, model) => {
      if (collection.get(model) || data.category === 'ResourceDeleted') return;

      const appName = `${ model.type }-${ model.id }`;

      if (app.isRunning() && app.getChildApp(appName)) return;

      const adderApp = app.addChildApp(appName, AdderApp);
      adderApp.start({ model, collection, dataParams });
    });
  },

  onMessage(event) {
    /* istanbul ignore next: Can't test this bref functionality in node websockets */
    if (!event.data) return;

    const data = JSON.parse(event.data);

    if (!data.category || data.name === 'pong') return;

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
