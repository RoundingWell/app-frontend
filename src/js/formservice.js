import 'js/base/setup';

import { get } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import App from 'js/base/app';

import 'js/entities-service';

// TODO: remove after the last Form.io PDF is replaced.
function isFormIo() {
  return document.referrer.includes('formio');
}

const ActionFormApp = App.extend({
  async prepareStart({ actionId }, { signal }) {
    const [form, data, action, definition] = await Promise.all([
      Radio.request('entities', 'fetch:forms:byAction', actionId, { signal }),
      Radio.request('entities', 'fetch:forms:data', actionId, null, null, { signal }),
      Radio.request('entities', 'fetch:actions:model', actionId, { signal }),
      isFormIo() && Radio.request('entities', 'fetch:forms:definition:byAction', actionId, { signal }),
    ]);
    const filter = this._getPrefillFilters(form, action);
    const response = await Radio.request('entities', 'fetch:formResponses:byPatient', filter, { signal });

    return [form, data, response, definition];
  },
  onStart(app, options, [form, data, response, definition]) {
    parent.postMessage({ message: 'form:pdf', args: { value: {
      ...(definition && { definition }),
      formData: data.attributes,
      responseData: response.getFormData(),
      formSubmission: response.getResponse(),
      options: form.get('options'),
    } } }, window.origin);
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
  prepareStart({ formId, patientId, responseId }, { signal }) {
    return Promise.all([
      Radio.request('entities', 'fetch:forms:model', formId, { signal }),
      Radio.request('entities', 'fetch:forms:data', null, patientId, formId, { signal }),
      Radio.request('entities', 'fetch:formResponses:model', responseId, { signal }),
      isFormIo() && Radio.request('entities', 'fetch:forms:definition', formId, { signal }),
    ]);
  },
  onStart(app, options, [form, data, response, definition]) {
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
