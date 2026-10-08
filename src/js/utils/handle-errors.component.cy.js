import handleErrors from './handle-errors';

context('handleErrors', function() {
  specify('thrown error', function() {
    const thrownError = new Error('test error');

    return handleErrors(thrownError).then(() => {
      throw new Error('Expected the thrown error to reject');
    }, error => {
      expect(error).to.equal(thrownError);
      expect(error.message).to.equal('test error');
    });
  });

  specify('response error', function() {
    const fakeResponseError = {
      response: {
        status: 400,
      },
      responseData: {
        errors: [{ details: 'fake error' }],
      },
    };

    return Promise.all([
      handleErrors({ response: { status: 500 } }).then(() => {
        throw new Error('Expected the 500 response to reject');
      }, error => {
        expect(error.message).to.equal('Error Status: 500 - undefined');
      }),
      handleErrors(fakeResponseError).then(() => {
        throw new Error('Expected the 400 response to reject');
      }, error => {
        expect(error.message).to.equal('Error Status: 400 - [{"details":"fake error"}]');
      }),
    ]);
  });

  specify('unknown error', function() {
    return handleErrors({ foo: 'error' }).then(() => {
      throw new Error('Expected the unknown error to reject');
    }, error => {
      expect(error.message).to.equal('{"foo":"error"}');
    });
  });
});
