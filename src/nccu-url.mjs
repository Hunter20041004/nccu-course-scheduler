export function trustedNccuUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const officialHost = url.hostname === 'nccu.edu.tw' || url.hostname.endsWith('.nccu.edu.tw');
    return url.protocol === 'https:' && officialHost ? url.href : '';
  } catch {
    return '';
  }
}
