import { extend } from 'underscore';
import Radio from 'backbone.radio';

import { SidebarMixin } from 'js/services/sidebar';

import App from 'js/base/app';

import { LayoutView, HeadingView, SidebarWidgetsView } from 'js/apps/patients/sidebar/patient/patient-sidebar_views';

export default App.extend(extend({
  onBeforeStart({ patient }) {
    this.patient = patient;
    this.widgets = Radio.request('widgets', 'sidebarWidgets');

    this.showChildView('heading', new HeadingView());

    this.showContent();
  },
  beforeStart() {
    const patientModel = Radio.request('entities', 'fetch:patients:model', this.patient.id);
    const workspacePatient = Radio.request('entities', 'fetch:workspacePatients:byPatient', this.patient.id);
    const values = this.widgets.invoke('fetchValues', this.patient.id);

    return [patientModel, workspacePatient, ...values];
  },
  onStart() {
    this.showContentView('widgets', new SidebarWidgetsView({
      model: this.patient,
      collection: this.widgets,
    }));
  },
  onClose() {
    this.stop();
  },
  showContent() {
    const layoutView = new LayoutView({ model: this.patient });

    layoutView.getRegion('widgets').startPreloader();

    this.listenTo(layoutView, 'click:patient', () => {
      Radio.trigger('event-router', 'patient:dashboard', this.patient.id);
    });

    this.showChildView('content', layoutView);
  },
}, SidebarMixin));
