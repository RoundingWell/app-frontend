import App from 'js/base/app';

export default App.extend({
  channelName: 'sidebars',
  radioRequests: {
    'patient': 'getPatientSidebars',
  },
  initialize({ sidebars }) {
    this.sidebars = sidebars;
  },
  getPatientSidebars() {
    return this.sidebars;
  },
});
