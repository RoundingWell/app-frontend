import { filter, map } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

export default App.extend({
  channelName: 'sidebars',
  radioRequests: {
    'patient': 'getPatientSidebars',
  },
  initialize({ panels }) {
    this.panels = panels;
  },
  getPatientSidebars() {
    const sidebar = Radio.request('settings', 'get', 'sidebar') ?? this.panels.pluck('slug');
    const panels = map(sidebar, slug => this.panels.findWhere({ slug }));
    const visiblePanels = filter(panels, panel => panel.getWidgets().length);

    return Radio.request('entities', 'panels:collection', visiblePanels);
  },
});
