import { trustedNccuUrl } from './nccu-url.mjs';

export function officialSyllabusState({ sourceUrl, lookupStatus, checkedAt = null }) {
  const url = trustedNccuUrl(sourceUrl);
  if (lookupStatus === 'success' && url) return { status: 'available', url, checkedAt };
  if (lookupStatus === 'success') return { status: 'not_uploaded', url: '', checkedAt };
  return { status: 'unverified', url: '', checkedAt };
}
