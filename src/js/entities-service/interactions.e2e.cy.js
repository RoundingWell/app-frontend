import { getInteraction } from 'support/api/interactions';
import { getPatient } from 'support/api/patients';

context('patient interaction service', function() {
  specify('fetches patient rows through Radio when request options are omitted', function() {
    const patient = getPatient();
    const older = getInteraction({ attributes: { channel: 'voice', occurred_at: '2026-10-08T10:00:00Z', metadata: { note: 'Older service row' } } });
    const middle = getInteraction({ attributes: { channel: 'voice', occurred_at: '2026-10-08T11:00:00Z', metadata: { note: 'Middle service row' } } });
    const newest = getInteraction({ attributes: { channel: 'voice', occurred_at: '2026-10-08T12:00:00Z', metadata: { note: 'Newest service row' } } });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = [middle, older, newest];
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`)
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .window()
      .then(win => {
        let request;
        expect(() => {
          request = win.Radio.request('entities', 'fetch:interactions:collection:byPatient', { patientId: patient.id, limit: 2 });
        }, 'the public patient collection request accepts omitted options').not.to.throw();
        return request;
      })
      .then(collection => {
        expect(collection.pluck('id'), 'the request fetches the newest two patient rows').to.deep.equal([newest.id, middle.id]);
        expect(collection.first().getTimestamp(), 'the response is parsed as interaction models').to.equal('2026-10-08T12:00:00Z');
        expect(collection.first().get('metadata').note).to.equal('Newest service row');
      });
  });
});
