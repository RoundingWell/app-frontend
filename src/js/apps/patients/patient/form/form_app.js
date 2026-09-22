import { get } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import App, { wrapStartFailure } from 'js/base/app';
import { addError } from 'js/datadog';

import intl from 'js/i18n';
import localStore from 'js/utils/local-store';

import WidgetsHeaderApp from './widgets/widgets_header_app';

import FormsService from 'js/services/forms';
import { LoadingView } from 'js/regions/preload_region';

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
    widgetHeader: WidgetsHeaderApp,
  },
  createState() {
    return new Backbone.Model();
  },
  initFormState({ actionId }) {
    const storedState = actionId && localStore.get(`form-state_${ this.currentUser.id }`);

    this.getState().set({
      responseId: null,
      saveButtonType: get(storedState, 'saveButtonType', 'saveAndGoBack'),
      updated: undefined,
    });
  },
  onBeforeStart(app, options) {
    this.currentUser = Radio.request('bootstrap', 'currentUser');
    this.layoutState = options.layoutState;
    if (!options.actionId) this.showView(new LoadingView({ variant: 'generic' }));
    this.initFormState(options);
  },
  async prepareStart(options, { signal }) {
    await this.removeChildApp('formsService');
    const { patient, formId, actionId } = options;
    if (!actionId) {
      return Promise.all([
        wrapStartFailure('form', Radio.request('entities', 'fetch:forms:model', formId, { signal })),
        null,
        wrapStartFailure('responses', Radio.request('entities', 'fetch:formResponses:byMe', { patientId: patient.id, formId }, { signal })),
      ]);
    }

    return Promise.all([
      wrapStartFailure('form', Radio.request('entities', 'fetch:forms:byAction', actionId, { signal })),
      wrapStartFailure('action', Radio.request('entities', 'fetch:actions:withResponses', actionId, { signal })),
      wrapStartFailure('responses', Radio.request('entities', 'fetch:formResponses:byMe', { actionId }, { signal })),
    ]);
  },
  handleStartFailure({ actionId }, failure) {
    const error = get(failure, 'error', failure);
    const resource = get(failure, 'resource');
    const status = get(error, ['response', 'status']);
    const isMissingResource = resource === 'form' || resource === 'action';

    if (!isMissingResource || (status !== 404 && status !== 410)) throw error;

    const message = actionId ?
      intl.patients.patient.form.formApp.notFound :
      intl.patients.patient.form.formApp.formNotFound;

    Radio.request('alert', 'show:error', message);
    Radio.trigger('event-router', 'default');
  },
  onStop() {
    const formService = this.getChildApp('formsService');
    if (formService) this.unbindEvents(formService, this.serviceEvents);
    this._draftStatusRequest = null;
    this._discardRequest = null;
    this.stopListening(this.layoutState, 'change:formExpanded', this.renderExpandedState);
  },
  onStart(app, { patient, viewportView }, [form, action, latestResponse]) {
    this.viewportView = viewportView;
    this.setFormContext({ patient, form, action, latestResponse });
    if (this.action) this.listenTo(this.layoutState, 'change:formExpanded', this.renderExpandedState);
    this.startFormService();
    this.setView(new LayoutView({
      model: this.form,
      isActionForm: !!this.action,
      isExpanded: !!this.action && this.layoutState.get('formExpanded'),
      viewportView,
    })).render();
    if (!this.action) this.triggerContextChange();
    this.getChildApp('widgetHeader').start({
      region: this.getView().getRegion('widgets'),
      patient: this.patient,
      form: this.form,
    }).catch(addError);
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
      this.getState().set({ responseId: get(this.responses.getFirstSubmission(), 'id') });
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

    const formService = this.addChildApp('formsService', new FormsService(serviceOptions));

    if (!this.isReadOnly && !this.isLocked) this.bindEvents(formService, this.serviceEvents);

    formService.start().catch(addError);
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

    return this.getState().get('saveButtonType') === 'saveAndGoBack' && !this.isSubmitHidden;
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

    // Only action forms track a response collection, and submitting a draft
    // reuses its model, so remove it before unshifting to keep the new
    // submission first
    if (this.action) {
      this.responses.remove(response);
      this.responses.unshift(response);
    }

    this.getState().set({ responseId: response.id });
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
    this.getState().set({ updated });
  },
  onFormServiceRefresh() {
    this.restart({
      patient: this.patient,
      formId: this.form.id,
      actionId: this.action && this.action.id,
      layoutState: this.layoutState,
      viewportView: this.viewportView,
    }).catch(addError);
  },
  stateEvents: {
    'change:responseId': 'onChangeResponseId',
    'change:saveButtonType': 'onChangeSaveButtonType',
    'change:updated': 'onChangeDraftStatus',
  },
  onChangeSaveButtonType() {
    localStore.set(`form-state_${ this.currentUser.id }`, {
      saveButtonType: this.getState().get('saveButtonType'),
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

    this.getView().showChildView('expandAction', formExpandAction);
  },
  onClickExpandButton() {
    this.trigger('toggle:expanded');
  },
  renderExpandedState() {
    const isExpanded = this.layoutState.get('formExpanded');
    const layout = this.getView();

    layout.setExpanded(isExpanded);
  },
  showContent() {
    if (!this.isReadOnly && !this.isLocked && (!this.action || !this.getState().get('responseId'))) this.loadDraftStatus();
    this.showForm();
  },
  async loadDraftStatus() {
    const form = this.form;
    const request = {};

    this._draftStatusRequest = request;
    const { updated } = await Radio.request(`form${ form.id }`, 'get:storedSubmission');

    /* istanbul ignore if: difficult to force stale async render */
    if (!this.isRunning() || this.form !== form || this._draftStatusRequest !== request) return;

    this.getState().set({ updated });
  },
  showForm(responseId = this.getState().get('responseId')) {
    const formView = new IframeView({
      model: this.form,
      responseId,
    });

    this.getView().showChildView('form', formView);
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

    if (this.action && this.getState().get('responseId')) {
      this.showFormUpdate();
      return;
    }

    this.showFormSaveDisabled();
  },
  isShowingHistoricalResponse() {
    if (!this.action || !this.getState().get('responseId')) return false;

    return this.getState().get('responseId') !== get(this.responses.getFirstSubmission(), 'id');
  },
  showReadOnly() {
    this.getView().showChildView('formAction', new ReadOnlyView());
  },
  showLockedSubmit() {
    this.getView().showChildView('formAction', new LockedSubmitView());
  },
  showSubmissionStatus() {
    const selected = this.responses.get(this.getState().get('responseId'));
    if (!selected) {
      this.getView().getRegion('draftStatus').empty();
      return;
    }

    const submissionStatus = new SubmissionStatusDroplist({
      collection: this.responses.filterSubmissions(),
      stateOptions: { selected },
    });

    this.getView().showChildView('draftStatus', submissionStatus);
    this.listenTo(submissionStatus, 'change:selected', response => {
      this.getState().set({ responseId: response.id });
    });
  },
  showFormHistory() {
    const historyView = this.getView().showChildView('formAction', new HistoryView());

    this.listenTo(historyView, {
      'click:current'() {
        this.getState().set({ responseId: get(this.responses.getFirstSubmission(), 'id') });
      },
    });
  },
  showFormUpdate() {
    const updateView = this.getView().showChildView('formAction', new UpdateView());

    this.listenTo(updateView, 'click', () => {
      this.getState().set({ responseId: null });
    });
  },
  onChangeDraftStatus() {
    const updated = this.getState().get('updated');
    const layout = this.getView();

    if (!updated) {
      layout.getRegion('draftStatus').empty();
      return;
    }

    if (layout.getRegion('draftStatus').hasView()) return;

    const draftStatusView = new DraftStatusView({ model: this.getState() });
    layout.showChildView('draftStatus', draftStatusView);

    this.listenTo(draftStatusView, {
      async 'discard:submission'() {
        const form = this.form;
        const request = {};

        this._discardRequest = request;
        await Radio.request(`form${ form.id }`, 'clear:storedSubmission');
        if (!this.isRunning() || this.form !== form || this._discardRequest !== request) return;

        this.showForm();
        this.showFormActions();
      },
    });
  },
  showFormSaveDisabled() {
    if (this.isSubmitHidden) {
      this.getView().getRegion('formAction').empty();
      return;
    }

    this.getView().showChildView('formAction', new SaveView({
      canChooseSaveType: !!this.action,
      isDisabled: true,
      model: this.getState(),
    }));
  },
  showFormSave() {
    if (this.isSubmitHidden) return;

    const saveView = this.getView().showChildView('formAction', new SaveView({
      canChooseSaveType: !!this.action,
      model: this.getState(),
    }));

    this.listenTo(saveView, {
      'click:save'() {
        Radio.request(`form${ this.form.id }`, 'send', 'form:submit');
        this.showFormSaveDisabled();
      },
      'select:button:type'(saveButtonType) {
        this.getState().set({ saveButtonType });
      },
    });
  },
});
