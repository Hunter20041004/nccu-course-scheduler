const PRIVATE_KEYS = new Set([
  'apiKey',
  'profileText',
  'futureDirection',
  'semesterGoals',
  'preferences',
  'screenshot',
  'image',
]);

function safeClone(value) {
  if (Array.isArray(value)) return value.map(safeClone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_KEYS.has(key))
      .map(([key, nested]) => [key, safeClone(nested)]),
  );
}

export function createPlannerUndo({ now = Date.now, ttlMs = 15_000 } = {}) {
  let entry = null;

  function current() {
    if (!entry || now() > entry.expiresAt) {
      entry = null;
      return null;
    }
    return entry;
  }

  return {
    capture(snapshot, label) {
      entry = {
        snapshot: safeClone(snapshot),
        label,
        expiresAt: now() + ttlMs,
      };
    },
    peek() {
      const available = current();
      return available
        ? {
          available: true,
          label: available.label,
          remainingMs: Math.max(0, available.expiresAt - now()),
        }
        : { available: false };
    },
    restore() {
      const available = current();
      if (!available) return null;
      entry = null;
      return safeClone(available.snapshot);
    },
    clear() {
      entry = null;
    },
  };
}
