import { reduce } from 'underscore';
import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/form-responses';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'formResponses:model': 'getModel',
    'formResponses:collection': 'getCollection',
    'fetch:formResponses:model': 'fetchFormResponse',
    'fetch:formResponses:latest': 'fetchLatestResponse',
    'fetch:formResponses:byMe': 'fetchByMe',
    'fetch:formResponses:byPatient': 'fetchSubmittedByPatient',
  },
  fetchFormResponse(id, options) {
    if (!id) return new Model();

    return this.fetchModel(id, options);
  },
  fetchLatestResponse(filter) {
    const data = reduce(filter, (filters, value, key) => {
      if (!value) return filters;
      filters.filter[key] = value;
      return filters;
    }, { filter: {} });
  fetchOrEmpty(url, data) {
    return this.fetchBy(url, { data }).then(response => response || new Model());
  },
  fetchByMe({ actionId, patientId, formId }) {
    const filter = actionId ? { action: actionId } : { patient: patientId, form: formId };

    return this.fetchOrEmpty('/api/clinicians/me/form-responses/latest', { filter });
  },
  fetchSubmittedByPatient({ patientId, actionId, flowId, formId, actionTags, submittedAt }) {
    const filter = {
      ...(actionId && { actions: actionId }),
      ...(flowId && { flows: flowId }),
      ...(formId && { forms: formId }),
      ...(actionTags && { action_tags: actionTags }),
      ...(submittedAt && { submitted_at: submittedAt }),
    };

    return this.fetchBy('/api/form-responses/latest', { data })
      .then(response => {
        if (!response) return new Model();
        return response;
      });
  },
});

export default new Entity();
