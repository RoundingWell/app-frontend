import { describe, expect, it } from 'vitest';

import { Model as Clinician } from 'js/entities-service/entities/clinicians';

describe('Clinician entity', () => {
  it('validates clinicians without requiring explicit options', () => {
    const clinician = new Clinician();

    expect(clinician.validate({
      name: 'Test Clinician',
      email: 'clinician@example.com',
      _role: { id: 'role-1', type: 'roles' },
    })).toBeUndefined();
  });

  it('rejects clinicians without an email address', () => {
    const clinician = new Clinician();

    expect(clinician.validate({
      name: 'Test Clinician',
      _role: { id: 'role-1', type: 'roles' },
    })).toBe('A clinician email address is required');
  });
});
