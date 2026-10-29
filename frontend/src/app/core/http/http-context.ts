import { HttpContextToken } from '@angular/common/http';

/** No bearer token is attached, and a 401 is the caller's to handle (a wrong password is not an expired session). */
export const PUBLIC_REQUEST = new HttpContextToken<boolean>(() => false);

/** The caller shows the error itself (inline in a form or dialog), so the interceptor stays quiet. */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);
