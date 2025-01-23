import Radio from 'backbone.radio';
import Store from 'backbone.store';
import BaseCollection from 'js/base/collection';
import BaseModel from 'js/base/model';

const TYPE = 'workspaces';

const _Model = BaseModel.extend({
  type: TYPE,
  urlRoot: '/api/workspaces',
  getStates() {
    return Radio.request('entities', 'states:collection', this.get('_states'));
  },
  getForms() {
    return Radio.request('entities', 'forms:collection', this.get('_forms'));
  },
  getClinicians() {
    return Radio.request('entities', 'clinicians:collection', this.get('_clinicians'));
  },
  getAssignableClinicians() {
    const clinicians = this.getClinicians();

    return clinicians.filterAssignable();
  },
  updateClinicians(clinicians) {
    this.set('_clinicians', clinicians.getResources());
  },
  addClinician(clinician) {
    const url = `/api/workspaces/${ this.id }/relationships/clinicians`;
    clinician.addWorkspace(this);

    const clinicians = this.getClinicians();
    clinicians.add(clinician);

    this.updateClinicians(clinicians);

    return this.sync('create', this, {
      url,
      data: JSON.stringify({
        data: [clinician.getResource()],
      }),
    });
  },
  removeClinician(clinician) {
    const url = `/api/workspaces/${ this.id }/relationships/clinicians`;
    clinician.removeWorkspace(this);

    const clinicians = this.getClinicians();
    clinicians.remove(clinician);

    this.updateClinicians(clinicians);

    return this.sync('delete', this, {
      url,
      data: JSON.stringify({
        data: [clinician.getResource()],
      }),
    });
  },
});

const Model = Store(_Model, TYPE);
const Collection = BaseCollection.extend({
  url: '/api/workspaces',
  model: Model,
  comparator: 'name',
});

export {
  _Model,
  Model,
  Collection,
};
