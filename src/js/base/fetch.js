//  Similar to https://github.com/akre54/Backbone.Fetch
import { isObject, isArray, defaults, extend, map, flatten, reduce, first, rest, get } from 'underscore';
import Radio from 'backbone.radio';

import { logResponse } from 'js/datadog';

const fetchers = [];

function registerFetcher(baseUrl, fetcher, controller) {
  fetchers[baseUrl] = { fetcher, controller };

  return fetcher;
}

function getFetcher(baseUrl) {
  return get(fetchers[baseUrl], 'fetcher');
}

function removeFetcher(baseUrl) {
  delete fetchers[baseUrl];
}

function abortFetcher(baseUrl) {
  const controller = get(fetchers[baseUrl], 'controller');

  if (!controller) return;

  controller.abort();
  removeFetcher(baseUrl);
}

function getActiveFetcher(baseUrl, options = {}) {
  const fetcher = getFetcher(baseUrl);

  /* istanbul ignore if: async safety */
  if (fetcher) {
    if (options.abort !== false) {
      abortFetcher(baseUrl);
      return false;
    }

    return fetcher;
  }

  return false;
}

async function buildFetcher(url, options = {}) {
  const token = await Radio.request('auth', 'getToken');
  const controller = new AbortController();
  const baseUrl = url;

  options = extend({
    signal: controller.signal,
    dataType: 'json',
    headers: defaults(options.headers, {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    }),
  }, options);

  if (token) options.headers.Authorization = token;

  if (!options.method || options.method === 'GET') {
    url = getUrl(url, options.data);
  } else if (options.data) {
    options.body = options.data;
  }

  // Attach preferred workspace to request
  const currentWorkspace = Radio.request('workspace', 'current');
  if (currentWorkspace) options.headers.Workspace = currentWorkspace.id;

  // Attach Client ID
  const currentUser = Radio.request('bootstrap', 'currentUser');
  if (currentUser) options.headers['Client-Key'] = currentUser.clientKey;

  return registerFetcher(baseUrl, fetch(url, options), controller);
}

function getValue(value) {
  return encodeURIComponent(value ?? '');
}

function getKey(key) {
  // Builds key[subkey] or key[subkey1][subkey2]
  if (isArray(key)) {
    const firstKey = encodeURIComponent(first(key));

    return reduce(rest(key), (str, k) => `${ str }[${ encodeURIComponent(k) }]`, firstKey);
  }

  return encodeURIComponent(key);
}

function buildParams(value, key) {
  if (isArray(value)) {
    // Builds key=value1,value2,value3
    return `${ getKey(key) }=${ value.map(getValue).join() }`;
  }

  if (isObject(value)) {
    // Builds key[subkey]=value or key[subkey1][subkey2]=value
    return flatten(map(value, (val, name) => buildParams(val, flatten([key, name])))).join('&');
  }

  return `${ getKey(key) }=${ getValue(value) }`;
}

function serializeParams(obj) {
  return map(obj, buildParams).join('&');
}

// Makes data object into `/url?param1=value1&param2=value2` string
function getUrl(url, data) {
  if (!isObject(data)) return url;

  const params = serializeParams(data);
  if (!params) return url;

  return `${ url }?${ params }`;
}

export function getData(response, dataType) {
  response = response.clone();

  if (dataType === 'json' && response.status !== 204) return response.json();

  return response.text();
}

export async function handleJSON(response) {
  if (!response) return;

  const responseData = await getData(response, 'json');

  if (!response.ok) return Promise.reject({ response, responseData });

  return responseData;
}

export function handleError(error) {
  if (error.name !== 'AbortError') throw error;
}

export default async(url, options) => {
  const fetcher = getActiveFetcher(url, options) || buildFetcher(url, options);

  return fetcher
    .then(async response => {
      removeFetcher(url);

      if (!response.ok) {
        if (response.status === 401) {
          Radio.request('auth', 'logout');
        }

        if (response.status >= 400) {
          logResponse(url, options, response);

          const contentType = String(response.headers.get('Content-Type'));

          if (!contentType.includes('json')) {
            Radio.trigger('event-router', 'unknownError', response.status);
          }
        }

        if (response.status >= 500 || !response.status) {
          Radio.trigger('event-router', 'unknownError', response.status);
        }
      }

      return response;
    })
    .catch(handleError);
};
