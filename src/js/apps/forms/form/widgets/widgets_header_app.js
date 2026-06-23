import Radio from 'backbone.radio';

import App from 'js/base/app';

import { FormWidgetsHeaderView } from 'js/apps/forms/form/widgets/widget_header_view';

export default App.extend({
  beforeStart({ patient, form }) {
    const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', patient.id);
    const widgets = form.getWidgets();
    const values = widgets.invoke('fetchValues', patient.id);

    return [workspacePatient, ...values];
  },
  onStart({ patient, form }) {
    const widgets = form.getWidgets();

    if (!widgets.length) return;

    this.showView(new FormWidgetsHeaderView({
      model: patient,
      collection: widgets,
    }));
  },
});
