import { extend } from 'underscore';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';
import { v5 as uuid } from 'uuid';
import { RWELL_NS } from 'js/static';

const TYPE = 'patient-fields';
const WRITABLE_ATTRIBUTES = [
  'value',
];

const _Model = BaseModel.extend({
  writableAttributes: WRITABLE_ATTRIBUTES,
  type: TYPE,
  url() {
    const patient = this.getPatient();
    return `/api/patients/${ patient.id }/fields/${ this.get('name') }`;
  },
  getPatient() {
    return this.getRelationship('_patient');
  },
  createId() {
    const patient = this.getPatient();
    const name = this.get('name');

    /* istanbul ignore next: dev protection */
    if (!patient || !name) {
      throw new Error('Cannot create patient-field without patient or name');
    }

    return uuid(`patient:${ patient.id }:field:${ String(name).toLowerCase() }`, RWELL_NS);
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const relationships = {
      patient: this.toRelation(attrs._patient),
    };

    return this.save(attrs, { relationships }, { wait: true, type: 'PATCH' });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  model: Model,
});

export {
  _Model,
  Model,
  Collection,
};
