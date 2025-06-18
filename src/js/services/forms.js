import { map, get, debounce } from 'underscore';
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
  send(message, ...args) {
    if (this.isDestroyed()) return;

    const channel = this.getChannel();

    return channel.request('send', message, ...args);
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
    'fetch:form:definition': 'fetchFormDefinition',
    'fetch:form:data': 'fetchFormData',
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
    if (this.isReadOnly()) return {};

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
  fetchField({ fieldName }, requestId) {
    const field = Radio.request('entities', 'patientFields:model', {
      name: fieldName,
      _patient: this.patient.getResource(),
    });

    const message = 'fetch:field';

    return field.fetch()
      .then(() => {
        this.send(message, { value: field.get('value') }, requestId);
      })
      .catch(({ responseData }) => {
        this.send(message, { error: responseData }, requestId);
      });
  },
  updateField({ fieldName, value }, requestId) {
    const field = Radio.request('entities', 'patientFields:model', {
      name: fieldName,
      value,
      _patient: this.patient.getResource(),
    });

    const message = 'update:field';

    return field.saveAll()
      .then(() => {
        this.send(message, { value: field.get('value') }, requestId);
      })
      .catch(({ responseData }) => {
        this.send(message, { error: responseData }, requestId);
      });
  },
  fetchClinicians({ teamId }, requestId) {
    const clinicians = getClinicians(teamId);

    this.send('fetch:directory', { value: clinicians.toJSON() }, requestId);
  },
  fetchDirectory({ directoryName, query }, requestId) {
    const message = 'fetch:directory';
    return Promise.resolve(Radio.request('entities', 'fetch:directories:model', directoryName, query))
      .then(directory => {
        this.send(message, { value: directory.get('value') }, requestId);
      })
      .catch(({ responseData }) => {
        this.send(message, { error: responseData }, requestId);
      });
  },
  fetchIcd({ by }, requestId) {
    const message = 'fetch:icd';
    return Promise.resolve(Radio.request('entities', 'fetch:icd', by))
      .then(icd => {
        this.send(message, { value: get(icd, ['data', 'icdCodes']) }, requestId);
      })
      .catch(({ responseData }) => {
        this.send(message, { error: responseData }, requestId);
      });
  },
  fetchFormDefinition(args, requestId) {
    const fetchFormDefinition = Radio.request('entities', 'fetch:forms:definition', this.form.id);
    const message = 'fetch:form:definition';
    fetchFormDefinition
      .then(definition => {
        this.send(message, { value: definition }, requestId);
      })
      .catch(
        /* istanbul ignore next: Don't test BE errors */
        ({ responseData }) => {
          this.send(message, { error: responseData }, requestId);
        },
      );
  },
  fetchOtherFormResponse(flow) {
    const flowId = flow && flow.id;
    const patientId = this.action.getPatient().id;
    const actionTags = this.form.getPrefillActionTag();
    const formId = !actionTags && this.form.getPrefillFormId();
    const submittedAt = this.form.isReport() && `<=${ this.action.get('created_at') }`;

    return Radio.request('entities', 'fetch:formResponses:byPatient', { patientId, flowId, formId, actionTags, submittedAt });
  },
  fetchLatestFormResponse() {
    const firstResponse = this.responses && this.responses.getFirstSubmission();

    if (!firstResponse && this.action) {
      if (this.action.hasTag('prefill-latest-response')) return this.fetchOtherFormResponse();
      if (this.action.hasTag('prefill-flow-response')) return this.fetchOtherFormResponse(this.action.getFlow());
    }

    return Radio.request('entities', 'fetch:formResponses:model', get(firstResponse, 'id'));
  },
  fetchFormData(args, requestId) {
    const message = 'fetch:form:data';
    const storedSubmission = this.getStoredSubmission();

    if (storedSubmission.updated) {
      this.send(message, { value: {
        storedSubmission: storedSubmission.submission,
        options: this.form.get('options'),
      } }, requestId);
      return;
    }

    Promise.all([
      Radio.request('entities', 'fetch:forms:data', get(this.action, 'id'), this.patient.id, this.form.id),
      this.fetchLatestFormResponse(),
    ])
      .then(([data, response]) => {
        this.send(message, { value: {
          isReadOnly: this.isReadOnly(),
          formData: data.attributes,
          responseData: response.getFormData(),
          formSubmission: response.getResponse(),
          options: this.form.get('options'),
        } }, requestId);
      })
      .catch(
        /* istanbul ignore next: Don't test BE errors */
        ({ responseData }) => {
          this.send(message, { error: responseData }, requestId);
        },
      );
  },
  fetchFormResponse({ responseId }, requestId) {
    const message = 'fetch:form:response';
    return Promise.all([
      Radio.request('entities', 'fetch:formResponses:model', responseId),
    ]).then(([response]) => {
      this.send(message, { value: {
        responseData: response.getFormData(),
        formSubmission: response.getResponse(),
        options: this.form.get('options'),
      } }, requestId);
    }).catch(
      /* istanbul ignore next: Don't test BE errors */
      ({ responseData }) => {
        this.send(message, { error: responseData }, requestId);
      },
    );
  },
  useLatestDraft(responseData) {
    responseData._form = this.form.getResource();
    responseData._patient = this.patient.getResource();
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

        const error = map(responseData.errors, 'detail');
        this.send('form:errors', { error });
      });
  },
});
