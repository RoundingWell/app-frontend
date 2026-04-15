import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import WSService from 'js/services/ws';

const clientKey = 'clientKey';
const workspace = 'workspaceId';

describe('WS Service', () => {
  let service;

  beforeEach(() => {
    service = new WSService();

    Radio.reply('bootstrap', 'currentUser', { clientKey });
    Radio.reply('workspace', 'current', { id: workspace });
    Radio.reply('auth', 'getToken', () => 'Bearer token');
  });

  afterEach(() => {
    service.destroy();
    Radio.channel('auth').reset();
    Radio.channel('bootstrap').reset();
    Radio.channel('workspace').reset();
    Radio.channel('entities').reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches and caches the websocket url when enabled', async() => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        data: {
          is_enabled: true,
          endpoint: 'ws://cypress-websocket/ws',
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const url = await service.getUrl();
    const cachedUrl = await service.getUrl();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(url).toBeInstanceOf(URL);
    expect(url.toString()).toBe('ws://cypress-websocket/ws');
    expect(cachedUrl).toBe(url);
  });

  it('returns nothing when websockets are disabled', async() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        data: {
          is_enabled: false,
          endpoint: 'ws://cypress-websocket/ws',
        },
      }),
    }));

    await expect(service.getUrl()).resolves.toBeUndefined();
  });

  it('returns the auth token and websocket url during beforeStart', async() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        data: {
          is_enabled: true,
          endpoint: 'ws://cypress-websocket/ws',
        },
      }),
    }));

    const [token, url] = await Promise.all(service.beforeStart());

    expect(token).toBe('Bearer token');
    expect(url).toBeInstanceOf(URL);
  });

  it('adds the auth token to the websocket url on start', () => {
    const addEventListener = vi.fn();

    class FakeWebSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.addEventListener = addEventListener;
      }
    }

    vi.stubGlobal('WebSocket', FakeWebSocket);

    service.url = new URL('ws://cypress-websocket/ws');
    service.onStart({ test: true }, 'Bearer token');

    expect(service.url.searchParams.get('auth')).toBe('Bearer token');
    expect(service.ws.url).toBe('ws://cypress-websocket/ws?auth=Bearer+token');
    expect(addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('routes send behavior based on websocket state', () => {
    vi.stubGlobal('WebSocket', {
      OPEN: 1,
      CONNECTING: 0,
      CLOSED: 3,
    });

    const sendData = vi.spyOn(service, 'sendData').mockImplementation(() => {});
    const restart = vi.spyOn(service, 'restart').mockImplementation(() => {});
    const start = vi.spyOn(service, 'start').mockImplementation(() => {});
    const addEventListener = vi.fn();

    service.ws = { readyState: WebSocket.OPEN };
    service.send({ state: 'open' });

    service.ws = { readyState: WebSocket.CLOSED };
    service.send({ state: 'closed' });

    service.ws = { readyState: 5 };
    service.send({ state: 'idle' });

    service.ws = { readyState: WebSocket.CONNECTING, addEventListener };
    service.send({ state: 'connecting' });

    expect(sendData).toHaveBeenCalledWith({ state: 'open' });
    expect(restart).toHaveBeenCalledWith({ data: { state: 'closed' } });
    expect(start).toHaveBeenCalledWith({ data: { state: 'idle' } });
    expect(addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
  });

  it('flushes queued payloads when a connecting socket opens', () => {
    vi.stubGlobal('WebSocket', {
      OPEN: 1,
      CONNECTING: 0,
      CLOSED: 3,
    });

    const sendData = vi.spyOn(service, 'sendData').mockImplementation(() => {});
    const startHeartbeat = vi.spyOn(service, 'startHeartbeat').mockImplementation(() => {});
    const listeners = new Map();

    service.ws = {
      readyState: WebSocket.CONNECTING,
      addEventListener: vi.fn((eventName, handler) => {
        listeners.set(eventName, handler);
      }),
    };

    service.send({ state: 'connecting' });
    listeners.get('open')();

    expect(sendData).toHaveBeenCalledWith({ state: 'connecting' });
    expect(startHeartbeat).toHaveBeenCalledOnce();
  });

  it('serializes websocket payloads directly', () => {
    service.ws = { send: vi.fn() };

    service.sendData({ name: 'ping' });

    expect(service.ws.send).toHaveBeenCalledWith('{"name":"ping"}');
  });

  it('sends initial data and heartbeats when opened', () => {
    vi.useFakeTimers();

    const sendData = vi.spyOn(service, 'sendData').mockImplementation(() => {});
    service.HEART_BEAT_INTERVAL = 10;

    service.onOpen({ name: 'Subscribe' });
    vi.advanceTimersByTime(10);
    service.stopHeartbeat();

    expect(sendData).toHaveBeenNthCalledWith(1, { name: 'Subscribe' });
    expect(sendData).toHaveBeenNthCalledWith(2, { name: 'ping' });
    expect(service.heartBeat).toBeNull();
  });

  it('starts heartbeat without an initial payload and stops it on close', () => {
    vi.useFakeTimers();

    const sendData = vi.spyOn(service, 'sendData').mockImplementation(() => {});

    service.onOpen();
    vi.advanceTimersByTime(service.HEART_BEAT_INTERVAL);
    service.onClose();

    expect(sendData).toHaveBeenCalledWith({ name: 'ping' });
    expect(service.heartBeat).toBeNull();
  });

  it('triggers generic and type-specific messages', () => {
    const channel = Radio.channel('ws');
    const messageHandler = vi.fn();
    const flowHandler = vi.fn();
    const model = {
      handleMessage: vi.fn(),
      trigger: vi.fn(),
      type: 'flows',
      id: 'id',
    };

    service.subscriptionVersion = 'current-version';
    channel.on('message', messageHandler);
    channel.on('message:flows', flowHandler);
    Radio.reply('entities', 'get:store', () => model);

    service.onMessage({ data: JSON.stringify({ category: 'Test' }) });
    service.onMessage({ data: JSON.stringify({ name: 'pong' }) });
    service.onMessage({ data: JSON.stringify({ category: 'Test', subscription_version: 'stale-version' }) });
    service.onMessage({
      data: JSON.stringify({
        category: 'Test',
        resource: { id: 'id', type: 'flows' },
        subscription_version: 'current-version',
      }),
    });

    expect(messageHandler).toHaveBeenCalledTimes(1);
    expect(flowHandler).not.toHaveBeenCalled();
    expect(model.handleMessage).toHaveBeenCalledWith({
      category: 'Test',
      resource: { id: 'id', type: 'flows' },
      subscription_version: 'current-version',
    });
  });

  it('triggers direct message events for a resource model', () => {
    const channel = service.getChannel();
    const messageHandler = vi.fn();
    const flowHandler = vi.fn();
    const model = {
      trigger: vi.fn(),
    };

    channel.on('message', messageHandler);
    channel.on('message:flows', flowHandler);

    service.triggerMessage({
      category: 'Updated',
      resource: { type: 'flows' },
    }, model);

    expect(model.trigger).toHaveBeenCalledWith('message', {
      category: 'Updated',
      resource: { type: 'flows' },
    });
    expect(flowHandler).toHaveBeenCalledOnce();
    expect(messageHandler).toHaveBeenCalledOnce();
  });

  it('manages subscriptions, persisted resources, and filters', () => {
    const subscribe = vi.spyOn(service, '_subscribe').mockImplementation(() => {});
    const TestModel = Backbone.Model.extend({ type: 'bar' });

    service.subscribe(new TestModel({ id: 'foo' }));
    expect(service.resources.toJSON()).toEqual([{ id: 'foo', type: 'bar' }]);

    service.add({ id: 'foo2', type: 'bar2' }, { shouldPersist: true });
    expect(service.persistent.foo2).toEqual({ id: 'foo2', type: 'bar2' });

    service.subscribe([{ id: 'foo3', type: 'bar3' }], {
      shouldPersist: true,
      filters: { team: 'care-ops' },
    });
    expect(service.filters).toEqual({ team: 'care-ops' });
    expect(service.resources.toJSON()).toEqual([{ id: 'foo3', type: 'bar3' }]);

    service.unsubscribe([{ id: 'foo2', type: 'bar2' }]);
    expect(service.persistent.foo2).toBeUndefined();

    expect(subscribe).toHaveBeenCalledTimes(4);
  });

  it('builds and sends subscription payloads with and without filters', () => {
    const send = vi.spyOn(service, 'send').mockImplementation(() => {});

    service.resources.reset([{ id: 'foo', type: 'bar' }]);
    service.filters = { team: 'care-ops' };
    service._subscribe();
    service.filters = undefined;
    service._subscribe();

    expect(send).toHaveBeenNthCalledWith(1, {
      name: 'Subscribe',
      data: {
        clientKey,
        workspace,
        resources: [{ id: 'foo', type: 'bar' }],
        subscriptionVersion: expect.any(String),
        filters: { team: 'care-ops' },
      },
    });
    expect(send).toHaveBeenNthCalledWith(2, {
      name: 'Subscribe',
      data: {
        clientKey,
        workspace,
        resources: [{ id: 'foo', type: 'bar' }],
        subscriptionVersion: expect.any(String),
      },
    });
  });

  it('restarts a closed socket with the current subscription payload', () => {
    vi.stubGlobal('WebSocket', {
      OPEN: 1,
      CONNECTING: 0,
      CLOSED: 3,
    });

    const restart = vi.spyOn(service, 'restart').mockImplementation(() => {});

    service.ws = { readyState: WebSocket.CLOSED };
    service.resources.reset([{ id: 'foo', type: 'bar' }]);

    service._subscribe();

    expect(restart).toHaveBeenCalledWith({
      data: {
        name: 'Subscribe',
        data: {
          clientKey,
          workspace,
          resources: [{ id: 'foo', type: 'bar' }],
          subscriptionVersion: expect.any(String),
        },
      },
    });
  });

  it('adds missing models through manageAdd and ignores duplicates', async() => {
    const appName = 'bar-foo';
    const model = new Backbone.Model({ id: 'foo' });
    model.type = 'bar';

    const collection = new Backbone.Collection();
    const adderStart = vi.fn();
    const childApp = {
      start: adderStart,
    };
    let adderClass;
    const app = {
      listenTo: (_channel, _eventName, handler) => {
        app.handler = handler;
      },
      isRunning: () => false,
      getChildApp: () => null,
      addChildApp: vi.fn((name, AppClass) => {
        adderClass = AppClass;
        return childApp;
      }),
    };

    service.manageAdd(app, collection, 'bar', { foo: 'bar' });

    app.handler({ category: 'Updated' }, model);
    app.handler({ category: 'ResourceDeleted' }, model);
    collection.add(model);
    app.handler({ category: 'Updated' }, model);

    expect(app.addChildApp).toHaveBeenCalledWith(appName, expect.any(Function));
    expect(adderStart).toHaveBeenCalledWith({
      model,
      collection,
      dataParams: { foo: 'bar' },
    });
    expect(adderStart).toHaveBeenCalledTimes(1);

    const existingApp = {
      listenTo: (_channel, _eventName, handler) => {
        existingApp.handler = handler;
      },
      isRunning: () => true,
      getChildApp: () => childApp,
      addChildApp: vi.fn(),
    };

    service.manageAdd(existingApp, new Backbone.Collection(), 'bar', {});
    existingApp.handler({ category: 'Updated' }, model);

    expect(existingApp.addChildApp).not.toHaveBeenCalled();

    const adderApp = new adderClass();
    const addSpy = vi.spyOn(Radio, 'request').mockReturnValue(undefined);
    const fetchModel = {
      fetch: vi.fn().mockResolvedValue(undefined),
    };
    const addCollection = new Backbone.Collection();

    await expect(adderApp.beforeStart({ model: fetchModel, dataParams: { foo: 'bar' } })).resolves.toBeUndefined();
    adderApp.onStart({ model, collection: addCollection });

    expect(fetchModel.fetch).toHaveBeenCalledWith({ data: { foo: 'bar' } });
    expect(addCollection.get(model)).toBe(model);
    expect(addSpy).toHaveBeenCalledWith('ws', 'add', model);
  });

  it('adds non-persistent resources without mutating persistent subscriptions', () => {
    const subscribe = vi.spyOn(service, '_subscribe').mockImplementation(() => {});

    service.add({ id: 'foo4', type: 'bar4' });

    expect(service.persistent).toEqual({});
    expect(service.resources.toJSON()).toEqual([{ id: 'foo4', type: 'bar4' }]);
    expect(subscribe).toHaveBeenCalledOnce();
  });
});
