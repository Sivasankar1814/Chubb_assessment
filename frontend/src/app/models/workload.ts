import { WorkloadLevel } from './enums';

export interface OfficerWorkload {
  officerId: number;
  fullName: string;
  /** Display only, and empty for an officer registered without one. */
  specialization?: string | null;
  maxCapacity: number;
  openClaims: number;
  availableCapacity: number;
  utilizationPercent: number;
  level: WorkloadLevel;
}
