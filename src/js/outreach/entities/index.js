import Radio from 'backbone.radio';
import fetcher, { handleJSON } from 'js/base/fetch';
import { v4 as uuid } from 'uuid';

function getRelationship(id, type) {
  return { data: { type, id } };
}

let token;

Radio.reply('auth', {
  setToken(tokenString) {
    token = tokenString;
  },
  getToken() {
    return `Bearer ${ token }`;
  },
});

function getPatientInfo({ actionId }) {
  return fetcher(`/api/outreach?filter[action]=${ actionId }`, {
    method: 'GET',
  })
    .then(handleJSON)
    .then(({ data }) => {
      return {
        outreachId: data.id,
        patientId: data.relationships.patient.data.id,
        patientPhoneEnd: data.attributes.phone_end,
      };
    });
}

function createVerificationCode({ actionId }) {
  return fetcher('/api/outreach/otp', {
    method: 'POST',
    data: JSON.stringify({
      data: {
        type: 'patient-actions',
        id: actionId,
      },
    }),
  })
    .then(handleJSON);
}

function validateVerificationCode({ outreachId, code, patientId }) {
  const data = {
    id: outreachId,
    type: 'outreach',
    attributes: { code },
    relationships: {
      patient: getRelationship(patientId, 'patients'),
    },
  };

  return fetcher('/api/outreach/auth', {
    method: 'POST',
    data: JSON.stringify({ data }),
  })
    .then(handleJSON)
    .then(({ data: { attributes } }) => {
      Radio.request('auth', 'setToken', attributes.token);
      return Promise.resolve(attributes.token);
    });
}

function optInPostRequest(attributes) {
  const data = {
    type: 'patients',
    attributes,
  };

  return fetcher('/api/outreach', {
    method: 'POST',
    data: JSON.stringify({ data }),
  })
    .then(handleJSON);
}

function postResponse({ formId, actionId, response }) {
  const data = {
    type: 'form-responses',
    id: uuid(),
    attributes: { response },
    relationships: {
      action: getRelationship(actionId, 'patient-actions'),
      form: getRelationship(formId, 'forms'),
    },
  };

  return fetcher(`/api/actions/${ actionId }/relationships/form-responses`, {
    method: 'POST',
    data: JSON.stringify({ data }),
  })
    .then(handleJSON);
}

export {
  getPatientInfo,
  postResponse,
  optInPostRequest,
  createVerificationCode,
  validateVerificationCode,
};
