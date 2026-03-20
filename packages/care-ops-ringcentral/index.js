import RingCentralApp from './ringcentral_app';

let dialerApp;

function call(number, action) {
  dialerApp.call(number, action);
}

function init({ region }) {
  dialerApp = new RingCentralApp({ region });
}

export { call, init };
