import { Market, Role } from './enums';

/** GET /api/users/me and friends. Fields that do not apply to the role are omitted by the backend. */
export interface User {
  id: number;
  username: string;
  role: Role;
  fullName: string;
  email: string;
  phone?: string;
  active: boolean;
  market?: Market;
  policyNumber?: string;
  specialization?: string;
  maxCapacity?: number;
  createdAt: string;
}

/**
 * POST /api/users. The form sends the same fields for every role: a claim's market is chosen when it is filed, and
 * an officer's capacity is the server's default (5), so it sends no market, policy number, specialization or
 * capacity. The API still accepts all of them, all optional.
 */
export interface CreateUserRequest {
  username: string;
  password: string;
  role: Role;
  fullName: string;
  email: string;
  phone?: string;
  active?: boolean;
  market?: Market;
  policyNumber?: string;
  specialization?: string;
  maxCapacity?: number;
}
