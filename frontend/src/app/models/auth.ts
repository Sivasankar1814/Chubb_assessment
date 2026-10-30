import { Role } from './enums';

export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * POST /api/auth/register, no token needed. The same person, role and sign-in fields as a staff-created user, and
 * nothing more: the account is always active and an officer gets the server's default capacity.
 */
export interface RegisterRequest {
  username: string;
  password: string;
  role: Role;
  fullName: string;
  email: string;
  phone?: string;
}

/** POST /api/auth/reset-password, no token needed: the email must be the one the account was registered with. */
export interface ResetPasswordRequest {
  username: string;
  email: string;
  newPassword: string;
}

/** POST /api/auth/login. There is no refresh token: the session ends when the token expires. */
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  username: string;
  roles: string[];
}
