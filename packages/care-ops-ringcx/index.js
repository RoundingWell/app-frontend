import RingCXApp from './ringcx_app';

let dialerApp;

function call(number, action) {
  return dialerApp?.call(number, action);
}

function init(options) {
  dialerApp = new RingCXApp(options);
  return dialerApp;
}

export { call, init };
