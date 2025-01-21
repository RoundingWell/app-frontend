import { map, get, debounce, omit } from 'underscore';
import dayjs from 'dayjs';
import store from 'store';

import Radio from 'backbone.radio';

import App from 'js/base/app';

import { FORM_RESPONSE_STATUS } from 'js/static';

import { versions } from 'js/config';

function getClinicians(teamId) {
  if (teamId) {
    const team = Radio.request('entities', 'teams:model', teamId);
    return team.getAssignableClinicians();
  }

  const currentWorkspace = Radio.request('workspace', 'current');
  return currentWorkspace.getAssignableClinicians();
}

export default App.extend({
  startAfterInitialized: true,
  channelName() {
    return `form${ this.getOption('form').id }`;
  },
  channelRequest() {
    if (this.isDestroyed()) return;

    const channel = this.getChannel();

    return channel.request(...arguments);
  },
  initialize(options) {
    this.updateDraft = debounce(this.updateDraft, 15000);
    this.refreshForm = debounce(this.refreshForm, 1800000);

    this.mergeOptions(options, ['action', 'form', 'patient', 'responses', 'latestResponse']);

    this.currentUser = Radio.request('bootstrap', 'currentUser');
  },
  onBeforeDestroy() {
    this.updateDraft.cancel();
    this.refreshForm.cancel();
  },
  radioRequests: {
    'ready:form': 'readyForm',
    'submit:form': 'submitForm',
    'fetch:clinicians': 'fetchClinicians',
    'fetch:directory': 'fetchDirectory',
    'fetch:form': 'fetchForm',
    'fetch:form:data': 'fetchFormPrefill',
    'fetch:form:response': 'fetchFormResponse',
    'update:storedSubmission': 'updateStoredSubmission',
    'get:storedSubmission': 'getStoredSubmission',
    'clear:storedSubmission': 'clearStoredSubmission',
    'fetch:field': 'fetchField',
    'update:field': 'updateField',
    'fetch:icd': 'fetchIcd',
    'version': 'checkVersion',
  },
  readyForm() {
    this.trigger('ready');

    this.refreshForm();
  },
  checkVersion(feVersion) {
    /* istanbul ignore if: can't test reload */
    if (feVersion !== versions.frontend) window.location.reload();
  },
  isReadOnly() {
    const isLocked = this.action && this.action.isLocked();
    const isSubmitRestricted = this.action && !this.action.canSubmit();

    return this.form.isReadOnly() || isLocked || isSubmitRestricted;
  },
  getStoreId() {
    const actionId = get(this.action, 'id');
    const ids = [this.currentUser.id, this.patient.id, this.form.id];
    if (actionId) ids.push(actionId);
    return `form-subm-${ ids.join('-') }`;
  },
  getLatestDraft() {
    if (this.responses) {
      // NOTE: latestResponse is for the currentUser
      // If the first response is not the latestResponse, the draft is invalidated
      if (this.responses.first() !== this.latestResponse) return {};
    }

    return (this.latestResponse && this.latestResponse.getDraft()) || {};
  },
  getStoredSubmission() {
    const draft = this.getLatestDraft();
    const localDraft = store.get(this.getStoreId()) || {};

    if (draft.updated && (!localDraft.updated || dayjs(draft.updated).isAfter(localDraft.updated))) {
      this.trigger('update:submission', draft.updated);
      return draft;
    }

    if (localDraft.updated) this.trigger('update:submission', localDraft.updated);
    return localDraft;
  },
  updateStoredSubmission(submission) {
    /* istanbul ignore if: difficult to test read only submission change */
    if (this.isReadOnly()) return;

    const updated = dayjs().format();

    // Cache the draft for debounced updateDraft
    this._draft = submission;

    try {
      store.set(this.getStoreId(), { submission, updated });
      this.trigger('update:submission', updated);
    } catch /* istanbul ignore next: Tested locally, test runner borks on CI */ {
      store.each((value, key) => {
        if (String(key).startsWith('form-subm-')) store.remove(key);
      });
      store.set(this.getStoreId(), { submission, updated });
    }

    this.updateDraft();
    this.refreshForm();
  },
  clearStoredSubmission() {
    this.latestResponse = null;
    store.remove(this.getStoreId());
    this.trigger('update:submission');
  },
  fetchField({ fieldName, requestId }) {
    const field = Radio.request('entities', 'patientFields:model', {
      name: fieldName,
      _patient: this.patient.getResource(),
    });

    return field.fetch()
      .then(() => {
        this.channelRequest('send', 'fetch:field', { value: field.get('value'), requestId });
      })
      .catch(({ responseData }) => {
        this.channelRequest('send', 'fetch:field', { error: responseData, requestId });
      });
  },
  updateField({ fieldName, value, requestId }) {
    const field = Radio.request('entities', 'patientFields:model', {
      name: fieldName,
      value,
      _patient: this.patient.getResource(),
    });

    return field.saveAll()
      .then(() => {
        this.channelRequest('send', 'update:field', { value: field.get('value'), requestId });
      })
      .catch(({ responseData }) => {
        this.channelRequest('send', 'update:field', { error: responseData, requestId });
      });
  },
  fetchClinicians({ teamId, requestId }) {
    const clinicians = getClinicians(teamId);

    this.channelRequest('send', 'fetch:directory', { value: clinicians.toJSON(), requestId });
  },
  fetchDirectory({ directoryName, query, requestId }) {
    return Promise.resolve(Radio.request('entities', 'fetch:directories:model', directoryName, query))
      .then(directory => {
        this.channelRequest('send', 'fetch:directory', { value: directory.get('value'), requestId });
      })
      .catch(({ responseData }) => {
        this.channelRequest('send', 'fetch:directory', { error: responseData, requestId });
      });
  },
  fetchIcd({ by, requestId }) {
    return Promise.resolve(Radio.request('entities', 'fetch:icd', by))
      .then(icd => {
        this.channelRequest('send', 'fetch:icd', { value: get(icd, ['data', 'icdCodes']), requestId });
      })
      .catch(({ responseData }) => {
        this.channelRequest('send', 'fetch:icd', { error: responseData, requestId });
      });
  },
  fetchForm() {
    return Promise.resolve(Radio.request('entities', 'fetch:forms:definition', this.form.id))
      .then(definition => {
        this.channelRequest('send', 'fetch:form', {
          definition,
          contextScripts: this.form.getContextScripts(),
        });
      });
  },
  fetchFormStoreSubmission({ submission }) {
    return Promise.all([
      Radio.request('entities', 'fetch:forms:definition', this.form.id),
    ]).then(([definition]) => {
      this.channelRequest('send', 'fetch:form:data', {
        definition,
        storedSubmission: submission,
        ...omit(this.form.getContext(), 'loaderReducers'),
      });
    });
  },
  _getPrefillFilters(form, action, flow) {
    const flowId = flow && flow.id;
    const patientId = action.getPatient().id;
    const actionTags = form.getPrefillActionTag();
    const formId = !actionTags && form.getPrefillFormId();
    const submittedAt = form.isReport() && `<=${ action.get('created_at') }`;

    return { patientId, flowId, formId, actionTags, submittedAt };
  },
  fetchLatestFormSubmission(flow) {
    const isReadOnly = this.isReadOnly();
    const filter = this._getPrefillFilters(this.form, this.action, flow);

    return Promise.all([
      Radio.request('entities', 'fetch:forms:definition', this.form.id),
      Radio.request('entities', 'fetch:forms:data', this.action.id, this.patient.id, this.form.id),
      Radio.request('entities', 'fetch:formResponses:byPatient', filter),
    ]).then(([definition, data, response]) => {
      this.channelRequest('send', 'fetch:form:data', {
        definition,
        isReadOnly,
        formData: data.attributes,
        responseData: response.getFormData(),
        formSubmission: response.getResponse(),
        ...this.form.getContext(),
      });
    });
  },
  fetchFormPrefill() {
    const storedSubmission = this.getStoredSubmission();
    const isReadOnly = this.isReadOnly();

    if (!isReadOnly && storedSubmission.updated) {
      return this.fetchFormStoreSubmission(storedSubmission);
    }

    const firstResponse = this.responses && this.responses.getFirstSubmission();

    if (!firstResponse && this.action) {
      if (this.action.hasTag('prefill-latest-response')) return this.fetchLatestFormSubmission();
      if (this.action.hasTag('prefill-flow-response')) return this.fetchLatestFormSubmission(this.action.getFlow());
    }

    return Promise.all([
      Radio.request('entities', 'fetch:forms:definition', this.form.id),
      Radio.request('entities', 'fetch:forms:data', get(this.action, 'id'), this.patient.id, this.form.id),
      Radio.request('entities', 'fetch:formResponses:model', get(firstResponse, 'id')),
    ]).then(([definition, data, response]) => {
      this.channelRequest('send', 'fetch:form:data', {
        definition,
        isReadOnly,
        formData: data.attributes,
        responseData: response.getFormData(),
        formSubmission: response.getResponse(),
        ...this.form.getContext(),
      });
    });
  },
  fetchFormResponse({ responseId }) {
    return Promise.all([
      Radio.request('entities', 'fetch:forms:definition', this.form.id),
      Radio.request('entities', 'fetch:formResponses:model', responseId),
    ]).then(([definition, response]) => {
      this.channelRequest('send', 'fetch:form:response', {
        definition,
        responseData: response.getFormData(),
        formSubmission: response.getResponse(),
        contextScripts: this.form.getContextScripts(),
      });
    });
  },
  useLatestDraft(responseData) {
    if (this.form) responseData._form = this.form.getResource();
    if (this.patient) responseData._patient = this.patient.getResource();
    if (this.action) responseData._action = this.action.getResource();

    if (!this.latestResponse || this.latestResponse.get('status') !== FORM_RESPONSE_STATUS.DRAFT) return responseData;

    return {
      ...responseData,
      id: this.latestResponse.id,
    };
  },
  updateDraft() {
    const data = this.useLatestDraft({
      response: { data: this._draft },
      status: FORM_RESPONSE_STATUS.DRAFT,
    });

    const formResponse = Radio.request('entities', 'formResponses:model', data);

    this.latestResponse = formResponse;

    return formResponse.saveAll()
      .catch(({ responseData }) => {
        /* istanbul ignore next: Don't handle non-API errors */
        if (!responseData) return;

        this.trigger('error', responseData.errors);
      });
  },
  refreshForm() {
    this.trigger('refresh');
  },
  submitForm({ response }) {
    // Cancel any pending draft updates or stale form refreshes
    this.updateDraft.cancel();
    this.refreshForm.cancel();

    const data = this.useLatestDraft({
      response,
      status: FORM_RESPONSE_STATUS.SUBMITTED,
    });

    const formResponse = Radio.request('entities', 'formResponses:model', data);

    return formResponse.saveAll()
      .then(() => {
        // Cancel any draft updates or stale form refreshes that may have been queued while the form was submitting
        this.updateDraft.cancel();
        this.refreshForm.cancel();
        this.clearStoredSubmission();
        this.trigger('success', formResponse);
      }).catch(({ responseData }) => {
        /* istanbul ignore next: Don't handle non-API errors */
        if (!responseData) return;

        this.trigger('error', responseData.errors);

        const errors = map(responseData.errors, 'detail');
        this.channelRequest('send', 'form:errors', errors);
      });
  },
});
