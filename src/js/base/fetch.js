//  Similar to https://github.com/akre54/Backbone.Fetch
import { isObject, isArray, defaults, extend, map, flatten, reduce, first, rest, get } from 'underscore';
import Radio from 'backbone.radio';
import dayjs from 'dayjs';

const fetchers = [];

function registerFetcher(baseUrl, request) {
  fetchers[baseUrl] = request;

  return request.fetcher;
}

function getFetcher(baseUrl) {
  return get(fetchers[baseUrl], 'fetcher');
}

function removeFetcher(baseUrl, request) {
  if (fetchers[baseUrl] !== request) return;

  delete fetchers[baseUrl];
}

function abortFetcher(baseUrl) {
  const request = fetchers[baseUrl];

  if (!request) return;

  request.controller.abort();
  removeFetcher(baseUrl, request);
}

function getActiveFetcher(baseUrl, options = {}) {
  const fetcher = getFetcher(baseUrl);

  if (fetcher) {
    if (options.abort !== false) {
      abortFetcher(baseUrl);
      return false;
    }

    return fetcher;
  }

  return false;
}

function forwardAbort(signal, controller) {
  if (!signal) return () => {};

  const abort = () => controller.abort(signal.reason);

  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });

  return () => signal.removeEventListener('abort', abort);
}

function isGetRequest({ method } = {}) {
  return !method || String(method).toUpperCase() === 'GET';
}

function buildFetcher(url, options = {}, shouldRegister = false) {
  const controller = new AbortController();
  const baseUrl = url;
  const removeAbortListener = forwardAbort(options.signal, controller);
  const request = { controller };

  request.fetcher = (async() => {
    const token = await Radio.request('auth', 'getToken');

    options = extend({
      dataType: 'json',
      headers: defaults(options.headers, {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      }),
    }, options, { signal: controller.signal });

    if (token) options.headers.Authorization = token;

    if (isGetRequest(options)) {
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

    return fetch(url, options);
  })()
    .finally(() => {
      removeAbortListener();
      if (shouldRegister) removeFetcher(baseUrl, request);
    });

  if (shouldRegister) return registerFetcher(baseUrl, request);

  return request.fetcher;
}

function getRequestFetcher(url, options = {}) {
  if (!isGetRequest(options)) return buildFetcher(url, options);

  return getActiveFetcher(url, options) || buildFetcher(url, options, true);
}

async function handleUnauthorized(url, options = {}) {
  return Radio.request('auth', 'handleUnauthorized', async() => {
    // recoverAuth force-refreshes through AuthKit; the retry uses the SDK-cached fresh token.
    return getRequestFetcher(url, options);
  });
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

// Makes data object into `/url?param1=value1&param2=value2` string.
// Exported so the cache layer can key on the same canonical GET URL the
// fetch layer actually requests (otherwise data-bearing fetches collide).
export function getUrl(url, data) {
  if (!isObject(data)) return url;

  const params = serializeParams(data);
  if (!params) return url;

  return `${ url }?${ params }`;
}

export async function getData(response, dataType) {
  response = response.clone();

  if (dataType === 'json' && response.status !== 204) {
    const data = await response.json();
    stampCachedTs(data);
    return data;
  }

  return response.text();
}

// Writes __cached_ts onto each JSON:API resource's `attributes`. No-op on
// shapes without `attributes` (non-JSON:API responses pass through unchanged).
function stampCachedTs(responseData) {
  if (!responseData) return;

  const ts = dayjs.utc().format();
  const { data, included } = responseData;

  if (Array.isArray(data)) data.forEach(d => stampResource(d, ts));
  else if (data) stampResource(data, ts);

  if (Array.isArray(included)) included.forEach(d => stampResource(d, ts));
}

function stampResource(resource, ts) {
  if (resource && resource.attributes) resource.attributes.__cached_ts = ts;
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
  const fetcher = getRequestFetcher(url, options);

  return fetcher
    .then(response => {
      if (response.status === 401) {
        return handleUnauthorized(url, options)
          .then(retryResponse => retryResponse || response);
      }

      return response;
    })
    .then(response => {
      if (!response.ok) {
        if (response.status >= 400) {
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
