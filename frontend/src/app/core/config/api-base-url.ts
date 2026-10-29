import { InjectionToken } from '@angular/core';

/**
 * Relative on purpose: the dev server and the production nginx both proxy /api to the gateway, so the
 * browser only ever talks to its own origin and CORS never comes into play.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
