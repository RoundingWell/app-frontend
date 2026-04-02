import dayjs from 'dayjs';

import App from 'js/base/app';

import RingCXTransport from './ringcx_transport';
import { LayoutView } from './ringcx_views';

const DEFAULT_FRAME_ID = 'care-ops-ringcx-frame';
const DEFAULT_SERVICE_NAME = 'CareOps';
const DEFAULT_WIDGET_URL = 'https://cdn.labs.ringcentral.com/ringcx-embeddable/1.0.0/app.html';

function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '*';
  }
}

export default App.extend({
  stateEvents: {
    'change:isReady': 'onReadyChange',
  },
  initialize({
    frameId = DEFAULT_FRAME_ID,
    serviceName = DEFAULT_SERVICE_NAME,
    service = {},
    widgetUrl = DEFAULT_WIDGET_URL,
    onCallLog,
    onMatchContacts,
    onMatchCallLogs,
    onViewLead,
    onPushEvent,
    onTransferredCall,
  } = {}) {
    this.frameId = frameId;
    this.service = {
      name: serviceName,
      callLoggerEnabled: true,
      contactMatcherEnabled: true,
      callLogMatcherEnabled: true,
      ...service,
    };
    this.widgetUrl = widgetUrl;
    this.onCallLog = onCallLog;
    this.onMatchContacts = onMatchContacts;
    this.onMatchCallLogs = onMatchCallLogs;
    this.onViewLead = onViewLead;
    this.onPushEvent = onPushEvent;
    this.onTransferredCall = onTransferredCall;
    this.transport = new RingCXTransport({
      frameId,
      widgetOrigin: getOrigin(widgetUrl),
      onInit: this._handleInit.bind(this),
      onPush: this._handlePush.bind(this),
      onRequest: this._handleRequest.bind(this),
    });
  },
  startAfterInitialized: true,
  onStart() {
    this.showView(new LayoutView({
      model: this.getState(),
      frameId: this.frameId,
      widgetUrl: this.widgetUrl,
    }));
  },
  onBeforeDestroy() {
    this.transport?.destroy();
  },
  onReadyChange() {
    this._call();
  },
  call(number, action) {
    if (!number) return false;

    this.setState({
      actionId: action?.id || null,
      isOpen: true,
      pendingCall: number,
    });

    return this._call();
  },
  _call() {
    const number = this.getState('pendingCall');

    if (!this.getState('isReady') || !number) return false;

    const didSend = this.transport.clickToDial(number);

    if (didSend) {
      this.setState('pendingCall', null);
    }

    return didSend;
  },
  _handleInit() {
    this.transport.registerService(this.service);
    this.setState({
      isOpen: true,
      isReady: true,
    });
  },
  _handlePush(payload = {}) {
    const currentCall = payload.call || null;

    this.onPushEvent?.(payload, this);

    if (payload.type === 'rc-ev-ringCall') {
      this.setState({
        currentCall,
        isCallEnded: false,
        isOpen: true,
        isRinging: true,
        isTransferredCall: this._isTransferredCall(currentCall),
      });
      this._notifyTransferredCall(currentCall);
      return;
    }

    if (payload.type === 'rc-ev-newCall') {
      this.setState({
        callTime: dayjs(),
        currentCall,
        isCallEnded: false,
        isCalling: true,
        isOpen: true,
        isRinging: false,
        isTransferredCall: this._isTransferredCall(currentCall),
      });
      this._notifyTransferredCall(currentCall);
      return;
    }

    if (payload.type === 'rc-ev-endCall') {
      this.setState({
        currentCall,
        isCallEnded: true,
        isCalling: false,
        isRinging: false,
        isTransferredCall: this._isTransferredCall(currentCall),
      });
      this._notifyTransferredCall(currentCall);
    }
  },
  async _handleRequest(message = {}) {
    const { payload = {}, requestId } = message;
    const context = this._getRequestContext();

    try {
      if (payload.requestType === 'rc-ev-logCall') {
        await this._handleLogCallRequest({ context, payload, requestId });
        return;
      }

      if (payload.requestType === 'rc-ev-matchContacts') {
        await this._handleMatchContactsRequest({ context, payload, requestId });
        return;
      }

      if (payload.requestType === 'rc-ev-matchCallLogs') {
        await this._handleMatchCallLogsRequest({ context, payload, requestId });
        return;
      }

      if (payload.requestType === 'rc-ev-viewLead') {
        await this._handleViewLeadRequest({ context, payload, requestId });
        return;
      }

      this._respondUnsupportedRequest({ requestId, requestType: payload.requestType });
    } catch(error) {
      this.transport.respond({
        requestId,
        error: error.message,
      });
    }
  },
  _getRequestContext() {
    return {
      actionId: this.getState('actionId'),
      app: this,
    };
  },
  async _handleLogCallRequest({ context, payload, requestId }) {
    this.setState(this._getLogCallState(payload.data));
    await this.onCallLog?.(payload.data, context);
    this._notifyTransferredCall(payload.data?.call);
    this.transport.respond({ requestId, result: 'ok' });
  },
  _getLogCallState(data) {
    const state = {
      actionId: this.getState('actionId'),
      callLogData: data,
      callTime: this.getState('callTime'),
      currentCall: data?.call || this.getState('currentCall'),
      isCallEnded: this.getState('isCallEnded'),
      isTransferredCall: this._isTransferredCall(data?.call),
    };

    if (!data?.task?.dispositionId) return state;

    state.actionId = null;
    state.callTime = null;
    state.isCallEnded = false;

    return state;
  },
  async _handleMatchContactsRequest({ context, payload, requestId }) {
    const result = await this.onMatchContacts?.(payload.data, context);

    this.transport.respond({ requestId, result: result || {} });
  },
  async _handleMatchCallLogsRequest({ context, payload, requestId }) {
    const result = await this.onMatchCallLogs?.(payload.data, context);

    this.transport.respond({ requestId, result: result || {} });
  },
  async _handleViewLeadRequest({ context, payload, requestId }) {
    await this.onViewLead?.(payload.data, context);
    this.transport.respond({ requestId, result: 'ok' });
  },
  _respondUnsupportedRequest({ requestId, requestType }) {
    this.transport.respond({
      requestId,
      error: `Unsupported request type: ${ requestType }`,
    });
  },
  _isTransferredCall(call) {
    const sessionId = call?.session?.sessionId;

    if (!sessionId) return false;

    return !!call.session.transferSessions?.[sessionId];
  },
  _notifyTransferredCall(call) {
    if (!this._isTransferredCall(call)) return;
    this.onTransferredCall?.(call, { actionId: this.getState('actionId'), app: this });
  },
});
