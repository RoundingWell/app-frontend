import { Radio } from 'marionette';

import App from 'js/base/app';

import { FormWidgetsHeaderView } from './widget_header_view';

export default App.extend({
  prepareStart({ patient, form }, { signal }) {
    const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', patient.id, { signal });
    const widgets = form.getWidgets();
    const values = widgets.invoke('fetchValues', patient.id, { signal });

    return Promise.all([workspacePatient, ...values]);
  },
  onStart(app, { patient, form }) {
    const widgets = form.getWidgets();

    if (!widgets.length) return;

    this.showView(new FormWidgetsHeaderView({
      model: patient,
      collection: widgets,
    }));
  },
});
