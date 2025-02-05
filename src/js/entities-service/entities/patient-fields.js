import { extend } from 'underscore';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'patient-fields';

const _Model = BaseModel.extend({
  type: TYPE,
  url() {
    const patient = this.getPatient();
    return `/api/patients/${ patient.id }/fields/${ this.get('name') }`;
  },
  getPatient() {
    return this.getRelationship('_patient');
  },
  saveAll(attrs) {
    attrs = extend({}, this.attributes, attrs);

    const relationships = {
      patient: this.toRelation(attrs._patient),
    };

    return this.save(attrs, { relationships }, { wait: true });
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
