import { extend, get } from 'underscore';
import Radio from 'backbone.radio';

import localStore from 'js/utils/local-store';

import App from 'js/base/app';

import intl from 'js/i18n';

import PatientSidebarApp from 'js/apps/patients/patient/sidebar/sidebar_app';
import ActionSiderbarApp from 'js/apps/patients/sidebar/action/action-sidebar_app';
import WidgetsHeaderApp from 'js/apps/forms/form/widgets/widgets_header_app';

import FormsService from 'js/services/forms';

import {
  LayoutView,
  IframeView,
  FormStateActionsView,
  StatusView,
  ReadOnlyView,
  LockedSubmitView,
  SaveView,
  UpdateView,
  HistoryView,
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
    actionSidebar: ActionSiderbarApp,
  },
  initFormState() {
    const storedState = localStore.get(`form-state_${ this.currentUser.id }`);

    this.setState(extend({
      responseId: null,
      isActionSidebar: true,
      isExpanded: true,
      shouldShowHistory: false,
      saveButtonType: 'save',
    }, storedState));
  },
  onBeforeStart() {
    this.getRegion().startPreloader();

    this.currentUser = Radio.request('bootstrap', 'currentUser');

    this.initFormState();
  },
  beforeStart({ patientActionId }) {
    this.patientActionId = patientActionId || this.patientActionId;

    return [
      Radio.request('entities', 'fetch:forms:byAction', this.patientActionId),
      Radio.request('entities', 'fetch:actions:withResponses', this.patientActionId),
      Radio.request('entities', 'fetch:patients:model:byAction', this.patientActionId),
      Radio.request('entities', 'fetch:formResponses:byMe', { actionId: this.patientActionId }),
    ];
  },
  onFail() {
    Radio.request('alert', 'show:error', intl.forms.form.formApp.notFound);
    Radio.trigger('event-router', 'default');
  },
  onBeforeStop() {
    this.removeChildApp('formsService');
  },
  onStart(options, form, action, patient, latestResponse) {
    this.form = form;
    this.patient = patient;
    this.action = action;
    this.responses = action.getFormResponses();
    this.latestResponse = latestResponse;
    this.isReadOnly = form.isReadOnly();
    this.isLocked = action.isLocked() || !action.canSubmit();
    this.isSubmitHidden = form.isSubmitHidden();

    this.listenTo(action, 'destroy', function() {
      Radio.request('alert', 'show:success', intl.forms.form.formApp.deleteSuccess);
      Radio.trigger('event-router', 'default');
    });

    this.startFormService();

    this.setView(new LayoutView({ model: this.form, patient, action }));

    this.startChildApp('widgetHeader');

    this.showStateActions();

    this.showSidebar();

    // Note: triggers onChangeResponseId to showContent
    this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id') });

    this.showView();
  },
  startFormService() {
    const formService = this.addChildApp('formsService', FormsService, {
      patient: this.patient,
      action: this.action,
      form: this.form,
      responses: this.responses,
      latestResponse: this.latestResponse,
    });

    if (!this.isReadOnly && !this.isLocked) this.bindEvents(formService, this.serviceEvents);
  },
  serviceEvents: {
    'success': 'onFormServiceSuccess',
    'error': 'onFormServiceError',
    'ready': 'onFormServiceReady',
    'update:submission': 'onFormServiceUpdateSubmission',
    'refresh': 'onFormServiceRefresh',
  },
  shouldSaveAndGoBack() {
    const saveButtonType = this.getState('saveButtonType');

    return (saveButtonType === 'saveAndGoBack' && !this.isSubmitHidden);
  },
  onFormServiceSuccess(response) {
    if (this.shouldSaveAndGoBack()) {
      Radio.request('history', 'go:back', () => {
        const flow = this.action.getFlow();
        if (flow) {
          Radio.trigger('event-router', 'flow', flow.id);
          return;
        }

        Radio.trigger('event-router', 'patient:dashboard', this.patient.id);
      });

      return;
    }

    this.responses.unshift(response);
    this.setState({ responseId: response.id });
  },
  onFormServiceError(errors) {
    const status = parseInt(errors[0].status, 10);

    if (status === 403) {
      Radio.request('alert', 'show:error', intl.forms.form.formViews.lockedSubmitView.permissionMessage);
    }

    this.showFormSave();
  },
  onFormServiceReady() {
    this.showFormSave();
  },
  onFormServiceUpdateSubmission(updated) {
    this.setState({ updated });
  },
  onFormServiceRefresh() {
    this.restart();
  },
  stateEvents: {
    'change': 'onChangeState',
    'change:isExpanded': 'showSidebar',
    'change:isActionSidebar': 'showSidebar',
    'change:shouldShowHistory': 'showFormActions',
    'change:responseId': 'onChangeResponseId',
    'change:updated': 'onChangeDraftStatus',
  },
  onChangeState(state) {
    localStore.set(`form-state_${ this.currentUser.id }`, state.pick('isExpanded', 'saveButtonType'));
  },
  onChangeResponseId() {
    this.showFormActions();
    this.showContent();
  },
  showStateActions() {
    const formStateActions = new FormStateActionsView({
      model: this.getState(),
      action: this.action,
      responses: this.responses.filterSubmissions(),
    });

    this.listenTo(formStateActions, {
      'click:sidebarButton': this.onClickSidebarButton,
      'click:expandButton': this.onClickExpandButton,
      'click:historyButton': this.onClickHistoryButton,
    });

    this.showChildView('stateActions', formStateActions);
  },
  onClickSidebarButton() {
    if (this.getState('isExpanded')) {
      this.setState({ isActionSidebar: true, isExpanded: false });
      return;
    }

    this.toggleState('isActionSidebar');
  },
  onClickExpandButton() {
    this.toggleState('isExpanded');
  },
  onClickHistoryButton() {
    this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id'), shouldShowHistory: !this.getState('shouldShowHistory') });
  },
  showContent() {
    if (!this.isReadOnly && !this.isLocked && !this.getState('responseId')) this.loadDraftStatus();
    this.showForm();
  },
  async loadDraftStatus() {
    const { updated } = await Radio.request(`form${ this.form.id }`, 'get:storedSubmission');

    /* istanbul ignore if: difficult to force stale async render */
    if (this.isDestroyed()) return;

    this.setState({ updated });
  },
  showForm() {
    this.showChildView('form', new IframeView({
      model: this.form,
      responseId: this.getState('responseId'),
    }));
  },
  showSidebar() {
    const isActionSidebar = this.getState('isActionSidebar');
    const isExpanded = this.getState('isExpanded');

    if (!isActionSidebar || isExpanded) {
      this.stopChildApp('actionSidebar');
    }

    if (isExpanded) {
      this.stopChildApp('patient');
      this.getRegion('sidebar').empty();
      return;
    }

    if (isActionSidebar) {
      this.showActionSidebar();
    }

    this.startChildApp('patient');
  },
  showActionSidebar() {
    const sidebarApp = this.getChildApp('actionSidebar');

    Radio.request('sidebar', 'start', sidebarApp, { action: this.action, isShowingForm: true });

    this.listenTo(sidebarApp, 'close', () => {
      sidebarApp.stop();

      this.setState('isActionSidebar', false);
    });
  },
  showFormActions() {
    // If there's a submission this always shows
    this.showFormStatus();

    if (this.getState('shouldShowHistory')) {
      this.showFormHistory();
      return;
    }

    if (this.isReadOnly) {
      this.showReadOnly();
      return;
    }

    if (this.isLocked) {
      this.showLockedSubmit();
      return;
    }

    if (this.getState('responseId')) {
      this.showFormUpdate();
      return;
    }

    this.showFormSaveDisabled();
  },
  showReadOnly() {
    this.showChildView('formAction', new ReadOnlyView());
  },
  showLockedSubmit() {
    this.showChildView('formAction', new LockedSubmitView());
  },
  showFormStatus() {
    if (!this.responses.getFirstSubmission()) return;

    this.showChildView('status', new StatusView({
      model: this.responses.getFirstSubmission(),
    }));
  },
  showFormHistory() {
    const selected = this.responses.get(this.getState('responseId'));

    const historyView = this.showChildView('formAction', new HistoryView({ selected, collection: this.responses.filterSubmissions() }));

    this.listenTo(historyView, {
      'change:response'(response) {
        this.setState({ responseId: response.id });
      },
      'click:current'() {
        this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id'), shouldShowHistory: false });
      },
    });
  },
  showFormUpdate() {
    const updateView = this.showChildView('formAction', new UpdateView());

    this.listenTo(updateView, 'click', () => {
      this.setState({ responseId: null });
    });
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
    if (this.isSubmitHidden) {
      this.getRegion('formAction').empty();
      return;
    }

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
