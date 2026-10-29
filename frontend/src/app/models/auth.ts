export interface LoginRequest {
  username: string;
  password: string;
}

/** POST /api/auth/login. There is no refresh token: the session ends when the token expires. */
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  username: string;
  roles: string[];
}
