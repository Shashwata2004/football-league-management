export const UserRole = {
  USER: "USER",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const RoleRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type RoleRequestStatus =
  (typeof RoleRequestStatus)[keyof typeof RoleRequestStatus];

export const SeasonFormat = {
  SINGLE_ROUND_ROBIN: "SINGLE_ROUND_ROBIN",
  DOUBLE_ROUND_ROBIN: "DOUBLE_ROUND_ROBIN",
  GROUP_STAGE_KNOCKOUT: "GROUP_STAGE_KNOCKOUT",
} as const;
export type SeasonFormat = (typeof SeasonFormat)[keyof typeof SeasonFormat];

export const SeasonPhase = {
  REGISTRATION_OPEN: "REGISTRATION_OPEN",
  REGISTRATION_CLOSED: "REGISTRATION_CLOSED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;
export type SeasonPhase = (typeof SeasonPhase)[keyof typeof SeasonPhase];

export const PlayerAbilityRating = {
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH: "HIGH",
} as const;
export type PlayerAbilityRating =
  (typeof PlayerAbilityRating)[keyof typeof PlayerAbilityRating];

export const PreferredFoot = {
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  BOTH: "BOTH",
  UNKNOWN: "UNKNOWN",
} as const;
export type PreferredFoot = (typeof PreferredFoot)[keyof typeof PreferredFoot];

export const PlayerLifecycleStatus = {
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REMOVED: "REMOVED",
  SUSPENDED: "SUSPENDED",
} as const;
export type PlayerLifecycleStatus =
  (typeof PlayerLifecycleStatus)[keyof typeof PlayerLifecycleStatus];

export const RegistrationStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type RegistrationStatus =
  (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const IdentityMode = {
  GENERATED: "GENERATED",
  VERIFIED: "VERIFIED",
} as const;
export type IdentityMode = (typeof IdentityMode)[keyof typeof IdentityMode];

export const FixtureStatus = {
  SCHEDULED: "SCHEDULED",
  WAITING_FOR_TEAMS: "WAITING_FOR_TEAMS",
  LINEUP_PENDING: "LINEUP_PENDING",
  LINEUPS_SUBMITTED: "LINEUPS_SUBMITTED",
  LINEUPS_CONFIRMED: "LINEUPS_CONFIRMED",
  READY_TO_SIMULATE: "READY_TO_SIMULATE",
  SIMULATED: "SIMULATED",
  SIMULATED_PENDING_ADMIN_CONFIRMATION: "SIMULATED_PENDING_ADMIN_CONFIRMATION",
  COMPLETED: "COMPLETED",
  FINAL: "FINAL",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
} as const;
export type FixtureStatus = (typeof FixtureStatus)[keyof typeof FixtureStatus];

export const VenueSide = {
  HOME: "HOME",
  AWAY: "AWAY",
} as const;
export type VenueSide = (typeof VenueSide)[keyof typeof VenueSide];

export const PlayerPosition = {
  GK: "GK",
  DEF: "DEF",
  MID: "MID",
  FWD: "FWD",
} as const;
export type PlayerPosition =
  (typeof PlayerPosition)[keyof typeof PlayerPosition];

export const FootballPosition = {
  GK: "GK",
  CB: "CB",
  LB: "LB",
  RB: "RB",
  DM: "DM",
  CM: "CM",
  AM: "AM",
  LW: "LW",
  RW: "RW",
  ST: "ST",
} as const;
export type FootballPosition =
  (typeof FootballPosition)[keyof typeof FootballPosition];

export const IdType = {
  NID: "NID",
  BIRTH_ID: "BIRTH_ID",
} as const;
export type IdType = (typeof IdType)[keyof typeof IdType];

export const MatchEventType = {
  GOAL: "GOAL",
  ASSIST: "ASSIST",
  YELLOW_CARD: "YELLOW_CARD",
  RED_CARD: "RED_CARD",
  SUBSTITUTION: "SUBSTITUTION",
  PENALTY_GOAL: "PENALTY_GOAL",
  PENALTY_SAVED: "PENALTY_SAVED",
  PENALTY_MISS: "PENALTY_MISS",
  INJURY: "INJURY",
  OWN_GOAL: "OWN_GOAL",
  HIT_WOODWORK: "HIT_WOODWORK",
} as const;
export type MatchEventType =
  (typeof MatchEventType)[keyof typeof MatchEventType];
