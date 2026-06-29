import type {
  FixtureStatus,
  PlayerAbilityRating,
  PlayerLifecycleStatus,
  PlayerPosition,
  PreferredFoot,
  RegistrationStatus,
  SeasonFormat,
  SeasonPhase,
  UserRole
} from "./enums.js";

export interface ProfileDto {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export interface LeagueDto {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  organizer_name: string | null;
  country: string | null;
  description: string | null;
}

export interface SeasonDto {
  id: string;
  league_id: string;
  name: string;
  season_year: number | null;
  registration_start_date: string | null;
  registration_deadline: string | null;
  format: SeasonFormat;
  round_format?: SeasonFormat | null;
  fixture_status?: string | null;
  phase: SeasonPhase;
  start_date: string | null;
  end_date: string | null;
  total_teams: number | null;
  min_players_per_team: number | null;
  max_players_per_team: number | null;
  lineup_size: number | null;
  substitute_limit: number | null;
  lineup_submission_deadline_hours: number | null;
  group_count: number | null;
  teams_per_group: number | null;
  qualifiers_per_group: number | null;
  best_third_place_teams: number | null;
  total_knockout_teams: number | null;
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
  ability_rating?: PlayerAbilityRating | null;
  preferred_foot?: PreferredFoot | null;
  player_status?: PlayerLifecycleStatus | null;
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
