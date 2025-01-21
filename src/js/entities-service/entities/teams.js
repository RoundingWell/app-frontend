import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'teams';

const _Model = BaseModel.extend({
  type: TYPE,
  urlRoot: '/api/teams',
  getAssignableClinicians() {
    const clinicians = this.getClinicians();

    return clinicians.filterAssignable();
  },
  getClinicians() {
    return Radio.request('entities', 'clinicians:collection', this.get('_clinicians'));
  },
  addClinician(clinician) {
    const clinicians = this.getClinicians();
    clinicians.add(clinician);
    this.set('_clinicians', clinicians.getResources());
  },
  removeClinician(clinician) {
    const clinicians = this.getClinicians();
    clinicians.remove(clinician);
    this.set('_clinicians', clinicians.getResources());
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/teams',
  model: Model,
  comparator: 'name',
});

export {
  _Model,
  Model,
  Collection,
};
