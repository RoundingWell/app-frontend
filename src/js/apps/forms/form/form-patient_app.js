import { extend } from 'underscore';
import Radio from 'backbone.radio';

import localStore from 'js/utils/local-store';

import App from 'js/base/app';

import FormsService from 'js/services/forms';

import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import WidgetsHeaderApp from 'js/apps/forms/form/widgets/widgets_header_app';

import {
  LayoutView,
  IframeView,
  FormStateActionsView,
  StatusView,
  ReadOnlyView,
  SaveView,
  DraftStatusView,
} from 'js/apps/forms/form/form_views';

export default App.extend({
  childApps: {
    patient: {
      AppClass: PatientSidebarApp,
      regionName: 'sidebar',
      getOptions: ['patient'],
    },
    widgetHeader: {
      AppClass: WidgetsHeaderApp,
      regionName: 'widgets',
      getOptions: ['patient', 'form'],
    },
  },
  initFormState() {
    const storedState = localStore.get(`form-state_${ this.currentUser.id }`);

    this.setState(extend({ isExpanded: true, saveButtonType: 'save' }, storedState));
  },
  onBeforeStart() {
    this.getRegion().startPreloader();

    this.currentUser = Radio.request('bootstrap', 'currentUser');

    this.initFormState();
  },
  beforeStart({ formId, patientId }) {
    return [
      Radio.request('entities', 'fetch:patients:model', patientId),
      Radio.request('entities', 'fetch:forms:model', formId),
      Radio.request('entities', 'fetch:formResponses:byMe', { patientId, formId }),
    ];
  },
  onBeforeStop() {
    this.removeChildApp('formsService');
  },
  onStart(options, patient, form, latestResponse) {
    this.patient = patient;
    this.form = form;
    this.latestResponse = latestResponse;
    this.isReadOnly = this.form.isReadOnly();
    this.isSubmitHidden = this.form.isSubmitHidden();

    this.startFormService();

    this.setView(new LayoutView({ model: this.form, patient }));

    this.startChildApp('widgetHeader');

    this.showStateActions();
    this.showFormActions();

    this.showSidebar();
    this.showContent();

    this.showView();
  },
  startFormService() {
    const formService = this.addChildApp('formsService', FormsService, {
      patient: this.patient,
      form: this.form,
      latestResponse: this.latestResponse,
    });

    if (!this.isReadOnly) this.bindEvents(formService, this.serviceEvents);
  },
  serviceEvents: {
    'success': 'onFormServiceSuccess',
    'error': 'onFormServiceError',
    'ready': 'onFormServiceReady',
    'update:submission': 'onFormServiceUpdateSubmission',
  },
  shouldSaveAndGoBack() {
    const saveButtonType = this.getState('saveButtonType');

    return (saveButtonType === 'saveAndGoBack' && !this.isSubmitHidden);
  },
  onFormServiceSuccess(response) {
    if (this.shouldSaveAndGoBack()) {
      Radio.request('history', 'go:back', () => {
        Radio.trigger('event-router', 'patient:dashboard', this.patient.id);
      });

      return;
    }

    this.showForm(response.id);
    this.showChildView('status', new StatusView({ model: response }));
    this.showFormActions();
  },
  onFormServiceError() {
    this.showFormSave();
  },
  onFormServiceReady() {
    this.showFormSave();
  },
  onFormServiceUpdateSubmission(updated) {
    this.setState({ updated });
  },
  stateEvents: {
    'change': 'onChangeState',
    'change:isExpanded': 'showSidebar',
    'change:updated': 'onChangeDraftStatus',
  },
  onChangeState(state) {
    localStore.set(`form-state_${ this.currentUser.id }`, state.pick('isExpanded', 'saveButtonType'));
  },
  showStateActions() {
    const actionsView = new FormStateActionsView({
      model: this.getState(),
      patient: this.patient,
    });

    this.listenTo(actionsView, {
      'click:expandButton': this.onClickExpandButton,
    });

    this.showChildView('stateActions', actionsView);
  },
  onClickExpandButton() {
    this.toggleState('isExpanded');
  },
  showContent() {
    if (!this.isReadOnly) this.loadDraftStatus();
    this.showForm();
  },
  async loadDraftStatus() {
    const { updated } = await Radio.request(`form${ this.form.id }`, 'get:storedSubmission');

    /* istanbul ignore if: difficult to force stale async render */
    if (this.isDestroyed()) return;

    this.setState({ updated });
  },
  showForm(responseId) {
    this.showChildView('form', new IframeView({
      model: this.form,
      responseId,
    }));
  },
  showSidebar() {
    const isExpanded = this.getState('isExpanded');

    if (isExpanded) {
      this.stopChildApp('patient');
      this.getRegion('sidebar').empty();
      return;
    }

    this.startChildApp('patient');
  },
  showFormActions() {
    if (this.isReadOnly) {
      this.showReadOnly();
      return;
    }

    this.showFormSaveDisabled();
  },
  showReadOnly() {
    this.showChildView('formAction', new ReadOnlyView());
  },
  onChangeDraftStatus() {
    const updated = this.getState('updated');

    if (!updated) {
      this.getRegion('draftStatus').empty();
      return;
    }

    if (this.getRegion('draftStatus').hasView()) return;

    const draftStatusView = new DraftStatusView({ model: this.getState() });
    this.showChildView('draftStatus', draftStatusView);

    this.listenTo(draftStatusView, {
      async 'discard:submission'() {
        await Radio.request(`form${ this.form.id }`, 'clear:storedSubmission');
        this.showForm();
        this.showFormActions();
      },
    });
  },
  showFormSaveDisabled() {
    if (this.isSubmitHidden) return;

    this.showChildView('formAction', new SaveView({
      isDisabled: true,
      model: this.getState(),
    }));
  },
  showFormSave() {
    if (this.isSubmitHidden) return;

    const saveView = this.showChildView('formAction', new SaveView({
      model: this.getState(),
    }));

    this.listenTo(saveView, {
      'click:save'() {
        Radio.request(`form${ this.form.id }`, 'send', 'form:submit');
        this.showFormSaveDisabled();
      },
      'select:button:type'(selectedSaveButtonType) {
        this.setState({ saveButtonType: selectedSaveButtonType });
      },
    });
  },
});
