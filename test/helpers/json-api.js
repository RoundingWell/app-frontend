import _ from 'underscore';
import { v7 as uuid } from 'uuid';

// NOTE: Set this to true to check for invalid types and relationships
const DEBUG = false;

const VALID_API_KEYS = ['id', 'type', 'attributes', 'relationships', 'meta'];

function debugKeys(data) {
  if (!DEBUG) return;

  _.each(_.keys(data), key => {
    if (VALID_API_KEYS.includes(key)) return;
    Cypress.log({
      name: 'mergeJsonApi',
      displayName: 'json-api',
      message: 'WARNING: Invalid type',
      consoleProps: () => {
        return { data, type: data.type };
      },
    });
  });
}

function debugRelationships(data, VALID = {}) {
  if (!DEBUG) return;

  const RELATIONSHIPS = VALID.relationships || [];

  const invalidRelationships = _.reject(_.keys(data.relationships), relationship => {
    return RELATIONSHIPS.includes(relationship);
  });

  if (invalidRelationships.length) {
    Cypress.log({
      name: 'mergeJsonApi',
      displayName: 'json-api',
      message: 'WARNING: Invalid Relationship',
      consoleProps: () => {
        return {
          data,
          invalidRelationships,
        };
      },
    });
  }
}

function debugData(data, { VALID } = {}) {
  debugRelationships(data, VALID);

  return data;
}

// Takes fixture data and returns a JSON API resource
function getResource(data, type, relationships = {}) {
  data = JSON.parse(JSON.stringify(data));

  if (_.isArray(data)) {
    return _.map(data, _.partial(getResource, _, type, relationships));
  }

  if (_.isFunction(relationships)) relationships = relationships();
  relationships = JSON.parse(JSON.stringify(relationships));

  return debugData({
    id: data.id,
    type,
    attributes: _.omit(data, 'id'),
    relationships,
  });
}

// Returns a JSON API relationship from a fixture or resource
function getRelationship(resource, type) {
  if (!resource) return { data: null };

  // Support explicit or resource type
  type = type || resource.type;

  if (_.isString(resource)) return getRelationship({ id: resource }, type);

  if (_.isArray(resource)) {
    if (_.isEmpty(resource)) return { data: [] };
    return {
      data: _.map(resource, res => {
        return { id: res.id, type: type || res.type };
      }),
    };
  }

  return {
    data: {
      id: resource.id,
      type,
    },
  };
}

function getError(error) {
  error = _.defaults(error, {
    id: uuid(),
    status: '400',
    title: 'Error Title',
    detail: 'Error detail',
  });

  // NOTE: supports a flat helper for errors
  if (error.sourceKeys) {
    error.source = { pointer: `/data/${ error.sourceKeys }` };
    delete error.sourceKeys;
  }

  error.status = String(error.status);

  return error;
}

function getErrors(errors) {
  return _.isArray(errors) ? _.map(errors, getError) : [getError(errors)];
}

// Note: mergeData { id, type, attributes, relationships, meta }
function mergeJsonApi(data = {}, mergeData = {}, _debugData) {
  debugKeys(mergeData);
  data = JSON.parse(JSON.stringify(data));
  data.id = _.result(mergeData, 'id', data.id);
  data.type = _.result(mergeData, 'type', data.type);
  data.attributes = _.defaults(_.result(mergeData, 'attributes'), data.attributes);
  data.relationships = _.defaults(_.result(mergeData, 'relationships'), data.relationships);
  data.meta = _.defaults(_.result(mergeData, 'meta'), data.meta);

  return debugData(JSON.parse(JSON.stringify(data)), _debugData);
}

export {
  getErrors,
  getResource,
  getRelationship,
  mergeJsonApi,
};
