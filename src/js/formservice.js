import 'js/base/setup';

import { get } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import App from 'js/base/app';

import 'js/entities-service';

// TODO: remove after the last Form.io PDF is replaced.
function isFormIo() {
  return document.referrer.includes('formio');
}

const ActionFormApp = App.extend({
  beforeStart({ actionId }) {
    return [
      Radio.request('entities', 'fetch:forms:byAction', actionId),
      Radio.request('entities', 'fetch:forms:data', actionId),
      Radio.request('entities', 'fetch:actions:model', actionId),
      isFormIo() && Radio.request('entities', 'fetch:forms:definition:byAction', actionId),
    ];
  },
  onStart(opts, form, data, action, definition) {
    const filter = this._getPrefillFilters(form, action);

    return Promise.resolve(Radio.request('entities', 'fetch:formResponses:byPatient', filter))
      .then(response => {
        parent.postMessage({ message: 'form:pdf', args: { value: {
          ...(definition && { definition }),
          formData: data.attributes,
          responseData: response.getFormData(),
          formSubmission: response.getResponse(),
          options: form.get('options'),
        } } }, window.origin);
      });
  },
  _getPrefillFilters(form, action) {
    const isReport = form.isReport();
    const actionTags = form.getPrefillActionTag();

    return {
      flowId: get(action.getFlow(), 'id'),
      patientId: action.getPatient().id,
      submittedAt: isReport && `<=${ action.get('created_at') }`,
      actionId: !actionTags && action.id,
      actionTags,
    };
  },
});

const FormApp = App.extend({
  beforeStart({ formId, patientId, responseId }) {
    return [
      Radio.request('entities', 'fetch:forms:model', formId),
      Radio.request('entities', 'fetch:forms:data', null, patientId, formId),
      Radio.request('entities', 'fetch:formResponses:model', responseId),
      isFormIo() && Radio.request('entities', 'fetch:forms:definition', formId),
    ];
  },
  onStart(opts, form, data, response, definition) {
    parent.postMessage({ message: 'form:pdf', args: { value: {
      ...(definition && { definition }),
      formData: data.attributes,
      responseData: response.getFormData(),
      formSubmission: response.getResponse(),
      options: form.get('options'),
    } } }, window.origin);
  },
});

const Router = Backbone.Router.extend({
  routes: {
    'formservice/action/:actionId': 'startActionFormService',
    'formservice/:formId/:patientId(/:responseId)': 'startFormService',
  },
  startActionFormService(actionId) {
    const app = new ActionFormApp();

    app.start({ actionId });
  },
  startFormService(formId, patientId, responseId) {
    const app = new FormApp();

    app.start({ formId, patientId, responseId });
  },
});

function startFormServiceApp() {
  new Router();
  Backbone.history.start({ pushState: true });
}

export {
  startFormServiceApp,
};
