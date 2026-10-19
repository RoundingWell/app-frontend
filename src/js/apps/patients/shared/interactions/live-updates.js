import { contains } from 'underscore';

const CATEGORIES = ['ResourceCreated', 'MetadataUpdated', 'InteractionScheduled', 'InteractionCompleted', 'InteractionCancelled', 'ResourceDeleted'];

export function isPatientInteractionMessage({ category, payload }, patient) {
  return payload?.patient?.id === patient.id && contains(CATEGORIES, category);
}
