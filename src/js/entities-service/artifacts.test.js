import { describe, expect, it, vi } from 'vitest';
import { v5 as uuid } from 'uuid';

import Artifacts from 'js/entities-service/artifacts';
import { RWELL_NS } from 'js/static';

describe('Artifacts entity service', () => {
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
});
