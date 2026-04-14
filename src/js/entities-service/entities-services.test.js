import { afterEach, describe, expect, it, vi } from 'vitest';
import { v5 as uuid } from 'uuid';

const { fetcher, handleJSON } = vi.hoisted(() => ({
  fetcher: vi.fn(),
  handleJSON: vi.fn(async response => response.json()),
}));

vi.mock('js/base/fetch', () => {
  return {
    default: (...args) => fetcher(...args),
    handleJSON: (...args) => handleJSON(...args),
  };
});

import Artifacts from 'js/entities-service/artifacts';
import FormResponses from 'js/entities-service/form-responses';
import Forms from 'js/entities-service/forms';
import BaseModel from 'js/base/model';
import { Model as FormResponseModel } from 'js/entities-service/entities/form-responses';
import { Model as Clinician } from 'js/entities-service/entities/clinicians';
import { RWELL_NS } from 'js/static';

describe('entity services', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetcher.mockReset();
    handleJSON.mockClear();
  });

  it('saves artifacts with a deterministic id', async() => {
    const save = vi.fn().mockResolvedValue('saved');
    const getModel = vi.spyOn(Artifacts, 'getModel').mockReturnValue({ save });

    const result = await Artifacts.saveModel({
      artifact: 'five9-call',
      identifier: 'abc123',
      values: { direction: 'outbound' },
    });

    expect(getModel).toHaveBeenCalledWith({
      artifact: 'five9-call',
      identifier: 'abc123',
      id: uuid('five9-call:abc123', RWELL_NS),
      values: { direction: 'outbound' },
    });
    expect(save).toHaveBeenCalledWith();
    expect(result).toBe('saved');
  });

  it('fetches form definitions and action definitions', async() => {
    fetcher.mockResolvedValue({
      ok: true,
      json: vi.fn()
        .mockResolvedValueOnce({ data: { id: 'form-1' } })
        .mockResolvedValueOnce({ data: { id: 'action-form-1' } }),
    });

    await expect(Forms.fetchDefinition('form-1')).resolves.toEqual({ data: { id: 'form-1' } });
    await expect(Forms.fetchDefinitionByAction('action-1')).resolves.toEqual({ data: { id: 'action-form-1' } });

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/forms/form-1/definition');
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/actions/action-1/form/definition');
    expect(handleJSON).toHaveBeenCalledTimes(2);
  });

  it('fetches form data for actions and patients', async() => {
    const fetchSpy = vi.spyOn(BaseModel.prototype, 'fetch').mockResolvedValue('fetched');

    await expect(Forms.fetchFormData('action-1', 'patient-1', 'form-1')).resolves.toBe('fetched');
    await expect(Forms.fetchFormData(null, 'patient-1', 'form-1')).resolves.toBe('fetched');

    expect(fetchSpy).toHaveBeenNthCalledWith(1, { url: '/api/actions/action-1/form/fields' });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, {
      url: '/api/forms/form-1/fields',
      data: { filter: { patient: 'patient-1' } },
    });
  });

  it('fetches forms by action', async() => {
    const fetchBySpy = vi.spyOn(Forms, 'fetchBy').mockResolvedValue('by-action');

    await expect(Forms.fetchByAction('action-1')).resolves.toBe('by-action');

    expect(fetchBySpy).toHaveBeenCalledWith('/api/actions/action-1/form');
  });

  it('returns empty or fetched form responses', async() => {
    const fetchModelSpy = vi.spyOn(FormResponses, 'fetchModel').mockResolvedValue('model');

    expect(FormResponses.fetchFormResponse()).toBeInstanceOf(FormResponseModel);
    await expect(FormResponses.fetchFormResponse('response-1', { data: { expand: true } })).resolves.toBe('model');

    expect(fetchModelSpy).toHaveBeenCalledWith('response-1', { data: { expand: true } });
  });

  it('returns an empty response model when fetchOrEmpty gets no response', async() => {
    const fetchBySpy = vi.spyOn(FormResponses, 'fetchBy')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('response');

    const emptyModel = await FormResponses.fetchOrEmpty('/empty', { filter: { a: 1 } });
    const response = await FormResponses.fetchOrEmpty('/filled', { filter: { b: 2 } });

    expect(fetchBySpy).toHaveBeenNthCalledWith(1, '/empty', { data: { filter: { a: 1 } } });
    expect(fetchBySpy).toHaveBeenNthCalledWith(2, '/filled', { data: { filter: { b: 2 } } });
    expect(emptyModel).toBeInstanceOf(FormResponseModel);
    expect(response).toBe('response');
  });

  it('builds form response filters for clinician and patient lookups', async() => {
    const fetchOrEmptySpy = vi.spyOn(FormResponses, 'fetchOrEmpty').mockResolvedValue('response');

    await FormResponses.fetchByMe({ actionId: 'action-1' });
    await FormResponses.fetchByMe({ patientId: 'patient-1', formId: 'form-1' });
    await FormResponses.fetchSubmittedByPatient({
      patientId: 'patient-1',
      actionId: 'action-1',
      flowId: 'flow-1',
      formId: 'form-1',
      actionTags: ['tag-1'],
      submittedAt: '2026-04-15',
    });
    await FormResponses.fetchSubmittedByPatient({ patientId: 'patient-2' });

    expect(fetchOrEmptySpy).toHaveBeenNthCalledWith(1, '/api/clinicians/me/form-responses/latest', {
      filter: { action: 'action-1' },
    });
    expect(fetchOrEmptySpy).toHaveBeenNthCalledWith(2, '/api/clinicians/me/form-responses/latest', {
      filter: { patient: 'patient-1', form: 'form-1' },
    });
    expect(fetchOrEmptySpy).toHaveBeenNthCalledWith(3, '/api/patients/patient-1/form-responses/submitted', {
      filter: {
        actions: 'action-1',
        flows: 'flow-1',
        forms: 'form-1',
        action_tags: ['tag-1'],
        submitted_at: '2026-04-15',
      },
    });
    expect(fetchOrEmptySpy).toHaveBeenNthCalledWith(4, '/api/patients/patient-2/form-responses/submitted', {
      filter: {},
    });
  });

  it('validates clinicians without requiring explicit options', () => {
    const clinician = new Clinician();

    expect(clinician.validate({
      name: 'Test Clinician',
      email: 'clinician@example.com',
      _role: { id: 'role-1', type: 'roles' },
    })).toBeUndefined();
  });
});
