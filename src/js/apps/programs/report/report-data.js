import { each, map } from 'underscore';
import { Radio } from 'marionette';

import intl from 'js/i18n';

const i18n = intl.programs.report;

export function isPublishedProgram(program) {
  return !!program.get('published_at') && !program.get('archived_at');
}

export function reportMetadata(model) {
  const behavior = model.get('behavior');
  const behaviors = {
    standard: { label: i18n.standardText, icon: 'circle-play' },
    conditional: { label: i18n.conditionalText, icon: 'circle-pause' },
    automated: { label: i18n.automatedText, icon: 'bolt' },
  };

  return {
    status: model.get('archived_at') ? i18n.archivedText : model.get('published_at') ? i18n.publishedText : i18n.unpublishedText,
    behaviorLabel: behaviors[behavior]?.label || behavior || i18n.unspecifiedText,
    behaviorIcon: behaviors[behavior]?.icon || 'circle-question',
    teamNames: relationshipNames(model, 'teams'),
    roleNames: relationshipNames(model, 'roles'),
  };
}

function relationshipNames(model, type) {
  const refs = model.get(`_${ type }`);
  return map(refs, ref => {
    const related = Radio.request('entities', `${ type }:model`, ref.id);
    return related.get('label') || related.get('name') || (type === 'teams' ? i18n.teamUnavailableText : i18n.roleUnavailableText);
  }).join(', ');
}

export function ownerName(owner) {
  if (!owner) return i18n.unassignedText;
  return owner.get('name') || i18n.ownerUnavailableText;
}

export function observeMetadata(view, model) {
  const owner = model.getOwner();
  if (owner) view.listenTo(owner, 'change:name', view.render);

  each(['teams', 'roles'], type => {
    each(model.get(`_${ type }`), ref => {
      const related = Radio.request('entities', `${ type }:model`, ref.id);
      view.listenTo(related, 'change:name change:label', view.render);
    });
  });
}
