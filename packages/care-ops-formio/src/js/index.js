/* global Formio */
import 'formiojs/dist/formio.form.min';
import 'formiojs/dist/formio.form.css';
import '@fortawesome/fontawesome-pro/scss/fontawesome.scss';
import '@fortawesome/fontawesome-pro/scss/v4-shims.scss';
import '@fortawesome/fontawesome-pro/scss/solid.scss';
import 'scss/bootstrap.min.css';
import 'scss/formapp-core.scss';

import { addError, initDataDog } from 'js/datadog';

import { fetchConfig, versions } from '@roundingwell/care-ops-config';

import Handlebars from 'handlebars/runtime';
import parsePhoneNumber from 'libphonenumber-js/min';

import {
  getBeforeSubmit,
  getScriptContext,
  getSubmission,
  getChangeReducers,
  getResponse,
} from './utils';

import './components';

import 'scss/comment.scss';
import 'scss/form.scss';
import 'scss/formio-overrides.scss';
import 'scss/print.scss';
import 'scss/pdf.scss';

import 'scss/loader.scss';
const { extend, map, debounce, forEach, isEmpty, isObject, uniqueId } = Formio.Utils._;

const pending = new Map();
const namedHandlers = new Map();

let updateSubmissionDebounce;

function updateField(fieldName, value) {
  return parentRequest('update:field', { fieldName, value });
}

function getField(fieldName) {
  return parentRequest('fetch:field', { fieldName });
}

function getFieldHistory(fieldName, limit = 10, sort = 'newest') {
  return parentRequest('fetch:fieldHistory', { fieldName, limit, sort });
}

function getClinicians({ teamId } = {}) {
  return parentRequest('fetch:clinicians', { teamId });
}

function getDirectory(directoryName, query) {
  return parentRequest('fetch:directory', { directoryName, query });
}

function getIcd(by) {
  // NOTE: Backwards compatible API
  const args = isObject(by) ? { by } : { by: { term: by } };
  return parentRequest('fetch:icd', args);
}

function getContext(contextScripts) {
  return getScriptContext(contextScripts, { getClinicians, getDirectory, getField, getFieldHistory, updateField, getIcd, Handlebars, TEMPLATES: {}, parsePhoneNumber });
}

let prevSubmission;

function updateSubmission() {
  parentSend('update:storedSubmission', prevSubmission);
}

const onChange = function(form, changeReducers) {
  const data = getChangeReducers(form, changeReducers, structuredClone(form.submission.data), prevSubmission);

  form.data = data;
  form.setSubmission({ data }, { fromChangeReducers: true, fromSubmission: false });

  prevSubmission = structuredClone(form.submission.data);
  updateSubmissionDebounce();
};

const onChangeDebounce = debounce(onChange, 100);

function formSubmit(form, options, response) {
  const { changeReducers, submitReducers, beforeSubmit } = options;

  // Always run one last change event on submit
  onChangeDebounce.cancel();
  onChange(form, changeReducers);
  updateSubmissionDebounce.cancel();

  form.setPristine(false);
  if (!form.checkValidity(response.data, true, response.data)) {
    form.emit('error');
    return;
  }

  const data = getBeforeSubmit(form, beforeSubmit, response.data);

  if (!data) {
    form.setAlert('danger', 'Failed to submit form. Please try again.');
    addError(new Error('beforeSubmit failure.'));
    return;
  }

  try {
    const submitResponse = extend(getResponse(form, submitReducers, data), response, { data });

    // Remove empty data to prevent { __empty__: true }
    forEach(['fields', 'flow', 'action', 'artifacts'], key => {
      if (isEmpty(submitResponse[key])) delete submitResponse[key];
    });

    parentRequest('submit:form', { response: submitResponse });
  } catch(e) {
    form.setAlert('danger', 'Failed to submit form. Please try again.');
    addError(e);
  }
}

async function renderForm({ definition, isReadOnly, storedSubmission, formData, formSubmission, responseData, options }) {
  const { reducers, changeReducers, context } = options;

  const evalContext = await getContext(context);

  const submission = storedSubmission || await getSubmission(formData, formSubmission, responseData, reducers, evalContext);
  prevSubmission = structuredClone(submission);

  const form = await Formio.createForm(document.getElementById('root'), definition, {
    readOnly: isReadOnly,
    evalContext,
    data: submission,
    onChange({ fromChangeReducers }, { instance }) {
      if (fromChangeReducers && form.initialized) return;

      // Prevents clearing submission on add/edit of editgrid
      if (instance && instance.inEditGrid) return;

      onChangeDebounce(form, changeReducers);
    },
  });

  form.nosubmit = true;

  // Set up form handlers directly
  namedHandlers.set('form:submit', () => form.submit());
  namedHandlers.set('form:errors', errors => {
    form.showErrors(map(errors, error => {
      return { message: error };
    }), true);
  });

  // Simple scroll-to-top behavior
  form.on('prevPage', () => window.scrollTo({ top: 0 }));
  form.on('nextPage', () => window.scrollTo({ top: 0 }));

  form.on('error', () => {
    parentSend('ready:form');
    form._isReady = true;
  });

  form.on('submit', response => {
    // Prevents submission after a success
    if (!form._isReady) return;
    form._isReady = false;
    formSubmit(form, options, response);
  });

  parentSend('ready:form');
  form._isReady = true;
}

async function renderResponse({ definition, formSubmission, options }) {
  const evalContext = await getContext(options.context);

  extend(evalContext, { isResponse: true });

  Formio.createForm(document.getElementById('root'), definition, {
    readOnly: true,
    renderMode: 'form',
    evalContext,
    data: formSubmission,
  }).then(form => {
    form.on('prevPage', () => window.scrollTo({ top: 0 }));
    form.on('nextPage', () => window.scrollTo({ top: 0 }));
  });
}

async function renderPdf({ definition, formData, formSubmission, responseData, options }) {
  const { reducers, context } = options;
  const evalContext = await getContext(context);

  const submission = await getSubmission(formData, formSubmission, responseData, reducers, evalContext);

  const form = await Formio.createForm(document.getElementById('root'), definition, {
    evalContext,
    data: submission,
  });

  form.nosubmit = true;
}

function parentRequest(message, args = {}) {
  return new Promise((resolve, reject) => {
    const requestId = uniqueId('req_');

    pending.set(requestId, { resolve, reject });
    parent.postMessage({ message, args, requestId }, window.origin);
  });
}

function parentSend(message, args = {}) {
  const requestId = uniqueId('req_');
  parent.postMessage({ message, args, requestId }, window.origin);
}

function loadForm() {
  Promise.all([
    parentRequest('fetch:form:definition'),
    parentRequest('fetch:form:data'),
  ]).then(([definition, data]) => {
    renderForm({ definition, ...data });
  }).catch(error => {
    console.error('loadForm encountered an error:', error);
  });
}

function loadResponse(responseId) {
  Promise.all([
    parentRequest('fetch:form:definition'),
    parentRequest('fetch:form:response', { responseId }),
  ]).then(([definition, data]) => {
    renderResponse({ definition, ...data });
  });
}

function loadActionPdf(actionId) {
  namedHandlers.set('form:pdf', renderPdf);
  const iframe = document.createElement('iframe');
  iframe.className = 'iframe-hidden';
  iframe.src = `/formservice/action/${ actionId }`;
  document.body.appendChild(iframe);
}

function loadFormPdf(formId, patientId, responseId) {
  namedHandlers.set('form:pdf', renderPdf);
  const iframe = document.createElement('iframe');
  iframe.className = 'iframe-hidden';
  iframe.src = `/formservice/${ formId }/${ patientId }${ responseId ? `/${ responseId }` : '' }`;
  document.body.appendChild(iframe);
}

function handleNamedMessage(message, value, error) {
  if (namedHandlers.has(message)) {
    namedHandlers.get(message)(error || value);
    return;
  }

  const errorValue = error || value;
  const errorMessage = isObject(errorValue) ? JSON.stringify(errorValue) : errorValue;
  addError(new Error(`Unhandled message: ${ message } ${ errorMessage }`));
}

function handleMessage({ data, origin }) {
  if (origin !== window.origin || !data || !data.message || !data.args) return;
  const { message, requestId, args } = data;
  const { value, error } = args;

  // Handle promise responses for API requests
  if (requestId && pending.has(requestId)) {
    const { resolve, reject } = pending.get(requestId);
    pending.delete(requestId);
    error ? reject(error) : resolve(value);
    return;
  }

  handleNamedMessage(message, value, error);
}

function handleQuery({ pdf, responseId, actionId, formId, patientId } = {}) {
  if (pdf && actionId) {
    loadActionPdf(actionId);
    return;
  }

  if (pdf && formId && patientId) {
    loadFormPdf(formId, patientId, responseId);
    return;
  }

  if (responseId) {
    loadResponse(responseId);
    return;
  }

  loadForm();
}

function startFormApp(queryParams) {
  // Set up message listener
  window.addEventListener('message', handleMessage);
  window.addEventListener('focus', () => parent.postMessage({ message: 'focus' }, window.origin));

  // Send version info on startup
  parent.postMessage({ message: 'version', args: versions.frontend }, window.origin);

  handleQuery(queryParams);
}

// Helper function to parse query parameters
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    _TEST_: params.get('_TEST_') === 'true',
    modal: params.get('modal'),
    pdf: params.get('pdf'),
    responseId: params.get('responseId'),
    actionId: params.get('actionId'),
    formId: params.get('formId'),
    patientId: params.get('patientId'),
  };
}

function showPreloaderHTML() {
  const loaderHTML = `
    <div class="loader__bar js-progress-bar">
      <div class="loader__bar-progress--loop"></div>
    </div>
    <div class="loader__text js-loading">Loading...</div>
  `;

  document.getElementById('root').innerHTML = loaderHTML;
}

document.addEventListener('DOMContentLoaded', async() => {
  await fetchConfig();

  const queryParams = getQueryParams();

  if (!queryParams._TEST_) initDataDog({ isPdfPrinter: !!queryParams.pdf });

  if (queryParams.modal) {
    document.body.classList.add('is-modal');
  }

  showPreloaderHTML();

  updateSubmissionDebounce = debounce(updateSubmission, queryParams._TEST_ ? 100 : 2000);

  startFormApp(queryParams);
});
