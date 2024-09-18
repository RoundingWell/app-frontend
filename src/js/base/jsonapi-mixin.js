import { each, isArray, isNull, isObject, isUndefined, map, pick } from 'underscore';
import dayjs from 'dayjs';
import Store from 'backbone.store';

import underscored from 'js/utils/formatting/underscored';

export function cacheIncluded(included) {
  each(included, data => {
    const Model = Store.get(data.type);
    const model = new Model({ id: data.id });
    model.set(model.parseModel(data));
  });
}

export default {
  cacheIncluded,
  // Override to handle specific id parsing
  parseId(attrs = {}, id) {
    attrs.id = id;

    return attrs;
  },
  // Override to handle specific relationships
  parseRelationship(relationship) {
    if (!relationship || !isArray(relationship)) return relationship;

    return map(relationship, item => {
      const itemRelationship = { id: item.id, type: item.type };

      if (item.meta) {
        each(item.meta, (value, key) => {
          itemRelationship[`_${ underscored(key) }`] = value;
        });
      }

      return itemRelationship;
    });
  },
  // Creates model relationship ie: _factors: [{id: '1'}, {id: '2'}]
  parseRelationships(attrs, relationships) {
    each(relationships, (relationship, key) => {
      attrs[`_${ underscored(key) }`] = this.parseRelationship(relationship.data, key);
    });

    return attrs;
  },
  parseModel(data) {
    const modelData = this.parseId(data.attributes, data.id);

    modelData.__cached_ts = dayjs.utc().format();

    each(data.meta, (value, key) => {
      modelData[`_${ underscored(key) }`] = value;
    });

    return this.parseRelationships(modelData, data.relationships);
  },
  toRelation(entity, entityType) {
    if (isUndefined(entity)) return;

    if (isNull(entity)) return { data: null };

    if (entity.models) {
      return {
        data: entity.map(({ id, type }) => {
          return { id, type };
        }),
      };
    }

    if (isArray(entity)) {
      return {
        data: map(entity, item => {
          const id = item.id ? item.id : item;
          return { id, type: entityType };
        }),
      };
    }

    if (isObject(entity)) {
      return { data: pick(entity, 'id', 'type') };
    }

    return {
      data: {
        id: entity,
        type: entityType,
      },
    };
  },
};
