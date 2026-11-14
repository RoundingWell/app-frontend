import { contains, extend } from 'underscore';

// This is a presentation contract, not an API or metadata schema. The host
// supplies evidence and translated copy after adapting its interaction model.
export function presentMessage(interaction, currentActionId, adapter) {
  const message = adapter(interaction);
  const hasContent = !!(message.body?.trim() || message.disposition);
  const hidden = (!hasContent && !message.reason) || contains(['consent', 'carrier-response'], message.kind);
  const action = message.action;
  return extend({}, message, {
    hidden,
    action: action && action.id !== currentActionId ? action : undefined,
    scheduled: message.status === 'scheduled',
    failed: message.status === 'failed',
    muted: message.status === 'cancelled' || message.kind === 'auto-reply',
    patient: message.senderKind === 'patient',
    hasContent,
  });
}

// Text is always escaped by Handlebars, including matched URLs. Limit clickable
// schemes to HTTP(S); punctuation outside the URL stays in the message.
export function messageSegments(body = '') {
  const segments = [];
  const pattern = /https?:\/\/[^\s<>"']+/gi;
  let cursor = 0;
  for (const match of body.matchAll(pattern)) {
    const url = match[0].replace(/[.,!?;:)\]}]+$/, '');
    segments.push({ text: body.slice(cursor, match.index) });
    segments.push({ text: url, href: url });
    cursor = match.index + url.length;
  }
  segments.push({ text: body.slice(cursor) });
  return segments;
}
