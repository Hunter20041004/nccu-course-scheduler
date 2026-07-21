const USER_OWNED_FIELDS = Object.freeze([
  'id',
  'attendance',
  'userNote',
  'selectedArrangementId',
  'selectedSectionId',
]);

export function reconcileOfficialCandidate(existing, incoming) {
  const reconciled = { ...existing, ...incoming };
  for (const field of USER_OWNED_FIELDS) {
    if (Object.hasOwn(existing, field)) reconciled[field] = existing[field];
  }
  return reconciled;
}
