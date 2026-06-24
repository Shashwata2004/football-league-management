export const UserRole = {
  USER: "USER",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN"
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const RoleRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
} as const;
export type RoleRequestStatus = (typeof RoleRequestStatus)[keyof typeof RoleRequestStatus];

export const SeasonFormat = {
  SINGLE_ROUND_ROBIN: "SINGLE_ROUND_ROBIN",
  DOUBLE_ROUND_ROBIN: "DOUBLE_ROUND_ROBIN",
  GROUP_STAGE_KNOCKOUT: "GROUP_STAGE_KNOCKOUT"
} as const;
export type SeasonFormat = (typeof SeasonFormat)[keyof typeof SeasonFormat];

export const RegistrationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
} as const;
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const FixtureStatus = {
  SCHEDULED: "SCHEDULED",
  LINEUPS_SUBMITTED: "LINEUPS_SUBMITTED",
  LINEUPS_CONFIRMED: "LINEUPS_CONFIRMED",
  SIMULATED_PENDING_ADMIN_CONFIRMATION: "SIMULATED_PENDING_ADMIN_CONFIRMATION",
  FINAL: "FINAL",
  CANCELLED: "CANCELLED"
} as const;
export type FixtureStatus = (typeof FixtureStatus)[keyof typeof FixtureStatus];

export const VenueSide = {
  HOME: "HOME",
  AWAY: "AWAY"
} as const;
export type VenueSide = (typeof VenueSide)[keyof typeof VenueSide];

export const PlayerPosition = {
  GK: "GK",
  DEF: "DEF",
  MID: "MID",
  FWD: "FWD"
} as const;
export type PlayerPosition = (typeof PlayerPosition)[keyof typeof PlayerPosition];

export const IdType = {
  NID: "NID",
  BIRTH_ID: "BIRTH_ID"
} as const;
export type IdType = (typeof IdType)[keyof typeof IdType];

export const MatchEventType = {
  GOAL: "GOAL",
  ASSIST: "ASSIST",
  YELLOW_CARD: "YELLOW_CARD",
  RED_CARD: "RED_CARD",
  SUBSTITUTION: "SUBSTITUTION"
} as const;
export type MatchEventType = (typeof MatchEventType)[keyof typeof MatchEventType];
