export interface JwtPayload {
  sub?: string;
  iss?: string;
  iat?: number;
  /** Seconds since the epoch. */
  exp?: number;
  roles?: unknown;
}

/**
 * Reads a token's payload without verifying it. Only the expiry is used, to time the session; the server
 * validates every token, so nothing here is a security decision.
 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) {
      return null;
    }
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return payload !== null && typeof payload === 'object' ? (payload as JwtPayload) : null;
  } catch {
    return null;
  }
}
