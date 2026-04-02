const PUSH_MESSAGE_TYPE = 'MessageTransport-push';
const REQUEST_MESSAGE_TYPE = 'MessageTransport-request';
const RESPONSE_MESSAGE_TYPE = 'MessageTransport-response';

export default class RingCXTransport {
  constructor({
    frameId,
    widgetOrigin = '*',
    onInit = () => {},
    onPush = () => {},
    onRequest = () => {},
  }) {
    this.frameId = frameId;
    this.widgetOrigin = widgetOrigin;
    this.onInit = onInit;
    this.onPush = onPush;
    this.onRequest = onRequest;

    this._onMessage = this._onMessage.bind(this);
    window.addEventListener('message', this._onMessage);
  }

  destroy() {
    window.removeEventListener('message', this._onMessage);
  }

  clickToDial(phoneNumber) {
    return this.send({
      type: 'rc-ev-clickToDial',
      phoneNumber,
    });
  }

  registerService(service) {
    return this.send({
      type: 'rc-ev-register',
      service,
    });
  }

  respond({ requestId, result, error }) {
    const frame = this.getFrame();

    if (!frame?.contentWindow) return false;

    frame.contentWindow.postMessage({
      type: RESPONSE_MESSAGE_TYPE,
      requestId,
      result,
      error,
    }, this.widgetOrigin);

    return true;
  }

  send(payload) {
    const frame = this.getFrame();

    if (!frame?.contentWindow) return false;

    frame.contentWindow.postMessage({
      type: PUSH_MESSAGE_TYPE,
      payload,
    }, this.widgetOrigin);

    return true;
  }

  getFrame() {
    return document.getElementById(this.frameId);
  }

  _isWidgetMessage(event) {
    if (!event?.data) return false;
    if (this.widgetOrigin === '*') return true;
    return event.origin === this.widgetOrigin;
  }

  _onMessage(event) {
    if (!this._isWidgetMessage(event)) return;

    const { data } = event;

    if (data.type === 'rc-ev-init') {
      this.onInit(data);
      return;
    }

    if (data.type === PUSH_MESSAGE_TYPE) {
      this.onPush(data.payload);
      return;
    }

    if (data.type === REQUEST_MESSAGE_TYPE) {
      this.onRequest(data);
    }
  }
}
