import tagRequestFailure from './tag-request-failure';

context('Tag Request Failure', function() {
  specify('preserves a successful response', async function() {
    const response = {};

    expect(await tagRequestFailure('patient', Promise.resolve(response))).to.equal(response);
  });

  specify('identifies the failed resource and preserves the original error', async function() {
    const error = new Error('Request failed');
    const failure = await tagRequestFailure('patient', Promise.reject(error)).catch(value => value);

    expect(failure).to.deep.equal({ resource: 'patient', error });
    expect(failure.error).to.equal(error);
  });
});
