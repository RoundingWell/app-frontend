import { isEmpty } from 'underscore';
import BaseEntity from 'js/base/entity-service';
import { _Model, Model } from './entities/widget-values';
import { v5 as uuid, validate, NIL as NIL_UUID } from 'uuid';

const Entity = BaseEntity.extend({
  Entity: { _Model, Model },
  radioRequests: {
    'get:widgetValues:model': 'getByPatient',
    'fetch:widgetValues:byPatient': 'fetchByPatient',
  },
  // UI callers supply request options with their lifetime signal.
  fetchByPatient(widget, patientId, /* istanbul ignore next */ options = {}) {
    const model = this.getByPatient(widget.get('slug'), patientId);

    const requestValues = widget.get('values');

    // If not expecting values don't fetch them
    if (isEmpty(requestValues)) return model;

    const data = { filter: { patient: patientId } };
    return model.fetch({ ...options, url: `/api/widgets/${ widget.get('slug') }/values`, data });
  },
  getByPatient(slug, patientId) {
    /* istanbul ignore next: makes patientId a uuid for cypress */
    if (!validate(patientId)) patientId = uuid(patientId, NIL_UUID);

    return new Model({
      id: uuid(slug, patientId),
      name: slug,
    });
  },
});

export default new Entity();
