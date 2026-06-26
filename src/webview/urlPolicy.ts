export const HEALZ_URL = 'https://app.healz.ai';
export const HEALZ_CHAT_URL = `${HEALZ_URL}/app/chat`;

export type UrlDisposition = 'internal' | 'external' | 'blocked';

const EXTERNAL_PROTOCOLS = new Set([
  'geo:',
  'http:',
  'https:',
  'mailto:',
  'sms:',
  'tel:',
]);

export function classifyUrl(rawUrl: string): UrlDisposition {
  if (rawUrl === 'about:blank') {
    return 'internal';
  }

  if (rawUrl.startsWith(`blob:${HEALZ_URL}`)) {
    return 'internal';
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol === 'https:' && url.hostname === 'app.healz.ai') {
      return 'internal';
    }

    if (EXTERNAL_PROTOCOLS.has(url.protocol)) {
      return 'external';
    }
  } catch {
    return 'blocked';
  }

  return 'blocked';
}

export function isHealzChatUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'app.healz.ai' &&
      (url.pathname === '/app/chat' || url.pathname.startsWith('/app/chat/'))
    );
  } catch {
    return false;
  }
}
