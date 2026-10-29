import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl } from '@angular/forms';

/**
 * One shape for every failure. The backend sends ApiError {status, error, message, path, details[]}, but its
 * 401 entry point sends only {status, error, message}, and a network failure sends no body at all.
 */
export interface ApiProblem {
  status: number;
  message: string;
  details: string[];
  /** "field: message" entries from a 400, keyed by field name. */
  fieldErrors: Record<string, string>;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Cannot reach the server. Check your connection and try again.',
  400: 'Some of the information is not valid.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That action isn't possible in the current state.",
};

const SERVER_FAULT = 'Something went wrong on our side. Please try again in a moment.';
const UNKNOWN = 'Something went wrong. Please try again.';
const DETAIL_PATTERN = /^([\w.[\]]+):\s*(.+)$/;

export function toApiProblem(err: unknown): ApiProblem {
  if (!(err instanceof HttpErrorResponse)) {
    return { status: -1, message: UNKNOWN, details: [], fieldErrors: {} };
  }

  const body = err.error as Record<string, unknown> | string | null;
  const record = body !== null && typeof body === 'object' ? body : {};
  const details = Array.isArray(record['details'])
    ? record['details'].filter((d): d is string => typeof d === 'string')
    : [];

  const fieldErrors: Record<string, string> = {};
  for (const detail of details) {
    const match = DETAIL_PATTERN.exec(detail);
    if (match && !(match[1] in fieldErrors)) {
      fieldErrors[match[1]] = match[2];
    }
  }

  // Never show a 5xx body: it can name internal services.
  if (err.status >= 500) {
    return { status: err.status, message: SERVER_FAULT, details: [], fieldErrors: {} };
  }

  const serverMessage = typeof record['message'] === 'string' ? record['message'] : '';
  const message =
    err.status === 400 && serverMessage === 'Validation failed'
      ? FALLBACK_MESSAGES[400]
      : serverMessage || FALLBACK_MESSAGES[err.status] || UNKNOWN;

  return { status: err.status, message, details, fieldErrors };
}

/**
 * Puts a 400's field errors on the matching controls (shown by <mat-error> as the "server" error) and returns
 * the details that matched no control, to show at form level.
 */
export function applyFieldErrors(
  controls: Record<string, AbstractControl | null | undefined>,
  problem: ApiProblem,
): string[] {
  const unmatched: string[] = [];
  for (const detail of problem.details) {
    const match = DETAIL_PATTERN.exec(detail);
    const control = match ? controls[match[1]] : undefined;
    if (match && control) {
      control.setErrors({ server: match[2] });
      control.markAsTouched();
    } else {
      unmatched.push(detail);
    }
  }
  return unmatched;
}
