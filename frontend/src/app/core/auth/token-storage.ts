import { Injectable } from '@angular/core';
import { isRole, Role } from '../../models/enums';

export interface StoredSession {
  token: string;
  username: string;
  roles: Role[];
  /** Epoch milliseconds. */
  expiresAt: number;
}

const KEY = 'claims.session';

/**
 * Keeps the session in sessionStorage: it survives a refresh but dies with the tab. Storage can be missing or
 * throw (private windows, blocked site data), so every access is guarded and the app works without it.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  read(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) {
        return null;
      }
      const value: unknown = JSON.parse(raw);
      return isStoredSession(value) ? value : null;
    } catch {
      return null;
    }
  }

  write(session: StoredSession): void {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // the session then lives in memory only and a refresh signs the user out
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v['token'] === 'string' &&
    typeof v['username'] === 'string' &&
    typeof v['expiresAt'] === 'number' &&
    Array.isArray(v['roles']) &&
    v['roles'].every(isRole)
  );
}
