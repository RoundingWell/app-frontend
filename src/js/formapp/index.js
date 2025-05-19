/* global Formio */
import 'formiojs/dist/formio.form.min';
import 'formiojs/dist/formio.form.css';
import '@fortawesome/fontawesome-pro/scss/fontawesome.scss';
import '@fortawesome/fontawesome-pro/scss/v4-shims.scss';
import '@fortawesome/fontawesome-pro/scss/solid.scss';
import 'scss/formapp/bootstrap.min.css';

import 'scss/formapp-core.scss';

import { extend, map, debounce, uniqueId, each, isEmpty, isObject } from 'underscore';
import $ from 'jquery';
import Backbone from 'backbone';
import Handlebars from 'handlebars/runtime';
import parsePhoneNumber from 'libphonenumber-js/min';
import { addError } from 'js/datadog';

import intl from 'js/i18n';

import { versions } from '../config';

import {
  getBeforeSubmit,
  getScriptContext,
  getSubmission,
  getChangeReducers,
  getResponse,
} from './utils';

import './components';

import 'scss/formapp/comment.scss';
import 'scss/formapp/form.scss';
import 'scss/formapp/formio-overrides.scss';
import 'scss/formapp/print.scss';
import 'scss/formapp/pdf.scss';

import 'scss/modules/loader.scss';

let router;

function scrollTop() {
  window.scrollTo({ top: 0 });
}

function updateField(fieldName, value) {
  return router.updateField({ fieldName, value });
}

function getField(fieldName) {
  return router.getField({ fieldName });
}

function getClinicians({ teamId } = {}) {
  return router.getClinicians({ teamId });
}

function getDirectory(directoryName, query) {
  return router.getDirectory({ directoryName, query });
}

function getIcd(by) {
  // NOTE: Backwards compatible API
  if (!isObject(by)) return router.getIcd({ by: { term: by } });
  return router.getIcd({ by });
}

function getContext(contextScripts) {
  return getScriptContext(contextScripts, { getClinicians, getDirectory, getField, updateField, getIcd, Handlebars, TEMPLATES: {}, parsePhoneNumber });
}

let prevSubmission;

function updateSubmission() {
  router.request('update:storedSubmission', prevSubmission);
}

const updateSubmissionDebounce = debounce(updateSubmission, /* istanbul ignore next */ _TEST_ ? 100 : 2000);

const onChange = function(form, changeReducers) {
  const data = getChangeReducers(form, changeReducers, structuredClone(form.submission.data), prevSubmission);

  form.data = data;
  form.setSubmission({ data }, { fromChangeReducers: true, fromSubmission: false });

  prevSubmission = structuredClone(form.submission.data);
  updateSubmissionDebounce();
};

const onChangeDebounce = debounce(onChange, 100);

async function renderForm({ definition, isReadOnly, storedSubmission, formData, formSubmission, responseData, options }) {
  const { reducers, changeReducers, submitReducers, context, beforeSubmit } = options;

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

  router.off('form:submit');
  router.off('form:errors');

  router.on({
    'form:errors'(errors) {
      // NOTE: maps errors due to https://github.com/formio/formio.js/issues/3970
      form.showErrors(map(errors, error => {
        return { message: error };
      }), true);
    },
    'form:submit'() {
      form.submit();
    },
  });

  form.on('prevPage', scrollTop);
  form.on('nextPage', scrollTop);

  form.on('error', () => {
    router.request('ready:form');
    form._isReady = true;
  });

  form.on('submit', response => {
    // Prevents submission after a success
    if (!form._isReady) return;
    form._isReady = false;
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
      router.trigger('form:errors', [intl.formapp.failedSubmit]);
      addError(new Error('beforeSubmit failure.'));
      return;
    }

    try {
      const submitResponse = extend(getResponse(form, submitReducers, data), response, { data });

      // Remove empty data to prevent { __empty__: true }
      each(['fields', 'flow', 'action', 'artifacts'], key => {
        if (isEmpty(submitResponse[key])) delete submitResponse[key];
      });

      router.request('submit:form', { response: submitResponse });
    } catch (e) {
      router.trigger('form:errors', [intl.formapp.failedSubmit]);
      addError(e);
    }
  });

  router.request('ready:form');
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
    form.on('prevPage', scrollTop);
    form.on('nextPage', scrollTop);
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

const Router = Backbone.Router.extend({
  initialize() {
    window.addEventListener('message', ({ data, origin }) => {
      /* istanbul ignore next: security check */
      if (origin !== window.origin || !data || !data.message) return;

      this.trigger(data.message, data.args);
    }, false);

    $(window).on('focus', () => {
      this.request('focus');
    });

    this.request('version', versions.frontend);
    this.requestResolves = {};
    this.on({
      'fetch:clinicians': this.onFetchClinicians,
      'fetch:directory': this.onFetchDirectory,
      'fetch:field': this.onFetchField,
      'update:field': this.onUpdateField,
      'fetch:icd': this.onFetchIcd,
    });
  },
  request(message, args = {}) {
    const request = new Promise(resolve => {
      this.once(message, resolve);
      parent.postMessage({ message, args }, window.origin);
    });

    return request;
  },
  requestValue({ args, message, requestId }) {
    const request = new Promise((resolve, reject) => {
      this.requestResolves[requestId] = { resolve, reject };
      parent.postMessage({
        message,
        args: extend({ requestId }, args),
      }, window.origin);
    });

    return request;
  },
  resolveValue({ value, error, requestId }) {
    // Prevents an edge case where a request is resolved
    // after the form is submitted and reloaded
    if (!this.requestResolves[requestId]) return;
    const { resolve, reject } = this.requestResolves[requestId];
    delete this.requestResolves[requestId];
    error ? reject(error) : resolve(value);
  },
  getClinicians(args) {
    const message = 'fetch:clinicians';
    const requestId = uniqueId('clinicians');

    return this.requestValue({ args, message, requestId });
  },
  onFetchClinicians(args) {
    this.resolveValue(args);
  },
  getDirectory(args) {
    const message = 'fetch:directory';
    const requestId = uniqueId('directory');

    return this.requestValue({ args, message, requestId });
  },
  onFetchDirectory(args) {
    this.resolveValue(args);
  },
  getField(args) {
    const message = 'fetch:field';
    const requestId = uniqueId('field');

    return this.requestValue({ args, message, requestId });
  },
  onFetchField(args) {
    this.resolveValue(args);
  },
  updateField(args) {
    const message = 'update:field';
    const requestId = uniqueId('field');

    return this.requestValue({ args, message, requestId });
  },
  onUpdateField(args) {
    this.resolveValue(args);
  },
  getIcd(args) {
    const message = 'fetch:icd';
    const requestId = uniqueId('icd');

    return this.requestValue({ args, message, requestId });
  },
  onFetchIcd(args) {
    this.resolveValue(args);
  },
  routes: {
    'formapp/': 'renderForm',
    'formapp/:id': 'renderResponse',
    'formapp/pdf/action/:actionId': 'renderActionPdf',
    'formapp/pdf/:formId/:patientId(/:responseId)': 'renderPdf',
  },
  renderForm() {
    Promise.all([
      this.request('fetch:form:definition'),
      this.request('fetch:form:data'),
    ]).then(([definition, data]) => {
      renderForm({ definition, ...data });
    });
  },
  renderResponse(responseId) {
    Promise.all([
      this.request('fetch:form:definition'),
      this.request('fetch:form:response', { responseId }),
    ]).then(([definition, data]) => {
      renderResponse({ definition, ...data });
    });
  },
  renderActionPdf(actionId) {
    this.once('form:pdf', renderPdf);
    $('body').append(`<iframe class="iframe-hidden" src="/formservice/action/${ actionId }"></iframe>`);
  },
  renderPdf(formId, patientId, responseId) {
    this.once('form:pdf', renderPdf);
    $('body').append(`<iframe class="iframe-hidden" src="/formservice/${ formId }/${ patientId }${ responseId ? `/${ responseId }` : '' }"></iframe>`);
  },
});

function startFormApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const isModal = urlParams.get('modal');

  $('#root').append(`
    <div class="loader__bar${ isModal ? ' u-margin--t-24' : '' } js-progress-bar">
      <div class="loader__bar-progress--loop"></div>
    </div>
    <div class="loader__text js-loading">${ intl.regions.preload.loading }</div>
  `);

  if (isModal) $('body').addClass('is-modal');

  router = new Router();
  Backbone.history.start({ pushState: true });
}

export {
  startFormApp,
};
