import { filter, find, get, keys, map, some } from 'underscore';
import { v7 as uuid } from 'uuid';
import { Radio } from 'marionette';
import { getDatadogLogsOptions } from '@roundingwell/care-ops-config';

import BaseEntity from 'js/base/entity-service';
import { addError } from 'js/datadog';
import fetcher, { getData } from 'js/base/fetch';
import { _Model, Model, Collection } from './entities/interactions';
import { CONTRACT_PATIENT_ID, FIELD_NAME, composerContext, isPrototypeTarget, readContext, sendResource } from './messaging-prototype/contract';
import { readSnapshot } from './messaging-prototype/history';
import { attemptScope, attemptedSend, retainAttempt, clearAttempt } from './messaging-prototype/send-attempts';
import { rememberConfirmation } from './messaging-prototype/confirmed-sends';

const pending = new Set();
const contextRequests = new Map();
const sharedContextReads = new Map();
let nextPostAt = 0;

export function prototypeTarget(patientId) {
  const config = getDatadogLogsOptions();
  return {
    patientId, hostname: _TEST_ && window.__MESSAGING_PROTOTYPE_TEST__ === true ? _MESSAGING_BINDINGS_.hostname : window.location.hostname, stage: config.env, organization: config.organization,
    workspaceId: Radio.request('workspace', 'current')?.id,
  };
}

function reservePost() {
  if (Date.now() < nextPostAt) throw new Error('Wait one second between prototype sends.');
  nextPostAt = Date.now() + 1000;
}

function unconfirmedSend(error, id) {
  const failure = new Error('Recording was not confirmed. Refresh before trying again.', { cause: error });
  const status = get(error, ['response', 'status'], 0);
  failure.interactionId = id;
  failure.outcome = status >= 400 && status < 500 ? 'rejected' : 'uncertain';
  return failure;
}

function confirmResponse(response, responseData, id) {
  if (response.status !== 201 || responseData.data?.id !== id) throw new Error('The API did not confirm this interaction.');
}

function announce(event, payload) {
  try {
    Radio.trigger('messaging-prototype', event, payload);
  } catch(error) {
    addError(error);
  }
}

function sameSession(scope, patientId) {
  try {
    return scope === attemptScope(patientId);
  } catch {
    return false;
  }
}

function requireSession(scope, patientId) {
  if (!sameSession(scope, patientId)) throw new Error('The Messaging session changed before submission.');
}

function consumeContext(entry, signal) {
  signal.throwIfAborted();
  entry.readers++;
  return new Promise((resolve, reject) => {
    let active = true;
    const settle = (callback, value) => {
      if (!active) return;
      active = false;
      signal.removeEventListener('abort', abort);
      if (--entry.readers === 0 && !entry.finished) entry.controller.abort();
      callback(value);
    };
    const abort = () => settle(reject, signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    entry.request.then(value => settle(resolve, value), error => settle(reject, error));
  });
}

const Entity = BaseEntity.extend({
  Entity: { Model, Collection },
  radioRequests: {
    'fetch:messagingPrototype:context': 'fetchContext',
    'fetch:messagingPrototype:actions': 'fetchActions',
    'create:messagingPrototype:interaction': 'sendInteraction',
    'fetch:messagingPrototype:history': 'fetchHistory',
    'reconcile:messagingPrototype:send': 'reconcileSend',
    'update:messagingPrototype:context': 'updateContext',
  },
  getTarget: prototypeTarget,
  requireTarget(patientId) {
    if (!isPrototypeTarget(this.getTarget(patientId))) throw new Error('Messaging prototype is unavailable in this scope.');
  },
  requireWriteTarget(patientId) {
    this.requireTarget(patientId);
    if (patientId !== CONTRACT_PATIENT_ID) throw new Error('This API overlay accepts only its reviewed synthetic patient.');
  },
  async fetchActions({ patientId, value }, { signal }) {
    this.requireTarget(patientId);
    const scope = attemptScope(patientId);
    const projections = readContext(value, patientId).actions;
    // The native patient-actions endpoint contains only standalone actions.
    const actions = await Radio.request('entities', 'fetch:actions:collection:byPatient', { patientId }, { signal, data: { include: 'flow' } });
    signal.throwIfAborted();
    requireSession(scope, patientId);
    const missing = filter(keys(projections), id => !actions.get(id));
    const models = await Promise.all(map(missing, id => Radio.request('entities', 'fetch:actions:model', id, { signal, abort: false })));
    signal.throwIfAborted();
    requireSession(scope, patientId);
    if (some(models, model => model.get?.('_patient')?.id !== patientId)) throw new Error('Messaging action hydration did not return this patient’s native action.');
    actions.add(models);
    return actions;
  },
  fetchHistory({ patientId }, { signal, read }) {
    this.requireTarget(patientId);
    return readSnapshot(async page => {
      this.requireTarget(patientId);
      const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', { patientId, ...page }, { signal, read });
      return collection.models;
    }, { signal });
  },
  async fetchContext(query, options) {
    return (await this.fetchContextResource(query, options)).value;
  },
  async fetchContextResource(query, { signal, fresh = false, readKey }) {
    const { patientId } = query;
    signal.throwIfAborted();
    this.requireTarget(patientId);
    const scope = attemptScope(patientId);
    let entry = !fresh && sharedContextReads.get(scope);
    if (!entry || entry.controller.signal.aborted || entry.readKey !== readKey) entry = this.startContextRead(query, scope, !fresh, readKey);
    return consumeContext(entry, signal);
  },
  startContextRead(query, scope, shared, readKey) {
    const { patientId } = query;
    const entry = { controller: new AbortController(), readers: 0, finished: false, readKey };
    const previous = contextRequests.get(patientId) || Promise.resolve();
    const request = previous.catch(() => {}).then(() => {
      requireSession(scope, patientId);
      return this.readContextResource(query, { signal: entry.controller.signal });
    }).then(value => {
      requireSession(scope, patientId);
      return value;
    }).finally(() => {
      entry.finished = true;
      if (contextRequests.get(patientId) === request) contextRequests.delete(patientId);
      if (sharedContextReads.get(scope) === entry) sharedContextReads.delete(scope);
    });
    entry.request = request;
    contextRequests.set(patientId, request);
    if (shared) sharedContextReads.set(scope, entry);
    return entry;
  },
  async readContextResource({ patientId }, { signal }) {
    signal.throwIfAborted();
    this.requireTarget(patientId);
    const field = Radio.request('entities', 'patientFields:model', {
      name: FIELD_NAME, _patient: { id: patientId, type: 'patients' },
    });
    const response = await fetcher(field.url(), { signal });
    // A superseding GET may abort the shared fetcher even when this consumer's
    // signal was not cancelled. Never reuse the field model's previous value.
    if (!response) throw new Error('Messaging context refresh was interrupted.');
    const responseData = await getData(response, 'json');
    signal.throwIfAborted();
    this.requireTarget(patientId);
    if (!response.ok) throw { response, responseData };
    const resource = responseData.data;
    if (resource?.type !== 'patient-fields' || typeof resource.id !== 'string' || !resource.id) throw new Error('Messaging context resource identity is missing.');
    return { id: resource.id, value: readContext(resource.attributes?.value, patientId) };
  },
  async sendInteraction({ patientId, action = null, body, recipientNumber }, { signal }) {
    signal.throwIfAborted();
    this.requireWriteTarget(patientId);
    const scope = attemptScope(patientId);
    const attempt = attemptedSend(patientId);
    if (attempt) throw unconfirmedSend(null, attempt.id);
    if (pending.has(patientId)) throw new Error('A text is already being recorded.');
    pending.add(patientId);
    try {
      const data = await this.prepareSend({ patientId, action, body, recipientNumber }, { signal });
      requireSession(scope, patientId);
      reservePost();
      retainAttempt(scope, data.id);
      return await this.recordInteraction(patientId, data, { signal, scope });
    } finally {
      pending.delete(patientId);
    }
  },
  async prepareSend({ patientId, action, body, recipientNumber }, { signal }) {
    const value = await this.fetchContext({ patientId }, { signal, fresh: true });
    signal.throwIfAborted();
    const context = composerContext({ value, patientId, action });
    if (!context.enabled || !find(context.recipients, { number: recipientNumber, eligible: true })) {
      throw new Error('This text cannot be recorded with the current recipient or action state.');
    }
    this.requireTarget(patientId);
    return sendResource({
      id: uuid(), patientId, actionId: context.actionId, body, recipientNumber, occurredAt: new Date().toISOString(),
    });
  },
  async recordInteraction(patientId, data, { signal, scope }) {
    let responseData;
    try {
      const response = await fetcher(`/api/patients/${ patientId }/interactions`, {
        method: 'POST', data: JSON.stringify({ data }), signal,
      });
      if (!response) throw new Error('The request ended without a confirmation.');
      if (!response.ok) throw { response };
      responseData = await getData(response, 'json');
      confirmResponse(response, responseData, data.id);
    } catch(error) {
      const failure = unconfirmedSend(error, data.id);
      if (failure.outcome === 'rejected') clearAttempt(scope, data.id);
      else announce('send:uncertain', { patientId, interactionId: data.id });
      throw failure;
    }
    clearAttempt(scope, data.id);
    return this.acceptConfirmation(patientId, responseData, scope);
  },
  acceptConfirmation(patientId, responseData, scope) {
    if (!sameSession(scope, patientId)) {
      const detached = new _Model();
      detached.set(detached.parseModel(responseData.data));
      return detached;
    }
    const model = this.getModel(responseData.data.id);
    model.set(model.parse(responseData));
    rememberConfirmation(patientId, model);
    // An observer failure cannot turn an acknowledged POST into an unsent text.
    announce('interaction:recorded', { patientId, model });
    return model;
  },
  async reconcileSend({ patientId }, { signal }) {
    this.requireTarget(patientId);
    const attempt = attemptedSend(patientId);
    if (!attempt) return { confirmed: true };
    const scope = attemptScope(patientId);
    const collection = await Radio.request('entities', 'fetch:interactions:collection:byPatient', { patientId, at: attempt.id, limit: 1 }, { signal });
    signal.throwIfAborted();
    this.requireTarget(patientId);
    const model = collection.get(attempt.id);
    if (!model) return { confirmed: false, interactionId: attempt.id };
    if (scope !== attemptScope(patientId)) return { confirmed: false, interactionId: attempt.id };
    clearAttempt(scope, attempt.id);
    rememberConfirmation(patientId, model);
    announce('interaction:recorded', { patientId, model });
    return { confirmed: true, model };
  },
  async updateContext({ patientId, revision, operation, number, state, dnc }, { signal }) {
    this.requireWriteTarget(patientId);
    const scope = attemptScope(patientId);
    if (!Number.isInteger(revision)) throw new Error('Refresh Messaging preferences before editing.');
    const intent = operation === 'set_dnc' ? { operation, revision, dnc } : { operation, revision, number, state };
    if (!['set_consent', 'set_dnc'].includes(operation)) throw new Error('Unsupported Messaging preference change.');
    announce('context:changing', { patientId });
    try {
      const field = await this.fetchContextResource({ patientId }, { signal, fresh: true });
      signal.throwIfAborted();
      requireSession(scope, patientId);
      this.requireWriteTarget(patientId);
      const response = await fetcher(`/api/patients/${ patientId }/fields/${ FIELD_NAME }`, {
        method: 'PATCH', data: JSON.stringify({ data: { id: field.id, type: 'patient-fields', attributes: { value: intent } } }), signal,
      });
      if (!response) throw new Error('Preference update was not confirmed. Refresh before trying again.');
      const body = await getData(response, 'json');
      if (!response.ok) throw { response, responseData: body };
      return readContext(body.data?.attributes?.value, patientId);
    } finally {
      announce('context:changed', { patientId });
    }
  },
});

export default new Entity();
