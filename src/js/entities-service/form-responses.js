import BaseEntity from 'js/base/entity-service';
import { _Model, Model, Collection } from './entities/form-responses';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model, Collection },
  radioRequests: {
    'formResponses:model': 'getModel',
    'formResponses:collection': 'getCollection',
    'fetch:formResponses:model': 'fetchFormResponse',
    'fetch:formResponses:byMe': 'fetchByMe',
    'fetch:formResponses:byPatient': 'fetchSubmittedByPatient',
  },
  fetchFormResponse(id, options) {
    if (!id) return new Model();

    return this.fetchModel(id, options);
  },
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

    return this.fetchOrEmpty(`/api/patients/${ patientId }/form-responses/submitted`, { filter });
  },
});

export default new Entity();
