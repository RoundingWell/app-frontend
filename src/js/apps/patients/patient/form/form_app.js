import { extend, get } from 'underscore';
import Radio from 'backbone.radio';

import localStore from 'js/utils/local-store';

import App from 'js/base/app';

import intl from 'js/i18n';

import WidgetsHeaderApp from './widgets/widgets_header_app';

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
} from './form_views';

export default App.extend({
  childApps: {
    widgetHeader: {
      AppClass: WidgetsHeaderApp,
      regionName: 'widgets',
      getOptions: ['patient', 'form'],
    },
  },
  initFormState() {
    const storedState = localStore.get(`form-state_${ this.currentUser.id }`);

    this.setState(extend({
      responseId: null,
      shouldShowHistory: false,
      saveButtonType: 'save',
    }, storedState));
  },
  onBeforeStart() {
    this.getRegion().startPreloader();

    this.currentUser = Radio.request('bootstrap', 'currentUser');

    this.initFormState();
  },
  beforeStart({ patient, formId, actionId }) {
    if (!actionId) {
      return [
        Radio.request('entities', 'fetch:forms:model', formId),
        null,
        Radio.request('entities', 'fetch:formResponses:byMe', { patientId: patient.id, formId }),
      ];
    }

    return [
      Radio.request('entities', 'fetch:forms:byAction', actionId),
      Radio.request('entities', 'fetch:actions:withResponses', actionId),
      Radio.request('entities', 'fetch:formResponses:byMe', { actionId }),
    ];
  },
  onFail({ actionId } = {}) {
    const message = actionId ?
      intl.patients.patient.form.formApp.notFound :
      intl.patients.patient.form.formApp.formNotFound;

    Radio.request('alert', 'show:error', message);
    Radio.trigger('event-router', 'default');
  },
  onBeforeStop() {
    this.removeChildApp('formsService');
  },
  onStart({ patient }, form, action, latestResponse) {
    this.setFormContext({ patient, form, action, latestResponse });
    this.listenToActionDestroy();
    this.startFormService();
    this.setView(new LayoutView({ model: this.form }));
    this.triggerContextChange();
    this.startChildApp('widgetHeader');
    this.showStateActions();
    this.showInitialForm();
    this.showView();
  },
  setFormContext({ patient, form, action, latestResponse }) {
    this.form = form;
    this.patient = patient;
    this.action = action || null;
    this.responses = action && action.getFormResponses();
    this.latestResponse = latestResponse;
    this.isReadOnly = form.isReadOnly();
    this.isLocked = action ? action.isLocked() || !action.canSubmit() : false;
    this.isSubmitHidden = form.isSubmitHidden();
  },
  listenToActionDestroy() {
    if (!this.action) return;

    this.listenTo(this.action, 'destroy', function() {
      Radio.request('alert', 'show:success', intl.patients.patient.form.formApp.deleteSuccess);
      Radio.trigger('event-router', 'default');
    });
  },
  triggerContextChange() {
    const flow = this.action && this.action.getFlow();
    this.trigger('context:change', {
      page: 'form',
      formId: this.form.id,
      formName: this.form.get('name'),
      actionId: this.action && this.action.id,
      actionName: this.action && this.action.get('name'),
      flowId: flow && flow.id,
      flowName: flow && flow.get('name'),
    });
  },
  showInitialForm() {
    if (this.action) {
      this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id') });
      this.onChangeResponseId();
      return;
    }

    this.showFormActions();
    this.showContent();
  },
  startFormService() {
    const serviceOptions = {
      patient: this.patient,
      form: this.form,
      latestResponse: this.latestResponse,
    };

    if (this.action) {
      serviceOptions.action = this.action;
      serviceOptions.responses = this.responses;
    }

    const formService = this.addChildApp('formsService', FormsService, serviceOptions);

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
        const flow = this.action && this.action.getFlow();
        if (flow) {
          Radio.trigger('event-router', 'patient:flow', this.patient.id, flow.id);
          return;
        }

        Radio.trigger('event-router', 'patient:workflow', this.patient.id);
      });

      return;
    }

    if (this.action) {
      this.responses.unshift(response);
      this.setState({ responseId: response.id });
      return;
    }

    this.showForm(response.id);
    this.showChildView('status', new StatusView({ model: response }));
    this.showFormActions();
  },
  onFormServiceError(errors) {
    const status = parseInt(get(errors, [0, 'status']), 10);

    if (status === 403) {
      Radio.request('alert', 'show:error', intl.patients.patient.form.formViews.lockedSubmitView.permissionMessage);
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
    this.restart({
      patient: this.patient,
      formId: this.form.id,
      actionId: this.action && this.action.id,
    });
  },
  stateEvents: {
    'change': 'onChangeState',
    'change:shouldShowHistory': 'showFormActions',
    'change:responseId': 'onChangeResponseId',
    'change:updated': 'onChangeDraftStatus',
  },
  onChangeState(state) {
    localStore.set(`form-state_${ this.currentUser.id }`, state.pick('saveButtonType'));
  },
  onChangeResponseId() {
    this.showFormActions();
    this.showContent();
  },
  showStateActions() {
    const formStateActions = new FormStateActionsView({
      model: this.getState(),
      responses: this.responses && this.responses.filterSubmissions(),
    });

    this.listenTo(formStateActions, {
      'click:historyButton': this.onClickHistoryButton,
    });

    this.showChildView('stateActions', formStateActions);
  },
  onClickHistoryButton() {
    if (!this.responses) return;

    this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id'), shouldShowHistory: !this.getState('shouldShowHistory') });
  },
  showContent() {
    if (!this.isReadOnly && !this.isLocked && (!this.action || !this.getState('responseId'))) this.loadDraftStatus();
    this.showForm();
  },
  async loadDraftStatus() {
    const { updated } = await Radio.request(`form${ this.form.id }`, 'get:storedSubmission');

    /* istanbul ignore if: difficult to force stale async render */
    if (this.isDestroyed()) return;

    this.setState({ updated });
  },
  showForm(responseId = this.getState('responseId')) {
    this.showChildView('form', new IframeView({
      model: this.form,
      responseId,
    }));
  },
  showFormActions() {
    if (this.action) this.showFormStatus();

    if (this.action && this.getState('shouldShowHistory')) {
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

    if (this.action && this.getState('responseId')) {
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
    if (!this.responses) return;

    if (!this.responses.getFirstSubmission()) return;

    this.showChildView('status', new StatusView({
      model: this.responses.getFirstSubmission(),
    }));
  },
  showFormHistory() {
    if (!this.responses) return;

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
