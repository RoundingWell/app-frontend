import { Radio } from 'marionette';

const CHANNELS = ['voice', 'voicemail', 'video', 'appointment', 'visit'];
const PAGE_SIZE = 100;

// The activity owner supplies its startup signal and commits the complete result.
export default async function loadActivityInteractions({ patientId, actionId, flowId }, { signal }) {
  let models = [];
  let before;
  while (true) {
    const page = await Radio.request('entities', 'fetch:interactions:collection:byPatient', {
      patientId, actionId, flowId, channels: CHANNELS, before, limit: PAGE_SIZE,
    }, { signal });
    signal.throwIfAborted();
    models = models.concat(page.models);
    if (page.length < PAGE_SIZE) return models;
    const cursor = page.last().id;
    if (cursor === before) throw new Error('Interaction activity pagination did not advance');
    before = cursor;
  }
}
