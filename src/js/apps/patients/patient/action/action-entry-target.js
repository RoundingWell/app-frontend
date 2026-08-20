let pendingTarget;

export function setActionEntryTarget(actionId, target) {
  pendingTarget = { actionId, ...target };
}

export function takeActionEntryTarget(actionId) {
  const target = pendingTarget;

  pendingTarget = null;

  return target?.actionId === actionId ? target : null;
}
