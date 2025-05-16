import handleErrors from './handle-errors';

context('handleErrors', function() {
  specify('thrown error', function() {
    handleErrors(new Error('test error')).catch(error => {
      expect(error.message).to.equal('test error');
    });
  });

  specify('response error', function() {
    const fakeResponseError = {
      status: 400,
      async json() {
        return Promise.resolve({
          errors: [{ details: 'fake error' }],
        });
      },
    };

    handleErrors({ response: fakeResponseError }).catch(error => {
      expect(error.message).to.equal('Error Status: 400 - [{"details":"fake error"}]');
    });
  });

  specify('unknown error', function() {
    handleErrors({ foo: 'error' }).catch(error => {
      expect(error.message).to.equal('{"foo":"error"}');
    });
  });
});
