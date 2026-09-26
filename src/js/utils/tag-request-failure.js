export default function tagRequestFailure(resource, request) {
  return request.catch(error => Promise.reject({ resource, error }));
}
