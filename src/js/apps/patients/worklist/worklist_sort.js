import { get, union, map, uniq, compact } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';

import { alphaSort, numSort } from 'js/utils/sorting';
import { i18n } from 'js/apps/patients/worklist/worklist_views';

// Casts values to String for alpha sort
function getEntityFieldValue(entity, fieldName, keys) {
  const patientField = entity.getPatient().getField(fieldName);
  if (!patientField) return null;
  return get(patientField.get('value'), keys);
}

// field_key may include a path for the model_attr.deeply_nested.value
const SortOption = Backbone.Model.extend({
  defaults: {
    direction: 'desc',
    field_key: 'value',
    entities: ['actions', 'flows'],
  },
  getComparator() {
    const comparator = this.get('comparator');
    if (comparator) return comparator.bind(this);

    const fieldName = this.get('field_name');
    const keys = this.get('field_key').split('.');
    const direction = this.get('direction');
    const sortType = this.get('sort_type');

    return (a, b) => {
      const aValue = getEntityFieldValue(a.model, fieldName, keys);
      const bValue = getEntityFieldValue(b.model, fieldName, keys);

      if (sortType === 'numeric') {
        return numSort(direction, aValue, bValue);
      }

      return alphaSort(direction, aValue, bValue);
    };
  },
});

const SortOptions = Backbone.Collection.extend({
  model: SortOption,
  getByType(entityType) {
    const clone = this.clone();
    const filtered = this.filter(option => option.get('entities').includes(entityType));
    clone.reset(filtered);
    return clone;
  },
  getInclude() {
    const fieldNames = compact(this.map('field_name'));

    return map(uniq(fieldNames), fieldName => {
      return `patient.patient-fields.${ fieldName }`;
    });
  },
});

const patientNameComparator = function(a, b) {
  return alphaSort(this.get('direction'), a.model.getPatient().getSortName(), b.model.getPatient().getSortName());
};

const actionNameComparator = function(a, b) {
  return alphaSort(this.get('direction'), a.model.get('name'), b.model.get('name'));
};

const updatedAtComparator = function(a, b) {
  return alphaSort(this.get('direction'), a.model.get('updated_at'), b.model.get('updated_at'));
};

const createdAtComparator = function(a, b) {
  return alphaSort(this.get('direction'), a.model.get('created_at'), b.model.get('created_at'));
};

const defaultSortOptions = [
  {
    id: 'sortPatientAsc',
    text: i18n.sortPatientOptions.asc,
    direction: 'asc',
    comparator: patientNameComparator,
  },
  {
    id: 'sortPatientDesc',
    text: i18n.sortPatientOptions.desc,
    comparator: patientNameComparator,
  },
  {
    id: 'sortActionNameAsc',
    text: i18n.sortActionOptions.asc,
    entities: ['actions'],
    direction: 'asc',
    comparator: actionNameComparator,
  },
  {
    id: 'sortActionNameDesc',
    text: i18n.sortActionOptions.desc,
    entities: ['actions'],
    comparator: actionNameComparator,
  },
  {
    id: 'sortDueAsc',
    text: i18n.sortDueOptions.asc,
    entities: ['actions'],
    direction: 'asc',
    comparator(a, b) {
      const dueA = a.model.get('due_date');
      const dueB = b.model.get('due_date');
      if (dueA === dueB) {
        return alphaSort(this.get('direction'), a.model.get('due_time'), b.model.get('due_time'), '24');
      }
      return alphaSort(this.get('direction'), dueA, dueB);
    },
  },
  {
    id: 'sortDueDesc',
    text: i18n.sortDueOptions.desc,
    entities: ['actions'],
    comparator(a, b) {
      const dueA = a.model.get('due_date');
      const dueB = b.model.get('due_date');
      if (dueA === dueB) {
        return alphaSort(this.get('direction'), a.model.get('due_time'), b.model.get('due_time'));
      }
      return alphaSort(this.get('direction'), dueA, dueB);
    },
  },
  {
    id: 'sortUpdateAsc',
    text: i18n.sortUpdateOptions.asc,
    direction: 'asc',
    comparator: updatedAtComparator,
  },
  {
    id: 'sortUpdateDesc',
    text: i18n.sortUpdateOptions.desc,
    comparator: updatedAtComparator,
  },
  {
    id: 'sortCreatedAsc',
    text: i18n.sortCreatedOptions.asc,
    direction: 'asc',
    comparator: createdAtComparator,
  },
  {
    id: 'sortCreatedDesc',
    text: i18n.sortCreatedOptions.desc,
    comparator: createdAtComparator,
  },
];

function getSortOptions(listType) {
  const customSort = Radio.request('settings', 'get', 'sorting');
  const sortOpts = new SortOptions(union(defaultSortOptions, customSort));

  return sortOpts.getByType(listType);
}

export {
  getSortOptions,
};
