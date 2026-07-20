"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Ban,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileText,
  GitBranch,
  Home,
  Mail,
  LogOut,
  Menu,
  MessageSquare,
  PlayCircle,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  User,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  FixtureStatus,
  fixtureOutcomeLabel,
  fixtureOutcomeScore,
  RegistrationStatus,
  SeasonFormat,
  SeasonPhase,
  type LeagueDto,
  type ProfileDto,
  type SeasonDto,
} from "@flms/shared";
import { api, publicApi } from "@/lib/api";
import { clearAuth } from "@/lib/auth";
import { OwnGoalIcon } from "@/components/ui/own-goal-icon";
import { PenaltyMissIcon } from "@/components/ui/penalty-miss-icon";
import { KnockoutBracket } from "@/components/knockout-bracket";

type TabId =
  | "dashboard"
  | "teams"
  | "team-requests"
  | "player-requests"
  | "fixtures"
  | "lineups"
  | "matches-ready"
  | "completed-matches"
  | "standings"
  | "reports"
  | "team-stats"
  | "messages"
  | "divide-groups"
  | "groups"
  | "knockout"
  | "settings";

interface TeamRequest {
  id: string;
  team: string;
  logoUrl?: string | null;
  manager: string;
  season: string;
  squad: number;
  status: "Pending" | "Approved" | "Rejected";
}

interface PlayerRequest {
  id: string;
  code: string;
  name: string;
  team: string;
  position: string;
  jersey: number;
  idType: string;
  status: "Pending" | "Approved";
  teamStatus: string;
  abilityRating: AdminPlayer["abilityRating"];
  player?: AdminPlayer | undefined;
}

interface FixtureRow {
  id: string;
  date: string;
  home: string;
  away: string;
  stage: string;
  status: string;
  venue: string;
}

interface PlayerMatchPerformance {
  match: string;
  date: string;
  opponent: string;
  result: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  chancesCreated: number;
  passAccuracy: string;
  successfulDribbles: number;
  tackles: number;
  cards: string;
  rating: string;
}

interface AdminPlayer {
  id: string;
  code: string;
  fullName: string;
  avatar: string;
  avatarUrl?: string | null;
  dateOfBirth: string;
  age: number;
  idType: string;
  maskedId: string;
  uploadedDocument: string;
  jerseyNumber: number;
  position: string;
  footballPosition: string;
  preferredFoot: string;
  approvalStatus: "Pending" | "Approved" | "Rejected";
  playerStatus: "Pending" | "Approved" | "Rejected" | "Removed" | "Suspended";
  registrationDate: string;
  submittedByManager: string;
  adminApprovalDate: string;
  adminMessage: string;
  abilityRating: "Not rated" | "Low" | "Moderate" | "High";
  overallRating: number | null;
  abilityDetails: { label: string; value: string }[];
  leagueStats: {
    matchesPlayed: number;
    starts: number;
    minutesPlayed: number;
    goals: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    shotAccuracy: string;
    chancesCreated: number;
    totalPasses: number;
    accuratePasses: number;
    passAccuracy: string;
    dribblesAttempted: number;
    successfulDribbles: number;
    dispossessed: number;
    tackles: number;
    interceptions: number;
    yellowCards: number;
    redCards: number;
    averageRating: string;
    bestMatchRating: string;
    lowestMatchRating: string;
    playerOfTheMatch: number;
  };
  performances: PlayerMatchPerformance[];
}

interface AdminTeam {
  id: string;
  logo: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  homeJerseyUrl?: string | null;
  awayJerseyUrl?: string | null;
  gkHomeJerseyUrl?: string | null;
  gkAwayJerseyUrl?: string | null;
  name: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  squadCount: number;
  approvedPlayers: number;
  pendingPlayers: number;
  status: "Approved" | "Pending" | "Removed";
  players: AdminPlayer[];
  suspendedPlayers: AdminPlayer[];
  fixtures: FixtureRow[];
  results: { date: string; match: string; result: string; status: string }[];
  messages: { date: string; text: string; type: string; read: string }[];
}

interface StandingTeam {
  name: string;
  short: string;
  logoUrl: string | null;
  color: string;
  points: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  gf: number;
  ga: number;
}

interface CompletedMatchRow {
  id: string;
  date: string;
  home: string;
  away: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  homePrimaryColor?: string | null;
  awayPrimaryColor?: string | null;
  stage: string;
  kickoff: string;
  status: string;
  score: string;
  outcomeLabel: string | null;
}

interface AdminMessageRow {
  manager: string;
  team: string;
  message: string;
  type: string;
  read: string;
}

interface ReadyMatchRow {
  id: string;
  homeTeamRegistrationId?: string | null;
  awayTeamRegistrationId?: string | null;
  home: string;
  away: string;
  homeLogoUrl?: string | null;
  awayLogoUrl?: string | null;
  homePrimaryColor?: string | null;
  awayPrimaryColor?: string | null;
  stage: string;
  kickoff: string;
  status: string;
  submitted_lineups?: number;
  confirmed_lineups?: number;
  can_simulate?: boolean;
}

type AdminPendingLineupRow = {
  id: string;
  fixture_id: string;
  team_registration_id: string;
  formation: string;
  status: string;
  submitted_at?: string | null;
  fixtures?: {
    id: string;
    kickoff_at?: string | null;
    stage?: string | null;
    status?: string | null;
    home_team?: {
      id: string;
      teams?: {
        name?: string | null;
        short_name?: string | null;
        logo_url?: string | null;
      } | null;
    } | null;
    away_team?: {
      id: string;
      teams?: {
        name?: string | null;
        short_name?: string | null;
        logo_url?: string | null;
      } | null;
    } | null;
  } | null;
  team_registrations?: {
    id: string;
    teams?: {
      name?: string | null;
      short_name?: string | null;
      logo_url?: string | null;
    } | null;
  } | null;
};

interface AdminSeasonData {
  teams: AdminTeam[];
  standings: StandingTeam[];
  teamRequests: TeamRequest[];
  playerRequests: PlayerRequest[];
  fixtures: FixtureRow[];
  completedMatches: CompletedMatchRow[];
  messages: AdminMessageRow[];
  readyMatches: ReadyMatchRow[];
  pendingLineups: number;
  topScorer: {
    name: string;
    team: string;
    teamLogoUrl?: string | null;
    avatarUrl?: string | null;
    goals: number;
    matches: number;
  } | null;
  topAssist: {
    name: string;
    team: string;
    teamLogoUrl?: string | null;
    avatarUrl?: string | null;
    assists: number;
    matches: number;
  } | null;
  topRated: {
    name: string;
    team: string;
    teamLogoUrl?: string | null;
    avatarUrl?: string | null;
    rating: string;
    matches: number;
  } | null;
  statsReport: AdminStatsReport;
}

interface StatEntry {
  id: string;
  name: string;
  subLabel: string;
  logoUrl?: string | null;
  teamLogoUrl?: string | null;
  initials: string;
  value: string;
  numericValue: number;
}

interface StatCardData {
  id: string;
  title: string;
  entries: StatEntry[];
}

interface StatSectionData {
  title: string;
  cards: StatCardData[];
}

interface AdminStatsReport {
  player_sections: StatSectionData[];
  team_sections: StatSectionData[];
}

const emptyStatsReport: AdminStatsReport = {
  player_sections: [],
  team_sections: [],
};

const emptyAdminSeasonData: AdminSeasonData = {
  teams: [],
  standings: [],
  teamRequests: [],
  playerRequests: [],
  fixtures: [],
  completedMatches: [],
  messages: [],
  readyMatches: [],
  pendingLineups: 0,
  topScorer: null,
  topAssist: null,
  topRated: null,
  statsReport: emptyStatsReport,
};

type TeamRegistrationApiRow = {
  id: string;
  season_id: string;
  team_id: string;
  manager_id?: string | null;
  status: string;
  created_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  removed_at?: string | null;
  removal_reason?: string | null;
  teams?: {
    name?: string | null;
    short_name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    home_jersey_url?: string | null;
    away_jersey_url?: string | null;
    gk_home_jersey_url?: string | null;
    gk_away_jersey_url?: string | null;
  } | null;
  seasons?: { name?: string | null } | null;
  manager?:
    | { full_name?: string | null; email?: string | null }
    | { full_name?: string | null; email?: string | null }[]
    | null;
};

type PlayerLifecycleAction = "reject" | "remove" | "suspend" | "unsuspend";

type PlayerRegistrationApiRow = {
  id: string;
  player_id: string;
  season_id: string;
  team_registration_id: string;
  position: string;
  shirt_number: number | null;
  status: string;
  ability_rating?: string | null;
  preferred_foot?: string | null;
  player_status?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  removal_reason?: string | null;
  suspension_reason?: string | null;
  created_at?: string | null;
  players?: {
    full_name?: string | null;
    date_of_birth?: string | null;
    id_type?: string | null;
    id_number_last4?: string | null;
    avatar_url?: string | null;
  } | null;
  team_registrations?: {
    status?: string | null;
    teams?: { name?: string | null } | null;
  } | null;
  player_abilities?:
    | {
        rating_tier?: string | null;
        shooting?: number | null;
        passing?: number | null;
        dribbling?: number | null;
        defending?: number | null;
        physical?: number | null;
        pace?: number | null;
        stamina?: number | null;
        shot_stopping?: number | null;
        reflexes?: number | null;
        positioning?: number | null;
        handling?: number | null;
        diving?: number | null;
        distribution?: number | null;
        communication?: number | null;
        overall_rating?: number | null;
      }
    | {
        rating_tier?: string | null;
        shooting?: number | null;
        passing?: number | null;
        dribbling?: number | null;
        defending?: number | null;
        physical?: number | null;
        pace?: number | null;
        stamina?: number | null;
        shot_stopping?: number | null;
        reflexes?: number | null;
        positioning?: number | null;
        handling?: number | null;
        diving?: number | null;
        distribution?: number | null;
        communication?: number | null;
        overall_rating?: number | null;
      }[]
    | null;
  football_position?: string | null;
};

type FixtureApiRow = {
  id: string;
  round_no?: number;
  matchday_number?: number | null;
  stage?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  home_team_registration_id?: string | null;
  away_team_registration_id?: string | null;
  home_source?: string | null;
  away_source?: string | null;
  kickoff_at?: string | null;
  venue?: string | null;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
  extra_time_played?: boolean | null;
  penalties_home?: number | null;
  penalties_away?: number | null;
  penalty_winner_team_registration_id?: string | null;
  result_confirmed?: boolean | null;
  home_team?: {
    id: string;
    teams?: {
      name?: string | null;
      short_name?: string | null;
      logo_url?: string | null;
      primary_color?: string | null;
    } | null;
  } | null;
  away_team?: {
    id: string;
    teams?: {
      name?: string | null;
      short_name?: string | null;
      logo_url?: string | null;
      primary_color?: string | null;
    } | null;
  } | null;
  season_groups?: { id: string; name?: string | null } | null;
};

type AdminFixtureTeam = {
  id: string;
  team_id?: string;
  name?: string | null;
  short_name?: string | null;
  logo_url?: string | null;
};

type AdminFixtureGroup = {
  id: string;
  name: string;
  teams: AdminFixtureTeam[];
};

type FixturePreviewRow = {
  round_no: number;
  matchday_number: number;
  stage: string;
  group_id?: string | null;
  group_name?: string | null;
  home_team_registration_id?: string | null;
  away_team_registration_id?: string | null;
  home_source?: string | null;
  away_source?: string | null;
  kickoff_at?: string | null;
  status: string;
};

type FixturePreviewResponse = {
  fixtures: FixturePreviewRow[];
  warnings: string[];
};

type AdminFixturesResponse = {
  season: SeasonDto & {
    round_format?: SeasonFormat | null;
    fixture_status?: string | null;
  };
  approved_teams: AdminFixtureTeam[];
  groups: AdminFixtureGroup[];
  fixtures: FixtureApiRow[];
  can_regenerate: boolean;
  fixture_status: string;
};

type AdminGroupsResponse = {
  season: SeasonDto;
  approved_teams: AdminFixtureTeam[];
  groups: AdminFixtureGroup[];
  groups_ready: boolean;
};

type MatchDetailLineupPlayer = {
  id: string;
  player_registration_id: string;
  is_starter?: boolean | null;
  football_position?: string | null;
  player_natural_position?: string | null;
  slot_key?: string | null;
  display_role?: string | null;
  is_captain?: boolean | null;
  shirt_number?: number | null;
  player_season_registrations?: {
    id: string;
    shirt_number?: number | null;
    football_position?: string | null;
    position?: string | null;
    players?: { full_name?: string | null; avatar_url?: string | null } | null;
  } | null;
};

type AdminFormationSlot = {
  slotKey: string;
  displayRole: string;
  line: "GK" | "DEF" | "MID" | "ATT";
  x: number;
  y: number;
};

type MatchDetailLineup = {
  id: string;
  team_registration_id: string;
  formation?: string | null;
  playing_style?: string | null;
  status?: string | null;
  captain_id?: string | null;
  formation_slots?: AdminFormationSlot[] | null;
  lineup_players?: MatchDetailLineupPlayer[] | null;
};

function lineupForFixtureTeam(
  lineups: MatchDetailLineup[] | null | undefined,
  teamRegistrationId: string | null | undefined,
) {
  return (
    lineups?.find(
      (lineup) =>
        teamRegistrationId != null &&
        lineup.team_registration_id === teamRegistrationId,
    ) ?? null
  );
}

type MatchDetailTeamStat = {
  id: string;
  fixture_id: string;
  team_registration_id: string;
  rating?: number | string | null;
  possession: number;
  expected_goals?: number | string | null;
  shots: number;
  shots_off_target?: number | null;
  shots_on_target: number;
  hit_woodwork?: number | null;
  big_chances: number;
  big_chances_missed: number;
  passes: number;
  accurate_passes: number;
  offsides?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  blocks?: number | null;
  clearances?: number | null;
  keeper_saves?: number | null;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  corners: number;
};

type MatchDetailPlayerStat = {
  id: string;
  player_registration_id: string;
  minutes: number;
  position_played?: string | null;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target?: number | null;
  chances_created?: number | null;
  big_chances_created?: number | null;
  big_chances_missed?: number | null;
  passes: number;
  accurate_passes: number;
  tackles: number;
  interceptions?: number | null;
  clearances?: number | null;
  blocks?: number | null;
  fouls_committed?: number | null;
  saves: number;
  goals_conceded?: number | null;
  accurate_long_balls?: number | null;
  diving_saves?: number | null;
  saves_inside_box?: number | null;
  dribbles_attempted: number;
  successful_dribbles: number;
  dribbled_past?: number | null;
  dispossessed?: number | null;
  yellow_cards: number;
  red_cards: number;
  rating: number | string;
  player_season_registrations?: {
    id: string;
    shirt_number?: number | null;
    football_position?: string | null;
    position?: string | null;
    players?: { full_name?: string | null; avatar_url?: string | null } | null;
  } | null;
};

type MatchDetailResponse = {
  fixture: FixtureApiRow;
  lineups: MatchDetailLineup[];
  team_stats: MatchDetailTeamStat[];
  player_stats: MatchDetailPlayerStat[];
  events: Record<string, unknown>[];
  substitutions: Record<string, unknown>[];
};

type StandingApiRow = {
  team_registration_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference?: number | null;
  points: number;
  fair_play_score: number;
  admin_draw_rank: number | null;
  head_to_head_points?: number;
  position?: number;
  group_id?: string | null;
  group_name?: string | null;
};

type PlayerSeasonStatApiRow = {
  player_registration_id: string;
  appearances?: number | null;
  starts?: number | null;
  minutes_played?: number | null;
  goals?: number | null;
  assists?: number | null;
  shots?: number | null;
  shots_on_target?: number | null;
  chances_created?: number | null;
  big_chances_created?: number | null;
  total_passes?: number | null;
  accurate_passes?: number | null;
  dribbles_attempted?: number | null;
  successful_dribbles?: number | null;
  dispossessed?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  yellow_cards?: number | null;
  red_cards?: number | null;
  average_rating?: number | string | null;
  best_match_rating?: number | string | null;
  lowest_match_rating?: number | string | null;
  player_of_match_count?: number | null;
  player_season_registrations?: {
    position?: string | null;
    football_position?: string | null;
    shirt_number?: number | null;
    players?: { full_name?: string | null; avatar_url?: string | null } | null;
  } | null;
};

function safeDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function safeDateTime(value?: string | null) {
  if (!value) return "Kickoff not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return 0;
  const born = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate()))
    age -= 1;
  return age;
}

function statusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeReadyMatches(matches: ReadyMatchRow[]) {
  return matches.map((match) => ({
    ...match,
    kickoff: safeDateTime(match.kickoff),
    status: statusLabel(match.status),
  }));
}

function isGroupKnockoutFormat(format?: string | null) {
  const normalized = String(format ?? "").toUpperCase();
  return normalized.includes("GROUP") && normalized.includes("KNOCKOUT");
}

function normalizedStatus(status?: string | null) {
  return String(status ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
}

function isSimulatedOrDoneStatus(status?: string | null) {
  const statuses: string[] = [
    FixtureStatus.SIMULATED,
    FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION,
    FixtureStatus.COMPLETED,
    "RESULT_CONFIRMED",
    "CONFIRMED",
  ];
  return statuses.includes(normalizedStatus(status));
}

function isSimulatableStatus(status?: string | null) {
  const statuses: string[] = [
    FixtureStatus.LINEUPS_CONFIRMED,
    FixtureStatus.READY_TO_SIMULATE,
    FixtureStatus.SIMULATED,
    FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION,
  ];
  return statuses.includes(normalizedStatus(status));
}

function compactStatusLabel(status?: string | null) {
  const normalized = normalizedStatus(status);
  if (normalized === FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION)
    return "Pending Confirmation";
  if (normalized === FixtureStatus.SIMULATED) return "Simulated";
  if (normalized === FixtureStatus.READY_TO_SIMULATE) return "Ready";
  if (normalized === FixtureStatus.LINEUPS_CONFIRMED)
    return "Lineups Confirmed";
  if (normalized === FixtureStatus.LINEUPS_SUBMITTED) return "Submitted";
  if (normalized === FixtureStatus.LINEUP_PENDING) return "Lineup Pending";
  return statusLabel(status);
}

function abilityLabel(value?: string | null): AdminPlayer["abilityRating"] {
  if (value === "LOW") return "Low";
  if (value === "MODERATE") return "Moderate";
  if (value === "HIGH") return "High";
  return "Not rated";
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function adminPlayerStatus(
  row: PlayerRegistrationApiRow,
): AdminPlayer["playerStatus"] {
  if (row.player_status === "REMOVED") return "Removed";
  if (row.player_status === "SUSPENDED") return "Suspended";
  if (row.status === RegistrationStatus.APPROVED) return "Approved";
  if (row.status === RegistrationStatus.REJECTED) return "Rejected";
  return "Pending";
}

function abilityDetails(
  row: PlayerRegistrationApiRow,
): AdminPlayer["abilityDetails"] {
  const ability = relatedOne(row.player_abilities);
  if (!ability) return [];
  const entries: Array<[string, number | string | null | undefined]> = [
    ["Tier", ability.rating_tier],
    ["Overall", ability.overall_rating],
    ["Shooting", ability.shooting],
    ["Passing", ability.passing],
    ["Dribbling", ability.dribbling],
    ["Defending", ability.defending],
    ["Physical", ability.physical],
    ["Pace", ability.pace],
    ["Stamina", ability.stamina],
    ["Shot Stopping", ability.shot_stopping],
    ["Reflexes", ability.reflexes],
    ["Positioning", ability.positioning],
    ["Handling", ability.handling],
    ["Diving", ability.diving],
    ["Distribution", ability.distribution],
    ["Communication", ability.communication],
  ];
  return entries
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([label, value]) => ({ label, value: String(value) }));
}

function abilityOverall(row: PlayerRegistrationApiRow) {
  return relatedOne(row.player_abilities)?.overall_rating ?? null;
}

function zeroLeagueStats(
  stat?: PlayerSeasonStatApiRow,
): AdminPlayer["leagueStats"] {
  const shots = stat?.shots ?? 0;
  const shotsOnTarget = stat?.shots_on_target ?? 0;
  const totalPasses = stat?.total_passes ?? 0;
  const accuratePasses = stat?.accurate_passes ?? 0;
  const dribblesAttempted = stat?.dribbles_attempted ?? 0;
  const successfulDribbles = stat?.successful_dribbles ?? 0;
  return {
    matchesPlayed: stat?.appearances ?? 0,
    starts: stat?.starts ?? 0,
    minutesPlayed: stat?.minutes_played ?? 0,
    goals: stat?.goals ?? 0,
    assists: stat?.assists ?? 0,
    shots,
    shotsOnTarget,
    shotAccuracy: shots
      ? `${Math.round((shotsOnTarget / shots) * 100)}%`
      : "0%",
    chancesCreated: stat?.chances_created ?? 0,
    totalPasses,
    accuratePasses,
    passAccuracy: totalPasses
      ? `${Math.round((accuratePasses / totalPasses) * 100)}%`
      : "0%",
    dribblesAttempted,
    successfulDribbles,
    dispossessed: stat?.dispossessed ?? 0,
    tackles: stat?.tackles ?? 0,
    interceptions: stat?.interceptions ?? 0,
    yellowCards: stat?.yellow_cards ?? 0,
    redCards: stat?.red_cards ?? 0,
    averageRating: formatRating(stat?.average_rating, "N/A"),
    bestMatchRating: stat?.best_match_rating
      ? formatRating(stat.best_match_rating, "N/A")
      : "N/A",
    lowestMatchRating: stat?.lowest_match_rating
      ? formatRating(stat.lowest_match_rating, "N/A")
      : "N/A",
    playerOfTheMatch: stat?.player_of_match_count ?? 0,
  };
}

function buildAdminSeasonData(input: {
  season: SeasonDto;
  teamRegistrations: TeamRegistrationApiRow[];
  playerRegistrations: PlayerRegistrationApiRow[];
  fixtures: FixtureApiRow[];
  standings: StandingApiRow[];
  playerStats: PlayerSeasonStatApiRow[];
  statsReport: AdminStatsReport;
}): AdminSeasonData {
  const seasonTeamRegistrations = input.teamRegistrations.filter(
    (row) => row.season_id === input.season.id,
  );
  const teamByRegistration = new Map(
    seasonTeamRegistrations.map((row) => [row.id, row]),
  );
  const statsByRegistration = new Map(
    input.playerStats.map((row) => [row.player_registration_id, row]),
  );

  const playersByTeam = new Map<string, AdminPlayer[]>();
  for (const row of input.playerRegistrations.filter(
    (player) => player.season_id === input.season.id,
  )) {
    const team = teamByRegistration.get(row.team_registration_id);
    const manager = relatedOne(team?.manager);
    const playerName = row.players?.full_name ?? "Unnamed player";
    const playerStatus = adminPlayerStatus(row);
    const stat = statsByRegistration.get(row.id);
    const player: AdminPlayer = {
      id: row.id,
      code: `PLY-${row.id.slice(0, 8).toUpperCase()}`,
      fullName: playerName,
      avatar: initials(playerName),
      avatarUrl: row.players?.avatar_url ?? null,
      dateOfBirth: row.players?.date_of_birth
        ? safeDate(row.players.date_of_birth)
        : "Not set",
      age: calculateAge(row.players?.date_of_birth),
      idType: row.players?.id_type ?? "N/A",
      maskedId: row.players?.id_number_last4
        ? `********${row.players.id_number_last4}`
        : "Not submitted",
      uploadedDocument: "Private document",
      jerseyNumber: row.shirt_number ?? 0,
      position: row.position,
      footballPosition: row.football_position ?? row.position,
      preferredFoot: statusLabel(row.preferred_foot),
      approvalStatus: statusLabel(row.status) as AdminPlayer["approvalStatus"],
      playerStatus,
      registrationDate: safeDate(row.created_at),
      submittedByManager: manager?.full_name ?? manager?.email ?? "Manager",
      adminApprovalDate: row.reviewed_at
        ? safeDate(row.reviewed_at)
        : "Not approved yet",
      adminMessage:
        row.rejection_reason ??
        row.removal_reason ??
        row.suspension_reason ??
        "No admin message.",
      abilityRating: abilityLabel(row.ability_rating),
      overallRating: abilityOverall(row),
      abilityDetails: abilityDetails(row),
      leagueStats: zeroLeagueStats(stat),
      performances: [],
    };
    const list = playersByTeam.get(row.team_registration_id) ?? [];
    list.push(player);
    playersByTeam.set(row.team_registration_id, list);
  }

  const fixturesByTeam = (teamRegistrationId: string) =>
    input.fixtures
      .filter(
        (fixture) =>
          fixture.home_team_registration_id === teamRegistrationId ||
          fixture.away_team_registration_id === teamRegistrationId,
      )
      .map((fixture) => ({
        id: fixture.id,
        date: safeDate(fixture.kickoff_at),
        home: fixture.home_team_registration_id
          ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
              ?.name ?? "Home team")
          : (fixture.home_source ?? "TBD"),
        away: fixture.away_team_registration_id
          ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
              ?.name ?? "Away team")
          : (fixture.away_source ?? "TBD"),
        stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
        status: statusLabel(fixture.status),
        venue: fixture.venue ?? "Not set",
      }));

  const teams: AdminTeam[] = seasonTeamRegistrations
    .filter(
      (row) => row.status === RegistrationStatus.APPROVED && !row.removed_at,
    )
    .map((row) => {
      const manager = relatedOne(row.manager);
      const players = playersByTeam.get(row.id) ?? [];
      const suspendedPlayers = players.filter(
        (player) =>
          player.playerStatus === "Suspended" ||
          player.playerStatus === "Removed",
      );
      const activePlayers = players.filter(
        (player) =>
          player.playerStatus !== "Suspended" &&
          player.playerStatus !== "Removed" &&
          player.playerStatus !== "Rejected",
      );
      const teamFixtures = fixturesByTeam(row.id);
      return {
        id: row.id,
        logo: row.teams?.short_name ?? row.teams?.name ?? "TM",
        logoUrl: row.teams?.logo_url ?? null,
        primaryColor: row.teams?.primary_color ?? null,
        secondaryColor: row.teams?.secondary_color ?? null,
        accentColor: row.teams?.accent_color ?? null,
        homeJerseyUrl: row.teams?.home_jersey_url ?? null,
        awayJerseyUrl: row.teams?.away_jersey_url ?? null,
        gkHomeJerseyUrl: row.teams?.gk_home_jersey_url ?? null,
        gkAwayJerseyUrl: row.teams?.gk_away_jersey_url ?? null,
        name: row.teams?.name ?? "Unnamed team",
        managerName: manager?.full_name ?? manager?.email ?? "Manager",
        managerEmail: manager?.email ?? "Not connected",
        managerPhone: "Not connected",
        squadCount: players.filter(
          (player) =>
            player.playerStatus !== "Removed" &&
            player.approvalStatus !== "Rejected",
        ).length,
        approvedPlayers: players.filter(
          (player) =>
            player.approvalStatus === "Approved" &&
            player.playerStatus !== "Removed",
        ).length,
        pendingPlayers: players.filter(
          (player) => player.approvalStatus === "Pending",
        ).length,
        status: "Approved",
        players: activePlayers,
        suspendedPlayers,
        fixtures: teamFixtures,
        results: teamFixtures
          .filter((fixture) => fixture.status === "Final")
          .map((fixture) => ({
            date: fixture.date,
            match: `${fixture.home} vs ${fixture.away}`,
            result: "Final",
            status: fixture.status,
          })),
        messages: [],
      };
    });

  const teamRequests: TeamRequest[] = seasonTeamRegistrations
    .filter((row) => row.status === RegistrationStatus.PENDING)
    .map((row) => ({
      id: row.id,
      team: row.teams?.name ?? "Unnamed team",
      logoUrl: row.teams?.logo_url ?? null,
      manager:
        relatedOne(row.manager)?.full_name ??
        relatedOne(row.manager)?.email ??
        "Manager",
      season: input.season.name,
      squad: (playersByTeam.get(row.id) ?? []).length,
      status: "Pending",
    }));

  const playerRequests: PlayerRequest[] = input.playerRegistrations
    .filter(
      (row) =>
        row.season_id === input.season.id &&
        row.status === RegistrationStatus.PENDING,
    )
    .map((row) => {
      const requestPlayer = (
        playersByTeam.get(row.team_registration_id) ?? []
      ).find((player) => player.id === row.id);
      return {
        id: row.id,
        code: `PLY-${row.id.slice(0, 8).toUpperCase()}`,
        name: row.players?.full_name ?? "Unnamed player",
        team:
          teamByRegistration.get(row.team_registration_id)?.teams?.name ??
          "Unassigned team",
        position: row.football_position ?? row.position,
        jersey: row.shirt_number ?? 0,
        idType: row.players?.id_type ?? "N/A",
        status: "Pending",
        teamStatus: relatedOne(row.team_registrations)?.status ?? "PENDING",
        abilityRating: abilityLabel(row.ability_rating),
        player: requestPlayer,
      };
    });

  const fixtures = input.fixtures.map((fixture) => ({
    id: fixture.id,
    date: safeDate(fixture.kickoff_at),
    home: fixture.home_team_registration_id
      ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
          ?.name ?? "Home team")
      : (fixture.home_source ?? "TBD"),
    away: fixture.away_team_registration_id
      ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
          ?.name ?? "Away team")
      : (fixture.away_source ?? "TBD"),
    stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
    status: statusLabel(fixture.status),
    venue: fixture.venue ?? "Not set",
  }));

  const completedMatches = input.fixtures
    .filter((fixture) => fixture.status === FixtureStatus.FINAL)
    .map((fixture) => ({
      id: fixture.id,
      date: safeDate(fixture.kickoff_at),
      home: fixture.home_team_registration_id
        ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
            ?.name ?? "Home team")
        : (fixture.home_source ?? "TBD"),
      away: fixture.away_team_registration_id
        ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
            ?.name ?? "Away team")
        : (fixture.away_source ?? "TBD"),
      homeLogoUrl: fixture.home_team_registration_id
        ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
            ?.logo_url ?? null)
        : null,
      awayLogoUrl: fixture.away_team_registration_id
        ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
            ?.logo_url ?? null)
        : null,
      homePrimaryColor: fixture.home_team_registration_id
        ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
            ?.primary_color ??
          fixture.home_team?.teams?.primary_color ??
          null)
        : null,
      awayPrimaryColor: fixture.away_team_registration_id
        ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
            ?.primary_color ??
          fixture.away_team?.teams?.primary_color ??
          null)
        : null,
      stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
      kickoff: fixture.kickoff_at
        ? safeDateTime(fixture.kickoff_at)
        : "Kickoff not set",
      status: statusLabel(fixture.status),
      score: fixtureOutcomeScore(fixture) ?? "-",
      outcomeLabel: fixtureOutcomeLabel(fixture),
    }));

  const standings = input.standings.map((row) => {
    const team = teamByRegistration.get(row.team_registration_id);
    const name = team?.teams?.name ?? "Unnamed team";
    return {
      name,
      short: team?.teams?.short_name ?? initials(name),
      logoUrl: team?.teams?.logo_url ?? null,
      color: "bg-blue-500",
      points: row.points,
      played: row.played,
      won: row.won,
      draw: row.drawn,
      lost: row.lost,
      gf: row.goals_for,
      ga: row.goals_against,
    };
  });

  const readyMatches = input.fixtures
    .filter(
      (fixture) =>
        fixture.status === FixtureStatus.LINEUPS_CONFIRMED ||
        fixture.status === FixtureStatus.READY_TO_SIMULATE ||
        fixture.status === FixtureStatus.SIMULATED ||
        fixture.status === FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION,
    )
    .map((fixture) => ({
      id: fixture.id,
      homeTeamRegistrationId: fixture.home_team_registration_id ?? null,
      awayTeamRegistrationId: fixture.away_team_registration_id ?? null,
      home: fixture.home_team_registration_id
        ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
            ?.name ?? "Home team")
        : (fixture.home_source ?? "TBD"),
      away: fixture.away_team_registration_id
        ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
            ?.name ?? "Away team")
        : (fixture.away_source ?? "TBD"),
      homeLogoUrl: fixture.home_team_registration_id
        ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
            ?.logo_url ?? null)
        : null,
      awayLogoUrl: fixture.away_team_registration_id
        ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
            ?.logo_url ?? null)
        : null,
      homePrimaryColor: fixture.home_team_registration_id
        ? (teamByRegistration.get(fixture.home_team_registration_id)?.teams
            ?.primary_color ??
          fixture.home_team?.teams?.primary_color ??
          null)
        : null,
      awayPrimaryColor: fixture.away_team_registration_id
        ? (teamByRegistration.get(fixture.away_team_registration_id)?.teams
            ?.primary_color ??
          fixture.away_team?.teams?.primary_color ??
          null)
        : null,
      stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
      kickoff: fixture.kickoff_at
        ? safeDateTime(fixture.kickoff_at)
        : "Kickoff not set",
      status: statusLabel(fixture.status),
    }));

  const sortedStats = [...input.playerStats].sort(
    (a, b) => (b.goals ?? 0) - (a.goals ?? 0),
  );
  const topGoal = sortedStats[0];
  const topAssist = [...input.playerStats].sort(
    (a, b) => (b.assists ?? 0) - (a.assists ?? 0),
  )[0];
  const topRated = [...input.playerStats]
    .filter((row) => row.average_rating)
    .sort(
      (a, b) => Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0),
    )[0];
  const registrationForStat = (stat?: PlayerSeasonStatApiRow | null) =>
    stat
      ? input.playerRegistrations.find(
          (registration) =>
            registration.id === stat.player_registration_id &&
            registration.season_id === input.season.id,
        )
      : undefined;
  const teamForStat = (stat?: PlayerSeasonStatApiRow | null) => {
    const registration = registrationForStat(stat);
    return registration
      ? teamByRegistration.get(registration.team_registration_id)
      : undefined;
  };

  return {
    teams,
    standings,
    teamRequests,
    playerRequests,
    fixtures,
    completedMatches,
    messages: [],
    readyMatches,
    pendingLineups: input.fixtures.filter(
      (fixture) => fixture.status === FixtureStatus.LINEUPS_SUBMITTED,
    ).length,
    topScorer:
      topGoal && (topGoal.appearances ?? 0) > 0
        ? {
            name:
              topGoal.player_season_registrations?.players?.full_name ??
              "Unnamed player",
            team:
              teamForStat(topGoal)?.teams?.name ??
              registrationForStat(topGoal)?.team_registrations?.teams?.name ??
              "Unassigned team",
            teamLogoUrl: teamForStat(topGoal)?.teams?.logo_url ?? null,
            avatarUrl:
              topGoal.player_season_registrations?.players?.avatar_url ?? null,
            goals: topGoal.goals ?? 0,
            matches: topGoal.appearances ?? 0,
          }
        : null,
    topAssist:
      topAssist &&
      (topAssist.appearances ?? 0) > 0 &&
      (topAssist.assists ?? 0) > 0
        ? {
            name:
              topAssist.player_season_registrations?.players?.full_name ??
              "Unnamed player",
            team:
              teamForStat(topAssist)?.teams?.name ??
              registrationForStat(topAssist)?.team_registrations?.teams?.name ??
              "Unassigned team",
            teamLogoUrl: teamForStat(topAssist)?.teams?.logo_url ?? null,
            avatarUrl:
              topAssist.player_season_registrations?.players?.avatar_url ??
              null,
            assists: topAssist.assists ?? 0,
            matches: topAssist.appearances ?? 0,
          }
        : null,
    topRated:
      topRated && (topRated.appearances ?? 0) > 0
        ? {
            name:
              topRated.player_season_registrations?.players?.full_name ??
              "Unnamed player",
            team:
              teamForStat(topRated)?.teams?.name ??
              registrationForStat(topRated)?.team_registrations?.teams?.name ??
              "Unassigned team",
            teamLogoUrl: teamForStat(topRated)?.teams?.logo_url ?? null,
            avatarUrl:
              topRated.player_season_registrations?.players?.avatar_url ?? null,
            rating: formatRating(topRated.average_rating, "N/A"),
            matches: topRated.appearances ?? 0,
          }
        : null,
    statsReport: input.statsReport,
  };
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "NA"
  );
}

function formatNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function formatRating(value: unknown, fallback = "0.0") {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : fallback;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function percent(part: unknown, total: unknown) {
  const numerator = Number(part ?? 0);
  const denominator = Number(total ?? 0);
  if (
    !denominator ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator)
  )
    return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function ratingTone(value: number) {
  if (value > 7.9) return "bg-sky-500";
  if (value >= 7) return "bg-emerald-500";
  return "bg-orange-500";
}

function ratingBadgeClass(value: number) {
  return ratingTone(value);
}

type PlayerEventMeta = {
  goals: number;
  ownGoals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  penaltyMiss: boolean;
  penaltySaved: boolean;
  injured: boolean;
  subInMinute?: number;
  subOutMinute?: number;
};

function blankPlayerEventMeta(): PlayerEventMeta {
  return {
    goals: 0,
    ownGoals: 0,
    assists: 0,
    yellow: false,
    red: false,
    penaltyMiss: false,
    penaltySaved: false,
    injured: false,
  };
}

function ensurePlayerEventMeta(
  map: Map<string, PlayerEventMeta>,
  playerId: string,
) {
  const existing = map.get(playerId);
  if (existing) return existing;
  const next = blankPlayerEventMeta();
  map.set(playerId, next);
  return next;
}

function buildPlayerEventMeta(
  events: Record<string, unknown>[],
  substitutions: Record<string, unknown>[],
) {
  const map = new Map<string, PlayerEventMeta>();
  for (const event of events) {
    const playerId = String(event.player_registration_id ?? "");
    if (!playerId) continue;
    const meta = ensurePlayerEventMeta(map, playerId);
    const type = String(event.type ?? "");
    if (type === "GOAL" || type === "PENALTY_GOAL") meta.goals += 1;
    if (type === "OWN_GOAL") meta.ownGoals += 1;
    if (
      (type === "GOAL" || type === "PENALTY_GOAL") &&
      event.related_player_registration_id
    ) {
      ensurePlayerEventMeta(
        map,
        String(event.related_player_registration_id),
      ).assists += 1;
    }
    if (type === "YELLOW_CARD") meta.yellow = true;
    if (type === "RED_CARD") meta.red = true;
    if (type === "PENALTY_MISS") meta.penaltyMiss = true;
    if (type === "PENALTY_SAVED") {
      // The penalty taker owns the event; the saving goalkeeper is related.
      // Show a miss on the taker and preserve the save on the goalkeeper.
      meta.penaltyMiss = true;
      if (event.related_player_registration_id) {
        ensurePlayerEventMeta(
          map,
          String(event.related_player_registration_id),
        ).penaltySaved = true;
      }
    }
    if (type === "INJURY") meta.injured = true;
  }
  for (const sub of substitutions) {
    const minute = Number(sub.minute ?? 0);
    const outId = String(sub.player_out_registration_id ?? "");
    const inId = String(sub.player_in_registration_id ?? "");
    if (outId) {
      const meta = ensurePlayerEventMeta(map, outId);
      if (!meta.red) meta.subOutMinute = minute;
    }
    if (inId) ensurePlayerEventMeta(map, inId).subInMinute = minute;
  }
  return map;
}

function bestRatedPlayer(stats: MatchDetailPlayerStat[]) {
  return (
    [...stats].sort((a, b) => Number(b.rating) - Number(a.rating))[0]
      ?.player_registration_id ?? null
  );
}

function LineupEventIcons({
  meta,
  dark = false,
  overlay = false,
}: {
  meta: PlayerEventMeta;
  dark?: boolean;
  overlay?: boolean;
}) {
  const textClass = dark ? "text-slate-700" : "text-white";
  const badgeBase =
    "inline-grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black shadow";
  const assistIcon = (
    <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
      <path
        d="M4 12.8c2.8-.5 5.3-2.4 7.4-5.6l1.2-1.8 2.6 1.7-1.7 2.5 3.5 2.2c.8.5 1.1 1.4.8 2.2-.2.7-.8 1.1-1.6 1.1H4.7c-1.2 0-1.8-1.5-.7-2.3Z"
        fill="currentColor"
      />
      <path
        d="M6.5 11.7 8 14m1-4 2.1 3.2m1.7-5.8 1.5 2"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
  if (overlay) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20 text-[10px] font-black">
        {meta.subOutMinute ? (
          <span className="absolute -left-1 -top-3 inline-flex items-center gap-0.5 text-white drop-shadow">
            {meta.subOutMinute}'
            <span className={`${badgeBase} bg-red-500 text-white`}>↩</span>
          </span>
        ) : null}
        {meta.subInMinute ? (
          <span className="absolute -left-1 -top-3 inline-flex items-center gap-0.5 text-white drop-shadow">
            {meta.subInMinute}'
            <span className={`${badgeBase} bg-emerald-500 text-white`}>↪</span>
          </span>
        ) : null}
        {meta.yellow ? (
          <span
            className="absolute -left-2 bottom-5 h-4 w-3 rounded-[3px] border border-white/70 bg-yellow-300 shadow"
            title="Yellow card"
          />
        ) : null}
        {meta.red ? (
          <span
            className="absolute -left-2 bottom-5 h-4 w-3 rounded-[3px] border border-white/70 bg-red-500 shadow"
            title="Red card"
          />
        ) : null}
        {meta.goals ? (
          <span
            className={`${badgeBase} absolute -right-1 ${meta.ownGoals ? "bottom-5" : "bottom-0"} bg-white text-slate-950`}
            title="Goal"
          >
            ⚽{meta.goals > 1 ? meta.goals : ""}
          </span>
        ) : null}
        {meta.ownGoals ? (
          <span
            className={`${badgeBase} absolute -right-1 bottom-0 gap-0.5 bg-white text-red-600 ring-1 ring-red-200`}
            title="Own goal"
          >
            <OwnGoalIcon />
            {meta.ownGoals > 1 ? meta.ownGoals : ""}
          </span>
        ) : null}
        {meta.assists ? (
          <span
            className="absolute -left-2 bottom-0 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-slate-800 shadow"
            title="Assist"
          >
            <span className="flex items-center gap-0.5">
              {assistIcon}
              {meta.assists > 1 ? meta.assists : ""}
            </span>
          </span>
        ) : null}
        {meta.penaltyMiss ? (
          <span
            className="absolute -right-1 bottom-5 drop-shadow"
            title="Penalty missed"
          >
            <PenaltyMissIcon />
          </span>
        ) : meta.penaltySaved ? (
          <span
            className={`${badgeBase} absolute -right-1 bottom-5 bg-white text-slate-950`}
            title="Penalty saved"
          >
            ⊗
          </span>
        ) : null}
      </div>
    );
  }
  return (
    <div
      className={`mt-0.5 flex min-h-4 items-center justify-center gap-1 text-[10px] font-black ${textClass}`}
    >
      {meta.subOutMinute ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-black">
          {meta.subOutMinute}'
          <span className={`${badgeBase} bg-red-500 text-white`}>↩</span>
        </span>
      ) : null}
      {meta.subInMinute ? (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-black">
          {meta.subInMinute}'
          <span className={`${badgeBase} bg-emerald-500 text-white`}>↪</span>
        </span>
      ) : null}
      {meta.goals ? (
        <span className={`${badgeBase} bg-white text-slate-950`} title="Goal">
          ⚽{meta.goals > 1 ? meta.goals : ""}
        </span>
      ) : null}
      {meta.ownGoals ? (
        <span
          className={`${badgeBase} gap-0.5 bg-white text-red-600 ring-1 ring-red-200`}
          title="Own goal"
        >
          <OwnGoalIcon />
          {meta.ownGoals > 1 ? meta.ownGoals : ""}
        </span>
      ) : null}
      {meta.assists ? (
        <span className={`${badgeBase} bg-white text-slate-800`} title="Assist">
          <span className="flex items-center gap-0.5">
            {assistIcon}
            {meta.assists > 1 ? meta.assists : ""}
          </span>
        </span>
      ) : null}
      {meta.penaltyMiss ? (
        <span title="Penalty missed">
          <PenaltyMissIcon className="h-4 w-4" />
        </span>
      ) : meta.penaltySaved ? (
        <span
          className={`${badgeBase} bg-white text-slate-950`}
          title="Penalty saved"
        >
          ⊗
        </span>
      ) : null}
      {meta.injured ? (
        <span
          className={`${badgeBase} bg-white text-red-600 ring-1 ring-red-100`}
          title="Injury"
        >
          +
        </span>
      ) : null}
      {meta.yellow ? (
        <span
          className="h-4 w-3 rounded-[3px] border border-white/70 bg-yellow-300 shadow"
          title="Yellow card"
        />
      ) : null}
      {meta.red ? (
        <span
          className="h-4 w-3 rounded-[3px] border border-white/70 bg-red-500 shadow"
          title="Red card"
        />
      ) : null}
    </div>
  );
}

function formatTeamStat(
  stat: MatchDetailTeamStat,
  field: keyof MatchDetailTeamStat,
  format: "number" | "percent" | "passes" | "rating" | "decimal",
) {
  if (format === "percent") return `${formatNumber(stat[field])}%`;
  if (format === "passes")
    return `${formatNumber(stat.accurate_passes)}/${formatNumber(stat.passes)} (${percent(stat.accurate_passes, stat.passes)})`;
  if (format === "decimal") {
    const value = Number(stat[field] ?? 0);
    return value.toFixed(2).replace(/\.00$/, "");
  }
  if (format === "rating") return formatRating(stat[field]);
  return formatNumber(stat[field]);
}

function positionBreakdown(players: AdminPlayer[]) {
  const order = ["GK", "LB", "CB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"];
  const counts = new Map<string, number>();
  for (const player of players) {
    const key = (
      player.footballPosition ||
      player.position ||
      "UNK"
    ).toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ordered = order
    .map((position) => [position, counts.get(position) ?? 0] as const)
    .filter(([, count]) => count > 0);
  const extra = Array.from(counts.entries())
    .filter(([position]) => !order.includes(position))
    .sort(([a], [b]) => a.localeCompare(b));
  return [...ordered, ...extra];
}

const adminTabIds: TabId[] = [
  "dashboard",
  "teams",
  "team-requests",
  "player-requests",
  "fixtures",
  "lineups",
  "matches-ready",
  "completed-matches",
  "standings",
  "reports",
  "team-stats",
  "messages",
  "divide-groups",
  "groups",
  "knockout",
  "settings",
];

function isAdminTabId(value: string | null): value is TabId {
  return Boolean(value && adminTabIds.includes(value as TabId));
}

export default function AdminLeagueSeasonDashboard() {
  const params = useParams<{ leagueId: string; seasonId: string }>();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [adminData, setAdminData] =
    useState<AdminSeasonData>(emptyAdminSeasonData);
  const [groupsReady, setGroupsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "dashboard";
    const stored = window.localStorage.getItem(
      `scoreline-admin-tab:${params.seasonId}`,
    );
    return isAdminTabId(stored) ? stored : "dashboard";
  });
  const [playerAction, setPlayerAction] = useState<{
    action: PlayerLifecycleAction;
    player: AdminPlayer;
  } | null>(null);
  const [selectedLineupPlayer, setSelectedLineupPlayer] = useState<{
    teamId: string;
    playerId: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [requestedTeamId, setRequestedTeamId] = useState<string | null>(null);
  const [requestedPlayerId, setRequestedPlayerId] = useState<string | null>(
    null,
  );
  const [requestedTeamReturnTab, setRequestedTeamReturnTab] =
    useState<TabId | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavigationOpen]);

  async function loadDashboardData() {
    const [me, leagueData, seasonData] = await Promise.all([
      api<{ profile: ProfileDto }>("/me"),
      publicApi<{ leagues: LeagueDto[] }>("/public/leagues"),
      publicApi<{ seasons: SeasonDto[] }>(
        `/public/leagues/${params.leagueId}/seasons`,
      ),
    ]);
    const selectedSeason =
      seasonData.seasons.find((item) => item.id === params.seasonId) ??
      seasonData.seasons[0] ??
      null;
    setProfile(me.profile);
    setLeague(
      leagueData.leagues.find((item) => item.id === params.leagueId) ?? null,
    );
    setSeason(selectedSeason);
    if (!selectedSeason) {
      setAdminData(emptyAdminSeasonData);
      setGroupsReady(false);
      return;
    }
    const [
      teamRegistrationData,
      playerRegistrationData,
      fixtureData,
      standingData,
      playerStatData,
      statsReportData,
      pendingLineupData,
      currentMatchdayData,
    ] = await Promise.all([
      api<{ team_registrations: TeamRegistrationApiRow[] }>(
        "/admin/team-registrations",
      ),
      api<{ player_registrations: PlayerRegistrationApiRow[] }>(
        "/admin/player-registrations",
      ),
      publicApi<{ fixtures: FixtureApiRow[] }>(
        `/public/seasons/${selectedSeason.id}/fixtures`,
      ),
      publicApi<{ standings: StandingApiRow[] }>(
        `/public/seasons/${selectedSeason.id}/standings`,
      ),
      publicApi<{ player_stats: PlayerSeasonStatApiRow[] }>(
        `/public/seasons/${selectedSeason.id}/player-stats`,
      ),
      api<AdminStatsReport>(
        `/admin/seasons/${selectedSeason.id}/stat-leaderboards`,
      ),
      api<{ lineups: AdminPendingLineupRow[] }>(
        `/admin/seasons/${selectedSeason.id}/lineups/pending`,
      ),
      api<{ matches: ReadyMatchRow[] }>(
        `/admin/seasons/${selectedSeason.id}/matches/current-matchday`,
      ),
    ]);
    const nextAdminData = buildAdminSeasonData({
      season: selectedSeason,
      teamRegistrations: teamRegistrationData.team_registrations ?? [],
      playerRegistrations: playerRegistrationData.player_registrations ?? [],
      fixtures: fixtureData.fixtures ?? [],
      standings: standingData.standings ?? [],
      playerStats: playerStatData.player_stats ?? [],
      statsReport: statsReportData ?? emptyStatsReport,
    });
    setAdminData({
      ...nextAdminData,
      pendingLineups: pendingLineupData.lineups?.length ?? 0,
      readyMatches: normalizeReadyMatches(currentMatchdayData.matches ?? []),
    });
    if (isGroupKnockoutFormat(selectedSeason.format)) {
      const groupData = await api<AdminGroupsResponse>(
        `/admin/seasons/${selectedSeason.id}/groups`,
      );
      setGroupsReady(groupData.groups_ready);
    } else {
      setGroupsReady(false);
    }
  }

  useEffect(() => {
    void loadDashboardData().catch((loadError) =>
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load dashboard",
      ),
    );
  }, [params.leagueId, params.seasonId]);

  async function decideTeamRequest(
    id: string,
    status: "APPROVED" | "REJECTED",
  ) {
    await api(`/admin/team-registrations/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadDashboardData();
  }

  async function decidePlayerRequest(
    id: string,
    status: "APPROVED" | "REJECTED",
  ) {
    await api(`/admin/player-registrations/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadDashboardData();
  }

  async function ratePlayer(
    id: string,
    ability_rating: "LOW" | "MODERATE" | "HIGH",
  ) {
    await api(`/admin/player-registrations/${id}/ability`, {
      method: "PATCH",
      body: JSON.stringify({ ability_rating }),
    });
    await loadDashboardData();
  }

  async function bulkRatePendingPlayers(teamId: string, rerate = false) {
    await api(`/admin/teams/${teamId}/pending-players/rate-randomly`, {
      method: "POST",
      body: JSON.stringify({
        seasonId: season?.id,
        distribution: { low: 0.15, moderate: 0.7, high: 0.15 },
        rerate,
      }),
    });
    await loadDashboardData();
  }

  async function bulkApproveRatedPlayers(teamId: string) {
    await api(`/admin/teams/${teamId}/pending-players/approve-all-rated`, {
      method: "POST",
      body: JSON.stringify({ seasonId: season?.id }),
    });
    await loadDashboardData();
  }

  async function simulateReadyMatch(fixtureId: string) {
    await api("/admin/matches/simulate", {
      method: "POST",
      body: JSON.stringify({ fixture_id: fixtureId }),
    });
    await loadDashboardData();
  }

  async function confirmMatchResult(fixtureId: string) {
    await api(`/admin/matches/${fixtureId}/final-confirmation`, {
      method: "POST",
    });
    await loadDashboardData();
  }

  async function decideLineup(
    lineupId: string,
    status: "APPROVED" | "REJECTED",
    reason?: string,
  ) {
    await api(`/admin/lineups/${lineupId}/decision`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    await loadDashboardData();
  }

  async function jumpToMatchday() {
    if (!season?.id) return { updated_count: 0, matches: [] };
    const result = await api<{
      updated_count: number;
      matches: ReadyMatchRow[];
    }>(`/admin/seasons/${season.id}/matches/jump-to-matchday`, {
      method: "POST",
    });
    const matches = normalizeReadyMatches(result.matches ?? []);
    setAdminData((current) => ({ ...current, readyMatches: matches }));
    return { ...result, matches };
  }

  async function updateAbilityScores(
    id: string,
    scores: Record<string, number>,
  ) {
    await api(`/admin/player-registrations/${id}/ability-scores`, {
      method: "PATCH",
      body: JSON.stringify(scores),
    });
    await loadDashboardData();
  }

  async function submitPlayerLifecycleAction(input: {
    action: PlayerLifecycleAction;
    playerId: string;
    reason: string;
    suspensionType?: string;
    suspensionUntil?: string;
    suspensionMatchesRemaining?: number;
  }) {
    const actionPath =
      input.action === "reject"
        ? "reject"
        : input.action === "remove"
          ? "remove"
          : input.action === "suspend"
            ? "suspend"
            : "unsuspend";
    const body =
      input.action === "reject"
        ? { reason: input.reason }
        : input.action === "suspend"
          ? {
              reason: input.reason,
              suspension_type: input.suspensionType,
              suspension_until: input.suspensionUntil || null,
              suspension_matches_remaining:
                input.suspensionMatchesRemaining ?? null,
            }
          : input.action === "unsuspend"
            ? { message: input.reason }
            : { reason: input.reason };
    await api(`/admin/player-registrations/${input.playerId}/${actionPath}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setPlayerAction(null);
    await loadDashboardData();
  }

  async function kickOutTeam(id: string) {
    const reason = window.prompt(
      "Reason for kicking out this team?",
      "Team removed by admin.",
    );
    if (reason === null) return;
    await api(`/admin/team-registrations/${id}/kick-out`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
    await loadDashboardData();
    setActiveTab("teams");
  }

  async function sendTeamMessage(id: string) {
    const message = window.prompt("Message to manager");
    if (!message?.trim()) return;
    await api(`/admin/team-registrations/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    await loadDashboardData();
  }

  async function generateFixtures() {
    await api("/admin/fixtures/generate", {
      method: "POST",
      body: JSON.stringify({ season_id: season?.id }),
    });
    await loadDashboardData();
  }

  async function scheduleFixture(id: string, currentVenue: string) {
    const kickoff_at = window.prompt(
      "Kickoff date/time. Use ISO format like 2026-09-01T16:00:00+06:00. Leave blank to clear date.",
    );
    if (kickoff_at === null) return;
    const venue = window.prompt(
      "Venue",
      currentVenue === "Not set" ? "" : currentVenue,
    );
    if (venue === null) return;
    await api(`/admin/fixtures/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({
        kickoff_at: kickoff_at.trim() || null,
        venue: venue.trim() || null,
      }),
    });
    await loadDashboardData();
  }

  async function postponeFixture(id: string, currentVenue: string) {
    await api(`/admin/fixtures/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({
        kickoff_at: null,
        venue: currentVenue === "Not set" ? null : currentVenue,
      }),
    });
    await loadDashboardData();
  }

  async function cancelFixture(id: string) {
    await api(`/admin/fixtures/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: FixtureStatus.CANCELLED }),
    });
    await loadDashboardData();
  }

  function logout() {
    clearAuth();
    window.location.href = "/login";
  }

  const isGroupKnockout = isGroupKnockoutFormat(season?.format);
  const navItems = useMemo(
    () =>
      [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "teams", label: "Teams", icon: ShieldCheck },
        { id: "team-requests", label: "Team Requests", icon: Users },
        { id: "player-requests", label: "Player Requests", icon: User },
        { id: "fixtures", label: "Fixtures", icon: CalendarDays },
        { id: "lineups", label: "Lineups", icon: ClipboardCheck },
        { id: "matches-ready", label: "Matches Ready", icon: PlayCircle },
        {
          id: "completed-matches",
          label: "Completed Matches",
          icon: CheckCircle2,
        },
        ...(!isGroupKnockout
          ? [{ id: "standings", label: "Standings", icon: Trophy }]
          : []),
        { id: "reports", label: "Player Stats", icon: BarChart3 },
        { id: "team-stats", label: "Team Stats", icon: ShieldCheck },
        { id: "messages", label: "Messages", icon: Mail },
      ] as const,
    [isGroupKnockout],
  );

  const groupTeamRequirement =
    Number(season?.group_count ?? 0) * Number(season?.teams_per_group ?? 0);
  const shouldShowGroupDivision = Boolean(
    isGroupKnockout &&
      !groupsReady &&
      groupTeamRequirement > 0 &&
      adminData.teams.length >= groupTeamRequirement,
  );
  const tournamentItems = useMemo(() => {
    if (!isGroupKnockout) return [];
    return [
      ...(shouldShowGroupDivision
        ? [
            {
              id: "divide-groups",
              label: "Divide Teams Into Groups",
              icon: GitBranch,
            },
          ]
        : []),
      { id: "groups", label: "Groups", icon: Users },
      { id: "knockout", label: "Knockout Bracket", icon: GitBranch },
    ] as Array<{ id: TabId; label: string; icon: typeof Users }>;
  }, [isGroupKnockout, shouldShowGroupDivision]);
  function openLineupPlayer(
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) {
    // Prefer the authoritative team id from the lineup context. Fall back to a
    // roster lookup only when it is not supplied.
    const owningTeam =
      (teamRegistrationId
        ? adminData.teams.find((team) => team.id === teamRegistrationId)
        : null) ??
      adminData.teams.find((team) =>
        [...team.players, ...team.suspendedPlayers].some(
          (item) => item.id === player.player_registration_id,
        ),
      );
    if (owningTeam) {
      setSelectedLineupPlayer({
        teamId: owningTeam.id,
        playerId: player.player_registration_id,
      });
    }
  }

  function openAdminPlayerProfile(playerRegistrationId: string) {
    const owningTeam = adminData.teams.find((team) =>
      [...team.players, ...team.suspendedPlayers].some(
        (player) => player.id === playerRegistrationId,
      ),
    );
    if (!owningTeam) return;
    setRequestedTeamReturnTab(activeTab === "teams" ? null : activeTab);
    setRequestedTeamId(owningTeam.id);
    setRequestedPlayerId(playerRegistrationId);
    setSelectedLineupPlayer(null);
    setActiveTab("teams");
  }

  function openAdminTeamProfile(
    teamRegistrationId: string,
    returnTab: TabId = activeTab,
  ) {
    if (!adminData.teams.some((team) => team.id === teamRegistrationId)) return;
    setRequestedTeamReturnTab(returnTab === "teams" ? null : returnTab);
    setRequestedTeamId(teamRegistrationId);
    setRequestedPlayerId(null);
    setActiveTab("teams");
  }

  useEffect(() => {
    if (isGroupKnockout && activeTab === "standings") setActiveTab("dashboard");
  }, [activeTab, isGroupKnockout]);

  useEffect(() => {
    window.localStorage.setItem(
      `scoreline-admin-tab:${params.seasonId}`,
      activeTab,
    );
  }, [activeTab, params.seasonId]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-100 text-slate-900">
        <div className="rounded-2xl bg-white p-8 shadow-xl">{error}</div>
      </div>
    );
  }

  if (!league || !season) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-100 text-slate-900">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          Loading selected league dashboard...
        </div>
      </div>
    );
  }

  const adminNotificationCount =
    adminData.teamRequests.length +
    adminData.playerRequests.length +
    adminData.pendingLineups +
    adminData.readyMatches.length;

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-[#f6f8fb] text-[#0f172a]">
      <button
        type="button"
        aria-label="Close admin navigation"
        className={`fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileNavigationOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileNavigationOpen(false)}
      />
      <aside
        id="admin-season-navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(88vw,272px)] shrink-0 flex-col overflow-y-auto bg-[#0d2035] bg-[radial-gradient(circle_at_top_left,rgba(58,122,255,0.2),transparent_18rem)] text-white shadow-2xl transition-transform duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:static lg:z-auto lg:w-[272px] lg:translate-x-0 ${
          mobileNavigationOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[74px] items-center gap-3 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#1d8aff] to-[#3057dc] shadow-lg">
            <Trophy size={23} />
          </div>
          <div className="text-xl font-black">League Admin</div>
          <button
            type="button"
            aria-label="Close admin navigation"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-white/15 lg:hidden"
            onClick={() => setMobileNavigationOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="mx-3 mb-5 rounded-xl bg-white/7 p-4">
          <div className="flex items-center gap-3">
            <TeamBadge
              name={league.short_name || league.name}
              logoUrl={league.logo_url}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{league.name}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-300">
                {season.name}
                <ChevronDown size={14} />
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-3">
          {navItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              active={activeTab === item.id}
              onClick={() => {
                setActiveTab(item.id as TabId);
                setMobileNavigationOpen(false);
              }}
            />
          ))}
        </nav>

        {tournamentItems.length > 0 ? (
          <>
            <div className="mx-3 my-6 h-px bg-white/15" />
            <p className="px-6 pb-3 text-xs font-bold uppercase tracking-wide text-slate-300">
              Tournament
            </p>
            <nav className="space-y-1 px-3">
              {tournamentItems.map((item) => (
                <SidebarButton
                  key={item.id}
                  item={item}
                  active={activeTab === item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavigationOpen(false);
                  }}
                />
              ))}
            </nav>
          </>
        ) : null}

        <div className="mt-auto px-3 pb-5">
          <div className="mb-5 h-px bg-white/15" />
          <SidebarButton
            item={{ id: "settings", label: "Settings", icon: Settings }}
            active={activeTab === "settings"}
            onClick={() => {
              setActiveTab("settings");
              setMobileNavigationOpen(false);
            }}
          />
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex w-full items-center gap-4 rounded-md px-4 py-3 text-left text-base text-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0 active:scale-[0.99]"
          >
            <LogOut size={22} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[74px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-6 lg:py-0">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              aria-label="Open admin navigation"
              aria-controls="admin-season-navigation"
              aria-expanded={mobileNavigationOpen}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <Menu size={20} />
            </button>
            <TeamBadge
              name={league.short_name || league.name}
              logoUrl={league.logo_url}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate text-sm font-black sm:text-base">
                {league.name}
              </div>
              <div className="truncate text-xs font-semibold text-blue-700 sm:text-sm">
                {season.name}
              </div>
            </div>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700 md:inline-flex">
              {formatPhase(season.phase)}
            </span>
            <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 xl:inline-flex">
              {formatLabel(season.format)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-6">
            <Link
              href="/dashboard/admin"
              className="hidden text-sm font-bold text-blue-700 hover:text-blue-900 md:block"
            >
              Back to League Selector
            </Link>
            <div className="relative text-slate-700">
              <Bell size={23} />
              {adminNotificationCount > 0 ? (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-xs font-bold text-white">
                  {adminNotificationCount}
                </span>
              ) : null}
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-sm font-black text-slate-600">
                {(profile?.full_name ?? profile?.email ?? "AD")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <p className="font-bold">Admin</p>
                <p className="text-xs text-slate-500">Super Admin</p>
              </div>
              <ChevronDown size={17} />
            </div>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">
          {activeTab === "dashboard" ? (
            <DashboardView
              league={league}
              season={season}
              data={adminData}
              onNavigate={setActiveTab}
              onSimulate={simulateReadyMatch}
            />
          ) : null}
          {activeTab === "teams" ? (
            <TeamsView
              season={season}
              teams={adminData.teams}
              initialTeamId={requestedTeamId}
              initialPlayerId={requestedPlayerId}
              initialBackTab={requestedTeamReturnTab}
              onInitialTeamOpened={() => {
                setRequestedTeamId(null);
                setRequestedPlayerId(null);
                setRequestedTeamReturnTab(null);
              }}
              onNavigateBack={setActiveTab}
              onKickOutTeam={kickOutTeam}
              onSendTeamMessage={sendTeamMessage}
              onPlayerDecision={decidePlayerRequest}
              onPlayerAbility={ratePlayer}
              onBulkRatePending={bulkRatePendingPlayers}
              onBulkApproveRated={bulkApproveRatedPlayers}
              onPlayerAction={(action, player) =>
                setPlayerAction({ action, player })
              }
              onAbilityScoresUpdate={updateAbilityScores}
            />
          ) : null}
          {activeTab === "team-requests" ? (
            <TeamRequestsView
              teamRequests={adminData.teamRequests}
              onDecision={decideTeamRequest}
            />
          ) : null}
          {activeTab === "player-requests" ? (
            <PlayerRequestsView
              playerRequests={adminData.playerRequests}
              onDecision={decidePlayerRequest}
              onAbility={ratePlayer}
              onPlayerAction={(action, player) =>
                setPlayerAction({ action, player })
              }
            />
          ) : null}
          {activeTab === "fixtures" ? <FixturesView season={season} /> : null}
          {activeTab === "lineups" ? (
            <LineupConfirmationsView
              season={season}
              onDecision={decideLineup}
              onPlayerClick={openLineupPlayer}
            />
          ) : null}
          {activeTab === "matches-ready" ? (
            <MatchesReadyView
              matches={adminData.readyMatches}
              onSimulate={simulateReadyMatch}
              onConfirm={confirmMatchResult}
              onJumpToMatchday={jumpToMatchday}
              onPlayerProfile={openLineupPlayer}
              onOpenTeam={(teamId) =>
                openAdminTeamProfile(teamId, "matches-ready")
              }
            />
          ) : null}
          {activeTab === "completed-matches" ? (
            <CompletedMatchesView
              matches={adminData.completedMatches}
              onPlayerProfile={openLineupPlayer}
            />
          ) : null}
          {activeTab === "standings" && !isGroupKnockout ? (
            <StandingsView groupMode={false} teams={adminData.standings} />
          ) : null}
          {activeTab === "reports" ? (
            <PlayerStatsView
              data={adminData}
              onOpenPlayer={openAdminPlayerProfile}
            />
          ) : null}
          {activeTab === "team-stats" ? (
            <TeamStatsView data={adminData} onOpenTeam={openAdminTeamProfile} />
          ) : null}
          {activeTab === "messages" ? (
            <MessagesView seasonId={season.id} />
          ) : null}
          {activeTab === "divide-groups" ? (
            <DivideGroupsView
              season={season}
              onSaved={async () => {
                await loadDashboardData();
                setActiveTab("fixtures");
              }}
            />
          ) : null}
          {activeTab === "groups" ? <GroupsView season={season} /> : null}
          {activeTab === "knockout" ? <KnockoutView season={season} /> : null}
          {activeTab === "settings" ? (
            <SettingsView
              league={league}
              season={season}
              onSaved={loadDashboardData}
            />
          ) : null}
        </main>
      </section>
      {playerAction ? (
        <PlayerLifecycleModal
          action={playerAction.action}
          player={playerAction.player}
          onClose={() => setPlayerAction(null)}
          onSubmit={submitPlayerLifecycleAction}
        />
      ) : null}
      {selectedLineupPlayer ? (
        <LineupPlayerModal
          selection={selectedLineupPlayer}
          teams={adminData.teams}
          onNavigate={(next) => setSelectedLineupPlayer(next)}
          onClose={() => setSelectedLineupPlayer(null)}
        />
      ) : null}
    </div>
  );
}

function DashboardView({
  league,
  season,
  data,
  onNavigate,
  onSimulate,
}: {
  league: LeagueDto;
  season: SeasonDto;
  data: AdminSeasonData;
  onNavigate: (tab: TabId) => void;
  onSimulate: (fixtureId: string) => Promise<void>;
}) {
  const tableTopper = data.standings[0] ?? null;
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState("");
  const isLeagueTableFormat =
    season.format === SeasonFormat.SINGLE_ROUND_ROBIN ||
    season.format === SeasonFormat.DOUBLE_ROUND_ROBIN;

  async function simulateFromDashboard(match: ReadyMatchRow) {
    setSimulatingId(match.id);
    setSimulationError("");
    try {
      await onSimulate(match.id);
      onNavigate("matches-ready");
    } catch (error) {
      setSimulationError(
        error instanceof Error ? error.message : "Could not simulate match.",
      );
    } finally {
      setSimulatingId(null);
    }
  }

  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle={`Overview of ${league.name} - ${season.name}`}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={<UserPlus size={31} />}
          label="Pending Team Requests"
          value={String(data.teamRequests.length)}
          color="blue"
          action="View all requests"
          onAction={() => onNavigate("team-requests")}
        />
        <SummaryCard
          icon={<User size={31} />}
          label="Pending Player Requests"
          value={String(data.playerRequests.length)}
          color="green"
          action="View all requests"
          onAction={() => onNavigate("player-requests")}
        />
        <SummaryCard
          icon={<ClipboardCheck size={31} />}
          label="Pending Lineup Confirmations"
          value={String(data.pendingLineups)}
          color="orange"
          action="View all lineups"
          onAction={() => onNavigate("lineups")}
        />
        <SummaryCard
          icon={<PlayCircle size={31} />}
          label="Matches Ready for Simulation"
          value={String(data.readyMatches.length)}
          color="purple"
          action="View matches"
          onAction={() => onNavigate("matches-ready")}
        />
        <SummaryCard
          icon={<CheckCircle2 size={31} />}
          label="Completed Matches"
          value={String(data.completedMatches.length)}
          color="cyan"
          action="View matches"
          onAction={() => onNavigate("completed-matches")}
        />
      </div>

      <div
        className={`mt-6 grid grid-cols-1 gap-5 ${isLeagueTableFormat ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
      >
        {isLeagueTableFormat ? (
          <FeatureCard
            title="Current Table Topper"
            icon={<Trophy size={20} />}
            className="xl:col-span-1"
          >
            {tableTopper ? (
              <>
                <div className="flex items-center gap-6">
                  <TeamBadge
                    name={tableTopper.short || tableTopper.name}
                    logoUrl={tableTopper.logoUrl}
                    size="xl"
                  />
                  <h3 className="text-2xl font-black">{tableTopper.name}</h3>
                </div>
                <StatStrip
                  stats={[
                    [String(tableTopper.points), "Points"],
                    [String(tableTopper.played), "Played"],
                    [String(tableTopper.won), "Won"],
                    [String(tableTopper.draw), "Draw"],
                    [String(tableTopper.lost), "Lost"],
                  ]}
                />
              </>
            ) : (
              <EmptyState label="No standings yet. Standings appear after teams are approved and matches are finalized." />
            )}
          </FeatureCard>
        ) : null}

        <FeatureCard
          title="Top Scorer"
          icon={<Target size={20} />}
          iconTone="green"
        >
          {data.topScorer ? (
            <>
              <PlayerHero
                name={data.topScorer.name}
                team={data.topScorer.team}
                teamLogoUrl={data.topScorer.teamLogoUrl}
                avatarUrl={data.topScorer.avatarUrl}
                shirt="-"
                color="blue"
              />
              <StatStrip
                stats={[
                  [String(data.topScorer.goals), "Goals"],
                  [String(data.topScorer.matches), "Matches"],
                ]}
              />
            </>
          ) : (
            <EmptyState label="No scorer data yet." />
          )}
        </FeatureCard>

        <FeatureCard
          title="Top Assist Provider"
          icon={<UserPlus size={20} />}
          iconTone="green"
        >
          {data.topAssist ? (
            <>
              <PlayerHero
                name={data.topAssist.name}
                team={data.topAssist.team}
                teamLogoUrl={data.topAssist.teamLogoUrl}
                avatarUrl={data.topAssist.avatarUrl}
                shirt="-"
                color="blue"
              />
              <StatStrip
                stats={[
                  [String(data.topAssist.assists), "Assists"],
                  [String(data.topAssist.matches), "Matches"],
                ]}
              />
            </>
          ) : (
            <EmptyState label="No assist data yet." />
          )}
        </FeatureCard>

        <FeatureCard
          title="Top Rated Player"
          icon={<Star size={20} />}
          iconTone="purple"
        >
          {data.topRated ? (
            <>
              <PlayerHero
                name={data.topRated.name}
                team={data.topRated.team}
                teamLogoUrl={data.topRated.teamLogoUrl}
                avatarUrl={data.topRated.avatarUrl}
                shirt="-"
                color="black"
              />
              <StatStrip
                stats={[
                  [data.topRated.rating, "Average Rating"],
                  [String(data.topRated.matches), "Matches"],
                ]}
              />
            </>
          ) : (
            <EmptyState label="No rating data yet." />
          )}
        </FeatureCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="Matches Ready for Simulation"
          action="View all"
          onAction={() => onNavigate("matches-ready")}
        >
          {simulationError ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {simulationError}
            </div>
          ) : null}
          {data.readyMatches[0] ? (
            <ReadyMatchCard
              match={data.readyMatches[0]}
              simulating={simulatingId === data.readyMatches[0].id}
              onSimulate={() =>
                void simulateFromDashboard(data.readyMatches[0]!)
              }
            />
          ) : (
            <EmptyState label="No matches are ready for simulation." />
          )}
        </Panel>

        <Panel
          title="Recently Completed Matches"
          action="View all"
          onAction={() => onNavigate("completed-matches")}
        >
          {data.completedMatches.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {data.completedMatches.map((match) => (
                <div
                  key={match.id}
                  className="grid grid-cols-[120px_1fr_68px_1fr_70px] items-center gap-3 py-4 text-sm"
                >
                  <span className="text-slate-600">{match.date}</span>
                  <div className="justify-self-end">
                    <TeamCompact
                      name={match.home}
                      logoUrl={match.homeLogoUrl}
                    />
                  </div>
                  <span className="rounded-md bg-green-100 px-3 py-1 text-center font-black text-green-800">
                    {match.score}
                  </span>
                  <TeamCompact name={match.away} logoUrl={match.awayLogoUrl} />
                  <button
                    className="rounded-md border border-slate-200 px-4 py-2 font-semibold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm active:translate-y-0 active:scale-[0.97]"
                    onClick={() => onNavigate("completed-matches")}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No completed matches yet." />
          )}
          <button
            className="mt-4 w-full text-sm font-bold text-indigo-700 transition hover:text-indigo-900 hover:drop-shadow-[0_0_8px_rgba(79,70,229,0.25)]"
            onClick={() => onNavigate("completed-matches")}
          >
            View all completed matches →
          </button>
        </Panel>
      </div>
    </div>
  );
}

function adminBackLabel(tab: TabId | null) {
  switch (tab) {
    case "matches-ready":
      return "Back to Matches Ready";
    case "completed-matches":
      return "Back to Completed Matches";
    case "reports":
      return "Back to Player Stats";
    case "team-stats":
      return "Back to Team Stats";
    default:
      return "Back to Teams";
  }
}

function TeamsView({
  season,
  teams,
  initialTeamId,
  initialPlayerId,
  initialBackTab,
  onInitialTeamOpened,
  onNavigateBack,
  onKickOutTeam,
  onSendTeamMessage,
  onPlayerDecision,
  onPlayerAbility,
  onBulkRatePending,
  onBulkApproveRated,
  onPlayerAction,
  onAbilityScoresUpdate,
}: {
  season: SeasonDto;
  teams: AdminTeam[];
  initialTeamId?: string | null;
  initialPlayerId?: string | null;
  initialBackTab?: TabId | null;
  onInitialTeamOpened?: (() => void) | undefined;
  onNavigateBack: (tab: TabId) => void;
  onKickOutTeam: (id: string) => Promise<void>;
  onSendTeamMessage: (id: string) => Promise<void>;
  onPlayerDecision: (
    id: string,
    status: "APPROVED" | "REJECTED",
  ) => Promise<void>;
  onPlayerAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>;
  onBulkRatePending: (teamId: string, rerate?: boolean) => Promise<void>;
  onBulkApproveRated: (teamId: string) => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (
    id: string,
    scores: Record<string, number>,
  ) => Promise<void>;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    initialTeamId ?? null,
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerTab, setPlayerTab] = useState<"personal" | "stats">("personal");
  const [backTab, setBackTab] = useState<TabId | null>(initialBackTab ?? null);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const allTeamPlayers = selectedTeam
    ? [...selectedTeam.players, ...selectedTeam.suspendedPlayers]
    : [];
  const selectedPlayer =
    allTeamPlayers.find((player) => player.id === selectedPlayerId) ?? null;

  useEffect(() => {
    if (initialTeamId && teams.some((team) => team.id === initialTeamId)) {
      setSelectedTeamId(initialTeamId);
      setSelectedPlayerId(initialPlayerId ?? null);
      setPlayerTab(initialBackTab === "reports" ? "stats" : "personal");
      setBackTab(initialBackTab ?? null);
      onInitialTeamOpened?.();
    }
  }, [
    initialBackTab,
    initialPlayerId,
    initialTeamId,
    onInitialTeamOpened,
    teams,
  ]);

  if (selectedTeam && selectedPlayer) {
    return (
      <PlayerDetailView
        season={season}
        team={selectedTeam}
        player={selectedPlayer}
        backLabel={
          backTab && backTab !== "teams"
            ? adminBackLabel(backTab)
            : `Back to ${selectedTeam.name}`
        }
        activeTab={playerTab}
        onTabChange={setPlayerTab}
        onDecision={onPlayerDecision}
        onAbility={onPlayerAbility}
        onPlayerAction={onPlayerAction}
        onAbilityScoresUpdate={onAbilityScoresUpdate}
        onMessageManager={() => onSendTeamMessage(selectedTeam.id)}
        hideAbility={backTab === "reports"}
        onBack={() => {
          const destination = backTab;
          setSelectedPlayerId(null);
          setPlayerTab("personal");
          if (destination && destination !== "teams") {
            setSelectedTeamId(null);
            setBackTab(null);
            onNavigateBack(destination);
          }
        }}
      />
    );
  }

  if (selectedTeam) {
    return (
      <TeamDetailView
        team={selectedTeam}
        season={season}
        backLabel={adminBackLabel(backTab)}
        onBack={() => {
          const destination = backTab;
          setSelectedTeamId(null);
          setBackTab(null);
          if (destination && destination !== "teams") {
            onNavigateBack(destination);
          }
        }}
        onKickOutTeam={() => onKickOutTeam(selectedTeam.id)}
        onSendMessage={() => onSendTeamMessage(selectedTeam.id)}
        onPlayerDecision={onPlayerDecision}
        onPlayerAbility={onPlayerAbility}
        onBulkRatePending={(rerate) =>
          onBulkRatePending(selectedTeam.id, rerate)
        }
        onBulkApproveRated={() => onBulkApproveRated(selectedTeam.id)}
        onPlayerAction={onPlayerAction}
        onAbilityScoresUpdate={onAbilityScoresUpdate}
        onOpenPlayer={(playerId) => {
          setSelectedPlayerId(playerId);
          setPlayerTab("personal");
        }}
      />
    );
  }

  return (
    <div>
      <PageTitle
        title="Teams"
        subtitle="Approved teams in this selected league season. Open a team to review manager, players, requests, fixtures, results, and messages."
      />
      {teams.length === 0 ? (
        <EmptyState label="No approved teams yet. Teams will appear here after managers register and admin approves them." />
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {teams.map((team) => (
          <div
            key={team.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <TeamBadge
                  name={team.logo || team.name}
                  logoUrl={team.logoUrl}
                  size="lg"
                />
                <div>
                  <h2 className="text-xl font-black">{team.name}</h2>
                  <p className="text-sm text-slate-600">
                    Manager: {team.managerName}
                  </p>
                </div>
              </div>
              <StatusPill
                tone={team.status === "Approved" ? "green" : "orange"}
              >
                {team.status}
              </StatusPill>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <StatusBox label="Squad Count" value={String(team.squadCount)} />
              <StatusBox
                label="Approved Players"
                value={String(team.approvedPlayers)}
              />
              <StatusBox
                label="Pending Players"
                value={String(team.pendingPlayers)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setBackTab(null);
                setSelectedTeamId(team.id);
              }}
              className="mt-5 w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98]"
            >
              Open Team
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamDetailView({
  team,
  season,
  backLabel,
  onBack,
  onKickOutTeam,
  onSendMessage,
  onPlayerDecision,
  onPlayerAbility,
  onBulkRatePending,
  onBulkApproveRated,
  onPlayerAction,
  onAbilityScoresUpdate,
  onOpenPlayer,
}: {
  team: AdminTeam;
  season: SeasonDto;
  backLabel: string;
  onBack: () => void;
  onKickOutTeam: () => Promise<void>;
  onSendMessage: () => Promise<void>;
  onPlayerDecision: (
    id: string,
    status: "APPROVED" | "REJECTED",
  ) => Promise<void>;
  onPlayerAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>;
  onBulkRatePending: (rerate?: boolean) => Promise<void>;
  onBulkApproveRated: () => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (
    id: string,
    scores: Record<string, number>,
  ) => Promise<void>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const approvedPlayers = team.players.filter(
    (player) => player.approvalStatus === "Approved",
  );
  const pendingPlayers = team.players.filter(
    (player) => player.approvalStatus === "Pending",
  );
  const squadBreakdown = positionBreakdown(
    team.players.filter(
      (player) =>
        player.playerStatus !== "Removed" && player.playerStatus !== "Rejected",
    ),
  );
  const pendingUnratedCount = pendingPlayers.filter(
    (player) => player.abilityRating === "Not rated",
  ).length;
  const allPendingRated =
    pendingPlayers.length > 0 && pendingUnratedCount === 0;
  const [playerPanel, setPlayerPanel] = useState<"approved" | "pending" | null>(
    null,
  );
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<"rating" | "approving" | null>(
    null,
  );

  async function runBulkRate(rerate = false) {
    setBulkLoading("rating");
    try {
      await onBulkRatePending(rerate);
    } finally {
      setBulkLoading(null);
    }
  }

  async function runBulkApprove() {
    setBulkLoading("approving");
    try {
      await onBulkApproveRated();
      setBulkApproveOpen(false);
    } finally {
      setBulkLoading(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 active:translate-y-0 active:scale-[0.98]"
      >
        <ArrowLeft size={16} />
        {backLabel}
      </button>

      <div
        className="mb-7 flex flex-col justify-between gap-5 rounded-xl border border-white/40 p-6 text-white shadow-xl md:flex-row md:items-center"
        style={{
          background: `linear-gradient(110deg, ${team.accentColor ?? "#F59E0B"} 0%, ${team.primaryColor ?? "#6D28D9"} 48%, ${team.secondaryColor ?? "#0B1626"} 100%)`,
        }}
      >
        <div className="flex items-center gap-5">
          <TeamBadge
            name={team.logo || team.name}
            logoUrl={team.logoUrl}
            size="lg"
          />
          <div>
            <h1 className="text-3xl font-black">{team.name}</h1>
            <p className="text-white/85">
              {season.name} team profile and squad control.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onKickOutTeam}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25"
          >
            <Ban size={15} />
            Kick Out Team
          </button>
          <button
            type="button"
            onClick={onSendMessage}
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25"
          >
            <MessageSquare size={15} />
            Send Message
          </button>
        </div>
      </div>
      <TeamJerseyStrip team={team} />

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Team Profile">
          <div className="grid gap-3">
            <InfoBox label="Team Name" value={team.name} />
            <InfoBox label="Team Status" value={team.status} />
            <InfoBox label="Squad Count" value={String(team.squadCount)}>
              {squadBreakdown.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {squadBreakdown.map(([position, count]) => (
                    <span
                      key={position}
                      className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700"
                    >
                      {position} {count}
                    </span>
                  ))}
                </div>
              ) : null}
            </InfoBox>
          </div>
        </Panel>

        <Panel title="Manager Details">
          <div className="space-y-3 text-sm">
            <DetailRow label="Manager Name" value={team.managerName} />
            <DetailRow label="Email" value={team.managerEmail} />
            <DetailRow label="Phone" value={team.managerPhone} />
            <DetailRow
              label="Pending Players"
              value={String(team.pendingPlayers)}
            />
          </div>
        </Panel>

        <Panel title="Admin Messages">
          <div className="space-y-3">
            {team.messages.length > 0 ? (
              team.messages.map((message) => (
                <div
                  key={`${message.date}-${message.text}`}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black">{message.type}</span>
                    <StatusPill
                      tone={message.read === "Read" ? "green" : "orange"}
                    >
                      {message.read}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-slate-600">{message.text}</p>
                  <p className="mt-2 text-xs text-slate-400">{message.date}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No admin messages yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <div
        className={`mt-6 grid gap-5 ${pendingPlayers.length > 0 ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}
      >
        <Panel
          title="Approved Players"
          action="View all"
          onAction={() => setPlayerPanel("approved")}
        >
          <PlayerMiniTable
            players={approvedPlayers}
            onOpenPlayer={onOpenPlayer}
            onDecision={onPlayerDecision}
            onAbility={onPlayerAbility}
            onPlayerAction={onPlayerAction}
          />
        </Panel>

        {pendingPlayers.length > 0 ? (
          <Panel
            title="Pending Player Requests"
            action="Review all"
            onAction={() => setPlayerPanel("pending")}
          >
            <BulkPendingActions
              pendingCount={pendingPlayers.length}
              unratedCount={pendingUnratedCount}
              allRated={allPendingRated}
              loading={bulkLoading}
              onRate={() => void runBulkRate()}
              onRateAgain={() => void runBulkRate(true)}
              onApprove={() => setBulkApproveOpen(true)}
            />
            <PlayerMiniTable
              players={pendingPlayers}
              onOpenPlayer={onOpenPlayer}
              onDecision={onPlayerDecision}
              onAbility={onPlayerAbility}
              onPlayerAction={onPlayerAction}
              pending
            />
          </Panel>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Panel title="Removed / Suspended Players">
          <PlayerMiniTable
            players={team.suspendedPlayers}
            onOpenPlayer={onOpenPlayer}
            onDecision={onPlayerDecision}
            onAbility={onPlayerAbility}
            onPlayerAction={onPlayerAction}
          />
        </Panel>

        <Panel title="Team Fixtures">
          <SimpleRows
            rows={team.fixtures.map((fixture) => [
              fixture.date,
              `${fixture.home} vs ${fixture.away}`,
              fixture.status,
            ])}
          />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Team Results">
          <SimpleRows
            rows={team.results.map((result) => [
              result.date,
              result.match,
              result.result,
              result.status,
            ])}
          />
        </Panel>
      </div>

      {playerPanel ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div className="max-h-[86vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">
                  {playerPanel === "approved"
                    ? "Approved Players"
                    : "Pending Player Requests"}
                </p>
                <h2 className="mt-1 text-2xl font-black">{team.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPlayerPanel(null)}
                className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            {playerPanel === "pending" ? (
              <BulkPendingActions
                pendingCount={pendingPlayers.length}
                unratedCount={pendingUnratedCount}
                allRated={allPendingRated}
                loading={bulkLoading}
                onRate={() => void runBulkRate()}
                onRateAgain={() => void runBulkRate(true)}
                onApprove={() => setBulkApproveOpen(true)}
              />
            ) : null}
            <PlayerMiniTable
              players={
                playerPanel === "approved" ? approvedPlayers : pendingPlayers
              }
              onOpenPlayer={onOpenPlayer}
              onDecision={onPlayerDecision}
              onAbility={onPlayerAbility}
              onPlayerAction={onPlayerAction}
              pending={playerPanel === "pending"}
            />
          </div>
        </div>
      ) : null}
      {bulkApproveOpen ? (
        <BulkApproveConfirmModal
          count={pendingPlayers.length}
          loading={bulkLoading === "approving"}
          onClose={() => setBulkApproveOpen(false)}
          onConfirm={() => void runBulkApprove()}
        />
      ) : null}
    </div>
  );
}

function PlayerDetailView({
  season,
  team,
  player,
  backLabel,
  activeTab,
  onTabChange,
  onDecision,
  onAbility,
  onPlayerAction,
  onAbilityScoresUpdate,
  onMessageManager,
  hideAbility,
  onBack,
}: {
  season: SeasonDto;
  team: AdminTeam;
  player: AdminPlayer;
  backLabel: string;
  activeTab: "personal" | "stats";
  onTabChange: (tab: "personal" | "stats") => void;
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (
    id: string,
    scores: Record<string, number>,
  ) => Promise<void>;
  onMessageManager: () => Promise<void>;
  hideAbility?: boolean;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 active:translate-y-0 active:scale-[0.98]"
      >
        <ArrowLeft size={16} />
        {backLabel}
      </button>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <PlayerAvatar player={player} />
            <div>
              <h1 className="text-3xl font-black">{player.fullName}</h1>
              <p className="text-slate-600">
                {team.name} · {season.name} · #{player.jerseyNumber} ·{" "}
                {player.footballPosition}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill
              tone={
                player.playerStatus === "Approved"
                  ? "green"
                  : player.playerStatus === "Pending"
                    ? "orange"
                    : "blue"
              }
            >
              {player.playerStatus}
            </StatusPill>
            <StatusPill
              tone={
                player.abilityRating === "High"
                  ? "green"
                  : player.abilityRating === "Moderate"
                    ? "blue"
                    : "orange"
              }
            >
              Rating: {player.abilityRating}
            </StatusPill>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-2 md:w-[420px]">
          <TabButton
            active={activeTab === "personal"}
            onClick={() => onTabChange("personal")}
          >
            Personal Data
          </TabButton>
          <TabButton
            active={activeTab === "stats"}
            onClick={() => onTabChange("stats")}
          >
            League Stats
          </TabButton>
        </div>
      </div>

      {activeTab === "personal" ? (
        <PlayerPersonalData
          team={team}
          season={season}
          player={player}
          onDecision={onDecision}
          onAbility={onAbility}
          onPlayerAction={onPlayerAction}
          onAbilityScoresUpdate={onAbilityScoresUpdate}
          onMessageManager={onMessageManager}
          showAbility={!hideAbility}
        />
      ) : (
        <PlayerLeagueStats player={player} />
      )}
    </div>
  );
}

function TeamJerseyStrip({ team }: { team: AdminTeam }) {
  const jerseys = [
    { label: "Home", url: team.homeJerseyUrl },
    { label: "Away", url: team.awayJerseyUrl },
    { label: "GK Home", url: team.gkHomeJerseyUrl },
    { label: "GK Away", url: team.gkAwayJerseyUrl },
  ];
  const hasJerseys = jerseys.some((jersey) => jersey.url);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-black">Team Jerseys</h2>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-indigo-700">
          Home / Away / GK
        </span>
      </div>
      {hasJerseys ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {jerseys.map((jersey) => (
            <AdminJerseyCard
              key={jersey.label}
              teamName={team.name}
              label={jersey.label}
              url={jersey.url}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
          No jersey URLs saved for this team yet.
        </div>
      )}
    </div>
  );
}

function AdminJerseyCard({
  teamName,
  label,
  url,
}: {
  teamName: string;
  label: string;
  url: string | null | undefined;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 flex h-56 items-center justify-center rounded-lg bg-white p-1">
        {url ? (
          <button
            type="button"
            className="flex h-full w-full items-center justify-center rounded-lg transition hover:scale-[1.02] hover:bg-slate-50"
            onClick={() => setPreviewOpen(true)}
            title={`Open ${teamName} ${label} jersey`}
            aria-label={`Open ${teamName} ${label} jersey`}
          >
            <img
              src={url}
              alt={`${teamName} ${label} jersey`}
              className="max-h-full max-w-full object-contain"
            />
          </button>
        ) : (
          <span className="text-sm font-semibold text-slate-400">Not set</span>
        )}
      </div>
      {previewOpen && url ? (
        <AdminImagePreviewModal
          title={`${teamName} ${label} Jersey`}
          src={url}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

function AdminImagePreviewModal({
  title,
  src,
  onClose,
}: {
  title: string;
  src: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black">{title}</h3>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="grid place-items-center rounded-3xl bg-slate-100 p-4">
          <img
            src={src}
            alt={title}
            className="max-h-[75vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function PlayerPersonalData({
  team,
  season,
  player,
  onDecision,
  onAbility,
  onPlayerAction,
  onAbilityScoresUpdate,
  onMessageManager,
  showAbility,
}: {
  team: AdminTeam;
  season: SeasonDto;
  player: AdminPlayer;
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (
    id: string,
    scores: Record<string, number>,
  ) => Promise<void>;
  onMessageManager: () => Promise<void>;
  showAbility: boolean;
}) {
  const [editingAbility, setEditingAbility] = useState(false);
  const [abilityDraft, setAbilityDraft] = useState<Record<string, string>>({});
  const isApproved = player.approvalStatus === "Approved";
  const isPending = player.approvalStatus === "Pending";
  const isSuspended = player.playerStatus === "Suspended";
  const isRemoved = player.playerStatus === "Removed";
  const canApprove = isPending && player.abilityRating !== "Not rated";
  const canRate = isPending;
  const editableAbilityRows = player.abilityDetails.filter(
    (ability) => ability.label !== "Tier" && ability.label !== "Overall",
  );
  function startAbilityEdit() {
    setAbilityDraft(
      Object.fromEntries(
        editableAbilityRows.map((ability) => [ability.label, ability.value]),
      ),
    );
    setEditingAbility(true);
  }
  function toAbilityKey(label: string) {
    return label.toLowerCase().replaceAll(" ", "_");
  }
  async function saveAbilityEdit() {
    const scores = Object.fromEntries(
      Object.entries(abilityDraft)
        .map(([label, value]) => [toAbilityKey(label), Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );
    await onAbilityScoresUpdate(player.id, scores);
    setEditingAbility(false);
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <Panel title="Identity + Registration Data">
        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow label="Player Code" value={player.code} />
          <DetailRow label="Full Name" value={player.fullName} />
          <DetailRow label="Date of Birth" value={player.dateOfBirth} />
          <DetailRow label="Age" value={String(player.age)} />
          <DetailRow label="ID Type" value={player.idType} />
          <DetailRow label="Masked ID Number" value={player.maskedId} />
          <DetailRow label="Team Name" value={team.name} />
          <DetailRow label="Season Name" value={season.name} />
          <DetailRow
            label="Jersey Number"
            value={String(player.jerseyNumber)}
          />
          <DetailRow
            label="Position"
            value={`${player.footballPosition} (${player.position})`}
          />
          <DetailRow label="Preferred Foot" value={player.preferredFoot} />
          <DetailRow label="Approval Status" value={player.approvalStatus} />
          <DetailRow label="Player Status" value={player.playerStatus} />
          <DetailRow
            label="Registration Date"
            value={player.registrationDate}
          />
          <DetailRow
            label="Submitted By Manager"
            value={player.submittedByManager}
          />
          <DetailRow
            label="Admin Approval Date"
            value={player.adminApprovalDate}
          />
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Admin Message
          </p>
          <p className="mt-2 text-sm text-slate-700">{player.adminMessage}</p>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Uploaded ID Document">
          <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
            <FileText className="mx-auto text-indigo-600" size={34} />
            <p className="mt-3 text-sm font-black">{player.uploadedDocument}</p>
            <button className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 active:translate-y-0 active:scale-[0.98]">
              View Document
            </button>
          </div>
        </Panel>

        <Panel title="Admin Actions">
          <div className="grid gap-2">
            {isPending ? (
              <>
                <AdminActionButton
                  label="Approve Player"
                  disabled={!canApprove}
                  onClick={() => onDecision(player.id, "APPROVED")}
                />
                <DangerButton
                  label="Reject Player"
                  onClick={() => onPlayerAction("reject", player)}
                />
              </>
            ) : null}
            {isApproved && !isSuspended && !isRemoved ? (
              <>
                <DangerButton
                  label="Remove Player"
                  onClick={() => onPlayerAction("remove", player)}
                />
                <DangerButton
                  label="Suspend Player"
                  onClick={() => onPlayerAction("suspend", player)}
                />
              </>
            ) : null}
            {isSuspended ? (
              <>
                <AdminActionButton
                  label="Unsuspend Player"
                  onClick={() => onPlayerAction("unsuspend", player)}
                />
                <DangerButton
                  label="Remove Player"
                  onClick={() => onPlayerAction("remove", player)}
                />
              </>
            ) : null}
            <AdminActionButton
              label="Send Message to Manager"
              onClick={onMessageManager}
            />
            <div className="grid grid-cols-3 gap-2">
              <AdminActionButton
                label="Low"
                selected={player.abilityRating === "Low"}
                disabled={!canRate}
                onClick={() => onAbility(player.id, "LOW")}
              />
              <AdminActionButton
                label="Moderate"
                selected={player.abilityRating === "Moderate"}
                disabled={!canRate}
                onClick={() => onAbility(player.id, "MODERATE")}
              />
              <AdminActionButton
                label="High"
                selected={player.abilityRating === "High"}
                disabled={!canRate}
                onClick={() => onAbility(player.id, "HIGH")}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Ability scores are visible to administrators and the player&apos;s
            owning manager, but remain hidden from opponents and public users.
            Approval is blocked until Low, Moderate, or High is assigned.
          </p>
        </Panel>

        {showAbility ? (
          <Panel
            title="Hidden Ability Scores"
            action={
              player.abilityDetails.length > 0
                ? editingAbility
                  ? "Save scores"
                  : "Edit scores"
                : undefined
            }
            onAction={
              player.abilityDetails.length > 0
                ? () => {
                    if (editingAbility) void saveAbilityEdit();
                    else startAbilityEdit();
                  }
                : undefined
            }
          >
            {player.abilityDetails.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {player.abilityDetails.map((ability) =>
                  editingAbility &&
                  ability.label !== "Tier" &&
                  ability.label !== "Overall" ? (
                    <label
                      key={ability.label}
                      className="rounded-lg bg-slate-50 p-3"
                    >
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        {ability.label}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={92}
                        value={abilityDraft[ability.label] ?? ability.value}
                        onChange={(event) =>
                          setAbilityDraft((current) => ({
                            ...current,
                            [ability.label]: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-black text-slate-800"
                      />
                    </label>
                  ) : (
                    <AbilityDetailCard key={ability.label} ability={ability} />
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No ability scores generated yet. Click Low, Moderate, or High
                first.
              </p>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function PlayerLeagueStats({ player }: { player: AdminPlayer }) {
  const stats = player.leagueStats;
  const statRows = [
    ["Matches Played", stats.matchesPlayed],
    ["Starts", stats.starts],
    ["Minutes Played", stats.minutesPlayed],
    ["Goals", stats.goals],
    ["Assists", stats.assists],
    ["Shots", stats.shots],
    ["Shots on Target", stats.shotsOnTarget],
    ["Shot Accuracy", stats.shotAccuracy],
    ["Chances Created", stats.chancesCreated],
    ["Total Passes", stats.totalPasses],
    ["Accurate Passes", stats.accuratePasses],
    ["Pass Accuracy", stats.passAccuracy],
    ["Dribbles Attempted", stats.dribblesAttempted],
    ["Successful Dribbles", stats.successfulDribbles],
    ["Dispossessed", stats.dispossessed],
    ["Tackles", stats.tackles],
    ["Interceptions", stats.interceptions],
    ["Yellow Cards", stats.yellowCards],
    ["Red Cards", stats.redCards],
    ["Average Rating", stats.averageRating],
    ["Best Match Rating", stats.bestMatchRating],
    ["Lowest Match Rating", stats.lowestMatchRating],
    ["Player of the Match", stats.playerOfTheMatch],
  ];

  return (
    <div className="space-y-6">
      <Panel title="Overall League Stats">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {statRows.map(([label, value]) => {
            const isRating = String(label).includes("Rating");
            return (
              <InfoBox
                key={label}
                label={String(label)}
                value={
                  isRating ? (
                    <LeagueRatingCapsule value={value} />
                  ) : (
                    String(value)
                  )
                }
              />
            );
          })}
        </div>
      </Panel>

      <Panel title="Match-by-Match Performance">
        {player.performances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    "Match",
                    "Date",
                    "Opponent",
                    "Result",
                    "Minutes",
                    "Goals",
                    "Assists",
                    "Shots",
                    "SOT",
                    "Chances",
                    "Pass Accuracy",
                    "Dribbles",
                    "Tackles",
                    "Cards",
                    "Rating",
                  ].map((header) => (
                    <th key={header} className="px-4 py-3 text-left font-black">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {player.performances.map((row) => (
                  <tr
                    key={`${row.date}-${row.match}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-bold">{row.match}</td>
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3">{row.opponent}</td>
                    <td className="px-4 py-3 font-black text-indigo-700">
                      {row.result}
                    </td>
                    <td className="px-4 py-3">{row.minutes}</td>
                    <td className="px-4 py-3">{row.goals}</td>
                    <td className="px-4 py-3">{row.assists}</td>
                    <td className="px-4 py-3">{row.shots}</td>
                    <td className="px-4 py-3">{row.shotsOnTarget}</td>
                    <td className="px-4 py-3">{row.chancesCreated}</td>
                    <td className="px-4 py-3">{row.passAccuracy}</td>
                    <td className="px-4 py-3">{row.successfulDribbles}</td>
                    <td className="px-4 py-3">{row.tackles}</td>
                    <td className="px-4 py-3">{row.cards}</td>
                    <td className="px-4 py-3 font-black">
                      <LeagueRatingCapsule value={row.rating} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No match performance yet. Stats will appear after confirmed matches.
          </p>
        )}
      </Panel>
    </div>
  );
}

function BulkPendingActions({
  pendingCount,
  unratedCount,
  allRated,
  loading,
  onRate,
  onRateAgain,
  onApprove,
}: {
  pendingCount: number;
  unratedCount: number;
  allRated: boolean;
  loading: "rating" | "approving" | null;
  onRate: () => void;
  onRateAgain: () => void;
  onApprove: () => void;
}) {
  if (pendingCount === 0) return null;
  const ratedCount = pendingCount - unratedCount;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-700">
          Bulk Actions
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {ratedCount}/{pendingCount} pending players rated. Moderate stays the
          majority, with occasional Low/High exceptions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {unratedCount > 0 ? (
          <button
            type="button"
            onClick={onRate}
            disabled={loading !== null}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading === "rating" ? "Rating..." : "Rate Everyone Randomly"}
          </button>
        ) : null}
        {ratedCount > 0 ? (
          <button
            type="button"
            onClick={onRateAgain}
            disabled={loading !== null}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-black text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading === "rating" ? "Rating..." : "Rate Again"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onApprove}
          disabled={!allRated || loading !== null}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          Approve All Rated Players
        </button>
      </div>
    </div>
  );
}

function BulkApproveConfirmModal({
  count,
  loading,
  onClose,
  onConfirm,
}: {
  count: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">
          Bulk Approval
        </p>
        <h2 className="mt-2 text-3xl font-black">Approve all rated players?</h2>
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          This will approve all {count} pending players who already have Low,
          Moderate, or High rating selected. Approved players will become
          available for lineup selection.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? "Approving..." : "Approve All"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerMiniTable({
  players,
  onOpenPlayer,
  onDecision,
  onAbility,
  onPlayerAction,
  pending = false,
}: {
  players: AdminPlayer[];
  onOpenPlayer: (playerId: string) => void;
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  pending?: boolean;
}) {
  if (players.length === 0)
    return (
      <p className="text-sm text-slate-500">No players in this section.</p>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {[
              "Player",
              "Code",
              "Position",
              "Jersey",
              "OVR",
              "Status",
              "Actions",
            ].map((header) => (
              <th key={header} className="px-4 py-3 text-left font-black">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {players.map((player) => (
            <tr key={player.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpenPlayer(player.id)}
                  className="inline-flex items-center gap-3 text-left font-black text-indigo-700 transition hover:text-indigo-950"
                >
                  <SmallPlayerAvatar player={player} />
                  <span>{player.fullName}</span>
                </button>
              </td>
              <td className="px-4 py-3">{player.code}</td>
              <td className="px-4 py-3">{player.footballPosition}</td>
              <td className="px-4 py-3">#{player.jerseyNumber}</td>
              <td className="px-4 py-3">
                <AbilityCapsule player={player} />
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  tone={
                    player.playerStatus === "Approved"
                      ? "green"
                      : player.playerStatus === "Removed" ||
                          player.playerStatus === "Suspended" ||
                          player.playerStatus === "Rejected"
                        ? "orange"
                        : "orange"
                  }
                >
                  {player.playerStatus}
                </StatusPill>
              </td>
              <td className="px-4 py-3">
                <ActionGroup
                  actions={playerMiniActions(
                    player,
                    pending,
                    onOpenPlayer,
                    onDecision,
                    onAbility,
                    onPlayerAction,
                  )}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function playerMiniActions(
  player: AdminPlayer,
  pending: boolean,
  onOpenPlayer: (playerId: string) => void,
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>,
  onAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>,
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void,
): ActionItem[] {
  if (pending || player.approvalStatus === "Pending") {
    return [
      {
        label: "Low",
        onClick: () => void onAbility(player.id, "LOW"),
        selected: player.abilityRating === "Low",
      },
      {
        label: "Moderate",
        onClick: () => void onAbility(player.id, "MODERATE"),
        selected: player.abilityRating === "Moderate",
      },
      {
        label: "High",
        onClick: () => void onAbility(player.id, "HIGH"),
        selected: player.abilityRating === "High",
      },
      {
        label: "Approve",
        onClick: () => void onDecision(player.id, "APPROVED"),
        disabled: player.abilityRating === "Not rated",
      },
      {
        label: "Reject",
        onClick: () => onPlayerAction("reject", player),
        danger: true,
      },
    ];
  }
  if (player.playerStatus === "Suspended") {
    return [
      { label: "Open", onClick: () => onOpenPlayer(player.id) },
      {
        label: "Unsuspend",
        onClick: () => onPlayerAction("unsuspend", player),
      },
      {
        label: "Remove",
        onClick: () => onPlayerAction("remove", player),
        danger: true,
      },
    ];
  }
  if (player.playerStatus === "Removed" || player.playerStatus === "Rejected") {
    return [{ label: "Open", onClick: () => onOpenPlayer(player.id) }];
  }
  return [
    { label: "Open", onClick: () => onOpenPlayer(player.id) },
    {
      label: "Remove",
      onClick: () => onPlayerAction("remove", player),
      danger: true,
    },
    {
      label: "Suspend",
      onClick: () => onPlayerAction("suspend", player),
      danger: true,
    },
  ];
}

function SimpleRows({ rows }: { rows: Array<Array<string>> }) {
  if (rows.length === 0)
    return <p className="text-sm text-slate-500">No records yet.</p>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <div
          key={`${row.join("-")}-${index}`}
          className="grid gap-2 py-3 text-sm md:grid-cols-4"
        >
          {row.map((cell, cellIndex) => (
            <span
              key={`${cell}-${cellIndex}`}
              className="font-medium text-slate-700"
            >
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-800">{value}</p>
    </div>
  );
}

function abilityTone(tier: AdminPlayer["abilityRating"]) {
  if (tier === "High") return "bg-sky-100 text-sky-700 ring-sky-200";
  if (tier === "Moderate") return "bg-green-100 text-green-700 ring-green-200";
  if (tier === "Low") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
}

function overallAbilityTone(
  overall: number,
  tier: AdminPlayer["abilityRating"],
) {
  if (tier !== "Not rated") return abilityTone(tier);
  if (overall >= 73) return abilityTone("High");
  if (overall >= 55) return abilityTone("Moderate");
  return abilityTone("Low");
}

function LeagueRatingCapsule({ value }: { value: unknown }) {
  const numeric = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(numeric)
  ) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
        N/A
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black text-white ${ratingBadgeClass(numeric)}`}
    >
      {formatRating(numeric)}
    </span>
  );
}

function AbilityCapsule({ player }: { player: AdminPlayer }) {
  if (player.overallRating === null || player.overallRating === undefined) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-400 ring-1 ring-slate-200">
        N/A
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${overallAbilityTone(player.overallRating, player.abilityRating)}`}
    >
      {player.overallRating}
    </span>
  );
}

function AbilityDetailCard({
  ability,
}: {
  ability: { label: string; value: string };
}) {
  const numeric = Number(ability.value);
  const bg =
    ability.label === "Tier"
      ? ability.value === "HIGH"
        ? "bg-sky-50 ring-sky-100"
        : ability.value === "MODERATE"
          ? "bg-green-50 ring-green-100"
          : "bg-amber-50 ring-amber-100"
      : Number.isFinite(numeric)
        ? numeric >= 73
          ? "bg-sky-50 ring-sky-100"
          : numeric >= 55
            ? "bg-green-50 ring-green-100"
            : "bg-amber-50 ring-amber-100"
        : "bg-slate-50 ring-slate-100";
  return (
    <div className={`rounded-lg p-3 ring-1 ${bg}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {ability.label}
      </p>
      <p className="mt-1 font-bold text-slate-800">{ability.value}</p>
    </div>
  );
}

function SmallPlayerAvatar({ player }: { player: AdminPlayer }) {
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.fullName}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white"
      />
    );
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-400 text-xs font-black text-white">
      {player.avatar}
    </span>
  );
}

function PlayerAvatar({ player }: { player: AdminPlayer }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  if (player.avatarUrl) {
    return (
      <>
        <button
          type="button"
          className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 shadow-lg ring-4 ring-white transition hover:scale-105 hover:ring-indigo-200"
          onClick={() => setPreviewOpen(true)}
          title={`Open ${player.fullName} miniface`}
          aria-label={`Open ${player.fullName} miniface`}
        >
          <img
            src={player.avatarUrl}
            alt={player.fullName}
            className="h-full w-full object-cover"
          />
        </button>
        {previewOpen ? (
          <AdminFacePreviewModal
            player={player}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null}
      </>
    );
  }
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-400 text-xl font-black text-white shadow-lg">
      {player.avatar}
    </div>
  );
}

function AdminFacePreviewModal({
  player,
  onClose,
}: {
  player: AdminPlayer;
  onClose: () => void;
}) {
  if (!player.avatarUrl) return null;
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black">{player.fullName}</h3>
            <p className="text-sm font-semibold text-slate-500">
              #{player.jerseyNumber} · {player.footballPosition}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="grid place-items-center rounded-3xl bg-slate-100 p-4">
          <img
            src={player.avatarUrl}
            alt={player.fullName}
            className="max-h-[70vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-black transition-all duration-200 ${
        active
          ? "bg-indigo-600 text-white shadow"
          : "text-slate-600 hover:bg-white hover:text-indigo-700"
      }`}
    >
      {children}
    </button>
  );
}

function AdminActionButton({
  label,
  icon,
  onClick,
  disabled,
  selected,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
        selected
          ? "border-green-300 bg-green-100 text-green-800 ring-2 ring-green-200"
          : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
      }`}
    >
      {selected ? <CheckCircle2 size={14} /> : null}
      {icon}
      {label}
    </button>
  );
}

function DangerButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-sm active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-red-50 disabled:hover:shadow-none"
    >
      {icon}
      {label}
    </button>
  );
}

function TeamRequestsView({
  teamRequests,
  onDecision,
}: {
  teamRequests: TeamRequest[];
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
}) {
  return (
    <CrudPage
      title="Team Requests"
      subtitle="Approve or reject manager team applications for this selected season."
      columns={[
        "Team Name",
        "Manager Name",
        "Season",
        "Squad Count",
        "Status",
        "Actions",
      ]}
      rows={teamRequests.map((row) => [
        <TeamCompact key="team" name={row.team} logoUrl={row.logoUrl} />,
        row.manager,
        row.season,
        String(row.squad),
        <StatusPill key="status" tone="orange">
          {row.status}
        </StatusPill>,
        <ActionGroup
          key="actions"
          actions={[
            {
              label: "Approve",
              onClick: () => void onDecision(row.id, "APPROVED"),
            },
            {
              label: "Reject",
              onClick: () => void onDecision(row.id, "REJECTED"),
              danger: true,
            },
          ]}
        />,
      ])}
    />
  );
}

function PlayerRequestsView({
  playerRequests,
  onDecision,
  onAbility,
  onPlayerAction,
}: {
  playerRequests: PlayerRequest[];
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (
    id: string,
    ability: "LOW" | "MODERATE" | "HIGH",
  ) => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(
    null,
  );
  return (
    <>
      <CrudPage
        title="Player Requests"
        subtitle="Review players, assign ability rating, approve, reject, or remove them."
        columns={[
          "Player Code",
          "Player Name",
          "Team Name",
          "Position",
          "Jersey",
          "ID Type",
          "Approval",
          "OVR",
          "Actions",
        ]}
        rows={playerRequests.map((row) => {
          const canRate = row.teamStatus === RegistrationStatus.APPROVED;
          const canApprove = canRate && row.abilityRating !== "Not rated";
          return [
            row.code,
            <button
              key="name"
              type="button"
              onClick={() => row.player && setSelectedPlayer(row.player)}
              className="text-left font-black text-slate-800 underline-offset-4 transition hover:text-indigo-700 hover:underline disabled:cursor-default disabled:no-underline"
              disabled={!row.player}
            >
              {row.name}
            </button>,
            row.team,
            row.position,
            String(row.jersey),
            row.idType,
            <div key="status" className="flex flex-col items-start gap-2">
              <StatusPill tone="orange">{row.status}</StatusPill>
              <span className="text-xs font-bold text-slate-500">
                Ability: {row.abilityRating}
              </span>
            </div>,
            row.player ? (
              <AbilityCapsule key="ovr" player={row.player} />
            ) : (
              <span key="ovr" className="text-xs font-bold text-slate-400">
                N/A
              </span>
            ),
            <ActionGroup
              key="actions"
              actions={[
                {
                  label: "Low",
                  onClick: () => void onAbility(row.id, "LOW"),
                  disabled: !canRate,
                  selected: row.abilityRating === "Low",
                },
                {
                  label: "Moderate",
                  onClick: () => void onAbility(row.id, "MODERATE"),
                  disabled: !canRate,
                  selected: row.abilityRating === "Moderate",
                },
                {
                  label: "High",
                  onClick: () => void onAbility(row.id, "HIGH"),
                  disabled: !canRate,
                  selected: row.abilityRating === "High",
                },
                {
                  label: "Approve",
                  onClick: () => void onDecision(row.id, "APPROVED"),
                  disabled: !canApprove,
                },
                {
                  label: "Reject",
                  onClick: () =>
                    row.player && onPlayerAction("reject", row.player),
                  disabled: !row.player,
                  danger: true,
                },
              ]}
            />,
          ];
        })}
      />
      {selectedPlayer ? (
        <PlayerRequestDetailModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      ) : null}
    </>
  );
}

function FixturesView({ season }: { season: SeasonDto }) {
  const [data, setData] = useState<AdminFixturesResponse | null>(null);
  const [preview, setPreview] = useState<FixturePreviewResponse | null>(null);
  const [previewMode, setPreviewMode] = useState<
    "all" | "group" | "knockout" | null
  >(null);
  const [tab, setTab] = useState<"group" | "knockout" | "all">("all");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [message, setMessage] = useState("");
  const isGroupKnockout = isGroupKnockoutFormat(season.format);

  async function loadFixtures() {
    const result = await api<AdminFixturesResponse>(
      `/admin/seasons/${season.id}/fixtures`,
    );
    setData(result);
  }

  useEffect(() => {
    setPreview(null);
    setPreviewMode(null);
    setTab(isGroupKnockout ? "group" : "all");
    void loadFixtures().catch((error) =>
      setMessage(
        error instanceof Error ? error.message : "Could not load fixtures",
      ),
    );
  }, [season.id, isGroupKnockout]);

  const teamById = useMemo(
    () => new Map((data?.approved_teams ?? []).map((team) => [team.id, team])),
    [data?.approved_teams],
  );
  const groupById = useMemo(
    () => new Map((data?.groups ?? []).map((group) => [group.id, group])),
    [data?.groups],
  );
  const rows = preview?.fixtures ?? data?.fixtures ?? [];
  const stageFilteredRows = rows.filter((row) => {
    if (!isGroupKnockout || tab === "all") return true;
    if (tab === "group") return row.stage === "GROUP";
    return row.stage !== "GROUP" && row.stage !== "LEAGUE";
  });
  const filteredRows = stageFilteredRows.filter((row) => {
    if (teamFilter === "ALL") return true;
    return (
      row.home_team_registration_id === teamFilter ||
      row.away_team_registration_id === teamFilter
    );
  });
  const groupFixtures =
    data?.fixtures.filter((fixture) => fixture.stage === "GROUP") ?? [];
  const groupStageComplete =
    groupFixtures.length > 0 &&
    groupFixtures.every(
      (fixture) =>
        fixture.status === FixtureStatus.FINAL ||
        fixture.status === "COMPLETED" ||
        fixture.result_confirmed,
    );
  const hasSavedFixtures = (data?.fixtures.length ?? 0) > 0;

  function rowTeamName(
    row: FixtureApiRow | FixturePreviewRow,
    side: "home" | "away",
  ) {
    const id =
      side === "home"
        ? row.home_team_registration_id
        : row.away_team_registration_id;
    const source = side === "home" ? row.home_source : row.away_source;
    const embedded =
      "home_team" in row && side === "home"
        ? row.home_team
        : "away_team" in row && side === "away"
          ? row.away_team
          : null;
    return (
      embedded?.teams?.name ??
      (id ? teamById.get(id)?.name : null) ??
      source ??
      "TBD"
    );
  }

  function rowTeamLogo(
    row: FixtureApiRow | FixturePreviewRow,
    side: "home" | "away",
  ) {
    const id =
      side === "home"
        ? row.home_team_registration_id
        : row.away_team_registration_id;
    const embedded =
      "home_team" in row && side === "home"
        ? row.home_team
        : "away_team" in row && side === "away"
          ? row.away_team
          : null;
    return (
      embedded?.teams?.logo_url ??
      (id ? teamById.get(id)?.logo_url : null) ??
      null
    );
  }

  function rowScore(row: FixtureApiRow | FixturePreviewRow) {
    if (!("home_score" in row) || !("away_score" in row)) return null;
    if (
      row.home_score === null ||
      row.home_score === undefined ||
      row.away_score === null ||
      row.away_score === undefined
    )
      return null;
    return fixtureOutcomeScore(row);
  }

  function rowOutcomeLabel(row: FixtureApiRow | FixturePreviewRow) {
    return "home_score" in row ? fixtureOutcomeLabel(row) : null;
  }

  function rowGroupName(row: FixtureApiRow | FixturePreviewRow) {
    return (
      ("season_groups" in row ? row.season_groups?.name : null) ??
      row.group_name ??
      (row.group_id ? groupById.get(row.group_id)?.name : null) ??
      "—"
    );
  }

  async function makePreview(mode: "all" | "group" | "knockout") {
    setMessage("");
    const endpoint =
      mode === "group"
        ? `/admin/seasons/${season.id}/fixtures/group/preview`
        : mode === "knockout"
          ? `/admin/seasons/${season.id}/fixtures/knockout/preview`
          : `/admin/seasons/${season.id}/fixtures/preview`;
    const result = await api<FixturePreviewResponse>(endpoint, {
      method: "POST",
      body: JSON.stringify({ stage: mode }),
    });
    setPreview(result);
    setPreviewMode(mode);
    setTab(
      mode === "knockout" ? "knockout" : mode === "group" ? "group" : "all",
    );
  }

  async function confirmPreview() {
    if (!previewMode) return;
    const endpoint =
      previewMode === "group"
        ? `/admin/seasons/${season.id}/fixtures/group/confirm`
        : previewMode === "knockout"
          ? `/admin/seasons/${season.id}/fixtures/knockout/confirm`
          : `/admin/seasons/${season.id}/fixtures/confirm`;
    await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ stage: previewMode }),
    });
    setPreview(null);
    setPreviewMode(null);
    await loadFixtures();
  }

  async function regenerateFixtures() {
    if (
      !window.confirm("Delete generated fixtures and allow a fresh generation?")
    )
      return;
    await api(`/admin/seasons/${season.id}/fixtures/regenerate`, {
      method: "DELETE",
    });
    setPreview(null);
    setPreviewMode(null);
    await loadFixtures();
  }

  async function finalizeFixtures() {
    if (!window.confirm("Finalize fixtures? Regeneration will be disabled."))
      return;
    await api(`/admin/seasons/${season.id}/fixtures/finalize`, {
      method: "POST",
    });
    await loadFixtures();
  }

  if (!data) {
    return (
      <div>
        <PageTitle
          title="Fixtures"
          subtitle="Generate and manage season fixtures"
        />
        <EmptyState label={message || "Loading fixture settings..."} />
      </div>
    );
  }

  const isFinalized = data.fixture_status === "FINALIZED";

  return (
    <div>
      <PageTitle
        title="Fixtures"
        subtitle="Generate and manage season fixtures"
      />

      {message ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {message}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Season Format" value={formatLabel(season.format)} />
        <SummaryCard
          label="Round Format"
          value={formatLabel(data.season.round_format ?? season.format)}
        />
        <SummaryCard label="Season Start" value={safeDate(season.start_date)} />
        <SummaryCard label="Season End" value={safeDate(season.end_date)} />
        <SummaryCard
          label="Approved Teams"
          value={String(data.approved_teams.length)}
        />
        <SummaryCard label="Fixture Status" value={data.fixture_status} />
      </div>

      {isGroupKnockout ? (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Group Count"
            value={String(season.group_count ?? 0)}
          />
          <SummaryCard
            label="Teams Per Group"
            value={String(season.teams_per_group ?? 0)}
          />
          <SummaryCard
            label="Qualifiers Per Group"
            value={String(season.qualifiers_per_group ?? 0)}
          />
          <SummaryCard
            label="Total Knockout Qualifiers"
            value={String(
              Number(season.group_count ?? 0) *
                Number(season.qualifiers_per_group ?? 0),
            )}
          />
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {!hasSavedFixtures && !preview && !isGroupKnockout ? (
            <button
              type="button"
              onClick={() =>
                void makePreview("all").catch((error) =>
                  setMessage(error.message),
                )
              }
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700"
            >
              Generate Fixtures
            </button>
          ) : null}

          {isGroupKnockout && !preview ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void makePreview("group").catch((error) =>
                    setMessage(error.message),
                  )
                }
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                Generate Group Fixtures
              </button>
              <button
                type="button"
                disabled={!groupStageComplete}
                title={
                  !groupStageComplete
                    ? "Knockout fixtures will unlock after all group stage results are confirmed."
                    : undefined
                }
                onClick={() =>
                  void makePreview("knockout").catch((error) =>
                    setMessage(error.message),
                  )
                }
                className="rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-black text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                Generate Knockout Fixtures
              </button>
            </>
          ) : null}

          {preview ? (
            <>
              <button
                type="button"
                onClick={() =>
                  void confirmPreview().catch((error) =>
                    setMessage(error.message),
                  )
                }
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700"
              >
                Confirm & Save Fixtures
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPreviewMode(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancel Preview
              </button>
            </>
          ) : null}

          {hasSavedFixtures && !preview ? (
            <>
              {isFinalized ? (
                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700">
                  Fixtures Finalized
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void finalizeFixtures().catch((error) =>
                        setMessage(error.message),
                      )
                    }
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                  >
                    Finalize Fixtures
                  </button>
                  <button
                    type="button"
                    disabled={!data.can_regenerate}
                    title={
                      !data.can_regenerate
                        ? "Fixtures cannot be regenerated because matches have already started or completed."
                        : undefined
                    }
                    onClick={() =>
                      void regenerateFixtures().catch((error) =>
                        setMessage(error.message),
                      )
                    }
                    className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:-translate-y-0.5 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                  >
                    Regenerate Fixtures
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>

        {preview?.warnings.length ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {preview.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </div>

      {isGroupKnockout ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["group", "Group Stage Fixtures"],
              ["knockout", "Knockout Fixtures"],
              ["all", "All Fixtures"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as "group" | "knockout" | "all")}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${tab === id ? "bg-indigo-600 text-white shadow" : "border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-indigo-300"
          >
            <option value="ALL">All teams</option>
            {data.approved_teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name ?? team.short_name ?? "Team"}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-5 flex justify-end">
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-indigo-300"
          >
            <option value="ALL">All teams</option>
            {data.approved_teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name ?? team.short_name ?? "Team"}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-xl font-black">
            {preview ? "Fixture Preview" : "Fixture List"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Season settings are read from the database. Dates are
            auto-distributed inside the saved season range.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "Matchday",
                  "Date",
                  "Stage",
                  "Group",
                  isGroupKnockout ? "Team A" : "Home Team",
                  isGroupKnockout ? "Team B" : "Away Team",
                  "Status",
                ].map((header) => (
                  <th key={header} className="px-5 py-4 text-left font-black">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center font-semibold text-slate-500"
                  >
                    No fixtures generated yet.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr
                    key={`${row.stage}-${row.round_no}-${row.home_team_registration_id ?? row.home_source}-${row.away_team_registration_id ?? row.away_source}-${index}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 font-bold">
                      {row.matchday_number ?? row.round_no ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      {row.kickoff_at ? safeDate(row.kickoff_at) : "Not set"}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {formatLabel(row.stage ?? "")}
                    </td>
                    <td className="px-5 py-4">{rowGroupName(row)}</td>
                    <td className="px-5 py-4 font-bold">
                      <TeamCompact
                        name={rowTeamName(row, "home")}
                        logoUrl={rowTeamLogo(row, "home")}
                      />
                    </td>
                    <td className="px-5 py-4 font-bold">
                      <TeamCompact
                        name={rowTeamName(row, "away")}
                        logoUrl={rowTeamLogo(row, "away")}
                      />
                    </td>
                    <td className="px-5 py-4">
                      {(row.status === "FINAL" || row.status === "COMPLETED") &&
                      rowScore(row) ? (
                        <div className="text-center">
                          <StatusPill tone="green">{rowScore(row)}</StatusPill>
                          {rowOutcomeLabel(row) ? (
                            <p className="mt-1 text-[10px] font-semibold text-slate-500">
                              {rowOutcomeLabel(row)}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <StatusPill
                          tone={
                            row.status === "WAITING_FOR_TEAMS"
                              ? "orange"
                              : "blue"
                          }
                        >
                          {statusLabel(row.status)}
                        </StatusPill>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlayerRequestDetailModal({
  player,
  onClose,
}: {
  player: AdminPlayer;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"stats" | "personal">("stats");
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar player={player} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">
                Player Profile
              </p>
              <h2 className="mt-1 text-3xl font-black">{player.fullName}</h2>
              <p className="text-sm font-semibold text-slate-500">
                #{player.jerseyNumber} · {player.footballPosition} ·{" "}
                {player.playerStatus}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-2 sm:w-[420px]">
          <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
            League Stats
          </TabButton>
          <TabButton
            active={tab === "personal"}
            onClick={() => setTab("personal")}
          >
            Personal Data
          </TabButton>
        </div>
        {tab === "stats" ? (
          <PlayerLeagueStats player={player} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="Player Code" value={player.code} />
              <DetailRow label="Full Name" value={player.fullName} />
              <DetailRow label="Date of Birth" value={player.dateOfBirth} />
              <DetailRow label="Age" value={String(player.age)} />
              <DetailRow label="ID Type" value={player.idType} />
              <DetailRow label="Masked ID Number" value={player.maskedId} />
              <DetailRow
                label="Jersey Number"
                value={String(player.jerseyNumber)}
              />
              <DetailRow
                label="Position"
                value={`${player.footballPosition} (${player.position})`}
              />
              <DetailRow label="Preferred Foot" value={player.preferredFoot} />
              <DetailRow
                label="Approval Status"
                value={player.approvalStatus}
              />
              <DetailRow label="Player Status" value={player.playerStatus} />
              <DetailRow
                label="Registration Date"
                value={player.registrationDate}
              />
              <DetailRow
                label="Submitted By Manager"
                value={player.submittedByManager}
              />
              <DetailRow
                label="Admin Approval Date"
                value={player.adminApprovalDate}
              />
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Admin Message
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {player.adminMessage}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LineupPlayerModal({
  selection,
  teams,
  onNavigate,
  onClose,
}: {
  selection: { teamId: string; playerId: string };
  teams: AdminTeam[];
  onNavigate: (next: { teamId: string; playerId: string }) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"stats" | "ability" | "personal">("stats");

  const team = teams.find((item) => item.id === selection.teamId) ?? null;
  // Navigation is scoped to this team only, so the arrows never jump to
  // another team's players. Suspended players are included so every squad
  // member reachable from a lineup can be paged through.
  const teamPlayers = team ? [...team.players, ...team.suspendedPlayers] : [];
  const currentIndex = teamPlayers.findIndex(
    (item) => item.id === selection.playerId,
  );
  const player = currentIndex >= 0 ? teamPlayers[currentIndex] : null;

  if (!team || !player) return null;

  const total = teamPlayers.length;
  const goTo = (offset: number) => {
    if (total <= 1) return;
    const nextIndex = (currentIndex + offset + total) % total;
    const nextPlayer = teamPlayers[nextIndex];
    if (nextPlayer) {
      onNavigate({ teamId: team.id, playerId: nextPlayer.id });
    }
  };

  const gradient = `linear-gradient(135deg, ${team.primaryColor ?? "#6D28D9"} 0%, ${team.secondaryColor ?? "#0B1626"} 100%)`;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div
          className="flex items-start justify-between gap-4 p-6 text-white"
          style={{ background: gradient }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={total <= 1}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous player"
              title="Previous player (same team)"
            >
              <ChevronLeft size={20} />
            </button>
            <PlayerAvatar player={player} />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/80">
                {team.name}
              </p>
              <h2 className="mt-1 truncate text-3xl font-black">
                {player.fullName}
              </h2>
              <p className="text-sm font-semibold text-white/80">
                #{player.jerseyNumber} · {player.footballPosition} ·{" "}
                {player.playerStatus}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={total <= 1}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next player"
              title="Next player (same team)"
            >
              <ChevronRight size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/90 px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 md:w-[520px]">
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
              League Stats
            </TabButton>
            <TabButton
              active={tab === "ability"}
              onClick={() => setTab("ability")}
            >
              Hidden Ability
            </TabButton>
            <TabButton
              active={tab === "personal"}
              onClick={() => setTab("personal")}
            >
              Personal Data
            </TabButton>
          </div>

          <div className="mt-5">
            {tab === "stats" ? <PlayerLeagueStats player={player} /> : null}

            {tab === "ability" ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Hidden Ability Scores
                </p>
                {player.abilityDetails.length > 0 ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {player.abilityDetails.map((ability) => (
                      <AbilityDetailCard
                        key={ability.label}
                        ability={ability}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    No ability scores generated yet.
                  </p>
                )}
              </div>
            ) : null}

            {tab === "personal" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailRow label="Player Code" value={player.code} />
                  <DetailRow label="Full Name" value={player.fullName} />
                  <DetailRow label="Date of Birth" value={player.dateOfBirth} />
                  <DetailRow label="Age" value={String(player.age)} />
                  <DetailRow label="ID Type" value={player.idType} />
                  <DetailRow label="Masked ID Number" value={player.maskedId} />
                  <DetailRow
                    label="Jersey Number"
                    value={String(player.jerseyNumber)}
                  />
                  <DetailRow
                    label="Position"
                    value={`${player.footballPosition} (${player.position})`}
                  />
                  <DetailRow
                    label="Preferred Foot"
                    value={player.preferredFoot}
                  />
                  <DetailRow
                    label="Approval Status"
                    value={player.approvalStatus}
                  />
                  <DetailRow
                    label="Player Status"
                    value={player.playerStatus}
                  />
                  <DetailRow
                    label="Registration Date"
                    value={player.registrationDate}
                  />
                  <DetailRow
                    label="Submitted By Manager"
                    value={player.submittedByManager}
                  />
                  <DetailRow
                    label="Admin Approval Date"
                    value={player.adminApprovalDate}
                  />
                  <DetailRow
                    label="Ability Rating"
                    value={player.abilityRating}
                  />
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    Admin Message
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {player.adminMessage}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerLifecycleModal({
  action,
  player,
  onClose,
  onSubmit,
}: {
  action: PlayerLifecycleAction;
  player: AdminPlayer;
  onClose: () => void;
  onSubmit: (input: {
    action: PlayerLifecycleAction;
    playerId: string;
    reason: string;
    suspensionType?: string;
    suspensionUntil?: string;
    suspensionMatchesRemaining?: number;
  }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [suspensionType, setSuspensionType] = useState(
    "UNTIL_ADMIN_UNSUSPENDS",
  );
  const [suspensionUntil, setSuspensionUntil] = useState("");
  const [suspensionMatchesRemaining, setSuspensionMatchesRemaining] =
    useState("1");
  const [submitting, setSubmitting] = useState(false);
  const title =
    action === "reject"
      ? "Reject Player"
      : action === "remove"
        ? "Remove Player"
        : action === "suspend"
          ? "Suspend Player"
          : "Unsuspend Player";
  const description =
    action === "reject"
      ? "Rejected players cannot be used in lineups and free a squad slot. Add a reason for the manager."
      : action === "remove"
        ? "Removed players cannot be used in future lineups, free a squad slot, and keep past stats."
        : action === "suspend"
          ? "Suspended players cannot be selected in lineups but still count in squad size."
          : "Unsuspending returns this player to active approved status.";
  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        action,
        playerId: player.id,
        reason: reason.trim(),
        suspensionType,
        suspensionUntil,
        suspensionMatchesRemaining: Number(suspensionMatchesRemaining),
      });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-5 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">
              Player Action
            </p>
            <h2 className="mt-1 text-3xl font-black">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {player.fullName} · #{player.jerseyNumber} ·{" "}
              {player.footballPosition}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {description}
        </p>
        {action === "suspend" ? (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Suspension Type
              </span>
              <select
                value={suspensionType}
                onChange={(event) => setSuspensionType(event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 font-bold"
              >
                <option value="UNTIL_ADMIN_UNSUSPENDS">
                  Until Admin Unsuspends
                </option>
                <option value="UNTIL_DATE">Until Specific Date</option>
                <option value="NEXT_MATCHES">For Next X Matches</option>
              </select>
            </label>
            {suspensionType === "UNTIL_DATE" ? (
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Suspended Until
                </span>
                <input
                  type="date"
                  value={suspensionUntil}
                  onChange={(event) => setSuspensionUntil(event.target.value)}
                  className="rounded-xl border border-slate-200 px-4 py-3 font-bold"
                />
              </label>
            ) : null}
            {suspensionType === "NEXT_MATCHES" ? (
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Match Count
                </span>
                <input
                  type="number"
                  min={1}
                  value={suspensionMatchesRemaining}
                  onChange={(event) =>
                    setSuspensionMatchesRemaining(event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3 font-bold"
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <label className="mt-5 grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
            Required Message / Reason
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            placeholder="Write a clear reason for the manager..."
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              !reason.trim() ||
              submitting ||
              (action === "suspend" &&
                suspensionType === "UNTIL_DATE" &&
                !suspensionUntil)
            }
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? "Saving..." : title}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineupConfirmationsView({
  season,
  onDecision,
  onPlayerClick,
}: {
  season: SeasonDto;
  onDecision: (
    lineupId: string,
    status: "APPROVED" | "REJECTED",
    reason?: string,
  ) => Promise<void>;
  onPlayerClick: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  const [lineups, setLineups] = useState<AdminPendingLineupRow[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    void loadLineups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.id]);

  async function loadLineups() {
    setLoading(true);
    setMessage("");
    try {
      const result = await api<{ lineups: AdminPendingLineupRow[] }>(
        `/admin/seasons/${season.id}/lineups/pending`,
      );
      setLineups(result.lineups ?? []);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not load pending lineups",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openFixture(fixtureId: string) {
    setSelectedFixtureId(fixtureId);
    setDetailLoading(true);
    setMessage("");
    try {
      const result = await api<MatchDetailResponse>(
        `/admin/matches/${fixtureId}/detail`,
      );
      setDetail(result);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not load lineup detail",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function decide(lineupId: string, status: "APPROVED" | "REJECTED") {
    const reason =
      status === "REJECTED"
        ? window.prompt("Reason for rejecting/blocking this lineup?")?.trim()
        : undefined;
    if (status === "REJECTED" && !reason) return;
    setSubmittingId(lineupId);
    try {
      await onDecision(lineupId, status, reason);
      await loadLineups();
      if (selectedFixtureId) {
        const result = await api<MatchDetailResponse>(
          `/admin/matches/${selectedFixtureId}/detail`,
        );
        setDetail(result);
      }
      setMessage(
        status === "APPROVED" ? "Lineup confirmed." : "Lineup rejected.",
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not update lineup",
      );
    } finally {
      setSubmittingId(null);
    }
  }

  const selectedLineups = selectedFixtureId
    ? lineups.filter((lineup) => lineup.fixture_id === selectedFixtureId)
    : [];
  const selectedFixture =
    detail?.fixture ?? selectedLineups[0]?.fixtures ?? null;
  const homeName = selectedFixture?.home_team?.teams?.name ?? "Home team";
  const awayName = selectedFixture?.away_team?.teams?.name ?? "Away team";
  const showSide = !isGroupKnockoutFormat(season.format);

  if (selectedFixtureId) {
    const homeLineup = lineupForFixtureTeam(
      detail?.lineups,
      selectedFixture?.home_team?.id,
    );
    const awayLineup = lineupForFixtureTeam(
      detail?.lineups,
      selectedFixture?.away_team?.id,
    );
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setSelectedFixtureId(null);
            setDetail(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-indigo-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50"
        >
          <ArrowLeft size={17} /> Back to lineups
        </button>
        <Panel
          title={`${homeName} vs ${awayName}`}
          action={
            selectedFixture?.kickoff_at
              ? safeDateTime(selectedFixture.kickoff_at)
              : "Kickoff not set"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TeamCompact
              name={homeName}
              logoUrl={selectedFixture?.home_team?.teams?.logo_url ?? null}
            />
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
              Lineup Review
            </span>
            <TeamCompact
              name={awayName}
              logoUrl={selectedFixture?.away_team?.teams?.logo_url ?? null}
            />
          </div>
        </Panel>
        {message ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        ) : null}
        {detailLoading ? <EmptyState label="Loading lineups..." /> : null}
        {!detailLoading ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <AdminLineupPitch
              title={homeName}
              logoUrl={selectedFixture?.home_team?.teams?.logo_url ?? null}
              lineup={homeLineup}
              onDecision={decide}
              submittingId={submittingId}
              onPlayerClick={onPlayerClick}
            />
            <AdminLineupPitch
              title={awayName}
              logoUrl={selectedFixture?.away_team?.teams?.logo_url ?? null}
              lineup={awayLineup}
              onDecision={decide}
              submittingId={submittingId}
              onPlayerClick={onPlayerClick}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Lineup Confirmations"
        subtitle="Review submitted match lineups before they become locked for simulation."
      />
      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {message}
        </div>
      ) : null}
      {loading ? <EmptyState label="Loading pending lineups..." /> : null}
      {!loading && lineups.length === 0 ? (
        <EmptyState label="No pending lineup confirmations." />
      ) : null}
      {!loading && lineups.length > 0 ? (
        <Panel title="Pending Lineups">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Match</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  {showSide ? (
                    <th className="px-4 py-3 text-left">Side</th>
                  ) : null}
                  <th className="px-4 py-3 text-left">Formation</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineups.map((lineup) => {
                  const fixture = lineup.fixtures;
                  const match = `${fixture?.home_team?.teams?.name ?? "Home"} vs ${fixture?.away_team?.teams?.name ?? "Away"}`;
                  const team = lineup.team_registrations?.teams;
                  const fixtureSide =
                    lineup.team_registration_id === fixture?.home_team?.id
                      ? "HOME"
                      : lineup.team_registration_id === fixture?.away_team?.id
                        ? "AWAY"
                        : "—";
                  return (
                    <tr key={lineup.id} className="border-t border-slate-100">
                      <td className="px-4 py-4 font-bold">{match}</td>
                      <td className="px-4 py-4">
                        <TeamCompact
                          name={team?.name ?? "Team"}
                          logoUrl={team?.logo_url ?? null}
                        />
                      </td>
                      {showSide ? (
                        <td className="px-4 py-4 font-black">{fixtureSide}</td>
                      ) : null}
                      <td className="px-4 py-4 font-black">
                        {lineup.formation}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {lineup.submitted_at
                          ? safeDateTime(lineup.submitted_at)
                          : "—"}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void openFixture(lineup.fixture_id)}
                          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700"
                        >
                          Review Lineup
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function AdminLineupPitch({
  title,
  logoUrl,
  lineup,
  onDecision,
  submittingId,
  onPlayerClick,
  showActions = true,
  statsByPlayer,
  eventMetaByPlayer,
  bestRatedPlayerId,
}: {
  title: string;
  logoUrl?: string | null;
  lineup: MatchDetailLineup | null;
  onDecision: (
    lineupId: string,
    status: "APPROVED" | "REJECTED",
  ) => Promise<void>;
  submittingId: string | null;
  onPlayerClick?: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
  showActions?: boolean;
  statsByPlayer?: Map<string, MatchDetailPlayerStat>;
  eventMetaByPlayer?: Map<string, PlayerEventMeta>;
  bestRatedPlayerId?: string | null;
}) {
  const players = lineup?.lineup_players ?? [];
  const slots = lineup?.formation_slots ?? [];
  const playerBySlot = new Map(
    players
      .filter((player) => player.is_starter && player.slot_key)
      .map((player) => [player.slot_key as string, player]),
  );
  const bench = players.filter((player) => !player.is_starter);
  const isPending = lineup?.status === "PENDING";
  return (
    <Panel
      title={title}
      action={
        lineup
          ? `${lineup.formation ?? "Formation"} · ${lineup.status ?? "Status"}`
          : "Not submitted"
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <TeamBadge name={title} logoUrl={logoUrl} />
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="text-sm font-semibold text-slate-500">
            Formation {lineup?.formation ?? "N/A"} · Playing style{" "}
            {formatLabel(lineup?.playing_style ?? "N/A")}
          </p>
        </div>
      </div>
      {!lineup ? (
        <EmptyState label="This team has not submitted a lineup yet." />
      ) : null}
      {lineup ? (
        <>
          <div className="relative h-[680px] overflow-hidden rounded-2xl bg-[#05A967] p-2 shadow-xl ring-1 ring-emerald-800/20 sm:h-[720px] sm:rounded-[2rem] sm:p-5">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/10" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white/10" />
            <div className="absolute left-1/2 top-0 h-20 w-40 -translate-x-1/2 rounded-b-3xl border-x-[5px] border-b-[5px] border-white/10" />
            <div className="absolute bottom-0 left-1/2 h-20 w-40 -translate-x-1/2 rounded-t-3xl border-x-[5px] border-t-[5px] border-white/10" />
            <div className="absolute inset-y-0 left-[35%] w-1 bg-white/5" />
            <div className="absolute inset-y-0 right-[35%] w-1 bg-white/5" />
            {slots.map((slot) => {
              const player = playerBySlot.get(slot.slotKey);
              const registration = player?.player_season_registrations;
              const name = registration?.players?.full_name ?? "Player";
              const stat = player
                ? statsByPlayer?.get(player.player_registration_id)
                : null;
              const meta = player
                ? eventMetaByPlayer?.get(player.player_registration_id)
                : null;
              return (
                <div
                  key={slot.slotKey}
                  className="absolute z-10 w-[82px] -translate-x-1/2 -translate-y-1/2 rounded-3xl py-1 text-center sm:w-[112px]"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {player ? (
                    <button
                      type="button"
                      className="inline-flex flex-col items-center outline-none transition hover:-translate-y-0.5"
                      onClick={() =>
                        onPlayerClick?.(player, lineup?.team_registration_id)
                      }
                    >
                      <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                        <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-[3px] border-white bg-white shadow-md">
                          {registration?.players?.avatar_url ? (
                            <img
                              src={registration.players.avatar_url}
                              alt={name}
                              className="h-[118%] w-full rounded-full object-cover object-top"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center rounded-full bg-emerald-700 text-sm font-black text-white">
                              {initials(name)}
                            </span>
                          )}
                        </div>
                        {stat ? (
                          <span
                            className={`absolute -right-1 -top-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white shadow ${ratingBadgeClass(Number(stat.rating))}`}
                          >
                            {formatRating(stat.rating)}
                            {player.player_registration_id ===
                            bestRatedPlayerId ? (
                              <Star
                                size={10}
                                className="ml-0.5 inline fill-current"
                              />
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex w-full items-center justify-center gap-1 px-0.5 sm:w-32 sm:max-w-[8rem]">
                        {meta?.injured ? (
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-[12px] font-black leading-none text-red-600 shadow ring-1 ring-red-100">
                            +
                          </span>
                        ) : null}
                        {player.is_captain ? (
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-black lowercase text-slate-700 shadow">
                            c
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate text-[13px] font-black text-white drop-shadow">
                          #
                          {registration?.shirt_number ??
                            player.shirt_number ??
                            "-"}{" "}
                          {name}
                        </span>
                      </div>
                      {meta ? <LineupEventIcons meta={meta} /> : null}
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
                        {player.display_role ?? slot.displayRole}
                      </p>
                    </button>
                  ) : (
                    <span className="inline-block h-12 w-12 rounded-full border-[3px] border-emerald-300/70 bg-emerald-800/20 sm:h-14 sm:w-14" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-black">Bench · {bench.length}</h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {bench.map((player) => {
                const registration = player.player_season_registrations;
                const name = registration?.players?.full_name ?? "Player";
                const stat = statsByPlayer?.get(player.player_registration_id);
                const meta = eventMetaByPlayer?.get(
                  player.player_registration_id,
                );
                return (
                  <button
                    key={player.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50"
                    onClick={() =>
                      onPlayerClick?.(player, lineup?.team_registration_id)
                    }
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 font-black text-indigo-700">
                      {registration?.players?.avatar_url ? (
                        <img
                          src={registration.players.avatar_url}
                          alt={name}
                          className="h-[118%] w-full object-cover object-top"
                        />
                      ) : (
                        initials(name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {stat ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-black text-white ${ratingBadgeClass(Number(stat.rating))}`}
                          >
                            {formatRating(stat.rating)}
                          </span>
                        ) : null}
                        <p className="truncate font-black">
                          #
                          {registration?.shirt_number ??
                            player.shirt_number ??
                            "-"}{" "}
                          {name}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        {registration?.football_position ??
                          player.football_position ??
                          player.player_natural_position ??
                          "POS"}
                        {meta?.subInMinute ? ` · ${meta.subInMinute}'` : ""}
                      </p>
                      {meta ? <LineupEventIcons meta={meta} dark /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {showActions ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!isPending || submittingId === lineup.id}
                onClick={() => void onDecision(lineup.id, "APPROVED")}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Lineup
              </button>
              <button
                type="button"
                disabled={!isPending || submittingId === lineup.id}
                onClick={() => void onDecision(lineup.id, "REJECTED")}
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:-translate-y-0.5 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject / Block
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </Panel>
  );
}

function MatchesReadyView({
  matches,
  onSimulate,
  onConfirm,
  onJumpToMatchday,
  onPlayerProfile,
  onOpenTeam,
}: {
  matches: ReadyMatchRow[];
  onSimulate: (fixtureId: string) => Promise<void>;
  onConfirm: (fixtureId: string) => Promise<void>;
  onJumpToMatchday: () => Promise<{
    updated_count: number;
    matches?: ReadyMatchRow[];
  }>;
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
  onOpenTeam: (teamRegistrationId: string) => void;
}) {
  const [selectedMatch, setSelectedMatch] = useState<ReadyMatchRow | null>(
    null,
  );
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [jumping, setJumping] = useState(false);
  const [selectedStat, setSelectedStat] =
    useState<MatchDetailPlayerStat | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const visibleMatches = matches;
  const hasUnsimulatedVisibleMatch = visibleMatches.some(
    (match) => !isSimulatedOrDoneStatus(match.status),
  );
  const jumpLocked = visibleMatches.length > 0 && hasUnsimulatedVisibleMatch;

  async function openDetail(match: ReadyMatchRow) {
    setSelectedMatch(match);
    setDetailLoading(true);
    setError("");
    try {
      const data = await api<MatchDetailResponse>(
        `/admin/matches/${match.id}/detail`,
      );
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load match detail",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function simulate(match: ReadyMatchRow) {
    setSimulatingId(match.id);
    setError("");
    try {
      await onSimulate(match.id);
      const data = await api<MatchDetailResponse>(
        `/admin/matches/${match.id}/detail`,
      );
      setSelectedMatch(match);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not simulate match");
    } finally {
      setSimulatingId(null);
    }
  }

  async function confirmSelectedMatch() {
    if (!selectedMatch) return;
    setConfirming(true);
    setError("");
    try {
      await onConfirm(selectedMatch.id);
      const data = await api<MatchDetailResponse>(
        `/admin/matches/${selectedMatch.id}/detail`,
      );
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm match");
    } finally {
      setConfirming(false);
    }
  }

  if (selectedMatch) {
    const matchRoleMap = buildMatchRoleMap(detail);
    const orderedStats = buildOrderedStats(detail);
    const statNavIndex = selectedStat
      ? orderedStats.findIndex(
          (item) =>
            item.player_registration_id === selectedStat.player_registration_id,
        )
      : -1;
    return (
      <div>
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}
        <MatchDetailPage
          match={selectedMatch}
          detail={detail}
          loading={detailLoading}
          simulating={simulatingId === selectedMatch.id}
          confirming={confirming}
          onBack={() => {
            setSelectedMatch(null);
            setDetail(null);
            setSelectedStat(null);
          }}
          onSimulate={() => void simulate(selectedMatch)}
          onConfirm={() => void confirmSelectedMatch()}
          onPlayerStat={setSelectedStat}
          onPlayerProfile={onPlayerProfile}
        />
        {selectedStat ? (
          <PlayerMatchStatModal
            stat={selectedStat}
            role={matchRoleMap.get(selectedStat.player_registration_id)}
            onPrev={
              statNavIndex > 0
                ? () => setSelectedStat(orderedStats[statNavIndex - 1] ?? null)
                : undefined
            }
            onNext={
              statNavIndex >= 0 && statNavIndex < orderedStats.length - 1
                ? () => setSelectedStat(orderedStats[statNavIndex + 1] ?? null)
                : undefined
            }
            onClose={() => setSelectedStat(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title="Matches Ready"
          subtitle="Matches appear here only after both lineups are confirmed."
        />
        <button
          type="button"
          onClick={async () => {
            setJumping(true);
            setError("");
            setNotice("");
            try {
              const result = await onJumpToMatchday();
              setNotice(
                result.updated_count > 0
                  ? `${result.updated_count} confirmed-lineup match${result.updated_count === 1 ? "" : "es"} moved to ready simulation.`
                  : "No matches were moved. Cards below show the next matchday, but simulation needs both lineups submitted and admin-confirmed.",
              );
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not jump to matchday",
              );
            } finally {
              setJumping(false);
            }
          }}
          disabled={jumping || jumpLocked}
          title={
            jumpLocked
              ? "Simulate all current matchday matches before moving to the next matchday."
              : undefined
          }
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {jumping ? "Loading..." : "Next Matchday"}
        </button>
      </div>
      {jumpLocked ? (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">
          Simulate all current matchday matches before opening the next
          matchday.
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {notice}
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {visibleMatches.length === 0 ? (
          <EmptyState label="No matches are ready for simulation. Confirm both team lineups first." />
        ) : null}
        {visibleMatches.map((match, index) => {
          const canSimulate =
            match.can_simulate ?? isSimulatableStatus(match.status);
          return (
            <Panel
              key={match.id}
              title={`${canSimulate ? "Ready" : "Matchday"} Match ${index + 1}`}
            >
              <div className="flex items-center justify-between">
                <TeamCompact
                  name={match.home}
                  logoUrl={match.homeLogoUrl}
                  onClick={
                    match.homeTeamRegistrationId
                      ? () => onOpenTeam(match.homeTeamRegistrationId!)
                      : undefined
                  }
                />
                <span className="font-black text-slate-500">VS</span>
                <TeamCompact
                  name={match.away}
                  logoUrl={match.awayLogoUrl}
                  onClick={
                    match.awayTeamRegistrationId
                      ? () => onOpenTeam(match.awayTeamRegistrationId!)
                      : undefined
                  }
                />
              </div>
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-black text-slate-700">
                {match.kickoff}
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
                <StatusBox
                  label="Submitted Lineups"
                  value={String(
                    match.submitted_lineups ?? (canSimulate ? 2 : 0),
                  )}
                />
                <StatusBox
                  label="Confirmed Lineups"
                  value={String(
                    match.confirmed_lineups ?? (canSimulate ? 2 : 0),
                  )}
                />
                <StatusBox label="Status" value={match.status} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void openDetail(match)}
                  className="rounded-md border border-indigo-200 bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-50 hover:shadow-lg active:translate-y-0 active:scale-[0.98]"
                >
                  Open Detail →
                </button>
                <button
                  type="button"
                  onClick={() => void simulate(match)}
                  disabled={!canSimulate || simulatingId === match.id}
                  title={
                    !canSimulate
                      ? "Simulation needs both lineups submitted and admin-confirmed."
                      : undefined
                  }
                  className="rounded-md bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {simulatingId === match.id
                    ? "Simulating..."
                    : "Simulate Match"}
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function CompletedMatchesView({
  matches,
  onPlayerProfile,
}: {
  matches: CompletedMatchRow[];
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  const [selectedMatch, setSelectedMatch] = useState<CompletedMatchRow | null>(
    null,
  );
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedStat, setSelectedStat] =
    useState<MatchDetailPlayerStat | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const teamNames = useMemo(
    () =>
      [...new Set(matches.flatMap((match) => [match.home, match.away]))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [matches],
  );
  const filteredMatches = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return matches.filter((match) => {
      const matchesTeam =
        teamFilter === "ALL" ||
        match.home === teamFilter ||
        match.away === teamFilter;
      if (!matchesTeam) return false;
      if (!query) return true;
      return [
        match.home,
        match.away,
        match.score,
        match.stage,
        match.kickoff,
        match.status,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [matches, searchQuery, teamFilter]);

  async function openDetail(match: CompletedMatchRow) {
    setSelectedMatch(match);
    setDetail(null);
    setDetailLoading(true);
    setError("");
    try {
      const data = await api<MatchDetailResponse>(
        `/admin/matches/${match.id}/detail`,
      );
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load completed match",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  if (selectedMatch) {
    const matchRoleMap = buildMatchRoleMap(detail);
    const orderedStats = buildOrderedStats(detail);
    const statNavIndex = selectedStat
      ? orderedStats.findIndex(
          (item) =>
            item.player_registration_id === selectedStat.player_registration_id,
        )
      : -1;
    const detailMatch: ReadyMatchRow = {
      id: selectedMatch.id,
      home: selectedMatch.home,
      away: selectedMatch.away,
      homeLogoUrl: selectedMatch.homeLogoUrl ?? null,
      awayLogoUrl: selectedMatch.awayLogoUrl ?? null,
      homePrimaryColor: selectedMatch.homePrimaryColor ?? null,
      awayPrimaryColor: selectedMatch.awayPrimaryColor ?? null,
      stage: selectedMatch.stage,
      kickoff: selectedMatch.kickoff,
      status: selectedMatch.status,
      submitted_lineups: 2,
      confirmed_lineups: 2,
      can_simulate: false,
    };
    return (
      <div>
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}
        <MatchDetailPage
          match={detailMatch}
          detail={detail}
          loading={detailLoading}
          simulating={false}
          confirming={false}
          onBack={() => {
            setSelectedMatch(null);
            setDetail(null);
            setSelectedStat(null);
          }}
          onSimulate={() => undefined}
          onConfirm={() => undefined}
          onPlayerStat={setSelectedStat}
          onPlayerProfile={onPlayerProfile}
        />
        {selectedStat ? (
          <PlayerMatchStatModal
            stat={selectedStat}
            role={matchRoleMap.get(selectedStat.player_registration_id)}
            onPrev={
              statNavIndex > 0
                ? () => setSelectedStat(orderedStats[statNavIndex - 1] ?? null)
                : undefined
            }
            onNext={
              statNavIndex >= 0 && statNavIndex < orderedStats.length - 1
                ? () => setSelectedStat(orderedStats[statNavIndex + 1] ?? null)
                : undefined
            }
            onClose={() => setSelectedStat(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Completed Matches"
        subtitle="Finalized matches and confirmed simulation data."
      />
      {matches.length === 0 ? (
        <EmptyState label="No completed matches yet." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
            <label className="relative block">
              <span className="sr-only">Search completed matches</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search team, score, stage, or date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </label>
            <label className="block">
              <span className="sr-only">Filter completed matches by team</span>
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              >
                <option value="ALL">All teams</option>
                {teamNames.map((teamName) => (
                  <option key={teamName} value={teamName}>
                    {teamName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p
            className="text-sm font-semibold text-slate-500"
            aria-live="polite"
          >
            Showing {filteredMatches.length} of {matches.length} completed
            matches
          </p>
          {filteredMatches.length === 0 ? (
            <EmptyState label="No completed matches match these filters." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredMatches.map((match, index) => (
                <Panel key={match.id} title={`Completed Match ${index + 1}`}>
                  <button
                    type="button"
                    className="block w-full rounded-2xl p-2 text-left transition hover:-translate-y-0.5 hover:bg-slate-50"
                    onClick={() => void openDetail(match)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <TeamCompact
                        name={match.home}
                        logoUrl={match.homeLogoUrl}
                      />
                      <span className="rounded-xl bg-green-100 px-4 py-2 text-center text-lg font-black text-green-800">
                        <span className="block">{match.score}</span>
                        {match.outcomeLabel ? (
                          <span className="mt-0.5 block text-[10px] font-bold text-green-700">
                            {match.outcomeLabel}
                          </span>
                        ) : null}
                      </span>
                      <TeamCompact
                        name={match.away}
                        logoUrl={match.awayLogoUrl}
                      />
                    </div>
                    <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-bold text-slate-600">
                      {match.kickoff} · {match.stage}
                    </p>
                  </button>
                </Panel>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchDetailPage({
  match,
  detail,
  loading,
  simulating,
  confirming,
  onBack,
  onSimulate,
  onConfirm,
  onPlayerStat,
  onPlayerProfile,
}: {
  match: ReadyMatchRow;
  detail: MatchDetailResponse | null;
  loading: boolean;
  simulating: boolean;
  confirming: boolean;
  onBack: () => void;
  onSimulate: () => void;
  onConfirm: () => void;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  const [activeTab, setActiveTab] = useState<"lineup" | "stats">("lineup");
  const statsByPlayer = new Map(
    (detail?.player_stats ?? []).map((stat) => [
      stat.player_registration_id,
      stat,
    ]),
  );
  const homeLineup = lineupForFixtureTeam(
    detail?.lineups,
    detail?.fixture?.home_team_registration_id,
  );
  const awayLineup = lineupForFixtureTeam(
    detail?.lineups,
    detail?.fixture?.away_team_registration_id,
  );
  const hasSimulation =
    (detail?.player_stats?.length ?? 0) > 0 ||
    (detail?.team_stats?.length ?? 0) > 0;
  const eventMetaByPlayer = buildPlayerEventMeta(
    detail?.events ?? [],
    detail?.substitutions ?? [],
  );
  const bestRatedPlayerId = bestRatedPlayer(detail?.player_stats ?? []);
  const canConfirm =
    detail?.fixture?.status ===
    FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION;
  const canSimulateDetail =
    !detail?.fixture?.status || isSimulatableStatus(detail.fixture.status);
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
      >
        <ArrowLeft size={16} /> Back to matches
      </button>
      <Panel title="">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-600">
              Match Detail
            </p>
            <h2 className="mt-2 text-3xl font-black">
              {match.home} vs {match.away}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {match.stage} · {match.kickoff}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSimulate}
              disabled={simulating || !canSimulateDetail}
              title={
                !canSimulateDetail
                  ? "This match is finalized or not in a simulatable status."
                  : undefined
              }
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {simulating
                ? "Simulating..."
                : hasSimulation
                  ? "Simulate Again"
                  : "Simulate Match"}
            </button>
            {hasSimulation ? (
              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm || confirming}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? "Confirming..." : "Confirm Result"}
              </button>
            ) : null}
          </div>
        </div>

        {loading ? <EmptyState label="Loading match detail..." /> : null}
        {!loading ? (
          <div className="mt-6 space-y-6">
            <MatchScorelineHeader match={match} detail={detail} />
            <div className="flex gap-3 border-b border-slate-200">
              {(["lineup", "stats"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-black capitalize transition ${
                    activeTab === tab
                      ? "border-b-2 border-slate-950 text-slate-950"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {activeTab === "lineup" ? (
              <AdminCombinedMatchPitch
                match={match}
                homeLineup={homeLineup}
                awayLineup={awayLineup}
                statsByPlayer={statsByPlayer}
                eventMetaByPlayer={eventMetaByPlayer}
                bestRatedPlayerId={bestRatedPlayerId}
                onPlayerStat={onPlayerStat}
                onPlayerProfile={onPlayerProfile}
              />
            ) : detail?.team_stats?.length ? (
              <MatchTeamStatsPanel
                leftTeamName={match.home}
                rightTeamName={match.away}
                leftTeamRegistrationId={
                  detail.fixture.home_team_registration_id
                }
                rightTeamRegistrationId={
                  detail.fixture.away_team_registration_id
                }
                leftTeamColor={match.homePrimaryColor}
                rightTeamColor={match.awayPrimaryColor}
                stats={detail.team_stats}
              />
            ) : (
              <EmptyState label="No match stats yet. Click Simulate Match to generate ratings and stats." />
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function MatchScorelineHeader({
  match,
  detail,
}: {
  match: ReadyMatchRow;
  detail: MatchDetailResponse | null;
}) {
  const playerNames = new Map<string, string>();
  for (const lineup of detail?.lineups ?? []) {
    for (const player of lineup.lineup_players ?? []) {
      playerNames.set(
        player.player_registration_id,
        player.player_season_registrations?.players?.full_name ?? "Player",
      );
    }
  }
  const scoreEventLines = (side: "HOME" | "AWAY") =>
    (detail?.events ?? [])
      .filter((event) => {
        const type = String(event.type ?? "");
        return (
          event.side === side &&
          (type === "GOAL" || type === "PENALTY_GOAL" || type === "OWN_GOAL")
        );
      })
      .map((event) => {
        const name =
          playerNames.get(String(event.player_registration_id ?? "")) ??
          "Scorer";
        const type = String(event.type ?? "");
        const suffix =
          type === "PENALTY_GOAL"
            ? " (Pen)"
            : type === "OWN_GOAL"
              ? " (OG)"
              : "";
        return `${name} ${formatNumber(event.minute)}'${suffix}`;
      });
  const homeScorers = scoreEventLines("HOME");
  const awayScorers = scoreEventLines("AWAY");
  const redCardEventLines = (side: "HOME" | "AWAY") =>
    (detail?.events ?? [])
      .filter(
        (event) =>
          event.side === side && String(event.type ?? "") === "RED_CARD",
      )
      .map((event) => {
        const name =
          playerNames.get(String(event.player_registration_id ?? "")) ??
          "Player";
        return `${name} ${formatNumber(event.minute)}'`;
      });
  const homeRedCards = redCardEventLines("HOME");
  const awayRedCards = redCardEventLines("AWAY");
  const homeScore = detail?.fixture?.home_score ?? "-";
  const awayScore = detail?.fixture?.away_score ?? "-";
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="grid items-start gap-5 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col items-center gap-2 md:items-end">
          <TeamBadge name={match.home} logoUrl={match.homeLogoUrl} size="lg" />
          <p className="text-xl font-black">{match.home}</p>
          <div className="space-y-1 text-xs font-semibold text-slate-500">
            {homeScorers.length ? (
              homeScorers.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>No scorers</p>
            )}
            {homeRedCards.map((line, index) => (
              <p
                key={`home-red-${line}-${index}`}
                className="inline-flex items-center gap-1.5 md:justify-end"
              >
                <span className="h-3.5 w-2.5 rounded-[2px] bg-red-600" />
                {line}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="flex items-center justify-center gap-2 text-4xl font-black tracking-tight">
            <span>{homeScore}</span>
            {homeRedCards.length ? (
              <span
                className="h-4 w-2.5 rounded-[2px] bg-red-600"
                title={`${homeRedCards.length} home red card${homeRedCards.length === 1 ? "" : "s"}`}
              />
            ) : null}
            <span>-</span>
            <span>{awayScore}</span>
            {awayRedCards.length ? (
              <span
                className="h-4 w-2.5 rounded-[2px] bg-red-600"
                title={`${awayRedCards.length} away red card${awayRedCards.length === 1 ? "" : "s"}`}
              />
            ) : null}
          </p>
          <p className="mt-2 text-xs font-bold tracking-[0.12em] text-slate-500">
            {detail?.fixture
              ? (fixtureOutcomeLabel(detail.fixture) ??
                statusLabel(String(detail.fixture.status)))
              : "Not simulated"}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 md:items-start">
          <TeamBadge name={match.away} logoUrl={match.awayLogoUrl} size="lg" />
          <p className="text-xl font-black">{match.away}</p>
          <div className="space-y-1 text-xs font-semibold text-slate-500">
            {awayScorers.length ? (
              awayScorers.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>No scorers</p>
            )}
            {awayRedCards.map((line, index) => (
              <p
                key={`away-red-${line}-${index}`}
                className="inline-flex items-center gap-1.5"
              >
                <span className="h-3.5 w-2.5 rounded-[2px] bg-red-600" />
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCombinedMatchPitch({
  match,
  homeLineup,
  awayLineup,
  statsByPlayer,
  eventMetaByPlayer,
  bestRatedPlayerId,
  onPlayerStat,
  onPlayerProfile,
}: {
  match: ReadyMatchRow;
  homeLineup: MatchDetailLineup | null;
  awayLineup: MatchDetailLineup | null;
  statsByPlayer: Map<string, MatchDetailPlayerStat>;
  eventMetaByPlayer: Map<string, PlayerEventMeta>;
  bestRatedPlayerId: string | null;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  const homeRating = averageLineupRating(homeLineup, statsByPlayer);
  const awayRating = averageLineupRating(awayLineup, statsByPlayer);
  const homeBench = (homeLineup?.lineup_players ?? []).filter(
    (player) => !player.is_starter,
  );
  const awayBench = (awayLineup?.lineup_players ?? []).filter(
    (player) => !player.is_starter,
  );
  return (
    <div className="overflow-hidden rounded-3xl bg-[#05a967] text-white shadow-xl">
      <div className="flex flex-col gap-3 bg-emerald-700/15 px-3 py-4 text-sm font-black sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${ratingBadgeClass(homeRating)}`}
          >
            {homeRating ? formatRating(homeRating) : "-"}
          </span>
          <TeamBadge name={match.home} logoUrl={match.homeLogoUrl} />
          <span>{match.home}</span>
          <span>{homeLineup?.formation ?? "Formation N/A"}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span>{awayLineup?.formation ?? "Formation N/A"}</span>
          <span>{match.away}</span>
          <TeamBadge name={match.away} logoUrl={match.awayLogoUrl} />
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${ratingBadgeClass(awayRating)}`}
          >
            {awayRating ? formatRating(awayRating) : "-"}
          </span>
        </div>
      </div>
      <div className="relative h-[560px] bg-[#06a766] sm:h-[620px]">
        <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white/10" />
        <div className="absolute left-0 top-1/2 h-48 w-20 -translate-y-1/2 rounded-r-3xl border-y-[5px] border-r-[5px] border-white/10" />
        <div className="absolute right-0 top-1/2 h-48 w-20 -translate-y-1/2 rounded-l-3xl border-y-[5px] border-l-[5px] border-white/10" />
        <div className="absolute inset-y-0 left-1/4 w-1 bg-white/5" />
        <div className="absolute inset-y-0 right-1/4 w-1 bg-white/5" />
        <AdminLineupSideNodes
          lineup={homeLineup}
          side="HOME"
          statsByPlayer={statsByPlayer}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onPlayerStat={onPlayerStat}
          onPlayerProfile={onPlayerProfile}
        />
        <AdminLineupSideNodes
          lineup={awayLineup}
          side="AWAY"
          statsByPlayer={statsByPlayer}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onPlayerStat={onPlayerStat}
          onPlayerProfile={onPlayerProfile}
        />
      </div>
      <div className="grid gap-5 bg-white p-5 text-slate-950 lg:grid-cols-2">
        <MatchBenchColumn
          title={`${match.home} substitutes`}
          players={homeBench}
          teamRegistrationId={homeLineup?.team_registration_id}
          statsByPlayer={statsByPlayer}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onPlayerStat={onPlayerStat}
          onPlayerProfile={onPlayerProfile}
        />
        <MatchBenchColumn
          title={`${match.away} substitutes`}
          players={awayBench}
          teamRegistrationId={awayLineup?.team_registration_id}
          statsByPlayer={statsByPlayer}
          eventMetaByPlayer={eventMetaByPlayer}
          bestRatedPlayerId={bestRatedPlayerId}
          onPlayerStat={onPlayerStat}
          onPlayerProfile={onPlayerProfile}
        />
      </div>
    </div>
  );
}

function AdminLineupSideNodes({
  lineup,
  side,
  statsByPlayer,
  eventMetaByPlayer,
  bestRatedPlayerId,
  onPlayerStat,
  onPlayerProfile,
}: {
  lineup: MatchDetailLineup | null;
  side: "HOME" | "AWAY";
  statsByPlayer: Map<string, MatchDetailPlayerStat>;
  eventMetaByPlayer: Map<string, PlayerEventMeta>;
  bestRatedPlayerId: string | null;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  const slots = lineup?.formation_slots ?? [];
  const playerBySlot = new Map(
    (lineup?.lineup_players ?? [])
      .filter((player) => player.is_starter && player.slot_key)
      .map((player) => [player.slot_key as string, player]),
  );
  return (
    <>
      {slots.map((slot) => {
        const player = playerBySlot.get(slot.slotKey);
        if (!player) return null;
        const x = side === "HOME" ? (100 - slot.y) * 0.5 : 50 + slot.y * 0.5;
        const y = side === "HOME" ? slot.x : 100 - slot.x;
        const stat = statsByPlayer.get(player.player_registration_id);
        const meta = eventMetaByPlayer.get(player.player_registration_id);
        return (
          <AdminMatchPlayerNode
            key={`${side}-${slot.slotKey}`}
            player={player}
            teamRegistrationId={lineup?.team_registration_id}
            x={x}
            y={y}
            displayRole={slot.displayRole}
            {...(stat ? { stat } : {})}
            {...(meta ? { meta } : {})}
            isBest={player.player_registration_id === bestRatedPlayerId}
            onPlayerStat={onPlayerStat}
            onPlayerProfile={onPlayerProfile}
          />
        );
      })}
    </>
  );
}

function AdminMatchPlayerNode({
  player,
  teamRegistrationId,
  x,
  y,
  displayRole,
  stat,
  meta,
  isBest,
  onPlayerStat,
  onPlayerProfile,
}: {
  player: MatchDetailLineupPlayer;
  teamRegistrationId?: string | undefined;
  x: number;
  y: number;
  displayRole: string;
  stat?: MatchDetailPlayerStat;
  meta?: PlayerEventMeta;
  isBest: boolean;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  const registration = player.player_season_registrations;
  const name = registration?.players?.full_name ?? "Player";
  return (
    <button
      type="button"
      onClick={() => (stat ? onPlayerStat(stat) : undefined)}
      onContextMenu={(event) => {
        event.preventDefault();
        onPlayerProfile(player, teamRegistrationId);
      }}
      className="absolute z-10 w-[72px] -translate-x-1/2 -translate-y-1/2 text-center outline-none transition hover:-translate-y-[54%] sm:w-[96px] lg:w-[118px]"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={
        stat
          ? "Left click: match stats · Right click: player profile"
          : "Right click for player profile"
      }
    >
      <div className="relative mx-auto h-11 w-11 sm:h-14 sm:w-14">
        <div className="grid h-full w-full place-items-center overflow-hidden rounded-full border-[3px] border-white bg-white shadow-md">
          {registration?.players?.avatar_url ? (
            <img
              src={registration.players.avatar_url}
              alt={name}
              className="h-[118%] w-full rounded-full object-cover object-top"
            />
          ) : (
            <span className="grid h-full w-full place-items-center rounded-full bg-emerald-700 text-sm font-black text-white">
              {initials(name)}
            </span>
          )}
        </div>
        {stat ? (
          <span
            className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white shadow ${ratingBadgeClass(Number(stat.rating))}`}
          >
            {formatRating(stat.rating)}
            {isBest ? (
              <Star size={10} className="ml-0.5 inline fill-current" />
            ) : null}
          </span>
        ) : null}
        {meta ? <LineupEventIcons meta={meta} overlay /> : null}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        {meta?.injured ? (
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-[12px] font-black leading-none text-red-600 shadow ring-1 ring-red-100">
            +
          </span>
        ) : null}
        {player.is_captain ? (
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-[10px] font-black lowercase text-slate-700 shadow">
            c
          </span>
        ) : null}
        <span className="truncate text-[13px] font-black text-white drop-shadow">
          {registration?.shirt_number ?? player.shirt_number ?? "-"} {name}
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">
        {player.display_role ?? displayRole}
      </p>
    </button>
  );
}

function MatchBenchColumn({
  title,
  players,
  teamRegistrationId,
  statsByPlayer,
  eventMetaByPlayer,
  bestRatedPlayerId,
  onPlayerStat,
  onPlayerProfile,
}: {
  title: string;
  players: MatchDetailLineupPlayer[];
  teamRegistrationId?: string | undefined;
  statsByPlayer: Map<string, MatchDetailPlayerStat>;
  eventMetaByPlayer: Map<string, PlayerEventMeta>;
  bestRatedPlayerId: string | null;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
  onPlayerProfile: (
    player: MatchDetailLineupPlayer,
    teamRegistrationId?: string,
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200">
      <h4 className="border-b border-slate-100 py-3 text-center text-sm font-black">
        {title}
      </h4>
      <div className="divide-y divide-slate-100">
        {players.length ? (
          players.map((player) => {
            const registration = player.player_season_registrations;
            const name = registration?.players?.full_name ?? "Player";
            const stat = statsByPlayer.get(player.player_registration_id);
            const meta = eventMetaByPlayer.get(player.player_registration_id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => (stat ? onPlayerStat(stat) : undefined)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onPlayerProfile(player, teamRegistrationId);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-indigo-700">
                  {registration?.players?.avatar_url ? (
                    <img
                      src={registration.players.avatar_url}
                      alt={name}
                      className="h-[118%] w-full object-cover object-top"
                    />
                  ) : (
                    initials(name)
                  )}
                </div>
                {stat ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black text-white ${ratingBadgeClass(Number(stat.rating))}`}
                  >
                    {formatRating(stat.rating)}
                    {player.player_registration_id === bestRatedPlayerId ? (
                      <Star size={10} className="ml-0.5 inline fill-current" />
                    ) : null}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{name}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    #{registration?.shirt_number ?? player.shirt_number ?? "-"}{" "}
                    ·{" "}
                    {registration?.football_position ??
                      player.football_position ??
                      player.player_natural_position ??
                      "POS"}
                  </p>
                </div>
                {meta ? <LineupEventIcons meta={meta} dark /> : null}
              </button>
            );
          })
        ) : (
          <p className="p-4 text-center text-sm font-semibold text-slate-500">
            No substitutes listed.
          </p>
        )}
      </div>
    </div>
  );
}

function averageLineupRating(
  lineup: MatchDetailLineup | null,
  statsByPlayer: Map<string, MatchDetailPlayerStat>,
) {
  const ratings = (lineup?.lineup_players ?? [])
    .map((player) =>
      Number(statsByPlayer.get(player.player_registration_id)?.rating),
    )
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  if (!ratings.length) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function LineupSide({
  title,
  lineup,
  statsByPlayer,
  onPlayerStat,
}: {
  title: string;
  lineup: MatchDetailLineup | null;
  statsByPlayer: Map<string, MatchDetailPlayerStat>;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
}) {
  const players = [...(lineup?.lineup_players ?? [])].sort(
    (a, b) => Number(b.is_starter) - Number(a.is_starter),
  );
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-black">{title}</h3>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          {lineup?.formation ?? "Formation N/A"}
        </span>
      </div>
      {players.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {players.map((player) => {
            const registration = player.player_season_registrations;
            const name = registration?.players?.full_name ?? "Player";
            const stat = statsByPlayer.get(player.player_registration_id);
            return (
              <button
                key={player.id}
                type="button"
                disabled={!stat}
                onClick={() => (stat ? onPlayerStat(stat) : undefined)}
                className="relative rounded-2xl bg-white/15 p-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-white/25 disabled:cursor-default disabled:hover:translate-y-0"
              >
                {stat ? (
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-black text-white ${ratingTone(Number(stat.rating))}`}
                  >
                    {formatRating(stat.rating)}
                  </span>
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-black text-emerald-700">
                    {initials(name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black">
                      #
                      {registration?.shirt_number ?? player.shirt_number ?? "-"}{" "}
                      {name}
                    </p>
                    <p className="text-xs text-white/75">
                      {registration?.football_position ??
                        player.football_position ??
                        registration?.position ??
                        "POS"}{" "}
                      · {player.is_starter ? "Starter" : "Bench"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/20 p-4 text-sm font-semibold text-white/80">
          No lineup players found.
        </div>
      )}
    </div>
  );
}

function MatchTeamStatsPanel({
  leftTeamName,
  rightTeamName,
  leftTeamRegistrationId,
  rightTeamRegistrationId,
  leftTeamColor,
  rightTeamColor,
  stats,
}: {
  leftTeamName: string;
  rightTeamName: string;
  leftTeamRegistrationId: string | null | undefined;
  rightTeamRegistrationId: string | null | undefined;
  leftTeamColor?: string | null | undefined;
  rightTeamColor?: string | null | undefined;
  stats: MatchDetailTeamStat[];
}) {
  const first = stats.find(
    (stat) => stat.team_registration_id === leftTeamRegistrationId,
  );
  const second = stats.find(
    (stat) => stat.team_registration_id === rightTeamRegistrationId,
  );
  if (!first || !second) return null;
  const leftColor = safeStatColor(leftTeamColor, "#C4003A");
  const rightColor = safeStatColor(rightTeamColor, "#0F172A");
  const sections: Array<{
    title: string;
    rows: Array<
      [
        string,
        keyof MatchDetailTeamStat,
        "number" | "percent" | "passes" | "rating" | "decimal",
      ]
    >;
  }> = [
    {
      title: "Top stats",
      rows: [
        ["Expected goals (xG)", "expected_goals", "decimal"],
        ["Total shots", "shots", "number"],
        ["Shots on target", "shots_on_target", "number"],
        ["Hit woodwork", "hit_woodwork", "number"],
        ["Big chances", "big_chances", "number"],
        ["Big chances missed", "big_chances_missed", "number"],
        ["Accurate passes", "accurate_passes", "passes"],
        ["Yellow cards", "yellow_cards", "number"],
        ["Corners", "corners", "number"],
      ],
    },
    {
      title: "Shots",
      rows: [
        ["Total shots", "shots", "number"],
        ["Shots off target", "shots_off_target", "number"],
        ["Shots on target", "shots_on_target", "number"],
        ["Hit woodwork", "hit_woodwork", "number"],
      ],
    },
    {
      title: "Defense",
      rows: [
        ["Tackles", "tackles", "number"],
        ["Interceptions", "interceptions", "number"],
        ["Blocks", "blocks", "number"],
        ["Clearances", "clearances", "number"],
        ["Keeper saves", "keeper_saves", "number"],
      ],
    },
    {
      title: "General",
      rows: [
        ["Team rating", "rating", "rating"],
        ["Offsides", "offsides", "number"],
        ["Fouls", "fouls", "number"],
        ["Red cards", "red_cards", "number"],
      ],
    },
  ];
  const firstPossession = Math.max(
    0,
    Math.min(100, Number(first.possession ?? 0)),
  );
  const secondPossession = Math.max(
    0,
    Math.min(100, Number(second.possession ?? 0)),
  );
  return (
    <div className="overflow-hidden rounded-3xl bg-[#1f1f1f] text-white shadow-2xl">
      <div className="grid gap-3 border-b border-white/10 px-6 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <p className="font-black" style={{ color: leftColor }}>
          {leftTeamName}
        </p>
        <h3 className="text-center text-lg font-black">Match stats</h3>
        <p className="text-right font-black" style={{ color: rightColor }}>
          {rightTeamName}
        </p>
      </div>

      <div className="px-6 py-5">
        <p className="text-center text-sm font-semibold">Ball possession</p>
        <div className="mt-5 flex h-10 overflow-hidden rounded-full bg-white text-sm font-black shadow-inner">
          <div
            className="grid place-items-center text-white"
            style={{
              width: `${firstPossession}%`,
              minWidth: firstPossession ? 56 : 0,
              background: leftColor,
            }}
          >
            {firstPossession}%
          </div>
          <div
            className="grid place-items-center text-slate-950"
            style={{
              width: `${secondPossession}%`,
              minWidth: secondPossession ? 56 : 0,
              background: rightColor === "#0F172A" ? "#FFFFFF" : rightColor,
              color: rightColor === "#0F172A" ? "#0F172A" : "#FFFFFF",
            }}
          >
            {secondPossession}%
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-black">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: leftColor }}
            />
            {leftTeamName}
          </span>
          <span className="inline-flex items-center justify-end gap-2 text-right">
            {rightTeamName}
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: rightColor }}
            />
          </span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="border-t border-white/10 px-6 py-6">
          <h4 className="mb-5 text-center text-base font-black">
            {section.title}
          </h4>
          <div className="space-y-5">
            {section.rows.map(([label, field, format]) => (
              <StatComparisonRow
                key={`${section.title}-${label}`}
                label={label}
                leftValue={formatTeamStat(first, field, format)}
                rightValue={formatTeamStat(second, field, format)}
                leftWins={
                  Number(first[field] ?? 0) > Number(second[field] ?? 0)
                }
                rightWins={
                  Number(second[field] ?? 0) > Number(first[field] ?? 0)
                }
                leftColor={leftColor}
                rightColor={rightColor}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatComparisonRow({
  label,
  leftValue,
  rightValue,
  leftWins,
  rightWins,
  leftColor,
  rightColor,
}: {
  label: string;
  leftValue: string;
  rightValue: string;
  leftWins: boolean;
  rightWins: boolean;
  leftColor: string;
  rightColor: string;
}) {
  return (
    <div className="grid grid-cols-[86px_1fr_86px] items-center gap-3 text-sm">
      <div className="justify-self-start">
        <span
          className="inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 font-black text-white"
          style={{
            background: leftWins ? leftColor : `${leftColor}22`,
            border: `1px solid ${leftColor}66`,
          }}
        >
          {leftValue}
        </span>
      </div>
      <p className="text-center font-medium text-white/90">{label}</p>
      <div className="justify-self-end">
        <span
          className="inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 font-black"
          style={{
            background: rightWins
              ? rightColor === "#0F172A"
                ? "#FFFFFF"
                : rightColor
              : `${rightColor}22`,
            border: `1px solid ${rightColor}66`,
            color:
              rightWins && rightColor === "#0F172A" ? "#0F172A" : "#FFFFFF",
          }}
        >
          {rightValue}
        </span>
      </div>
    </div>
  );
}

function safeStatColor(value: string | null | undefined, fallback: string) {
  const color = value?.trim();
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return fallback;
  return color;
}

// Builds a map of player_registration_id -> the position a player actually
// played in the match (the lineup slot's display_role, e.g. "AM"). Bench
// players carry display_role "SUB", so we fall back to their natural position.
function buildMatchRoleMap(
  detail: MatchDetailResponse | null,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const lineup of detail?.lineups ?? []) {
    for (const player of lineup.lineup_players ?? []) {
      const natural =
        player.player_season_registrations?.football_position ??
        player.football_position ??
        player.player_natural_position ??
        null;
      let role = player.display_role ?? null;
      if (!role || role === "SUB") role = natural;
      if (role) map.set(player.player_registration_id, role);
    }
  }
  return map;
}

// Ordered list of stat rows (home lineup order, then away) so the stat modal
// can step through players with the prev/next header buttons.
function buildOrderedStats(
  detail: MatchDetailResponse | null,
): MatchDetailPlayerStat[] {
  const statsByPlayer = new Map(
    (detail?.player_stats ?? []).map((stat) => [
      stat.player_registration_id,
      stat,
    ]),
  );
  const ordered: MatchDetailPlayerStat[] = [];
  const seen = new Set<string>();
  const home = lineupForFixtureTeam(
    detail?.lineups,
    detail?.fixture?.home_team_registration_id,
  );
  const away = lineupForFixtureTeam(
    detail?.lineups,
    detail?.fixture?.away_team_registration_id,
  );
  for (const lineup of [home, away]) {
    for (const player of lineup?.lineup_players ?? []) {
      const stat = statsByPlayer.get(player.player_registration_id);
      if (stat && !seen.has(stat.player_registration_id)) {
        ordered.push(stat);
        seen.add(stat.player_registration_id);
      }
    }
  }
  for (const stat of detail?.player_stats ?? []) {
    if (!seen.has(stat.player_registration_id)) {
      ordered.push(stat);
      seen.add(stat.player_registration_id);
    }
  }
  return ordered;
}

function PlayerMatchStatModal({
  stat,
  role,
  onPrev,
  onNext,
  onClose,
}: {
  stat: MatchDetailPlayerStat;
  role?: string | null | undefined;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  onClose: () => void;
}) {
  const player = stat.player_season_registrations;
  const position =
    role ??
    stat.position_played ??
    player?.football_position ??
    player?.position ??
    "POS";
  const isGoalkeeper = position === "GK";
  const name = player?.players?.full_name ?? "Player";
  const defensiveContribution =
    Number(stat.tackles ?? 0) +
    Number(stat.interceptions ?? 0) +
    Number(stat.clearances ?? 0) +
    Number(stat.blocks ?? 0);
  const sectionGroups: Array<{
    title: string;
    items: Array<[string, unknown]>;
  }> = isGoalkeeper
    ? [
        {
          title: "Top stats",
          items: [
            ["Minutes played", stat.minutes],
            ["Rating", stat.rating],
            ["Saves", stat.saves],
            ["Goals conceded", stat.goals_conceded],
          ],
        },
        {
          title: "Distribution",
          items: [
            ["Accurate passes", stat.accurate_passes],
            ["Accurate long balls", stat.accurate_long_balls],
          ],
        },
        {
          title: "Goalkeeping",
          items: [
            ["Diving saves", stat.diving_saves],
            ["Saves inside box", stat.saves_inside_box],
            ["Clearances", stat.clearances],
          ],
        },
        {
          title: "Discipline",
          items: [
            ["Yellow cards", stat.yellow_cards],
            ["Red cards", stat.red_cards],
          ],
        },
      ]
    : [
        {
          title: "Top stats",
          items: [
            ["Minutes played", stat.minutes],
            ["Position played", position],
            ["Rating", stat.rating],
            ["Goals", stat.goals],
            ["Assists", stat.assists],
          ],
        },
        {
          title: "Attack",
          items: [
            ["Shots", stat.shots],
            ["Shots on target", stat.shots_on_target],
            ["Shot accuracy", percent(stat.shots_on_target, stat.shots)],
            ["Chances created", stat.chances_created],
            ["Big chances created", stat.big_chances_created],
            ["Big chances missed", stat.big_chances_missed],
          ],
        },
        {
          title: "Passing + dribbling",
          items: [
            ["Total passes", stat.passes],
            [
              "Accurate passes",
              `${formatNumber(stat.accurate_passes)}/${formatNumber(stat.passes)} (${percent(stat.accurate_passes, stat.passes)})`,
            ],
            ["Dribbles attempted", stat.dribbles_attempted],
            [
              "Successful dribbles",
              `${formatNumber(stat.successful_dribbles)}/${formatNumber(stat.dribbles_attempted)} (${percent(stat.successful_dribbles, stat.dribbles_attempted)})`,
            ],
            ["Dispossessed", stat.dispossessed],
          ],
        },
        {
          title: "Defense",
          items: [
            ["Defensive contribution", defensiveContribution],
            ["Tackles", stat.tackles],
            ["Interceptions", stat.interceptions],
            ["Clearances", stat.clearances],
            ["Blocks", stat.blocks],
            ["Dribbled past", stat.dribbled_past],
          ],
        },
        {
          title: "Discipline",
          items: [
            ["Fouls committed", stat.fouls_committed],
            ["Yellow cards", stat.yellow_cards],
            ["Red cards", stat.red_cards],
          ],
        },
      ];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-emerald-200 to-white p-6">
          <div className="flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl font-black shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous player"
            >
              ‹
            </button>
            <div className="text-center">
              <div className="relative mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-white bg-white text-xl font-black text-indigo-700 shadow">
                {player?.players?.avatar_url ? (
                  <img
                    src={player.players.avatar_url}
                    alt={name}
                    className="h-[120%] w-full object-cover object-top"
                  />
                ) : (
                  initials(name)
                )}
                <span
                  className={`absolute -right-1 -top-1 rounded-full px-2 py-0.5 text-xs font-black text-white ${ratingBadgeClass(Number(stat.rating))}`}
                >
                  {formatRating(stat.rating)}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black">{name}</h3>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-black">{position}</p>
                  <p className="text-slate-500">Position</p>
                </div>
                <div>
                  <p className="font-black">
                    {player?.shirt_number ? `#${player.shirt_number}` : "-"}
                  </p>
                  <p className="text-slate-500">Number</p>
                </div>
                <div>
                  <p className="font-black">{formatNumber(stat.minutes)}</p>
                  <p className="text-slate-500">Minutes</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl font-black shadow transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next player"
              >
                ›
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl font-black shadow transition hover:bg-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-6 p-6">
          {sectionGroups.map((section) => (
            <section key={section.title}>
              <h4 className="mb-3 text-lg font-black">{section.title}</h4>
              <div className="divide-y divide-slate-100">
                {section.items.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="text-right font-black">
                      {label === "Rating"
                        ? formatRating(value)
                        : formatValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="sticky bottom-0 w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function StandingsView({
  groupMode,
  teams,
}: {
  groupMode: boolean;
  teams: StandingTeam[];
}) {
  if (groupMode) {
    return (
      <div>
        <PageTitle
          title="Group Standings"
          subtitle="Group table with qualified and eliminated status."
        />
        <EmptyState label="Group standings will appear after groups are generated and matches are finalized." />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Standings"
        subtitle="League table. Table topper becomes champion for round robin formats."
      />
      <StandingTable title="Current Table" teams={teams} />
    </div>
  );
}

function PlayerStatsView({
  data,
  onOpenPlayer,
}: {
  data: AdminSeasonData;
  onOpenPlayer: (playerRegistrationId: string) => void;
}) {
  const [openCard, setOpenCard] = useState<StatCardData | null>(null);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const sections = filterStatSections(
    data.statsReport.player_sections,
    teamFilter,
    data.teams,
    "player",
  );
  return (
    <div>
      <PageTitle
        title="Player Stats"
        subtitle="Player leaderboards update after confirmed match simulations. xG/xA are intentionally not tracked in this project."
      />
      <AdminStatsFilter
        value={teamFilter}
        teams={data.teams}
        onChange={setTeamFilter}
      />
      <LeaderboardSections
        title="Player Stats"
        sections={sections}
        onOpen={setOpenCard}
        onEntryOpen={(entry) => onOpenPlayer(entry.id)}
      />
      {openCard ? (
        <LeaderboardModal
          card={openCard}
          onEntryOpen={(entry) => onOpenPlayer(entry.id)}
          onClose={() => setOpenCard(null)}
        />
      ) : null}
    </div>
  );
}

function TeamStatsView({
  data,
  onOpenTeam,
}: {
  data: AdminSeasonData;
  onOpenTeam: (teamRegistrationId: string) => void;
}) {
  const [openCard, setOpenCard] = useState<StatCardData | null>(null);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const sections = filterStatSections(
    data.statsReport.team_sections,
    teamFilter,
    data.teams,
    "team",
  );
  return (
    <div>
      <PageTitle
        title="Team Stats"
        subtitle="Team leaderboards update after confirmed match simulations. Team xG is the sum of each recorded match's xG."
      />
      <AdminStatsFilter
        value={teamFilter}
        teams={data.teams}
        onChange={setTeamFilter}
      />
      <LeaderboardSections
        title="Team Stats"
        sections={sections}
        onOpen={setOpenCard}
        onEntryOpen={(entry) => onOpenTeam(entry.id)}
      />
      {openCard ? (
        <LeaderboardModal
          card={openCard}
          onEntryOpen={(entry) => onOpenTeam(entry.id)}
          onClose={() => setOpenCard(null)}
        />
      ) : null}
    </div>
  );
}

function AdminStatsFilter({
  value,
  teams,
  onChange,
}: {
  value: string;
  teams: AdminTeam[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => onChange("ALL")}
        className={`rounded-xl px-4 py-2 text-sm font-black transition ${value === "ALL" ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-indigo-50"}`}
      >
        All Stats
      </button>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700"
      >
        <option value="ALL">All teams</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function filterStatSections(
  sections: StatSectionData[],
  teamFilter: string,
  teams: AdminTeam[],
  mode: "player" | "team",
) {
  if (teamFilter === "ALL") return sections;
  const team = teams.find((item) => item.id === teamFilter);
  if (!team) return sections;
  return sections.map((section) => ({
    ...section,
    cards: section.cards.map((card) => ({
      ...card,
      entries: card.entries.filter((entry) =>
        mode === "team" ? entry.id === team.id : entry.subLabel === team.name,
      ),
    })),
  }));
}

function LeaderboardSections({
  title,
  sections,
  onOpen,
  onEntryOpen,
}: {
  title: string;
  sections: StatSectionData[];
  onOpen: (card: StatCardData) => void;
  onEntryOpen: (entry: StatEntry) => void;
}) {
  const hasData = sections.some((section) =>
    section.cards.some((card) => card.entries.length > 0),
  );
  return (
    <section>
      <h2 className="mb-4 text-2xl font-black">{title}</h2>
      {!hasData ? (
        <EmptyState
          label={`${title} will appear after confirmed match results generate stats.`}
        />
      ) : null}
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-lg font-black">{section.title}</h3>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {section.cards.map((card) => (
                <LeaderboardCard
                  key={card.id}
                  card={card}
                  onOpen={() => onOpen(card)}
                  onEntryOpen={onEntryOpen}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeaderboardCard({
  card,
  onOpen,
  onEntryOpen,
}: {
  card: StatCardData;
  onOpen: () => void;
  onEntryOpen: (entry: StatEntry) => void;
}) {
  const topEntries = card.entries.slice(0, 3);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl">
      <button
        type="button"
        onClick={onOpen}
        className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg text-left outline-none transition hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Open full ${card.title} leaderboard`}
      >
        <h4 className="text-lg font-black">{card.title}</h4>
        <span className="text-2xl font-black text-slate-300">›</span>
      </button>
      {topEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-bold text-slate-500">
          No data yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {topEntries.map((entry, index) => (
            <LeaderboardEntryRow
              key={entry.id}
              entry={entry}
              rank={index + 1}
              onOpen={() => onEntryOpen(entry)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function LeaderboardEntryRow({
  entry,
  rank,
  onOpen,
}: {
  entry: StatEntry;
  rank: number;
  onOpen?: (() => void) | undefined;
}) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-5 text-sm font-black text-slate-400">{rank}</span>
        <PlayerOrTeamAvatar entry={entry} />
        <div className="min-w-0">
          <p className="truncate font-black">{entry.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
            {entry.teamLogoUrl ? (
              <img
                src={entry.teamLogoUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : null}
            <span className="truncate">{entry.subLabel}</span>
          </div>
        </div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-sm font-black ${rank === 1 ? "bg-blue-500 text-white" : "text-slate-900"}`}
      >
        {entry.value}
      </span>
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-4 rounded-lg py-3 text-left transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Open ${entry.name}`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {content}
    </div>
  );
}

function PlayerOrTeamAvatar({ entry }: { entry: StatEntry }) {
  const [failed, setFailed] = useState(false);
  if (entry.logoUrl && !failed) {
    return (
      <img
        src={entry.logoUrl}
        alt={entry.name}
        onError={() => setFailed(true)}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
      {entry.initials}
    </div>
  );
}

function LeaderboardModal({
  card,
  onEntryOpen,
  onClose,
}: {
  card: StatCardData;
  onEntryOpen: (entry: StatEntry) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">
              Full Leaderboard
            </p>
            <h2 className="mt-1 text-2xl font-black">{card.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        {card.entries.length === 0 ? (
          <EmptyState label="No data yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {card.entries.map((entry, index) => (
              <LeaderboardEntryRow
                key={entry.id}
                entry={entry}
                rank={index + 1}
                onOpen={() => onEntryOpen(entry)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AdminMessageApiRow {
  id: string;
  message: string;
  related_type: string;
  sender_role?: string | null;
  parent_message_id?: string | null;
  read_at: string | null;
  created_at: string;
  manager_id: string;
  team_registration_id?: string | null;
  manager?:
    | { full_name?: string | null; email?: string | null }
    | Array<{ full_name?: string | null; email?: string | null }>
    | null;
  team_registrations?:
    | {
        id: string;
        teams?: { name?: string | null; short_name?: string | null } | null;
      }
    | Array<{
        id: string;
        teams?: { name?: string | null; short_name?: string | null } | null;
      }>
    | null;
}

interface AdminMessageThread {
  root: AdminMessageApiRow;
  items: AdminMessageApiRow[];
  manager: string;
  team: string;
  lastAt: string;
  hasUnread: boolean;
}

function isAdminAuthored(row: AdminMessageApiRow) {
  return (row.sender_role ?? "ADMIN").toUpperCase() === "ADMIN";
}

// Group the season's flat message list into per-conversation threads keyed by
// their root message, most-recent-activity first. Manager-authored roots with
// unread replies surface as actionable inbox items.
function buildAdminThreads(rows: AdminMessageApiRow[]): AdminMessageThread[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const rootOf = (row: AdminMessageApiRow): AdminMessageApiRow => {
    let current = row;
    const seen = new Set<string>();
    while (current.parent_message_id && byId.has(current.parent_message_id)) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      current = byId.get(current.parent_message_id)!;
    }
    return current;
  };
  const threads = new Map<string, AdminMessageApiRow[]>();
  for (const row of rows) {
    const root = rootOf(row);
    const list = threads.get(root.id) ?? [];
    list.push(row);
    threads.set(root.id, list);
  }
  return Array.from(threads.entries())
    .map(([rootId, items]) => {
      const sorted = [...items].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const root: AdminMessageApiRow = byId.get(rootId) ?? sorted[0]!;
      const manager = relatedOne(root.manager);
      const teamReg = relatedOne(root.team_registrations);
      return {
        root,
        items: sorted,
        manager: manager?.full_name ?? manager?.email ?? "Manager",
        team: teamReg?.teams?.name ?? "-",
        lastAt: sorted[sorted.length - 1]?.created_at ?? "",
        // Only inbound (manager-authored) messages that are unread need action.
        hasUnread: sorted.some(
          (item) => !item.read_at && !isAdminAuthored(item),
        ),
      };
    })
    .sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
}

function MessagesView({ seasonId }: { seasonId: string }) {
  const [rows, setRows] = useState<AdminMessageApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const { messages } = await api<{ messages: AdminMessageApiRow[] }>(
      `/admin/seasons/${seasonId}/messages`,
    );
    setRows(messages);
    return messages;
  }, [seasonId]);

  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        ),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  const threads = buildAdminThreads(rows);
  const selectedThread =
    threads.find((thread) => thread.root.id === selectedRootId) ??
    threads[0] ??
    null;

  async function openThread(thread: AdminMessageThread) {
    setSelectedRootId(thread.root.id);
    setReplyDraft("");
    const unread = thread.items.filter(
      (item) => !item.read_at && !isAdminAuthored(item),
    );
    if (unread.length) {
      await Promise.all(
        unread.map((item) =>
          api(`/admin/manager-messages/${item.id}/read`, { method: "PATCH" }),
        ),
      ).catch(() => undefined);
      await reload();
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const trimmed = replyDraft.trim();
    if (!trimmed || !selectedThread) return;
    setSending(true);
    setError("");
    try {
      // Reply to the latest message in the thread so scope always resolves.
      const target =
        selectedThread.items[selectedThread.items.length - 1] ??
        selectedThread.root;
      await api(`/admin/manager-messages/${target.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: trimmed }),
      });
      setReplyDraft("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Messages</h2>
        <p className="text-sm text-slate-500">
          Conversations with managers, plus automated notices for rejections,
          blocks, and removals.
        </p>
      </div>
      {error ? (
        <p className="text-sm font-semibold text-red-600">{error}</p>
      ) : null}
      {loading ? (
        <EmptyState label="Loading messages..." />
      ) : threads.length === 0 ? (
        <EmptyState label="No messages yet." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Panel title="Conversations">
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.root.id}
                  className={`w-full rounded-2xl p-3 text-left text-sm transition hover:bg-slate-100 ${
                    selectedThread?.root.id === thread.root.id
                      ? "bg-slate-100"
                      : "bg-slate-50"
                  }`}
                  onClick={() => void openThread(thread)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-bold text-slate-900">
                      {thread.manager}
                    </p>
                    {thread.hasUnread ? (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {thread.team}
                  </p>
                  <p className="mt-1 truncate text-slate-500">
                    {thread.items[thread.items.length - 1]?.message}
                  </p>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Conversation">
            {selectedThread ? (
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-slate-900">
                    {selectedThread.manager}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedThread.team}
                  </p>
                </div>
                <div className="space-y-3">
                  {selectedThread.items.map((item) => {
                    const fromAdmin = isAdminAuthored(item);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 ${
                          fromAdmin ? "ml-6 bg-slate-100" : "mr-6 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            {fromAdmin
                              ? "League office"
                              : selectedThread.manager}
                          </p>
                          <p className="text-xs text-slate-400">
                            {safeDateTime(item.created_at)}
                          </p>
                        </div>
                        <p className="mt-1 leading-7 text-slate-700">
                          {item.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={sendReply} className="space-y-2">
                  <textarea
                    className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                    value={replyDraft}
                    maxLength={2000}
                    placeholder="Reply to this manager..."
                    onChange={(event) => setReplyDraft(event.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sending || !replyDraft.trim()}
                      className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? "Sending..." : "Reply"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </Panel>
        </div>
      )}
    </div>
  );
}

function DivideGroupsView({
  season,
  onSaved,
}: {
  season: SeasonDto;
  onSaved: () => Promise<void>;
}) {
  const [data, setData] = useState<AdminGroupsResponse | null>(null);
  const [draftGroups, setDraftGroups] = useState<AdminFixtureGroup[]>([]);
  const [message, setMessage] = useState("");

  async function loadGroups() {
    const result = await api<AdminGroupsResponse>(
      `/admin/seasons/${season.id}/groups`,
    );
    setData(result);
    setDraftGroups(result.groups);
  }

  useEffect(() => {
    void loadGroups().catch((error) =>
      setMessage(
        error instanceof Error ? error.message : "Could not load group data",
      ),
    );
  }, [season.id]);

  const assignedTeamIds = new Set(
    draftGroups.flatMap((group) => group.teams.map((team) => team.id)),
  );
  const unassignedTeams = (data?.approved_teams ?? []).filter(
    (team) => !assignedTeamIds.has(team.id),
  );
  const requiredTeams =
    Number(season.group_count ?? 0) * Number(season.teams_per_group ?? 0);
  const canSave =
    draftGroups.length === Number(season.group_count ?? 0) &&
    draftGroups.every(
      (group) => group.teams.length === Number(season.teams_per_group ?? 0),
    ) &&
    unassignedTeams.length === 0;

  async function randomizeGroups() {
    setMessage("");
    const result = await api<{ groups: AdminFixtureGroup[] }>(
      `/admin/seasons/${season.id}/groups/randomize`,
      { method: "POST" },
    );
    setDraftGroups(result.groups);
    await loadGroups();
  }

  function moveTeam(teamId: string, targetGroupId: string) {
    const team = (data?.approved_teams ?? []).find(
      (item) => item.id === teamId,
    );
    if (!team) return;
    setDraftGroups((groups) =>
      groups.map((group) => ({
        ...group,
        teams:
          group.id === targetGroupId
            ? group.teams.some((item) => item.id === teamId)
              ? group.teams
              : [...group.teams, team]
            : group.teams.filter((item) => item.id !== teamId),
      })),
    );
  }

  async function saveGroups() {
    await api(`/admin/seasons/${season.id}/groups/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        groups: draftGroups.map((group) => ({
          group_id: group.id,
          team_registration_ids: group.teams.map((team) => team.id),
        })),
      }),
    });
    await onSaved();
  }

  if (!data) {
    return (
      <div>
        <PageTitle
          title="Divide Teams Into Groups"
          subtitle="Loading group settings from the database."
        />
        <EmptyState label={message || "Loading groups..."} />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Divide Teams Into Groups"
        subtitle="Generate groups randomly, then manually move or swap teams before saving."
      />
      {message ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {message}
        </div>
      ) : null}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard
          label="Group Count"
          value={String(season.group_count ?? 0)}
        />
        <SummaryCard
          label="Teams Per Group"
          value={String(season.teams_per_group ?? 0)}
        />
        <SummaryCard
          label="Approved Teams"
          value={`${data.approved_teams.length}/${requiredTeams}`}
        />
        <SummaryCard
          label="Groups Ready"
          value={canSave ? "Yes" : "No"}
          color={canSave ? "green" : "orange"}
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={() =>
            void randomizeGroups().catch((error) => setMessage(error.message))
          }
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700"
        >
          Generate Groups Randomly
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() =>
            void saveGroups().catch((error) => setMessage(error.message))
          }
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
        >
          Save Group Division
        </button>
        {!canSave ? (
          <p className="self-center text-sm font-semibold text-slate-500">
            Each group must have exactly {season.teams_per_group ?? 0} approved
            teams.
          </p>
        ) : null}
      </div>
      {draftGroups.length === 0 ? (
        <EmptyState label="No groups created yet. Click Generate Groups Randomly first, then adjust manually if needed." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {draftGroups.map((group) => (
            <Panel
              key={group.id}
              title={`${group.name} (${group.teams.length}/${season.teams_per_group ?? 0})`}
            >
              {group.teams.length === 0 ? (
                <EmptyState label="No teams in this group yet." />
              ) : (
                group.teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <TeamCompact
                      name={team.name ?? "Unnamed team"}
                      logoUrl={team.logo_url ?? null}
                    />
                    <select
                      value={group.id}
                      onChange={(event) =>
                        moveTeam(team.id, event.target.value)
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                    >
                      {draftGroups.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </Panel>
          ))}
          {unassignedTeams.length > 0 ? (
            <Panel title="Unassigned Teams">
              {unassignedTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0"
                >
                  <TeamCompact
                    name={team.name ?? "Unnamed team"}
                    logoUrl={team.logo_url ?? null}
                  />
                  <select
                    defaultValue=""
                    onChange={(event) => moveTeam(team.id, event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    <option value="" disabled>
                      Move to...
                    </option>
                    {draftGroups.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GroupsView({ season }: { season: SeasonDto }) {
  const [data, setData] = useState<AdminGroupsResponse | null>(null);
  const [standings, setStandings] = useState<StandingApiRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    void Promise.all([
      api<AdminGroupsResponse>(`/admin/seasons/${season.id}/groups`),
      publicApi<{ standings: StandingApiRow[] }>(
        `/public/seasons/${season.id}/standings`,
      ),
    ])
      .then(([groupData, standingData]) => {
        if (!alive) return;
        setData(groupData);
        setStandings(standingData.standings ?? []);
      })
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Could not load groups",
        ),
      );
    return () => {
      alive = false;
    };
  }, [season.id]);

  const standingByTeam = useMemo(
    () =>
      new Map(
        standings.map((standing) => [standing.team_registration_id, standing]),
      ),
    [standings],
  );

  return (
    <div>
      <PageTitle
        title="Groups"
        subtitle="Saved group division for this season."
      />
      {!data ? (
        <EmptyState label={message || "Loading groups..."} />
      ) : data.groups.length === 0 ? (
        <EmptyState label="Groups are not divided yet." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.groups.map((group) => {
            const rankedTeams = [...group.teams].sort((a, b) => {
              const aStanding = standingByTeam.get(a.id);
              const bStanding = standingByTeam.get(b.id);
              return (
                Number(aStanding?.position ?? Number.MAX_SAFE_INTEGER) -
                  Number(bStanding?.position ?? Number.MAX_SAFE_INTEGER) ||
                a.id.localeCompare(b.id)
              );
            });
            return (
              <Panel
                key={group.id}
                title={`${group.name} (${group.teams.length}/${season.teams_per_group ?? 0})`}
              >
                {group.teams.length === 0 ? (
                  <EmptyState label="No teams in this group." />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-3 py-3 text-center">P</th>
                          <th className="px-3 py-3 text-center">W</th>
                          <th className="px-3 py-3 text-center">D</th>
                          <th className="px-3 py-3 text-center">L</th>
                          <th className="px-3 py-3 text-center">GF</th>
                          <th className="px-3 py-3 text-center">GA</th>
                          <th className="px-3 py-3 text-center">GD</th>
                          <th className="px-3 py-3 text-center">PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedTeams.map((team) => {
                          const standing = standingByTeam.get(team.id);
                          const goalsFor = standing?.goals_for ?? 0;
                          const goalsAgainst = standing?.goals_against ?? 0;
                          const goalDifference =
                            standing?.goal_difference ??
                            goalsFor - goalsAgainst;
                          return (
                            <tr
                              key={team.id}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-3">
                                <TeamCompact
                                  name={team.name ?? "Unnamed team"}
                                  logoUrl={team.logo_url ?? null}
                                />
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {standing?.played ?? 0}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {standing?.won ?? 0}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {standing?.drawn ?? 0}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {standing?.lost ?? 0}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {goalsFor}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {goalsAgainst}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {goalDifference}
                              </td>
                              <td className="px-3 py-3 text-center font-black text-indigo-700">
                                {standing?.points ?? 0}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KnockoutView({ season }: { season: SeasonDto }) {
  const [data, setData] = useState<AdminFixturesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api<AdminFixturesResponse>(`/admin/seasons/${season.id}/fixtures`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load the knockout bracket.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [season.id]);

  const knockoutFixtures = useMemo(
    () =>
      (data?.fixtures ?? [])
        .filter(
          (fixture) => fixture.stage !== "GROUP" && fixture.stage !== "LEAGUE",
        )
        .sort((left, right) => {
          const roundDifference =
            Number(left.round_no ?? 0) - Number(right.round_no ?? 0);
          if (roundDifference) return roundDifference;
          const kickoffDifference = String(left.kickoff_at ?? "").localeCompare(
            String(right.kickoff_at ?? ""),
          );
          if (kickoffDifference) return kickoffDifference;
          return left.id.localeCompare(right.id);
        }),
    [data?.fixtures],
  );

  return (
    <div>
      <PageTitle
        title="Knockout Bracket"
        subtitle="Generated after group stage is finished. Knockout matches cannot end in draw."
      />
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState label="Loading saved knockout fixtures..." />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 font-bold text-red-700 shadow-sm">
          {error}
        </div>
      ) : (
        <KnockoutBracket
          fixtures={knockoutFixtures}
          emptyMessage="No saved knockout fixtures yet. Generate them in Fixtures, then select Confirm & Save Fixtures."
        />
      )}
    </div>
  );
}

function SettingsView({
  league,
  season,
  onSaved,
}: {
  league: LeagueDto;
  season: SeasonDto;
  onSaved: () => Promise<void>;
}) {
  const [leagueDraft, setLeagueDraft] = useState({
    name: league.name,
    short_name: league.short_name ?? "",
    logo_url: league.logo_url ?? "",
    organizer_name: league.organizer_name ?? "",
    country: league.country ?? "",
    description: league.description ?? "",
  });
  const [seasonDraft, setSeasonDraft] = useState({
    format: season.format,
    phase: season.phase,
    total_teams: String(season.total_teams ?? ""),
    lineup_size: "11",
    substitute_limit: String(season.substitute_limit ?? ""),
    yellow_card_suspension_threshold: String(
      season.yellow_card_suspension_threshold ?? 3,
    ),
    registration_start_date: season.registration_start_date ?? "",
    registration_deadline: season.registration_deadline ?? "",
    start_date: season.start_date ?? "",
    end_date: season.end_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  async function saveSettings() {
    setSaving(true);
    try {
      await Promise.all([
        api(`/admin/leagues/${league.id}`, {
          method: "PATCH",
          body: JSON.stringify(leagueDraft),
        }),
        api(`/admin/seasons/${season.id}`, {
          method: "PATCH",
          body: JSON.stringify(seasonDraft),
        }),
      ]);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <PageTitle
        title="Settings"
        subtitle="Edit selected league and season configuration."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="League Settings">
          <div className="grid gap-4">
            <EditableField
              label="League Name"
              value={leagueDraft.name}
              onChange={(value) =>
                setLeagueDraft((current) => ({ ...current, name: value }))
              }
            />
            <EditableField
              label="Short Name"
              value={leagueDraft.short_name}
              onChange={(value) =>
                setLeagueDraft((current) => ({ ...current, short_name: value }))
              }
            />
            <EditableField
              label="League Logo URL"
              value={leagueDraft.logo_url}
              onChange={(value) =>
                setLeagueDraft((current) => ({ ...current, logo_url: value }))
              }
            />
            <EditableField
              label="Organizer Name"
              value={leagueDraft.organizer_name}
              onChange={(value) =>
                setLeagueDraft((current) => ({
                  ...current,
                  organizer_name: value,
                }))
              }
            />
            <EditableField
              label="Country / Category"
              value={leagueDraft.country}
              onChange={(value) =>
                setLeagueDraft((current) => ({ ...current, country: value }))
              }
            />
            <EditableField
              label="Description"
              value={leagueDraft.description}
              onChange={(value) =>
                setLeagueDraft((current) => ({
                  ...current,
                  description: value,
                }))
              }
              textarea
            />
          </div>
        </Panel>
        <Panel title="Season Settings">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Format
              </span>
              <select
                value={seasonDraft.format}
                onChange={(event) =>
                  setSeasonDraft((current) => ({
                    ...current,
                    format: event.target.value as SeasonFormat,
                  }))
                }
                className="rounded-xl border border-slate-200 px-4 py-3 font-bold"
              >
                {Object.values(SeasonFormat).map((format) => (
                  <option key={format} value={format}>
                    {formatLabel(format)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Phase
              </span>
              <select
                value={seasonDraft.phase}
                onChange={(event) =>
                  setSeasonDraft((current) => ({
                    ...current,
                    phase: event.target.value as SeasonPhase,
                  }))
                }
                className="rounded-xl border border-slate-200 px-4 py-3 font-bold"
              >
                {Object.values(SeasonPhase).map((phase) => (
                  <option key={phase} value={phase}>
                    {formatPhase(phase)}
                  </option>
                ))}
              </select>
            </label>
            <EditableField
              label="Total Teams"
              value={seasonDraft.total_teams}
              type="number"
              onChange={(value) =>
                setSeasonDraft((current) => ({
                  ...current,
                  total_teams: value,
                }))
              }
            />
            <EditableField
              label="Substitute Limit"
              value={seasonDraft.substitute_limit}
              type="number"
              onChange={(value) =>
                setSeasonDraft((current) => ({
                  ...current,
                  substitute_limit: value,
                }))
              }
            />
            <EditableField
              label="Yellow Cards for 1-Match Suspension"
              value={seasonDraft.yellow_card_suspension_threshold}
              type="number"
              onChange={(value) =>
                setSeasonDraft((current) => ({
                  ...current,
                  yellow_card_suspension_threshold: value,
                }))
              }
            />
            <EditableField
              label="Registration Start"
              value={seasonDraft.registration_start_date}
              type="date"
              onChange={(value) =>
                setSeasonDraft((current) => ({
                  ...current,
                  registration_start_date: value,
                }))
              }
            />
            <EditableField
              label="Registration Deadline"
              value={seasonDraft.registration_deadline}
              type="date"
              onChange={(value) =>
                setSeasonDraft((current) => ({
                  ...current,
                  registration_deadline: value,
                }))
              }
            />
            <EditableField
              label="Season Start"
              value={seasonDraft.start_date}
              type="date"
              onChange={(value) =>
                setSeasonDraft((current) => ({ ...current, start_date: value }))
              }
            />
            <EditableField
              label="Season End"
              value={seasonDraft.end_date}
              type="date"
              onChange={(value) =>
                setSeasonDraft((current) => ({ ...current, end_date: value }))
              }
            />
          </div>
        </Panel>
      </div>
      <button
        type="button"
        onClick={() => void saveSettings()}
        disabled={saving}
        className="mt-5 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
      )}
    </label>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <h1 className="break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-base text-slate-600">{subtitle}</p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  action,
  onAction,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  color?: "blue" | "green" | "orange" | "purple" | "cyan";
  action?: string;
  onAction?: () => void;
}) {
  const cardColor = color ?? "blue";
  const tones = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
    purple: "bg-violet-100 text-violet-700",
    cyan: "bg-cyan-100 text-cyan-700",
  };
  const text = {
    blue: "text-blue-700",
    green: "text-green-700",
    orange: "text-orange-600",
    purple: "text-violet-700",
    cyan: "text-cyan-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        {icon ? (
          <div
            className={`grid h-[70px] w-[70px] place-items-center rounded-xl ${tones[cardColor]}`}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p
            className={`${icon ? "min-h-[48px]" : ""} text-base font-black leading-snug`}
          >
            {label}
          </p>
          <p
            className={`mt-2 ${icon ? "text-4xl" : "text-2xl"} font-black ${text[cardColor]}`}
          >
            {value}
          </p>
        </div>
      </div>
      {action ? (
        <>
          <div className="my-4 h-px bg-slate-200" />
          <button
            className="w-full rounded-lg py-2 text-center text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 active:translate-y-0 active:scale-[0.98]"
            onClick={onAction}
          >
            {action} →
          </button>
        </>
      ) : null}
    </div>
  );
}

function FeatureCard({
  title,
  icon,
  children,
  className = "",
  iconTone = "yellow",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  iconTone?: "yellow" | "green" | "purple";
}) {
  const tone =
    iconTone === "green"
      ? "bg-green-100 text-green-700"
      : iconTone === "purple"
        ? "bg-violet-100 text-violet-700"
        : "bg-yellow-100 text-yellow-700";
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="mb-5 flex items-center gap-4">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>
          {icon}
        </span>
        <h2 className="font-black">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Panel({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string | undefined;
  onAction?: (() => void) | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black">{title}</h2>
        {action ? (
          <button
            className="rounded-md px-2 py-1 text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 active:translate-y-0 active:scale-[0.97]"
            onClick={onAction}
          >
            {action} →
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function CrudPage({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle: string;
  columns: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4 font-black">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-sm font-semibold text-slate-500"
                >
                  No records yet.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-5 py-4 align-middle font-medium text-slate-700"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function ReadyMatchCard({
  match,
  simulating,
  onSimulate,
}: {
  match: ReadyMatchRow;
  simulating: boolean;
  onSimulate: () => void;
}) {
  const canSimulate = match.can_simulate ?? isSimulatableStatus(match.status);
  return (
    <div className="rounded-xl border border-slate-200 p-6 text-center">
      <div className="flex items-center justify-center gap-14">
        <TeamCompact name={match.home} logoUrl={match.homeLogoUrl} />
        <span className="font-black">vs</span>
        <TeamCompact name={match.away} logoUrl={match.awayLogoUrl} />
      </div>
      <p className="mt-7 text-sm text-slate-600">{match.kickoff}</p>
      <p className="mt-3 text-sm text-slate-600">{match.stage}</p>
      <button
        type="button"
        onClick={onSimulate}
        disabled={!canSimulate || simulating}
        title={
          !canSimulate
            ? "Simulation needs both lineups submitted and admin-confirmed."
            : undefined
        }
        className="group mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow"
      >
        <PlayCircle
          className="transition-transform duration-200 group-hover:scale-110"
          size={17}
        />
        {simulating ? "Simulating..." : "Simulate Match"}
      </button>
    </div>
  );
}

function StandingTable({
  title,
  teams: tableTeams,
}: {
  title: string;
  teams: StandingTeam[];
}) {
  return (
    <Panel title={title} action="Recalculate Standings">
      <div className="overflow-x-auto">
        {tableTeams.length === 0 ? (
          <EmptyState label="No standings yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Rank",
                  "Team",
                  "P",
                  "W",
                  "D",
                  "L",
                  "GF",
                  "GA",
                  "GD",
                  "Pts",
                ].map((header) => (
                  <th key={header} className="px-3 py-3 text-left">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableTeams.map((team, index) => (
                <tr key={team.name}>
                  <td className="px-3 py-3 font-black">{index + 1}</td>
                  <td className="px-3 py-3">
                    <TeamCompact name={team.name} />
                  </td>
                  <td className="px-3 py-3">{team.played}</td>
                  <td className="px-3 py-3">{team.won}</td>
                  <td className="px-3 py-3">{team.draw}</td>
                  <td className="px-3 py-3">{team.lost}</td>
                  <td className="px-3 py-3">{team.gf}</td>
                  <td className="px-3 py-3">{team.ga}</td>
                  <td className="px-3 py-3">{team.gf - team.ga}</td>
                  <td className="px-3 py-3 font-black text-indigo-700">
                    {team.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function SidebarButton({
  item,
  active,
  onClick,
}: {
  item: {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-md px-4 py-3 text-left text-base transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/20"
          : "text-slate-100 hover:bg-white/10 hover:shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
      }`}
    >
      <Icon
        className="transition-transform duration-200 group-hover:scale-110"
        size={22}
      />
      <span>{item.label}</span>
    </button>
  );
}

function TeamBadge({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions =
    size === "xl"
      ? "h-28 w-28 text-xl"
      : size === "lg"
        ? "h-20 w-20 text-sm"
        : size === "sm"
          ? "h-7 w-7 text-[9px]"
          : "h-12 w-12 text-xs";
  if (logoUrl && !imageFailed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setImageFailed(true)}
        className={`${dimensions} shrink-0 rounded-full border-4 border-white object-cover shadow`}
      />
    );
  }
  return (
    <div
      className={`${dimensions} grid shrink-0 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-blue-700 to-sky-400 text-center font-black text-white shadow`}
    >
      {name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 3)}
    </div>
  );
}

function TeamCompact({
  name,
  logoUrl,
  onClick,
}: {
  name: string;
  logoUrl?: string | null | undefined;
  onClick?: (() => void) | undefined;
}) {
  const content = (
    <>
      <TeamBadge name={name} logoUrl={logoUrl} />
      <span className="font-black">{name}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg text-left transition hover:-translate-y-0.5 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      title={`Open ${name}`}
    >
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3">{content}</div>
  );
}

function PlayerHero({
  name,
  team,
  teamLogoUrl,
  avatarUrl,
  shirt,
  color,
}: {
  name: string;
  team: string;
  teamLogoUrl?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  shirt: string;
  color: "blue" | "black";
}) {
  return (
    <div className="flex items-center gap-6">
      <div
        className={`grid h-24 w-24 place-items-center overflow-hidden rounded-full ${color === "blue" ? "bg-blue-100" : "bg-slate-100"}`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div
            className={`grid h-16 w-14 place-items-center rounded-t-2xl text-2xl font-black text-white ${color === "blue" ? "bg-blue-800" : "bg-slate-900"}`}
          >
            {shirt}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-black">{name}</h3>
        <div className="mt-1 flex items-center gap-2 text-base text-slate-600">
          <TeamBadge name={team} logoUrl={teamLogoUrl} size="sm" />
          <span>{team}</span>
        </div>
      </div>
    </div>
  );
}

function StatStrip({ stats }: { stats: [string, string][] }) {
  return (
    <div className="mt-6 grid grid-cols-2 divide-x divide-slate-200 text-center md:grid-cols-5">
      {stats.map(([value, label]) => (
        <div key={label} className="px-3">
          <p className="text-2xl font-black">{value}</p>
          <p className="mt-1 text-sm text-slate-600">{label}</p>
        </div>
      ))}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "blue" | "green" | "orange";
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

type ActionItem =
  | string
  | {
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      danger?: boolean;
      selected?: boolean;
    };

function ActionGroup({ actions }: { actions: ActionItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const item = typeof action === "string" ? { label: action } : action;
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            title={
              item.disabled
                ? "Approve the team before rating or approving players."
                : undefined
            }
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold transition-all duration-200 active:translate-y-0 active:scale-[0.96] ${
              item.selected
                ? "border-green-300 bg-green-100 text-green-800 ring-2 ring-green-200"
                : item.danger
                  ? "border-red-200 text-red-700 hover:-translate-y-0.5 hover:bg-red-50 hover:shadow-sm"
                  : "border-slate-200 text-indigo-700 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm"
            } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-white disabled:hover:shadow-none`}
          >
            {item.selected ? <CheckCircle2 size={13} /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black leading-tight text-green-700">
        {compactStatusLabel(value)}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
      {children}
    </div>
  );
}

function BracketColumn({
  title,
  matches,
}: {
  title: string;
  matches: string[];
}) {
  return (
    <div>
      <h3 className="mb-4 font-black text-slate-700">{title}</h3>
      <div className="space-y-4">
        {matches.map((match) => (
          <div
            key={match}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-bold"
          >
            {match}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLabel(format: string) {
  return format
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPhase(phase: SeasonDto["phase"] | null | undefined) {
  if (!phase || phase === SeasonPhase.REGISTRATION_OPEN)
    return "Registration Open";
  return formatLabel(phase);
}
