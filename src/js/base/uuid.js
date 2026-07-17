import { clone, isString } from 'underscore';
import Backbone from 'backbone';
import { v7 as uuid } from 'uuid';

// NOTE: Assumes idAttribute is _always_ id
Backbone.Model.prototype.sync = function(method, model, options) {
  options = clone(options);

  if (method === 'create') {
    let data = options.data || options.attrs || model.toJSON(options);
    if (isString(data)) data = JSON.parse(data);
    data.data.id = (model && model.createId) ? model.createId() : uuid();
    options.data = JSON.stringify(data);
  }

  return Backbone.sync(method, model, options);
};
