import { afterEach, describe, expect, it, vi } from 'vitest';

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

import Forms from 'js/entities-service/forms';
import BaseModel from 'js/base/model';

describe('Forms entity service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    fetcher.mockReset();
    handleJSON.mockClear();
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
});
