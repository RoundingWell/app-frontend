import { each, isArray, isNull, isUndefined, map, pick } from 'underscore';
import dayjs from 'dayjs';
import underscored from 'js/utils/formatting/underscored';

import { getStore } from './entity-service';

export function cacheIncluded(included) {
  each(included, data => {
    const model = getStore(data);
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
  toRelation(entity) {
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
        data: map(entity, ({ id, type }) => {
          return { id, type };
        }),
      };
    }

    return { data: pick(entity, 'id', 'type') };
  },
};
