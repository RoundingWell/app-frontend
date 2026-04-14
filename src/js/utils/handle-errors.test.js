import { describe, it, expect } from 'vitest';

import handleErrors from 'js/utils/handle-errors';

describe('handleErrors', () => {
  it('rethrows thrown errors', () => {
    return expect(handleErrors(new Error('test error'))).rejects.toThrow('test error');
  });

  it('formats response errors from responseData', () => {
    const fakeResponseError = {
      response: {
        status: 400,
      },
      responseData: {
        errors: [{ details: 'fake error' }],
      },
    };

    return expect(handleErrors(fakeResponseError)).rejects.toThrow(
      'Error Status: 400 - [{"details":"fake error"}]',
    );
  });

  it('formats empty responseData error arrays', () => {
    const fakeResponseError = {
      response: {
        status: 500,
      },
      responseData: {
        errors: [],
      },
    };

    return expect(handleErrors(fakeResponseError)).rejects.toThrow(
      'Error Status: 500 - []',
    );
  });

  it('stringifies unknown errors', () => {
    return expect(handleErrors({ foo: 'error' })).rejects.toThrow('{"foo":"error"}');
  });
});
