import RingCentralApp from './ringcentral_app';

let dialerApp;

function call(number, action) {
  dialerApp.call(number, action);
}

function init({ region, patients }) {
  dialerApp = new RingCentralApp({ region, patients });
}

export { call, init };
