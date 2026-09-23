import { isError } from 'underscore';

export default async function handleErrors(error) {
  if (isError(error)) throw error;

  if (error.response) {
    const status = error.response.status;
    const errors = error.responseData?.errors;
    /* istanbul ignore next: can't get coverage on a throw */
    throw new Error(`Error Status: ${ status } - ${ JSON.stringify(errors) }`);
  }
  throw new Error(JSON.stringify(error));
}
