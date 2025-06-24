import { extend } from 'underscore';
import Backbone from 'backbone';
import baseFetch, { getData, handleError } from 'js/base/fetch';

Backbone.ajax = options => {
  options = extend({
    method: options.type,
  }, options);

  const fetcher = baseFetch(options.url, options)
    .then(async response => {
      if (!response) return;

      const responseData = await getData(response, options.dataType);

      if (!response.ok) {
        if (options.error) options.error(responseData);

        return Promise.reject({ response, responseData });
      }

      if (options.success) options.success(responseData);

      return response;
    })
    .catch(handleError);

  return fetcher;
};
