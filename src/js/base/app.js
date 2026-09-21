export { Application as default } from 'marionette';

export const wrapStartFailure = (resource, request) => {
  return request.catch(error => Promise.reject({ resource, error }));
};
