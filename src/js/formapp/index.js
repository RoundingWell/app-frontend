/* global Formio */
import 'formiojs/dist/formio.form.min';
import 'formiojs/dist/formio.form.css';
import '@fortawesome/fontawesome-pro/scss/fontawesome.scss';
import '@fortawesome/fontawesome-pro/scss/v4-shims.scss';
import '@fortawesome/fontawesome-pro/scss/solid.scss';
import 'scss/formapp/bootstrap.min.css';

import 'scss/formapp-core.scss';

import { extend, map, debounce, each, isEmpty, isObject } from 'underscore';
import $ from 'jquery';
import { v4 as uuid } from 'uuid';
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
  return router.request('update:field', { fieldName, value });
}

function getField(fieldName) {
  return router.request('fetch:field', { fieldName });
}

function getFieldHistory(fieldName, limit = 10, sort = 'newest') {
  return router.request('fetch:fieldHistory', { fieldName, limit, sort });
}

function getClinicians({ teamId } = {}) {
  return router.request('fetch:clinicians', { teamId });
}

function getDirectory(directoryName, query) {
  return router.request('fetch:directory', { directoryName, query });
}

function getIcd(by) {
  // NOTE: Backwards compatible API
  const args = isObject(by) ? { by } : { by: { term: by } };
  return router.request('fetch:icd', args);
}

function getContext(contextScripts) {
  return getScriptContext(contextScripts, { getClinicians, getDirectory, getField, getFieldHistory, updateField, getIcd, Handlebars, TEMPLATES: {}, parsePhoneNumber });
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
    this.pending = new Map();

    window.addEventListener('message', ({ data, origin }) => {
      /* istanbul ignore next: security check */
      if (origin !== window.origin || !data || !data.message || !data.args) return;

      const { value, error } = data.args;

      if (this.pending.has(data.requestId)) {
        const { resolve, reject } = this.pending.get(data.requestId);
        this.pending.delete(data.requestId);

        error ? reject(error) : resolve(value);
      }

      this.trigger(data.message, error || value);
    }, false);

    $(window).on('focus', () => {
      this.send('focus');
    });

    this.send('version', versions.frontend);
  },
  send(message, args = {}) {
    parent.postMessage({ message, args }, window.origin);
  },
  request(message, args = {}) {
    const requestId = uuid();
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      parent.postMessage({ message, args, requestId }, window.origin);
    });
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
