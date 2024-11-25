import { each, values, isArray } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import Store from 'backbone.store';

import App from 'js/base/app';

export default App.extend({
  HEART_BEAT_INTERVAL: 50000,
  channelName: 'ws',

  radioRequests: {
    'send': 'send',
    'subscribe': 'subscribe',
    'add': 'add',
    'unsubscribe': 'unsubscribe',
  },

  initialize({ url }) {
    this.resources = new Backbone.Collection();
    this.persistent = {};
    this.ws = {};
    this.url = url;
  },

  beforeStart() {
    return Radio.request('auth', 'getToken');
  },

  onStart({ data }, token) {
    this.ws = new WebSocket(this.url, token);
    this.ws.addEventListener('open', this.onOpen.bind(this, data));
    this.ws.addEventListener('close', this.onClose.bind(this));
    this.ws.addEventListener('message', this.onMessage.bind(this));
  },

  _subscribe() {
    const currentUser = Radio.request('bootstrap', 'currentUser');

    this.send({
      name: 'Subscribe',
      data: {
        clientKey: currentUser.clientKey,
        resources: this.resources.toJSON(),
      },
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
    this.sendData(data);
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
  },

  onMessage(event) {
    const channel = this.getChannel();

    const data = JSON.parse(event.data);

    if (data.name === 'pong') return;

    if (data.resource) {
      const Resource = Store.get(data.resource.type);
      const resource = new Resource({ id: data.resource.id });
      resource.handleMessage(data);
    }

    channel.trigger('message', data);
  },

  subscribe(resources, { shouldPersist } = {}) {
    resources = isArray(resources) ? resources : [resources];

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
    resources = isArray(resources) ? resources : [resources];

    if (shouldPersist) {
      each(resources, ({ id, type }) => {
        this.persistent[id] = { id, type };
      });
    }

    this.resources.add(resources);
    this._subscribe();
  },

  unsubscribe(resources) {
    resources = isArray(resources) ? resources : [resources];
    each(resources, ({ id }) => {
      delete this.persistent[id];
    });
    this.resources.remove(resources);
    this._subscribe();
  },
});
