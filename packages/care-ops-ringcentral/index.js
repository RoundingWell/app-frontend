import RingCentralApp from './ringcentral_app';

function init({ region }) {
  new RingCentralApp({ region });
}

export { init };
