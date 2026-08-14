import Radio from 'backbone.radio';

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
    const sidebars = this.sidebars.filter(sidebar => sidebar.getWidgets().length);

    return Radio.request('entities', 'sidebars:collection', sidebars);
  },
});
