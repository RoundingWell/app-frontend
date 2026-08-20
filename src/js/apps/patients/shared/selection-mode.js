import { compact, filter, values } from 'underscore';
import hbs from 'handlebars-inline-precompile';

import intl, { renderTemplate } from 'js/i18n';
import { PHONE_QUERY } from 'js/utils/responsive';

const SelectionLabelTemplates = {
  action: {
    deselect: hbs`{{formatMessage (intlGet "patients.shared.actionsViews.deselectActionContext") itemName=itemName patientName=patientName}}`,
    select: hbs`{{formatMessage (intlGet "patients.shared.actionsViews.selectActionContext") itemName=itemName patientName=patientName}}`,
  },
  flow: {
    deselect: hbs`{{formatMessage (intlGet "patients.shared.actionsViews.deselectFlowContext") itemName=itemName patientName=patientName}}`,
    select: hbs`{{formatMessage (intlGet "patients.shared.actionsViews.selectFlowContext") itemName=itemName patientName=patientName}}`,
  },
};

function getSelectedCount(state) {
  return filter(values(state.getSelectedList()), Boolean).length;
}

function getSelectionLabels(model, type) {
  const patient = model.getPatient();
  const itemName = model.get('name');
  const patientName = patient?.get('full_name') || compact([
    patient?.get('first_name'),
    patient?.get('last_name'),
  ]).join(' ');
  const labels = intl.patients.shared.actionsViews;

  if (!itemName || !patientName) {
    const itemType = `${ type[0].toUpperCase() }${ type.slice(1) }`;

    return {
      deselectLabel: labels[`deselect${ itemType }`],
      selectLabel: labels[`select${ itemType }`],
    };
  }

  const context = {
    itemName,
    patientName,
  };
  const templates = SelectionLabelTemplates[type];

  return {
    deselectLabel: renderTemplate(templates.deselect, context),
    selectLabel: renderTemplate(templates.select, context),
  };
}

function isPhoneSelectionMode(state) {
  return state.get('isSelectionMode') && isPhoneViewport();
}

function isPhoneViewport() {
  return window.matchMedia(PHONE_QUERY).matches;
}

function selectInSelectionMode(view, event, domEvent) {
  if (!view.canEdit || !isPhoneSelectionMode(view.state)) return false;

  event = typeof event?.preventDefault === 'function' ? event : domEvent;
  event?.preventDefault();
  event?.stopImmediatePropagation();
  view.triggerMethod('select', view, !!event?.shiftKey);

  return true;
}

function syncSelectionMode(view) {
  const isSelectionMode = isPhoneSelectionMode(view.state) && view.canEdit;

  view.$el.toggleClass('is-selection-mode', isSelectionMode);
  view.$('.work-card__surface, .schedule-list__day-card').prop('inert', isSelectionMode);
}

function syncSelectionCheck(view) {
  if (!view.canEdit) return;

  const isSelected = view.state.isSelected(view.model);

  view.toggleSelected(isSelected);
  view.checkComponent?.setState('isSelected', isSelected);
}

function bindSelectionModeViewport(view) {
  view.selectionModeQuery = window.matchMedia(PHONE_QUERY);
  view.onSelectionModeViewportChange = ({ matches }) => {
    if (matches && getSelectedCount(view.model)) {
      view.model.enterSelectionMode();
    } else if (!matches) {
      view.model.set('isSelectionMode', false);
    }
  };
  view.selectionModeQuery.addEventListener('change', view.onSelectionModeViewportChange);
  view.onSelectionModeViewportChange(view.selectionModeQuery);
}

function unbindSelectionModeViewport(view) {
  view.selectionModeQuery.removeEventListener('change', view.onSelectionModeViewportChange);
}

export {
  bindSelectionModeViewport,
  getSelectedCount,
  getSelectionLabels,
  isPhoneViewport,
  selectInSelectionMode,
  syncSelectionCheck,
  syncSelectionMode,
  unbindSelectionModeViewport,
};
