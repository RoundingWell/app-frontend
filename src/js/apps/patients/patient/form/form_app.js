import { get } from 'underscore';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import intl from 'js/i18n';
import localStore from 'js/utils/local-store';

import WidgetsHeaderApp from './widgets/widgets_header_app';

import FormsService from 'js/services/forms';

import {
  LayoutView,
  IframeView,
  FormExpandActionView,
  ReadOnlyView,
  LockedSubmitView,
  SaveView,
  UpdateView,
  SubmissionStatusDroplist,
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
  initFormState({ actionId }) {
    const storedState = actionId && localStore.get(`form-state_${ this.currentUser.id }`);

    this.setState({
      responseId: null,
      saveButtonType: get(storedState, 'saveButtonType', 'saveAndGoBack'),
    });
  },
  onBeforeStart(options) {
    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.layoutState = options.layoutState;
    if (options.actionId) this.listenTo(this.layoutState, 'change:formExpanded', this.renderExpandedState);
    if (!options.actionId) this.getRegion().startPreloader({ variant: 'generic' });
    this.initFormState(options);
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
  onFail({ actionId }) {
    const message = actionId ?
      intl.patients.patient.form.formApp.notFound :
      intl.patients.patient.form.formApp.formNotFound;

    Radio.request('alert', 'show:error', message);
    Radio.trigger('event-router', 'default');
  },
  onBeforeStop() {
    this.removeChildApp('formsService');
  },
  onStart({ patient, viewportView }, form, action, latestResponse) {
    this.viewportView = viewportView;
    this.setFormContext({ patient, form, action, latestResponse });
    this.startFormService();
    this.setView(new LayoutView({
      model: this.form,
      isActionForm: !!this.action,
      isExpanded: !!this.action && this.layoutState.get('formExpanded'),
      viewportView,
    }));
    if (!this.action) this.triggerContextChange();
    this.startChildApp('widgetHeader');
    if (this.action) this.showExpandAction();
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
  triggerContextChange() {
    this.trigger('context:change', {
      page: 'form',
      formId: this.form.id,
      formName: this.form.get('name'),
    });
  },
  showInitialForm() {
    if (this.action) {
      this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id') });
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
  shouldSubmitAndGoBack() {
    if (!this.action) return !this.isSubmitHidden;

    return this.getState('saveButtonType') === 'saveAndGoBack' && !this.isSubmitHidden;
  },
  onFormServiceSuccess(response) {
    if (this.shouldSubmitAndGoBack()) {
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

    this.responses.unshift(response);
    this.setState({ responseId: response.id });
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
      layoutState: this.layoutState,
      viewportView: this.viewportView,
    });
  },
  stateEvents: {
    'change:responseId': 'onChangeResponseId',
    'change:saveButtonType': 'onChangeSaveButtonType',
    'change:updated': 'onChangeDraftStatus',
  },
  onChangeSaveButtonType() {
    localStore.set(`form-state_${ this.currentUser.id }`, {
      saveButtonType: this.getState('saveButtonType'),
    });
  },
  onChangeResponseId() {
    this.showFormActions();
    this.showContent();
  },
  showExpandAction() {
    const formExpandAction = new FormExpandActionView({ model: this.layoutState });

    this.listenTo(formExpandAction, {
      'click:expandButton': this.onClickExpandButton,
    });

    this.showChildView('expandAction', formExpandAction);
  },
  onClickExpandButton() {
    this.trigger('toggle:expanded');
  },
  renderExpandedState() {
    const isExpanded = this.layoutState.get('formExpanded');
    const layout = this.getView();

    if (!layout) return;

    layout.setExpanded(isExpanded);
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
    const formView = new IframeView({
      model: this.form,
      responseId,
    });

    this.showChildView('form', formView);
    this.getView().trigger('change:form:view');
  },
  showFormActions() {
    if (this.action) this.showSubmissionStatus();

    if (this.isShowingHistoricalResponse()) {
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
  isShowingHistoricalResponse() {
    if (!this.action || !this.getState('responseId')) return false;

    return this.getState('responseId') !== get(this.responses.getFirstSubmission(), 'id');
  },
  showReadOnly() {
    this.showChildView('formAction', new ReadOnlyView());
  },
  showLockedSubmit() {
    this.showChildView('formAction', new LockedSubmitView());
  },
  showSubmissionStatus() {
    const selected = this.responses.get(this.getState('responseId'));
    if (!selected) {
      this.getRegion('draftStatus').empty();
      return;
    }

    const submissionStatus = new SubmissionStatusDroplist({
      collection: this.responses.filterSubmissions(),
      state: { selected },
    });

    this.showChildView('draftStatus', submissionStatus);
    this.listenTo(submissionStatus, 'change:selected', response => {
      this.setState({ responseId: response.id });
    });
  },
  showFormHistory() {
    const historyView = this.showChildView('formAction', new HistoryView());

    this.listenTo(historyView, {
      'click:current'() {
        this.setState({ responseId: get(this.responses.getFirstSubmission(), 'id') });
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
      canChooseSaveType: !!this.action,
      isDisabled: true,
      model: this.getState(),
    }));
  },
  showFormSave() {
    if (this.isSubmitHidden) return;

    const saveView = this.showChildView('formAction', new SaveView({
      canChooseSaveType: !!this.action,
      model: this.getState(),
    }));

    this.listenTo(saveView, {
      'click:save'() {
        Radio.request(`form${ this.form.id }`, 'send', 'form:submit');
        this.showFormSaveDisabled();
      },
      'select:button:type'(saveButtonType) {
        this.setState({ saveButtonType });
      },
    });
  },
});
