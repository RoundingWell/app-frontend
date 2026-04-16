import { afterEach, describe, expect, it, vi } from 'vitest';

import FormResponses from 'js/entities-service/form-responses';
import { Model as FormResponseModel } from 'js/entities-service/entities/form-responses';

describe('Form responses entity service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty or fetched form responses', async() => {
    const fetchModelSpy = vi.spyOn(FormResponses, 'fetchModel').mockResolvedValue('model');

    expect(FormResponses.fetchFormResponse()).toBeInstanceOf(FormResponseModel);
    await expect(FormResponses.fetchFormResponse('response-1', { data: { expand: true } })).resolves.toBe('model');

    expect(fetchModelSpy).toHaveBeenCalledTimes(1);
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
});
