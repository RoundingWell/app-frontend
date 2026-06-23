import { composeLocale } from './index';

context('i18n locale composition', function() {
  specify('merges unique top-level namespaces', function() {
    const locale = composeLocale([
      { clinicians: { headingText: 'Clinicians' } },
      { patients: { headingText: 'Patients' } },
    ]);

    expect(locale).to.deep.equal({
      clinicians: { headingText: 'Clinicians' },
      patients: { headingText: 'Patients' },
    });
  });

  specify('rejects duplicate top-level namespaces', function() {
    expect(() => composeLocale([
      { patients: { headingText: 'Patients' } },
      { patients: { emptyText: 'No Patients' } },
    ])).to.throw('Duplicate locale namespace: patients');
  });
});
