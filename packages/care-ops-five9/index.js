import Five9App from './five9_app';

let dialerApp;

function call(number, action) {
  dialerApp.call(number, action);
}

function init({ region, providerName, patients }) {
  dialerApp = new Five9App({ region, providerName, patients });
}

export { call, init };
