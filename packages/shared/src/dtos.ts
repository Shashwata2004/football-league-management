import type { FixtureStatus, PlayerPosition, RegistrationStatus, SeasonFormat, UserRole } from "./enums.js";

export interface ProfileDto {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export interface LeagueDto {
  id: string;
  name: string;
  country: string | null;
  description: string | null;
}

export interface SeasonDto {
  id: string;
  league_id: string;
  name: string;
  format: SeasonFormat;
  group_count: number | null;
  qualifiers_per_group: number | null;
  champion_team_registration_id: string | null;
}

export interface TeamRegistrationDto {
  id: string;
  season_id: string;
  team_id: string;
  name: string;
  short_name: string;
  status: RegistrationStatus;
}

export interface PublicPlayerDto {
  id: string;
  player_registration_id: string;
  full_name: string;
  position: PlayerPosition;
  shirt_number: number | null;
}

export interface FixtureDto {
  id: string;
  season_id: string;
  round_no: number;
  stage: string;
  home_team_registration_id: string;
  away_team_registration_id: string;
  kickoff_at: string | null;
  venue: string | null;
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
}

export interface StandingDto {
  team_registration_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  fair_play_score: number;
  admin_draw_rank: number | null;
}
