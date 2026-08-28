import { compact, difference, filter, map } from 'underscore';
import Radio from 'backbone.radio';

import { addError } from 'js/datadog';

import App from 'js/base/app';

export default App.extend({
  channelName: 'sidebars',
  radioRequests: {
    'patient': 'getPatientSidebars',
  },
  initialize({ panels }) {
    this.panels = panels;
    this.reportedMissingPanelSlugs = [];
  },
  getPatientSidebars() {
    const sidebar = Radio.request('settings', 'get', 'sidebar') ?? this.panels.pluck('slug');
    const panels = map(sidebar, slug => this.panels.findWhere({ slug }));
    const missingPanelSlugs = filter(sidebar, (slug, index) => !panels[index]);
    const visiblePanels = filter(compact(panels), panel => panel.getWidgets().length);

    this.reportMissingPanels(missingPanelSlugs);

    return Radio.request('entities', 'panels:collection', visiblePanels);
  },
  reportMissingPanels(missingPanelSlugs) {
    const unreportedSlugs = difference(missingPanelSlugs, this.reportedMissingPanelSlugs);

    if (!unreportedSlugs.length) return;

    this.reportedMissingPanelSlugs.push(...unreportedSlugs);

    addError(
      new Error('Patient sidebar configuration references unavailable panels'),
      { missingPanelSlugs: unreportedSlugs },
    );
  },
});
