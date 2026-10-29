const DEFAULT_URL = '/dashboard';

/** Only same-app paths are followed after login; anything else (an absolute or protocol-relative URL) is dropped. */
export function safeReturnUrl(url: string | null | undefined): string {
  if (
    !url ||
    !url.startsWith('/') ||
    url.startsWith('//') ||
    url.includes('\\') ||
    url.startsWith('/login')
  ) {
    return DEFAULT_URL;
  }
  return url;
}
