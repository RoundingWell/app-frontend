export const EIGHTBYEIGHT_ORIGIN = 'https://cloud8.8x8.com';

export const EIGHTBYEIGHT_CTI_URL = `${ EIGHTBYEIGHT_ORIGIN }/mashell/public/index.html?env=embeddable&nextgen=true`;

export function buildStartCallMessage(phoneNumber) {
  return {
    eventName: 'maEvent',
    family: 'external',
    content: {
      eventName: 'startCall',
      method: 'mapDirective',
      phoneNumber,
    },
    schemaVersion: '1.0.0',
  };
}
