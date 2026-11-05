import { Radio } from 'marionette';

import App from 'js/base/app';

import { AddFlowView } from 'js/apps/patients/patient/action/action-add-flow_views';

export default App.extend({
  viewEvents: {
    'select': 'onSelect',
  },
  prepareStart({ patient }, { signal }) {
    const currentWorkspace = Radio.request('workspace', 'current');
    const { notDone } = currentWorkspace.getStates().groupByDone();
    const filter = { states: notDone.getFilterIds() };

    return Radio.request('entities', 'fetch:flows:collection:byPatient', { patientId: patient.id, filter }, { signal });
  },
  onStart(app, { action }, flows) {
    this.action = action;

    if (!flows.length) return;

    this.showView(new AddFlowView({ collection: flows }));
  },
  onSelect(flow) {
    const view = this.getView();

    view.setSaving(true);

    this.action.saveFlow(flow)
      .catch(({ responseData }) => {
        view.setSaving(false);
        Radio.request('alert', 'show:apiError', responseData);
      });
  },
});
