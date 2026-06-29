"use client";

import { useEffect, useMemo, useState } from "react";
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
  ClipboardCheck,
  Eye,
  FileText,
  GitBranch,
  Home,
  Mail,
  LogOut,
  MessageSquare,
  PlayCircle,
  Settings,
  Shield,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  User,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import { FixtureStatus, RegistrationStatus, SeasonFormat, SeasonPhase, type LeagueDto, type ProfileDto, type SeasonDto } from "@flms/shared";
import { api, publicApi } from "@/lib/api";
import { clearAuth } from "@/lib/auth";

type TabId =
  | "dashboard"
  | "teams"
  | "team-requests"
  | "player-requests"
  | "fixtures"
  | "matches-ready"
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
  date: string;
  home: string;
  away: string;
  score: string;
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
  home: string;
  away: string;
  stage: string;
  kickoff: string;
  status: string;
}

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
  topScorer: { name: string; team: string; goals: number; matches: number } | null;
  topAssist: { name: string; team: string; assists: number; matches: number } | null;
  topRated: { name: string; team: string; rating: string; matches: number } | null;
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
  team_sections: []
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
  statsReport: emptyStatsReport
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
    city?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    home_jersey_url?: string | null;
    away_jersey_url?: string | null;
    gk_home_jersey_url?: string | null;
    gk_away_jersey_url?: string | null;
  } | null;
  seasons?: { name?: string | null } | null;
  manager?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
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
    nationality?: string | null;
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
  result_confirmed?: boolean | null;
  home_team?: { id: string; teams?: { name?: string | null; short_name?: string | null; logo_url?: string | null } | null } | null;
  away_team?: { id: string; teams?: { name?: string | null; short_name?: string | null; logo_url?: string | null } | null } | null;
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
  shirt_number?: number | null;
  player_season_registrations?: {
    id: string;
    shirt_number?: number | null;
    football_position?: string | null;
    position?: string | null;
    players?: { full_name?: string | null; avatar_url?: string | null } | null;
  } | null;
};

type MatchDetailLineup = {
  id: string;
  team_registration_id: string;
  side: string;
  formation?: string | null;
  status?: string | null;
  lineup_players?: MatchDetailLineupPlayer[] | null;
};

type MatchDetailTeamStat = {
  id: string;
  fixture_id: string;
  team_registration_id: string;
  rating?: number | string | null;
  possession: number;
  shots: number;
  shots_on_target: number;
  big_chances: number;
  big_chances_missed: number;
  passes: number;
  accurate_passes: number;
  offsides?: number | null;
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
  points: number;
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
    players?: { full_name?: string | null } | null;
  } | null;
};

function safeDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(new Date(value));
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return 0;
  const born = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

function statusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
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

function adminPlayerStatus(row: PlayerRegistrationApiRow): AdminPlayer["playerStatus"] {
  if (row.player_status === "REMOVED") return "Removed";
  if (row.player_status === "SUSPENDED") return "Suspended";
  if (row.status === RegistrationStatus.APPROVED) return "Approved";
  if (row.status === RegistrationStatus.REJECTED) return "Rejected";
  return "Pending";
}

function abilityDetails(row: PlayerRegistrationApiRow): AdminPlayer["abilityDetails"] {
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
    ["Communication", ability.communication]
  ];
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => ({ label, value: String(value) }));
}

function abilityOverall(row: PlayerRegistrationApiRow) {
  return relatedOne(row.player_abilities)?.overall_rating ?? null;
}

function zeroLeagueStats(stat?: PlayerSeasonStatApiRow): AdminPlayer["leagueStats"] {
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
    shotAccuracy: shots ? `${Math.round((shotsOnTarget / shots) * 100)}%` : "0%",
    chancesCreated: stat?.chances_created ?? 0,
    totalPasses,
    accuratePasses,
    passAccuracy: totalPasses ? `${Math.round((accuratePasses / totalPasses) * 100)}%` : "0%",
    dribblesAttempted,
    successfulDribbles,
    dispossessed: stat?.dispossessed ?? 0,
    tackles: stat?.tackles ?? 0,
    interceptions: stat?.interceptions ?? 0,
    yellowCards: stat?.yellow_cards ?? 0,
    redCards: stat?.red_cards ?? 0,
    averageRating: stat?.average_rating ? String(stat.average_rating) : "N/A",
    bestMatchRating: stat?.best_match_rating ? String(stat.best_match_rating) : "N/A",
    lowestMatchRating: stat?.lowest_match_rating ? String(stat.lowest_match_rating) : "N/A",
    playerOfTheMatch: stat?.player_of_match_count ?? 0
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
  const seasonTeamRegistrations = input.teamRegistrations.filter((row) => row.season_id === input.season.id);
  const teamByRegistration = new Map(seasonTeamRegistrations.map((row) => [row.id, row]));
  const statsByRegistration = new Map(input.playerStats.map((row) => [row.player_registration_id, row]));

  const playersByTeam = new Map<string, AdminPlayer[]>();
  for (const row of input.playerRegistrations.filter((player) => player.season_id === input.season.id)) {
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
      dateOfBirth: row.players?.date_of_birth ? safeDate(row.players.date_of_birth) : "Not set",
      age: calculateAge(row.players?.date_of_birth),
      idType: row.players?.id_type ?? "N/A",
      maskedId: row.players?.id_number_last4 ? `********${row.players.id_number_last4}` : "Not submitted",
      uploadedDocument: "Private document",
      jerseyNumber: row.shirt_number ?? 0,
      position: row.position,
      footballPosition: row.football_position ?? row.position,
      preferredFoot: statusLabel(row.preferred_foot),
      approvalStatus: statusLabel(row.status) as AdminPlayer["approvalStatus"],
      playerStatus,
      registrationDate: safeDate(row.created_at),
      submittedByManager: manager?.full_name ?? manager?.email ?? "Manager",
      adminApprovalDate: row.reviewed_at ? safeDate(row.reviewed_at) : "Not approved yet",
      adminMessage: row.rejection_reason ?? row.removal_reason ?? row.suspension_reason ?? "No admin message.",
      abilityRating: abilityLabel(row.ability_rating),
      overallRating: abilityOverall(row),
      abilityDetails: abilityDetails(row),
      leagueStats: zeroLeagueStats(stat),
      performances: []
    };
    const list = playersByTeam.get(row.team_registration_id) ?? [];
    list.push(player);
    playersByTeam.set(row.team_registration_id, list);
  }

  const fixturesByTeam = (teamRegistrationId: string) =>
    input.fixtures
      .filter((fixture) => fixture.home_team_registration_id === teamRegistrationId || fixture.away_team_registration_id === teamRegistrationId)
      .map((fixture) => ({
        id: fixture.id,
        date: safeDate(fixture.kickoff_at),
        home: fixture.home_team_registration_id ? teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team" : fixture.home_source ?? "TBD",
        away: fixture.away_team_registration_id ? teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team" : fixture.away_source ?? "TBD",
        stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
        status: statusLabel(fixture.status),
        venue: fixture.venue ?? "Not set"
      }));

  const teams: AdminTeam[] = seasonTeamRegistrations
    .filter((row) => row.status === RegistrationStatus.APPROVED && !row.removed_at)
    .map((row) => {
      const manager = relatedOne(row.manager);
      const players = playersByTeam.get(row.id) ?? [];
      const suspendedPlayers = players.filter((player) => player.playerStatus === "Suspended" || player.playerStatus === "Removed");
      const activePlayers = players.filter((player) => player.playerStatus !== "Suspended" && player.playerStatus !== "Removed" && player.playerStatus !== "Rejected");
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
        squadCount: players.filter((player) => player.playerStatus !== "Removed" && player.approvalStatus !== "Rejected").length,
        approvedPlayers: players.filter((player) => player.approvalStatus === "Approved" && player.playerStatus !== "Removed").length,
        pendingPlayers: players.filter((player) => player.approvalStatus === "Pending").length,
        status: "Approved",
        players: activePlayers,
        suspendedPlayers,
        fixtures: teamFixtures,
        results: teamFixtures
          .filter((fixture) => fixture.status === "Final")
          .map((fixture) => ({ date: fixture.date, match: `${fixture.home} vs ${fixture.away}`, result: "Final", status: fixture.status })),
        messages: []
      };
    });

  const teamRequests: TeamRequest[] = seasonTeamRegistrations
    .filter((row) => row.status === RegistrationStatus.PENDING)
    .map((row) => ({
      id: row.id,
      team: row.teams?.name ?? "Unnamed team",
      logoUrl: row.teams?.logo_url ?? null,
      manager: relatedOne(row.manager)?.full_name ?? relatedOne(row.manager)?.email ?? "Manager",
      season: input.season.name,
      squad: (playersByTeam.get(row.id) ?? []).length,
      status: "Pending"
    }));

  const playerRequests: PlayerRequest[] = input.playerRegistrations
    .filter((row) => row.season_id === input.season.id && row.status === RegistrationStatus.PENDING)
    .map((row) => {
      const requestPlayer = (playersByTeam.get(row.team_registration_id) ?? []).find((player) => player.id === row.id);
      return {
        id: row.id,
        code: `PLY-${row.id.slice(0, 8).toUpperCase()}`,
        name: row.players?.full_name ?? "Unnamed player",
        team: teamByRegistration.get(row.team_registration_id)?.teams?.name ?? "Unassigned team",
        position: row.football_position ?? row.position,
        jersey: row.shirt_number ?? 0,
        idType: row.players?.id_type ?? "N/A",
        status: "Pending",
        teamStatus: relatedOne(row.team_registrations)?.status ?? "PENDING",
        abilityRating: abilityLabel(row.ability_rating),
        player: requestPlayer
      };
    });

  const fixtures = input.fixtures.map((fixture) => ({
    id: fixture.id,
    date: safeDate(fixture.kickoff_at),
    home: fixture.home_team_registration_id ? teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team" : fixture.home_source ?? "TBD",
    away: fixture.away_team_registration_id ? teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team" : fixture.away_source ?? "TBD",
    stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
    status: statusLabel(fixture.status),
    venue: fixture.venue ?? "Not set"
  }));

  const completedMatches = input.fixtures
    .filter((fixture) => fixture.status === FixtureStatus.FINAL)
    .map((fixture) => ({
      date: safeDate(fixture.kickoff_at),
      home: fixture.home_team_registration_id ? teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team" : fixture.home_source ?? "TBD",
      away: fixture.away_team_registration_id ? teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team" : fixture.away_source ?? "TBD",
      score: `${fixture.home_score ?? 0} - ${fixture.away_score ?? 0}`
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
      ga: row.goals_against
    };
  });

  const readyMatches = input.fixtures
    .filter((fixture) => fixture.status === FixtureStatus.LINEUPS_CONFIRMED || fixture.status === FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION)
    .map((fixture) => ({
      id: fixture.id,
      home: fixture.home_team_registration_id ? teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team" : fixture.home_source ?? "TBD",
      away: fixture.away_team_registration_id ? teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team" : fixture.away_source ?? "TBD",
      stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
      kickoff: fixture.kickoff_at ? safeDate(fixture.kickoff_at) : "Kickoff not set",
      status: statusLabel(fixture.status)
    }));

  const sortedStats = [...input.playerStats].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
  const topGoal = sortedStats[0];
  const topAssist = [...input.playerStats].sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))[0];
  const topRated = [...input.playerStats]
    .filter((row) => row.average_rating)
    .sort((a, b) => Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0))[0];

  return {
    teams,
    standings,
    teamRequests,
    playerRequests,
    fixtures,
    completedMatches,
    messages: [],
    readyMatches,
    pendingLineups: input.fixtures.filter((fixture) => fixture.status === FixtureStatus.LINEUPS_SUBMITTED).length,
    topScorer: topGoal && (topGoal.appearances ?? 0) > 0
      ? {
        name: topGoal.player_season_registrations?.players?.full_name ?? "Unnamed player",
        team: "Season team",
        goals: topGoal.goals ?? 0,
        matches: topGoal.appearances ?? 0
      }
      : null,
    topAssist: topAssist && (topAssist.appearances ?? 0) > 0 && (topAssist.assists ?? 0) > 0
      ? {
        name: topAssist.player_season_registrations?.players?.full_name ?? "Unnamed player",
        team: "Season team",
        assists: topAssist.assists ?? 0,
        matches: topAssist.appearances ?? 0
      }
      : null,
    topRated: topRated && (topRated.appearances ?? 0) > 0
      ? {
        name: topRated.player_season_registrations?.players?.full_name ?? "Unnamed player",
        team: "Season team",
        rating: String(topRated.average_rating),
        matches: topRated.appearances ?? 0
      }
      : null,
    statsReport: input.statsReport
  };
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NA";
}

function formatNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function percent(part: unknown, total: unknown) {
  const numerator = Number(part ?? 0);
  const denominator = Number(total ?? 0);
  if (!denominator || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function ratingTone(value: number) {
  if (value >= 7.9) return "bg-emerald-500";
  if (value >= 7) return "bg-lime-500";
  return "bg-orange-500";
}

function formatTeamStat(stat: MatchDetailTeamStat, field: keyof MatchDetailTeamStat, format: "number" | "percent" | "passes" | "rating") {
  if (format === "percent") return `${formatNumber(stat[field])}%`;
  if (format === "passes") return `${formatNumber(stat.accurate_passes)}/${formatNumber(stat.passes)} (${percent(stat.accurate_passes, stat.passes)})`;
  if (format === "rating") return formatNumber(stat[field]);
  return formatNumber(stat[field]);
}

function positionBreakdown(players: AdminPlayer[]) {
  const order = ["GK", "LB", "CB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"];
  const counts = new Map<string, number>();
  for (const player of players) {
    const key = (player.footballPosition || player.position || "UNK").toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ordered = order.map((position) => [position, counts.get(position) ?? 0] as const).filter(([, count]) => count > 0);
  const extra = Array.from(counts.entries())
    .filter(([position]) => !order.includes(position))
    .sort(([a], [b]) => a.localeCompare(b));
  return [...ordered, ...extra];
}

export default function AdminLeagueSeasonDashboard() {
  const params = useParams<{ leagueId: string; seasonId: string }>();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [adminData, setAdminData] = useState<AdminSeasonData>(emptyAdminSeasonData);
  const [groupsReady, setGroupsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [playerAction, setPlayerAction] = useState<{ action: PlayerLifecycleAction; player: AdminPlayer } | null>(null);
  const [error, setError] = useState("");

  async function loadDashboardData() {
    const [me, leagueData, seasonData] = await Promise.all([
      api<{ profile: ProfileDto }>("/me"),
      publicApi<{ leagues: LeagueDto[] }>("/public/leagues"),
      publicApi<{ seasons: SeasonDto[] }>(`/public/leagues/${params.leagueId}/seasons`)
    ]);
    const selectedSeason = seasonData.seasons.find((item) => item.id === params.seasonId) ?? seasonData.seasons[0] ?? null;
    setProfile(me.profile);
    setLeague(leagueData.leagues.find((item) => item.id === params.leagueId) ?? null);
    setSeason(selectedSeason);
    if (!selectedSeason) {
      setAdminData(emptyAdminSeasonData);
      setGroupsReady(false);
      return;
    }
    const [teamRegistrationData, playerRegistrationData, fixtureData, standingData, playerStatData, statsReportData] = await Promise.all([
      api<{ team_registrations: TeamRegistrationApiRow[] }>("/admin/team-registrations"),
      api<{ player_registrations: PlayerRegistrationApiRow[] }>("/admin/player-registrations"),
      publicApi<{ fixtures: FixtureApiRow[] }>(`/public/seasons/${selectedSeason.id}/fixtures`),
      publicApi<{ standings: StandingApiRow[] }>(`/public/seasons/${selectedSeason.id}/standings`),
      publicApi<{ player_stats: PlayerSeasonStatApiRow[] }>(`/public/seasons/${selectedSeason.id}/player-stats`),
      api<AdminStatsReport>(`/admin/seasons/${selectedSeason.id}/stat-leaderboards`)
    ]);
    setAdminData(
      buildAdminSeasonData({
        season: selectedSeason,
        teamRegistrations: teamRegistrationData.team_registrations ?? [],
        playerRegistrations: playerRegistrationData.player_registrations ?? [],
        fixtures: fixtureData.fixtures ?? [],
        standings: standingData.standings ?? [],
        playerStats: playerStatData.player_stats ?? [],
        statsReport: statsReportData ?? emptyStatsReport
      })
    );
    if (selectedSeason.format === SeasonFormat.GROUP_STAGE_KNOCKOUT) {
      const groupData = await api<AdminGroupsResponse>(`/admin/seasons/${selectedSeason.id}/groups`);
      setGroupsReady(groupData.groups_ready);
    } else {
      setGroupsReady(false);
    }
  }

  useEffect(() => {
    void loadDashboardData().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load dashboard"));
  }, [params.leagueId, params.seasonId]);

  async function decideTeamRequest(id: string, status: "APPROVED" | "REJECTED") {
    await api(`/admin/team-registrations/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadDashboardData();
  }

  async function decidePlayerRequest(id: string, status: "APPROVED" | "REJECTED") {
    await api(`/admin/player-registrations/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await loadDashboardData();
  }

  async function ratePlayer(id: string, ability_rating: "LOW" | "MODERATE" | "HIGH") {
    await api(`/admin/player-registrations/${id}/ability`, {
      method: "PATCH",
      body: JSON.stringify({ ability_rating })
    });
    await loadDashboardData();
  }

  async function bulkRatePendingPlayers(teamId: string, rerate = false) {
    await api(`/admin/teams/${teamId}/pending-players/rate-randomly`, {
      method: "POST",
      body: JSON.stringify({
        seasonId: season?.id,
        distribution: { low: 0.15, moderate: 0.7, high: 0.15 },
        rerate
      })
    });
    await loadDashboardData();
  }

  async function bulkApproveRatedPlayers(teamId: string) {
    await api(`/admin/teams/${teamId}/pending-players/approve-all-rated`, {
      method: "POST",
      body: JSON.stringify({ seasonId: season?.id })
    });
    await loadDashboardData();
  }

  async function simulateReadyMatch(fixtureId: string) {
    await api("/admin/matches/simulate", {
      method: "POST",
      body: JSON.stringify({ fixture_id: fixtureId })
    });
    await loadDashboardData();
  }

  async function updateAbilityScores(id: string, scores: Record<string, number>) {
    await api(`/admin/player-registrations/${id}/ability-scores`, {
      method: "PATCH",
      body: JSON.stringify(scores)
    });
    await loadDashboardData();
  }

  async function submitPlayerLifecycleAction(input: {
    action: PlayerLifecycleAction;
    playerId: string;
    reason: string;
    allowResubmission?: boolean;
    suspensionType?: string;
    suspensionUntil?: string;
    suspensionMatchesRemaining?: number;
  }) {
    const actionPath = input.action === "reject" ? "reject" : input.action === "remove" ? "remove" : input.action === "suspend" ? "suspend" : "unsuspend";
    const body =
      input.action === "reject"
        ? { reason: input.reason, allow_resubmission: Boolean(input.allowResubmission) }
        : input.action === "suspend"
          ? {
            reason: input.reason,
            suspension_type: input.suspensionType,
            suspension_until: input.suspensionUntil || null,
            suspension_matches_remaining: input.suspensionMatchesRemaining ?? null
          }
          : input.action === "unsuspend"
            ? { message: input.reason }
            : { reason: input.reason };
    await api(`/admin/player-registrations/${input.playerId}/${actionPath}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    setPlayerAction(null);
    await loadDashboardData();
  }

  async function kickOutTeam(id: string) {
    const reason = window.prompt("Reason for kicking out this team?", "Team removed by admin.");
    if (reason === null) return;
    await api(`/admin/team-registrations/${id}/kick-out`, {
      method: "PATCH",
      body: JSON.stringify({ reason })
    });
    await loadDashboardData();
    setActiveTab("teams");
  }

  async function sendTeamMessage(id: string) {
    const message = window.prompt("Message to manager");
    if (!message?.trim()) return;
    await api(`/admin/team-registrations/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ message })
    });
    await loadDashboardData();
  }

  async function generateFixtures() {
    await api("/admin/fixtures/generate", {
      method: "POST",
      body: JSON.stringify({ season_id: season?.id })
    });
    await loadDashboardData();
  }

  async function scheduleFixture(id: string, currentVenue: string) {
    const kickoff_at = window.prompt("Kickoff date/time. Use ISO format like 2026-09-01T16:00:00+06:00. Leave blank to clear date.");
    if (kickoff_at === null) return;
    const venue = window.prompt("Venue", currentVenue === "Not set" ? "" : currentVenue);
    if (venue === null) return;
    await api(`/admin/fixtures/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({ kickoff_at: kickoff_at.trim() || null, venue: venue.trim() || null })
    });
    await loadDashboardData();
  }

  async function postponeFixture(id: string, currentVenue: string) {
    await api(`/admin/fixtures/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({ kickoff_at: null, venue: currentVenue === "Not set" ? null : currentVenue })
    });
    await loadDashboardData();
  }

  async function cancelFixture(id: string) {
    await api(`/admin/fixtures/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: FixtureStatus.CANCELLED })
    });
    await loadDashboardData();
  }

  function logout() {
    clearAuth();
    window.location.href = "/login";
  }

  const isGroupKnockout = season?.format === SeasonFormat.GROUP_STAGE_KNOCKOUT;
  const navItems = useMemo(
    () =>
      [
        { id: "dashboard", label: "Dashboard", icon: Home },
        { id: "teams", label: "Teams", icon: ShieldCheck },
        { id: "team-requests", label: "Team Requests", icon: Users },
        { id: "player-requests", label: "Player Requests", icon: User },
        { id: "fixtures", label: "Fixtures", icon: CalendarDays },
        { id: "matches-ready", label: "Matches Ready", icon: PlayCircle },
        { id: "standings", label: "Standings", icon: Trophy },
        { id: "reports", label: "Player Stats", icon: BarChart3 },
        { id: "team-stats", label: "Team Stats", icon: ShieldCheck },
        { id: "messages", label: "Messages", icon: Mail }
      ] as const,
    []
  );

  const groupTeamRequirement = Number(season?.group_count ?? 0) * Number(season?.teams_per_group ?? 0);
  const shouldShowGroupDivision =
    Boolean(isGroupKnockout && !groupsReady && groupTeamRequirement > 0 && adminData.teams.length >= groupTeamRequirement);
  const tournamentItems = useMemo(() => {
    if (!isGroupKnockout) return [];
    return [
      ...(shouldShowGroupDivision ? [{ id: "divide-groups", label: "Divide Teams Into Groups", icon: GitBranch }] : []),
      { id: "groups", label: "Groups", icon: Users },
      { id: "knockout", label: "Knockout Bracket", icon: GitBranch }
    ] as Array<{ id: TabId; label: string; icon: typeof Users }>;
  }, [isGroupKnockout, shouldShowGroupDivision]);

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
        <div className="rounded-2xl bg-white p-8 shadow-xl">Loading selected league dashboard...</div>
      </div>
    );
  }

  const adminNotificationCount = adminData.teamRequests.length + adminData.playerRequests.length + adminData.pendingLineups + adminData.readyMatches.length;

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden bg-[#f6f8fb] text-[#0f172a]">
      <aside className="flex w-[272px] shrink-0 flex-col overflow-y-auto bg-[#0d2035] bg-[radial-gradient(circle_at_top_left,rgba(58,122,255,0.2),transparent_18rem)] text-white shadow-2xl">
        <div className="flex h-[74px] items-center gap-3 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#1d8aff] to-[#3057dc] shadow-lg">
            <Trophy size={23} />
          </div>
          <div className="text-xl font-black">League Admin</div>
        </div>

        <div className="mx-3 mb-5 rounded-xl bg-white/7 p-4">
          <div className="flex items-center gap-3">
            <TeamBadge name={league.short_name || league.name} logoUrl={league.logo_url} size="lg" />
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
            <SidebarButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
          ))}
        </nav>

        {tournamentItems.length > 0 ? (
          <>
            <div className="mx-3 my-6 h-px bg-white/15" />
            <p className="px-6 pb-3 text-xs font-bold uppercase tracking-wide text-slate-300">Tournament</p>
            <nav className="space-y-1 px-3">
              {tournamentItems.map((item) => (
                <SidebarButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
              ))}
            </nav>
          </>
        ) : null}

        <div className="mt-auto px-3 pb-5">
          <div className="mb-5 h-px bg-white/15" />
          <SidebarButton item={{ id: "settings", label: "Settings", icon: Settings }} active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
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
        <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="flex items-center gap-5">
            <TeamBadge name={league.short_name || league.name} logoUrl={league.logo_url} />
            <div>
              <div className="flex items-center gap-2 text-base font-black">
                {league.name}
                <ChevronDown size={17} />
              </div>
              <div className="text-sm font-semibold text-blue-700">{season.name}</div>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
              {formatPhase(season.phase)}
            </span>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {formatLabel(season.format)}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/dashboard/admin" className="text-sm font-bold text-blue-700 hover:text-blue-900">
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
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-sm font-black text-slate-600">
                {(profile?.full_name ?? profile?.email ?? "AD").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-bold">Admin</p>
                <p className="text-xs text-slate-500">Super Admin</p>
              </div>
              <ChevronDown size={17} />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-8">
          {activeTab === "dashboard" ? <DashboardView league={league} season={season} data={adminData} onNavigate={setActiveTab} /> : null}
		          {activeTab === "teams" ? <TeamsView season={season} teams={adminData.teams} onKickOutTeam={kickOutTeam} onSendTeamMessage={sendTeamMessage} onPlayerDecision={decidePlayerRequest} onPlayerAbility={ratePlayer} onBulkRatePending={bulkRatePendingPlayers} onBulkApproveRated={bulkApproveRatedPlayers} onPlayerAction={(action, player) => setPlayerAction({ action, player })} onAbilityScoresUpdate={updateAbilityScores} /> : null}
          {activeTab === "team-requests" ? <TeamRequestsView teamRequests={adminData.teamRequests} onDecision={decideTeamRequest} /> : null}
          {activeTab === "player-requests" ? <PlayerRequestsView playerRequests={adminData.playerRequests} onDecision={decidePlayerRequest} onAbility={ratePlayer} onPlayerAction={(action, player) => setPlayerAction({ action, player })} /> : null}
          {activeTab === "fixtures" ? <FixturesView season={season} /> : null}
          {activeTab === "matches-ready" ? <MatchesReadyView matches={adminData.readyMatches} onSimulate={simulateReadyMatch} /> : null}
          {activeTab === "standings" ? <StandingsView groupMode={isGroupKnockout} teams={adminData.standings} /> : null}
          {activeTab === "reports" ? <PlayerStatsView data={adminData} /> : null}
          {activeTab === "team-stats" ? <TeamStatsView data={adminData} /> : null}
          {activeTab === "messages" ? <MessagesView messages={adminData.messages} /> : null}
          {activeTab === "divide-groups" ? <DivideGroupsView season={season} onSaved={async () => { await loadDashboardData(); setActiveTab("fixtures"); }} /> : null}
          {activeTab === "groups" ? <GroupsView season={season} /> : null}
          {activeTab === "knockout" ? <KnockoutView /> : null}
          {activeTab === "settings" ? <SettingsView league={league} season={season} onSaved={loadDashboardData} /> : null}
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
    </div>
  );
}

function DashboardView({ league, season, data, onNavigate }: { league: LeagueDto; season: SeasonDto; data: AdminSeasonData; onNavigate: (tab: TabId) => void }) {
  const tableTopper = data.standings[0] ?? null;
  const isLeagueTableFormat = season.format === SeasonFormat.SINGLE_ROUND_ROBIN || season.format === SeasonFormat.DOUBLE_ROUND_ROBIN;
  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle={`Overview of ${league.name} - ${season.name}`}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={<UserPlus size={31} />} label="Pending Team Requests" value={String(data.teamRequests.length)} color="blue" action="View all requests" onAction={() => onNavigate("team-requests")} />
        <SummaryCard icon={<User size={31} />} label="Pending Player Requests" value={String(data.playerRequests.length)} color="green" action="View all requests" onAction={() => onNavigate("player-requests")} />
        <SummaryCard icon={<ClipboardCheck size={31} />} label="Pending Lineup Confirmations" value={String(data.pendingLineups)} color="orange" action="View all lineups" onAction={() => onNavigate("fixtures")} />
        <SummaryCard icon={<PlayCircle size={31} />} label="Matches Ready for Simulation" value={String(data.readyMatches.length)} color="purple" action="View matches" onAction={() => onNavigate("matches-ready")} />
        <SummaryCard icon={<CheckCircle2 size={31} />} label="Completed Matches" value={String(data.completedMatches.length)} color="cyan" action="View matches" onAction={() => onNavigate("fixtures")} />
      </div>

      <div className={`mt-6 grid grid-cols-1 gap-5 ${isLeagueTableFormat ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {isLeagueTableFormat ? (
          <FeatureCard title="Current Table Topper" icon={<Trophy size={20} />} className="xl:col-span-1">
            {tableTopper ? (
              <>
                <div className="flex items-center gap-6">
                  <TeamBadge name={tableTopper.short || tableTopper.name} logoUrl={tableTopper.logoUrl} size="xl" />
                  <h3 className="text-2xl font-black">{tableTopper.name}</h3>
                </div>
                <StatStrip
                  stats={[
                    [String(tableTopper.points), "Points"],
                    [String(tableTopper.played), "Played"],
                    [String(tableTopper.won), "Won"],
                    [String(tableTopper.draw), "Draw"],
                    [String(tableTopper.lost), "Lost"]
                  ]}
                />
              </>
            ) : <EmptyState label="No standings yet. Standings appear after teams are approved and matches are finalized." />}
          </FeatureCard>
        ) : null}

        <FeatureCard title="Top Scorer" icon={<Target size={20} />} iconTone="green">
          {data.topScorer ? (
            <>
              <PlayerHero name={data.topScorer.name} team={data.topScorer.team} shirt="-" color="blue" />
              <StatStrip stats={[[String(data.topScorer.goals), "Goals"], [String(data.topScorer.matches), "Matches"]]} />
            </>
          ) : <EmptyState label="No scorer data yet." />}
        </FeatureCard>

        <FeatureCard title="Top Assist Provider" icon={<UserPlus size={20} />} iconTone="green">
          {data.topAssist ? (
            <>
              <PlayerHero name={data.topAssist.name} team={data.topAssist.team} shirt="-" color="blue" />
              <StatStrip stats={[[String(data.topAssist.assists), "Assists"], [String(data.topAssist.matches), "Matches"]]} />
            </>
          ) : <EmptyState label="No assist data yet." />}
        </FeatureCard>

        <FeatureCard title="Top Rated Player" icon={<Star size={20} />} iconTone="purple">
          {data.topRated ? (
            <>
              <PlayerHero name={data.topRated.name} team={data.topRated.team} shirt="-" color="black" />
              <StatStrip stats={[[data.topRated.rating, "Average Rating"], [String(data.topRated.matches), "Matches"]]} />
            </>
          ) : <EmptyState label="No rating data yet." />}
        </FeatureCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Matches Ready for Simulation" action="View all" onAction={() => onNavigate("matches-ready")}>
          {data.readyMatches[0] ? <ReadyMatchCard match={data.readyMatches[0]} /> : <EmptyState label="No matches are ready for simulation." />}
        </Panel>

        <Panel title="Recently Completed Matches" action="View all" onAction={() => onNavigate("fixtures")}>
          {data.completedMatches.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {data.completedMatches.map((match) => (
                <div key={`${match.date}-${match.home}`} className="grid grid-cols-[120px_1fr_68px_1fr_70px] items-center gap-3 py-4 text-sm">
                  <span className="text-slate-600">{match.date}</span>
                  <span className="text-right font-medium">{match.home}</span>
                  <span className="rounded-md bg-green-100 px-3 py-1 text-center font-black text-green-800">{match.score}</span>
                  <span className="font-medium">{match.away}</span>
                  <button className="rounded-md border border-slate-200 px-4 py-2 font-semibold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm active:translate-y-0 active:scale-[0.97]">View</button>
                </div>
              ))}
            </div>
          ) : <EmptyState label="No completed matches yet." />}
          <button className="mt-4 w-full text-sm font-bold text-indigo-700 transition hover:text-indigo-900 hover:drop-shadow-[0_0_8px_rgba(79,70,229,0.25)]" onClick={() => onNavigate("fixtures")}>View all completed matches →</button>
        </Panel>
      </div>
    </div>
  );
}

function TeamsView({
  season,
  teams,
  onKickOutTeam,
  onSendTeamMessage,
  onPlayerDecision,
  onPlayerAbility,
  onBulkRatePending,
  onBulkApproveRated,
  onPlayerAction,
  onAbilityScoresUpdate
}: {
  season: SeasonDto;
  teams: AdminTeam[];
  onKickOutTeam: (id: string) => Promise<void>;
  onSendTeamMessage: (id: string) => Promise<void>;
  onPlayerDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onPlayerAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
  onBulkRatePending: (teamId: string, rerate?: boolean) => Promise<void>;
  onBulkApproveRated: (teamId: string) => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (id: string, scores: Record<string, number>) => Promise<void>;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerTab, setPlayerTab] = useState<"personal" | "stats">("personal");

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const allTeamPlayers = selectedTeam ? [...selectedTeam.players, ...selectedTeam.suspendedPlayers] : [];
  const selectedPlayer = allTeamPlayers.find((player) => player.id === selectedPlayerId) ?? null;

  if (selectedTeam && selectedPlayer) {
    return (
      <PlayerDetailView
        season={season}
        team={selectedTeam}
        player={selectedPlayer}
        activeTab={playerTab}
        onTabChange={setPlayerTab}
        onDecision={onPlayerDecision}
        onAbility={onPlayerAbility}
        onPlayerAction={onPlayerAction}
        onAbilityScoresUpdate={onAbilityScoresUpdate}
        onMessageManager={() => onSendTeamMessage(selectedTeam.id)}
        onBack={() => {
          setSelectedPlayerId(null);
          setPlayerTab("personal");
        }}
      />
    );
  }

  if (selectedTeam) {
    return (
      <TeamDetailView
        team={selectedTeam}
        season={season}
        onBack={() => setSelectedTeamId(null)}
        onKickOutTeam={() => onKickOutTeam(selectedTeam.id)}
        onSendMessage={() => onSendTeamMessage(selectedTeam.id)}
		        onPlayerDecision={onPlayerDecision}
		        onPlayerAbility={onPlayerAbility}
		        onBulkRatePending={(rerate) => onBulkRatePending(selectedTeam.id, rerate)}
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
      <PageTitle title="Teams" subtitle="Approved teams in this selected league season. Open a team to review manager, players, requests, fixtures, results, and messages." />
      {teams.length === 0 ? <EmptyState label="No approved teams yet. Teams will appear here after managers register and admin approves them." /> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <TeamBadge name={team.logo || team.name} logoUrl={team.logoUrl} size="lg" />
                <div>
                  <h2 className="text-xl font-black">{team.name}</h2>
                  <p className="text-sm text-slate-600">Manager: {team.managerName}</p>
                </div>
              </div>
              <StatusPill tone={team.status === "Approved" ? "green" : "orange"}>{team.status}</StatusPill>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <StatusBox label="Squad Count" value={String(team.squadCount)} />
              <StatusBox label="Approved Players" value={String(team.approvedPlayers)} />
              <StatusBox label="Pending Players" value={String(team.pendingPlayers)} />
            </div>
            <button
              type="button"
              onClick={() => setSelectedTeamId(team.id)}
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
  onBack,
  onKickOutTeam,
  onSendMessage,
  onPlayerDecision,
  onPlayerAbility,
  onBulkRatePending,
  onBulkApproveRated,
  onPlayerAction,
  onAbilityScoresUpdate,
  onOpenPlayer
}: {
  team: AdminTeam;
  season: SeasonDto;
  onBack: () => void;
  onKickOutTeam: () => Promise<void>;
  onSendMessage: () => Promise<void>;
  onPlayerDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onPlayerAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
  onBulkRatePending: (rerate?: boolean) => Promise<void>;
  onBulkApproveRated: () => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (id: string, scores: Record<string, number>) => Promise<void>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const approvedPlayers = team.players.filter((player) => player.approvalStatus === "Approved");
  const pendingPlayers = team.players.filter((player) => player.approvalStatus === "Pending");
  const squadBreakdown = positionBreakdown(team.players.filter((player) => player.playerStatus !== "Removed" && player.playerStatus !== "Rejected"));
  const pendingUnratedCount = pendingPlayers.filter((player) => player.abilityRating === "Not rated").length;
  const allPendingRated = pendingPlayers.length > 0 && pendingUnratedCount === 0;
  const [playerPanel, setPlayerPanel] = useState<"approved" | "pending" | null>(null);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<"rating" | "approving" | null>(null);

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
        Back to Teams
      </button>

      <div
        className="mb-7 flex flex-col justify-between gap-5 rounded-xl border border-white/40 p-6 text-white shadow-xl md:flex-row md:items-center"
        style={{
          background: `linear-gradient(110deg, ${team.accentColor ?? "#F59E0B"} 0%, ${team.primaryColor ?? "#6D28D9"} 48%, ${team.secondaryColor ?? "#0B1626"} 100%)`
        }}
      >
        <div className="flex items-center gap-5">
          <TeamBadge name={team.logo || team.name} logoUrl={team.logoUrl} size="lg" />
          <div>
            <h1 className="text-3xl font-black">{team.name}</h1>
            <p className="text-white/85">{season.name} team profile and squad control.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onKickOutTeam} className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25">
            <Ban size={15} />
            Kick Out Team
          </button>
          <button type="button" onClick={onSendMessage} className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25">
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
                    <span key={position} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
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
            <DetailRow label="Pending Players" value={String(team.pendingPlayers)} />
          </div>
        </Panel>

        <Panel title="Admin Messages">
          <div className="space-y-3">
            {team.messages.length > 0 ? team.messages.map((message) => (
              <div key={`${message.date}-${message.text}`} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black">{message.type}</span>
                  <StatusPill tone={message.read === "Read" ? "green" : "orange"}>{message.read}</StatusPill>
                </div>
                <p className="mt-2 text-slate-600">{message.text}</p>
                <p className="mt-2 text-xs text-slate-400">{message.date}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No admin messages yet.</p>}
          </div>
        </Panel>
      </div>

      <div className={`mt-6 grid gap-5 ${pendingPlayers.length > 0 ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
        <Panel title="Approved Players" action="View all" onAction={() => setPlayerPanel("approved")}>
          <PlayerMiniTable players={approvedPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} />
        </Panel>

        {pendingPlayers.length > 0 ? (
          <Panel title="Pending Player Requests" action="Review all" onAction={() => setPlayerPanel("pending")}>
            <BulkPendingActions
              pendingCount={pendingPlayers.length}
              unratedCount={pendingUnratedCount}
              allRated={allPendingRated}
              loading={bulkLoading}
              onRate={() => void runBulkRate()}
              onRateAgain={() => void runBulkRate(true)}
              onApprove={() => setBulkApproveOpen(true)}
            />
            <PlayerMiniTable players={pendingPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} pending />
          </Panel>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Panel title="Removed / Suspended Players">
          <PlayerMiniTable players={team.suspendedPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} />
        </Panel>

        <Panel title="Team Fixtures">
          <SimpleRows rows={team.fixtures.map((fixture) => [fixture.date, `${fixture.home} vs ${fixture.away}`, fixture.status])} />
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Team Results">
          <SimpleRows rows={team.results.map((result) => [result.date, result.match, result.result, result.status])} />
        </Panel>
      </div>

      {playerPanel ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div className="max-h-[86vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
	                <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">{playerPanel === "approved" ? "Approved Players" : "Pending Player Requests"}</p>
	                <h2 className="mt-1 text-2xl font-black">{team.name}</h2>
	              </div>
              <button type="button" onClick={() => setPlayerPanel(null)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">
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
	            <PlayerMiniTable players={playerPanel === "approved" ? approvedPlayers : pendingPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} pending={playerPanel === "pending"} />
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
  activeTab,
  onTabChange,
  onDecision,
  onAbility,
  onPlayerAction,
  onAbilityScoresUpdate,
  onMessageManager,
  onBack
}: {
  season: SeasonDto;
  team: AdminTeam;
  player: AdminPlayer;
  activeTab: "personal" | "stats";
  onTabChange: (tab: "personal" | "stats") => void;
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (id: string, scores: Record<string, number>) => Promise<void>;
  onMessageManager: () => Promise<void>;
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
        Back to {team.name}
      </button>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <PlayerAvatar player={player} />
            <div>
              <h1 className="text-3xl font-black">{player.fullName}</h1>
              <p className="text-slate-600">
                {team.name} · {season.name} · #{player.jerseyNumber} · {player.footballPosition}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={player.playerStatus === "Approved" ? "green" : player.playerStatus === "Pending" ? "orange" : "blue"}>
              {player.playerStatus}
            </StatusPill>
            <StatusPill tone={player.abilityRating === "High" ? "green" : player.abilityRating === "Moderate" ? "blue" : "orange"}>
              Rating: {player.abilityRating}
            </StatusPill>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-2 md:w-[420px]">
          <TabButton active={activeTab === "personal"} onClick={() => onTabChange("personal")}>Personal Data</TabButton>
          <TabButton active={activeTab === "stats"} onClick={() => onTabChange("stats")}>League Stats</TabButton>
        </div>
      </div>

      {activeTab === "personal" ? <PlayerPersonalData team={team} season={season} player={player} onDecision={onDecision} onAbility={onAbility} onPlayerAction={onPlayerAction} onAbilityScoresUpdate={onAbilityScoresUpdate} onMessageManager={onMessageManager} /> : <PlayerLeagueStats player={player} />}
    </div>
  );
}

function TeamJerseyStrip({ team }: { team: AdminTeam }) {
  const jerseys = [
    { label: "Home", url: team.homeJerseyUrl },
    { label: "Away", url: team.awayJerseyUrl },
    { label: "GK Home", url: team.gkHomeJerseyUrl },
    { label: "GK Away", url: team.gkAwayJerseyUrl }
  ];
  const hasJerseys = jerseys.some((jersey) => jersey.url);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-black">Team Jerseys</h2>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-indigo-700">Home / Away / GK</span>
      </div>
      {hasJerseys ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {jerseys.map((jersey) => (
            <AdminJerseyCard key={jersey.label} teamName={team.name} label={jersey.label} url={jersey.url} />
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

function AdminJerseyCard({ teamName, label, url }: { teamName: string; label: string; url: string | null | undefined }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex h-56 items-center justify-center rounded-lg bg-white p-1">
        {url ? (
          <button
            type="button"
            className="flex h-full w-full items-center justify-center rounded-lg transition hover:scale-[1.02] hover:bg-slate-50"
            onClick={() => setPreviewOpen(true)}
            title={`Open ${teamName} ${label} jersey`}
            aria-label={`Open ${teamName} ${label} jersey`}
          >
            <img src={url} alt={`${teamName} ${label} jersey`} className="max-h-full max-w-full object-contain" />
          </button>
        ) : (
          <span className="text-sm font-semibold text-slate-400">Not set</span>
        )}
      </div>
      {previewOpen && url ? <AdminImagePreviewModal title={`${teamName} ${label} Jersey`} src={url} onClose={() => setPreviewOpen(false)} /> : null}
    </div>
  );
}

function AdminImagePreviewModal({ title, src, onClose }: { title: string; src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black">{title}</h3>
          <button type="button" className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid place-items-center rounded-3xl bg-slate-100 p-4">
          <img src={src} alt={title} className="max-h-[75vh] max-w-full rounded-2xl object-contain" />
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
  onMessageManager
}: {
  team: AdminTeam;
  season: SeasonDto;
  player: AdminPlayer;
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (id: string, scores: Record<string, number>) => Promise<void>;
  onMessageManager: () => Promise<void>;
}) {
  const [editingAbility, setEditingAbility] = useState(false);
  const [abilityDraft, setAbilityDraft] = useState<Record<string, string>>({});
  const isApproved = player.approvalStatus === "Approved";
  const isPending = player.approvalStatus === "Pending";
  const isSuspended = player.playerStatus === "Suspended";
  const isRemoved = player.playerStatus === "Removed";
  const canApprove = isPending && player.abilityRating !== "Not rated";
  const canRate = isPending;
  const editableAbilityRows = player.abilityDetails.filter((ability) => ability.label !== "Tier" && ability.label !== "Overall");
  function startAbilityEdit() {
    setAbilityDraft(Object.fromEntries(editableAbilityRows.map((ability) => [ability.label, ability.value])));
    setEditingAbility(true);
  }
  function toAbilityKey(label: string) {
    return label.toLowerCase().replaceAll(" ", "_");
  }
  async function saveAbilityEdit() {
    const scores = Object.fromEntries(
      Object.entries(abilityDraft)
        .map(([label, value]) => [toAbilityKey(label), Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value))
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
          <DetailRow label="Jersey Number" value={String(player.jerseyNumber)} />
          <DetailRow label="Position" value={`${player.footballPosition} (${player.position})`} />
          <DetailRow label="Preferred Foot" value={player.preferredFoot} />
          <DetailRow label="Approval Status" value={player.approvalStatus} />
          <DetailRow label="Player Status" value={player.playerStatus} />
          <DetailRow label="Registration Date" value={player.registrationDate} />
          <DetailRow label="Submitted By Manager" value={player.submittedByManager} />
          <DetailRow label="Admin Approval Date" value={player.adminApprovalDate} />
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Admin Message</p>
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
                <AdminActionButton label="Approve Player" disabled={!canApprove} onClick={() => onDecision(player.id, "APPROVED")} />
                <DangerButton label="Reject Player" onClick={() => onPlayerAction("reject", player)} />
              </>
            ) : null}
            {isApproved && !isSuspended && !isRemoved ? (
              <>
                <DangerButton label="Remove Player" onClick={() => onPlayerAction("remove", player)} />
                <DangerButton label="Suspend Player" onClick={() => onPlayerAction("suspend", player)} />
              </>
            ) : null}
            {isSuspended ? (
              <>
                <AdminActionButton label="Unsuspend Player" onClick={() => onPlayerAction("unsuspend", player)} />
                <DangerButton label="Remove Player" onClick={() => onPlayerAction("remove", player)} />
              </>
            ) : null}
            <AdminActionButton label="Send Message to Manager" onClick={onMessageManager} />
            <div className="grid grid-cols-3 gap-2">
              <AdminActionButton label="Low" selected={player.abilityRating === "Low"} disabled={!canRate} onClick={() => onAbility(player.id, "LOW")} />
              <AdminActionButton label="Moderate" selected={player.abilityRating === "Moderate"} disabled={!canRate} onClick={() => onAbility(player.id, "MODERATE")} />
              <AdminActionButton label="High" selected={player.abilityRating === "High"} disabled={!canRate} onClick={() => onAbility(player.id, "HIGH")} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Ability scores stay hidden from managers and public users. Approval is blocked until Low, Moderate, or High is assigned.
          </p>
        </Panel>

        <Panel title="Hidden Ability Scores" action={player.abilityDetails.length > 0 ? (editingAbility ? "Save scores" : "Edit scores") : undefined} onAction={player.abilityDetails.length > 0 ? () => { if (editingAbility) void saveAbilityEdit(); else startAbilityEdit(); } : undefined}>
          {player.abilityDetails.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {player.abilityDetails.map((ability) =>
                editingAbility && ability.label !== "Tier" && ability.label !== "Overall" ? (
                  <label key={ability.label} className="rounded-lg bg-slate-50 p-3">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">{ability.label}</span>
                    <input
                      type="number"
                      min={1}
                      max={92}
                      value={abilityDraft[ability.label] ?? ability.value}
                      onChange={(event) => setAbilityDraft((current) => ({ ...current, [ability.label]: event.target.value }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-black text-slate-800"
                    />
                  </label>
                ) : (
                  <AbilityDetailCard key={ability.label} ability={ability} />
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No ability scores generated yet. Click Low, Moderate, or High first.</p>
          )}
        </Panel>
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
    ["Player of the Match", stats.playerOfTheMatch]
  ];

  return (
    <div className="space-y-6">
      <Panel title="Overall League Stats">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {statRows.map(([label, value]) => (
            <InfoBox key={label} label={String(label)} value={String(value)} />
          ))}
        </div>
      </Panel>

      <Panel title="Match-by-Match Performance">
        {player.performances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Match", "Date", "Opponent", "Result", "Minutes", "Goals", "Assists", "Shots", "SOT", "Chances", "Pass Accuracy", "Dribbles", "Tackles", "Cards", "Rating"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left font-black">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {player.performances.map((row) => (
                  <tr key={`${row.date}-${row.match}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold">{row.match}</td>
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3">{row.opponent}</td>
                    <td className="px-4 py-3 font-black text-indigo-700">{row.result}</td>
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
                    <td className="px-4 py-3 font-black text-indigo-700">{row.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No match performance yet. Stats will appear after confirmed matches.</p>
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
  onApprove
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
        <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-700">Bulk Actions</p>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {ratedCount}/{pendingCount} pending players rated. Moderate stays the majority, with occasional Low/High exceptions.
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
  onConfirm
}: {
  count: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">Bulk Approval</p>
        <h2 className="mt-2 text-3xl font-black">Approve all rated players?</h2>
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          This will approve all {count} pending players who already have Low, Moderate, or High rating selected.
          Approved players will become available for lineup selection.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
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
  pending = false
}: {
  players: AdminPlayer[];
  onOpenPlayer: (playerId: string) => void;
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  pending?: boolean;
}) {
  if (players.length === 0) return <p className="text-sm text-slate-500">No players in this section.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Player", "Code", "Position", "Jersey", "OVR", "Status", "Actions"].map((header) => (
              <th key={header} className="px-4 py-3 text-left font-black">{header}</th>
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
              <td className="px-4 py-3"><AbilityCapsule player={player} /></td>
              <td className="px-4 py-3">
                <StatusPill tone={player.playerStatus === "Approved" ? "green" : player.playerStatus === "Removed" || player.playerStatus === "Suspended" || player.playerStatus === "Rejected" ? "orange" : "orange"}>
                  {player.playerStatus}
                </StatusPill>
              </td>
              <td className="px-4 py-3">
                <ActionGroup
                  actions={playerMiniActions(player, pending, onOpenPlayer, onDecision, onAbility, onPlayerAction)}
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
  onAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>,
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void
): ActionItem[] {
  if (pending || player.approvalStatus === "Pending") {
    return [
      { label: "Low", onClick: () => void onAbility(player.id, "LOW"), selected: player.abilityRating === "Low" },
      { label: "Moderate", onClick: () => void onAbility(player.id, "MODERATE"), selected: player.abilityRating === "Moderate" },
      { label: "High", onClick: () => void onAbility(player.id, "HIGH"), selected: player.abilityRating === "High" },
      { label: "Approve", onClick: () => void onDecision(player.id, "APPROVED"), disabled: player.abilityRating === "Not rated" },
      { label: "Reject", onClick: () => onPlayerAction("reject", player), danger: true }
    ];
  }
  if (player.playerStatus === "Suspended") {
    return [
      { label: "Open", onClick: () => onOpenPlayer(player.id) },
      { label: "Unsuspend", onClick: () => onPlayerAction("unsuspend", player) },
      { label: "Remove", onClick: () => onPlayerAction("remove", player), danger: true }
    ];
  }
  if (player.playerStatus === "Removed" || player.playerStatus === "Rejected") {
    return [{ label: "Open", onClick: () => onOpenPlayer(player.id) }];
  }
  return [
    { label: "Open", onClick: () => onOpenPlayer(player.id) },
    { label: "Remove", onClick: () => onPlayerAction("remove", player), danger: true },
    { label: "Suspend", onClick: () => onPlayerAction("suspend", player), danger: true }
  ];
}

function SimpleRows({ rows }: { rows: Array<Array<string>> }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No records yet.</p>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <div key={`${row.join("-")}-${index}`} className="grid gap-2 py-3 text-sm md:grid-cols-4">
          {row.map((cell) => (
            <span key={cell} className="font-medium text-slate-700">{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
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

function AbilityCapsule({ player }: { player: AdminPlayer }) {
  if (player.overallRating === null || player.overallRating === undefined) {
    return <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-400 ring-1 ring-slate-200">N/A</span>;
  }
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${abilityTone(player.abilityRating)}`}>
      {player.overallRating}
    </span>
  );
}

function AbilityDetailCard({ ability }: { ability: { label: string; value: string } }) {
  const numeric = Number(ability.value);
  const bg = ability.label === "Tier"
    ? ability.value === "HIGH" ? "bg-sky-50 ring-sky-100" : ability.value === "MODERATE" ? "bg-green-50 ring-green-100" : "bg-amber-50 ring-amber-100"
    : Number.isFinite(numeric)
      ? numeric >= 73 ? "bg-sky-50 ring-sky-100" : numeric >= 55 ? "bg-green-50 ring-green-100" : "bg-amber-50 ring-amber-100"
      : "bg-slate-50 ring-slate-100";
  return (
    <div className={`rounded-lg p-3 ring-1 ${bg}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{ability.label}</p>
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
          <img src={player.avatarUrl} alt={player.fullName} className="h-full w-full object-cover" />
        </button>
        {previewOpen ? <AdminFacePreviewModal player={player} onClose={() => setPreviewOpen(false)} /> : null}
      </>
    );
  }
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-400 text-xl font-black text-white shadow-lg">
      {player.avatar}
    </div>
  );
}

function AdminFacePreviewModal({ player, onClose }: { player: AdminPlayer; onClose: () => void }) {
  if (!player.avatarUrl) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black">{player.fullName}</h3>
            <p className="text-sm font-semibold text-slate-500">#{player.jerseyNumber} · {player.footballPosition}</p>
          </div>
          <button type="button" className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="grid place-items-center rounded-3xl bg-slate-100 p-4">
          <img src={player.avatarUrl} alt={player.fullName} className="max-h-[70vh] max-w-full rounded-2xl object-contain" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-black transition-all duration-200 ${active ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-white hover:text-indigo-700"
        }`}
    >
      {children}
    </button>
  );
}

function AdminActionButton({ label, icon, onClick, disabled, selected }: { label: string; icon?: React.ReactNode; onClick?: () => void; disabled?: boolean; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none ${selected ? "border-green-300 bg-green-100 text-green-800 ring-2 ring-green-200" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        }`}
    >
      {selected ? <CheckCircle2 size={14} /> : null}
      {icon}
      {label}
    </button>
  );
}

function DangerButton({ label, icon, onClick, disabled }: { label: string; icon?: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
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
  onDecision
}: {
  teamRequests: TeamRequest[];
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
}) {
  return (
    <CrudPage
      title="Team Requests"
      subtitle="Approve or reject manager team applications for this selected season."
      columns={["Team Name", "Manager Name", "Season", "Squad Count", "Status", "Actions"]}
      rows={teamRequests.map((row) => [
        <TeamCompact key="team" name={row.team} logoUrl={row.logoUrl} />,
        row.manager,
        row.season,
        String(row.squad),
        <StatusPill key="status" tone="orange">{row.status}</StatusPill>,
        <ActionGroup
          key="actions"
          actions={[
            { label: "Approve", onClick: () => void onDecision(row.id, "APPROVED") },
            { label: "Reject", onClick: () => void onDecision(row.id, "REJECTED"), danger: true }
          ]}
        />
      ])}
    />
  );
}

function PlayerRequestsView({
  playerRequests,
  onDecision,
  onAbility,
  onPlayerAction
}: {
  playerRequests: PlayerRequest[];
  onDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayer | null>(null);
  return (
    <>
      <CrudPage
        title="Player Requests"
        subtitle="Review players, assign ability rating, approve, reject, or remove them."
        columns={["Player Code", "Player Name", "Team Name", "Position", "Jersey", "ID Type", "Approval", "OVR", "Actions"]}
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
              <span className="text-xs font-bold text-slate-500">Ability: {row.abilityRating}</span>
            </div>,
            row.player ? <AbilityCapsule key="ovr" player={row.player} /> : <span key="ovr" className="text-xs font-bold text-slate-400">N/A</span>,
            <ActionGroup
              key="actions"
              actions={[
                { label: "Low", onClick: () => void onAbility(row.id, "LOW"), disabled: !canRate, selected: row.abilityRating === "Low" },
                { label: "Moderate", onClick: () => void onAbility(row.id, "MODERATE"), disabled: !canRate, selected: row.abilityRating === "Moderate" },
                { label: "High", onClick: () => void onAbility(row.id, "HIGH"), disabled: !canRate, selected: row.abilityRating === "High" },
                { label: "Approve", onClick: () => void onDecision(row.id, "APPROVED"), disabled: !canApprove },
                { label: "Reject", onClick: () => row.player && onPlayerAction("reject", row.player), disabled: !row.player, danger: true }
              ]}
            />
          ];
        })}
      />
      {selectedPlayer ? <PlayerRequestDetailModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} /> : null}
    </>
  );
}

function FixturesView({ season }: { season: SeasonDto }) {
  const [data, setData] = useState<AdminFixturesResponse | null>(null);
  const [preview, setPreview] = useState<FixturePreviewResponse | null>(null);
  const [previewMode, setPreviewMode] = useState<"all" | "group" | "knockout" | null>(null);
  const [tab, setTab] = useState<"group" | "knockout" | "all">("all");
  const [message, setMessage] = useState("");
  const isGroupKnockout = season.format === SeasonFormat.GROUP_STAGE_KNOCKOUT;

  async function loadFixtures() {
    const result = await api<AdminFixturesResponse>(`/admin/seasons/${season.id}/fixtures`);
    setData(result);
  }

  useEffect(() => {
    setPreview(null);
    setPreviewMode(null);
    setTab(isGroupKnockout ? "group" : "all");
    void loadFixtures().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load fixtures"));
  }, [season.id, isGroupKnockout]);

  const teamById = useMemo(() => new Map((data?.approved_teams ?? []).map((team) => [team.id, team])), [data?.approved_teams]);
  const groupById = useMemo(() => new Map((data?.groups ?? []).map((group) => [group.id, group])), [data?.groups]);
  const rows = preview?.fixtures ?? data?.fixtures ?? [];
  const filteredRows = rows.filter((row) => {
    if (!isGroupKnockout || tab === "all") return true;
    if (tab === "group") return row.stage === "GROUP";
    return row.stage !== "GROUP" && row.stage !== "LEAGUE";
  });
  const groupFixtures = data?.fixtures.filter((fixture) => fixture.stage === "GROUP") ?? [];
  const groupStageComplete =
    groupFixtures.length > 0 && groupFixtures.every((fixture) => fixture.status === FixtureStatus.FINAL || fixture.status === "COMPLETED" || fixture.result_confirmed);
  const hasSavedFixtures = (data?.fixtures.length ?? 0) > 0;

  function rowTeamName(row: FixtureApiRow | FixturePreviewRow, side: "home" | "away") {
    const id = side === "home" ? row.home_team_registration_id : row.away_team_registration_id;
    const source = side === "home" ? row.home_source : row.away_source;
    const embedded = "home_team" in row && side === "home" ? row.home_team : "away_team" in row && side === "away" ? row.away_team : null;
    return embedded?.teams?.name ?? (id ? teamById.get(id)?.name : null) ?? source ?? "TBD";
  }

  function rowGroupName(row: FixtureApiRow | FixturePreviewRow) {
    return ("season_groups" in row ? row.season_groups?.name : null) ?? row.group_name ?? (row.group_id ? groupById.get(row.group_id)?.name : null) ?? "—";
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
      body: JSON.stringify({ stage: mode })
    });
    setPreview(result);
    setPreviewMode(mode);
    setTab(mode === "knockout" ? "knockout" : mode === "group" ? "group" : "all");
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
      body: JSON.stringify({ stage: previewMode })
    });
    setPreview(null);
    setPreviewMode(null);
    await loadFixtures();
  }

  async function regenerateFixtures() {
    if (!window.confirm("Delete generated fixtures and allow a fresh generation?")) return;
    await api(`/admin/seasons/${season.id}/fixtures/regenerate`, { method: "DELETE" });
    setPreview(null);
    setPreviewMode(null);
    await loadFixtures();
  }

  function exportFixtures() {
    const fixtureRows = data?.fixtures ?? [];
    const header = ["Matchday", "Date", "Stage", "Group", "Home Team", "Away Team", "Status"];
    const body = fixtureRows.map((row) => [
      row.matchday_number ?? row.round_no ?? "",
      row.kickoff_at ? safeDate(row.kickoff_at) : "",
      row.stage ?? "",
      rowGroupName(row),
      rowTeamName(row, "home"),
      rowTeamName(row, "away"),
      row.status
    ]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${season.name.replace(/\s+/g, "-").toLowerCase()}-fixtures.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div>
        <PageTitle title="Fixtures" subtitle="Generate and manage season fixtures" />
        <EmptyState label={message || "Loading fixture settings..."} />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Fixtures" subtitle="Generate and manage season fixtures" />

      {message ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Season Format" value={formatLabel(season.format)} />
        <SummaryCard label="Round Format" value={formatLabel(data.season.round_format ?? season.format)} />
        <SummaryCard label="Season Start" value={safeDate(season.start_date)} />
        <SummaryCard label="Season End" value={safeDate(season.end_date)} />
        <SummaryCard label="Approved Teams" value={String(data.approved_teams.length)} />
        <SummaryCard label="Fixture Status" value={data.fixture_status} />
      </div>

      {isGroupKnockout ? (
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Group Count" value={String(season.group_count ?? 0)} />
          <SummaryCard label="Teams Per Group" value={String(season.teams_per_group ?? 0)} />
          <SummaryCard label="Qualifiers Per Group" value={String(season.qualifiers_per_group ?? 0)} />
          <SummaryCard label="Total Knockout Qualifiers" value={String(Number(season.group_count ?? 0) * Number(season.qualifiers_per_group ?? 0))} />
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {!hasSavedFixtures && !preview && !isGroupKnockout ? (
            <button type="button" onClick={() => void makePreview("all").catch((error) => setMessage(error.message))} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700">
              Generate Fixtures
            </button>
          ) : null}

          {isGroupKnockout && !preview ? (
            <>
              <button type="button" onClick={() => void makePreview("group").catch((error) => setMessage(error.message))} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700">
                Generate Group Fixtures
              </button>
              <button
                type="button"
                disabled={!groupStageComplete}
                title={!groupStageComplete ? "Knockout fixtures will unlock after all group stage results are confirmed." : undefined}
                onClick={() => void makePreview("knockout").catch((error) => setMessage(error.message))}
                className="rounded-xl border border-indigo-200 bg-white px-5 py-3 text-sm font-black text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                Generate Knockout Fixtures
              </button>
            </>
          ) : null}

          {preview ? (
            <>
              <button type="button" onClick={() => void confirmPreview().catch((error) => setMessage(error.message))} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700">
                Confirm & Save Fixtures
              </button>
              <button type="button" onClick={() => { setPreview(null); setPreviewMode(null); }} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                Cancel Preview
              </button>
            </>
          ) : null}

          {hasSavedFixtures && !preview ? (
            <>
              <button type="button" onClick={exportFixtures} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
                Export Fixtures
              </button>
              <button
                type="button"
                disabled={!data.can_regenerate}
                title={!data.can_regenerate ? "Fixtures cannot be regenerated because matches have already started or completed." : undefined}
                onClick={() => void regenerateFixtures().catch((error) => setMessage(error.message))}
                className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:-translate-y-0.5 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                Regenerate Fixtures
              </button>
            </>
          ) : null}
        </div>

        {preview?.warnings.length ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
      </div>

      {isGroupKnockout ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ["group", "Group Stage Fixtures"],
            ["knockout", "Knockout Fixtures"],
            ["all", "All Fixtures"]
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
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h3 className="text-xl font-black">{preview ? "Fixture Preview" : "Fixture List"}</h3>
          <p className="mt-1 text-sm text-slate-500">Season settings are read from the database. Dates are auto-distributed inside the saved season range.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Matchday", "Date", "Stage", "Group", "Home Team", "Away Team", "Status"].map((header) => (
                  <th key={header} className="px-5 py-4 text-left font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center font-semibold text-slate-500">No fixtures generated yet.</td></tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={`${row.stage}-${row.round_no}-${row.home_team_registration_id ?? row.home_source}-${row.away_team_registration_id ?? row.away_source}-${index}`} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold">{row.matchday_number ?? row.round_no ?? "—"}</td>
                    <td className="px-5 py-4">{row.kickoff_at ? safeDate(row.kickoff_at) : "Not set"}</td>
                    <td className="px-5 py-4 font-semibold">{formatLabel(row.stage ?? "")}</td>
                    <td className="px-5 py-4">{rowGroupName(row)}</td>
                    <td className="px-5 py-4 font-bold">{rowTeamName(row, "home")}</td>
                    <td className="px-5 py-4 font-bold">{rowTeamName(row, "away")}</td>
                    <td className="px-5 py-4"><StatusPill tone={row.status === "WAITING_FOR_TEAMS" ? "orange" : row.status === "FINAL" || row.status === "COMPLETED" ? "green" : "blue"}>{statusLabel(row.status)}</StatusPill></td>
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

function PlayerRequestDetailModal({ player, onClose }: { player: AdminPlayer; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar player={player} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">Player Personal Data</p>
              <h2 className="mt-1 text-3xl font-black">{player.fullName}</h2>
              <p className="text-sm font-semibold text-slate-500">#{player.jerseyNumber} · {player.footballPosition} · {player.playerStatus}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">
            Close
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow label="Player Code" value={player.code} />
          <DetailRow label="Full Name" value={player.fullName} />
          <DetailRow label="Date of Birth" value={player.dateOfBirth} />
          <DetailRow label="Age" value={String(player.age)} />
          <DetailRow label="ID Type" value={player.idType} />
          <DetailRow label="Masked ID Number" value={player.maskedId} />
          <DetailRow label="Jersey Number" value={String(player.jerseyNumber)} />
          <DetailRow label="Position" value={`${player.footballPosition} (${player.position})`} />
          <DetailRow label="Preferred Foot" value={player.preferredFoot} />
          <DetailRow label="Approval Status" value={player.approvalStatus} />
          <DetailRow label="Player Status" value={player.playerStatus} />
          <DetailRow label="Registration Date" value={player.registrationDate} />
          <DetailRow label="Submitted By Manager" value={player.submittedByManager} />
          <DetailRow label="Admin Approval Date" value={player.adminApprovalDate} />
          <DetailRow label="Ability Rating" value={player.abilityRating} />
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Admin Message</p>
          <p className="mt-2 text-sm text-slate-700">{player.adminMessage}</p>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Hidden Ability Scores</p>
          {player.abilityDetails.length > 0 ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {player.abilityDetails.map((ability) => (
                <AbilityDetailCard key={ability.label} ability={ability} />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No ability scores generated yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerLifecycleModal({
  action,
  player,
  onClose,
  onSubmit
}: {
  action: PlayerLifecycleAction;
  player: AdminPlayer;
  onClose: () => void;
  onSubmit: (input: {
    action: PlayerLifecycleAction;
    playerId: string;
    reason: string;
    allowResubmission?: boolean;
    suspensionType?: string;
    suspensionUntil?: string;
    suspensionMatchesRemaining?: number;
  }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [suspensionType, setSuspensionType] = useState("UNTIL_ADMIN_UNSUSPENDS");
  const [suspensionUntil, setSuspensionUntil] = useState("");
  const [suspensionMatchesRemaining, setSuspensionMatchesRemaining] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const title =
    action === "reject" ? "Reject Player" : action === "remove" ? "Remove Player" : action === "suspend" ? "Suspend Player" : "Unsuspend Player";
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
        allowResubmission,
        suspensionType,
        suspensionUntil,
        suspensionMatchesRemaining: Number(suspensionMatchesRemaining)
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
            <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">Player Action</p>
            <h2 className="mt-1 text-3xl font-black">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{player.fullName} · #{player.jerseyNumber} · {player.footballPosition}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black transition hover:bg-slate-200">Close</button>
        </div>
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{description}</p>
        {action === "suspend" ? (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Suspension Type</span>
              <select value={suspensionType} onChange={(event) => setSuspensionType(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold">
                <option value="UNTIL_ADMIN_UNSUSPENDS">Until Admin Unsuspends</option>
                <option value="UNTIL_DATE">Until Specific Date</option>
                <option value="NEXT_MATCHES">For Next X Matches</option>
              </select>
            </label>
            {suspensionType === "UNTIL_DATE" ? (
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Suspended Until</span>
                <input type="date" value={suspensionUntil} onChange={(event) => setSuspensionUntil(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
              </label>
            ) : null}
            {suspensionType === "NEXT_MATCHES" ? (
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Match Count</span>
                <input type="number" min={1} value={suspensionMatchesRemaining} onChange={(event) => setSuspensionMatchesRemaining(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
              </label>
            ) : null}
          </div>
        ) : null}
        {action === "reject" ? (
          <label className="mt-5 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-900">
            <input type="checkbox" checked={allowResubmission} onChange={(event) => setAllowResubmission(event.target.checked)} />
            Allow manager to edit and resubmit this player
          </label>
        ) : null}
        <label className="mt-5 grid gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Required Message / Reason</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            placeholder="Write a clear reason for the manager..."
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">Cancel</button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!reason.trim() || submitting || (action === "suspend" && suspensionType === "UNTIL_DATE" && !suspensionUntil)}
            className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? "Saving..." : title}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchesReadyView({ matches, onSimulate }: { matches: ReadyMatchRow[]; onSimulate: (fixtureId: string) => Promise<void> }) {
  const [selectedMatch, setSelectedMatch] = useState<ReadyMatchRow | null>(null);
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<MatchDetailPlayerStat | null>(null);
  const [error, setError] = useState("");

  async function openDetail(match: ReadyMatchRow) {
    setSelectedMatch(match);
    setDetailLoading(true);
    setError("");
    try {
      const data = await api<MatchDetailResponse>(`/admin/matches/${match.id}/detail`);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load match detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function simulate(match: ReadyMatchRow) {
    setSimulatingId(match.id);
    setError("");
    try {
      await onSimulate(match.id);
      const data = await api<MatchDetailResponse>(`/admin/matches/${match.id}/detail`);
      setSelectedMatch(match);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not simulate match");
    } finally {
      setSimulatingId(null);
    }
  }

  return (
    <div>
      <PageTitle title="Matches Ready" subtitle="Matches appear here only after both lineups are confirmed." />
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {matches.length === 0 ? <EmptyState label="No matches are ready for simulation. Confirm both team lineups first." /> : null}
        {matches.map((match, index) => (
          <Panel key={match.id} title={`Ready Match ${index + 1}`}>
            <div className="flex items-center justify-between">
              <TeamCompact name={match.home} />
              <span className="font-black text-slate-500">VS</span>
              <TeamCompact name={match.away} />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
              <StatusBox label="Home Lineup" value="Confirmed" />
              <StatusBox label="Away Lineup" value="Confirmed" />
              <StatusBox label="Abilities" value="Ready" />
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
                disabled={simulatingId === match.id}
                className="rounded-md bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98]"
              >
                {simulatingId === match.id ? "Simulating..." : "Simulate Match"}
              </button>
            </div>
          </Panel>
        ))}
      </div>
      {selectedMatch ? (
        <MatchDetailModal
          match={selectedMatch}
          detail={detail}
          loading={detailLoading}
          simulating={simulatingId === selectedMatch.id}
          onClose={() => {
            setSelectedMatch(null);
            setDetail(null);
            setSelectedStat(null);
          }}
          onSimulate={() => void simulate(selectedMatch)}
          onPlayerStat={setSelectedStat}
        />
      ) : null}
      {selectedStat ? <PlayerMatchStatModal stat={selectedStat} onClose={() => setSelectedStat(null)} /> : null}
    </div>
  );
}

function MatchDetailModal({
  match,
  detail,
  loading,
  simulating,
  onClose,
  onSimulate,
  onPlayerStat
}: {
  match: ReadyMatchRow;
  detail: MatchDetailResponse | null;
  loading: boolean;
  simulating: boolean;
  onClose: () => void;
  onSimulate: () => void;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
}) {
  const statsByPlayer = new Map((detail?.player_stats ?? []).map((stat) => [stat.player_registration_id, stat]));
  const homeLineup = detail?.lineups.find((lineup) => lineup.side === "HOME") ?? detail?.lineups[0] ?? null;
  const awayLineup = detail?.lineups.find((lineup) => lineup.side === "AWAY") ?? detail?.lineups[1] ?? null;
  const hasSimulation = (detail?.player_stats?.length ?? 0) > 0 || (detail?.team_stats?.length ?? 0) > 0;
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mx-auto my-8 max-w-7xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-indigo-600">Match Detail</p>
            <h2 className="mt-2 text-3xl font-black">{match.home} vs {match.away}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{match.stage} · {match.kickoff}</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onSimulate} disabled={simulating} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:opacity-50">
              {simulating ? "Simulating..." : hasSimulation ? "Simulate Again" : "Simulate Match"}
            </button>
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">Close</button>
          </div>
        </div>

        {loading ? <EmptyState label="Loading match detail..." /> : null}
        {!loading ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-3xl bg-gradient-to-b from-emerald-500 to-emerald-700 p-5 text-white shadow-inner">
              <div className="grid gap-5 lg:grid-cols-2">
                <LineupSide title={match.home} lineup={homeLineup} statsByPlayer={statsByPlayer} onPlayerStat={onPlayerStat} />
                <LineupSide title={match.away} lineup={awayLineup} statsByPlayer={statsByPlayer} onPlayerStat={onPlayerStat} />
              </div>
            </div>
            {detail?.team_stats?.length ? <MatchTeamStatsPanel home={match.home} away={match.away} stats={detail.team_stats} /> : <EmptyState label="No match stats yet. Click Simulate Match to generate ratings and stats." />}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LineupSide({
  title,
  lineup,
  statsByPlayer,
  onPlayerStat
}: {
  title: string;
  lineup: MatchDetailLineup | null;
  statsByPlayer: Map<string, MatchDetailPlayerStat>;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
}) {
  const players = [...(lineup?.lineup_players ?? [])].sort((a, b) => Number(b.is_starter) - Number(a.is_starter));
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-black">{title}</h3>
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{lineup?.formation ?? "Formation N/A"}</span>
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
                onClick={() => stat ? onPlayerStat(stat) : undefined}
                className="relative rounded-2xl bg-white/15 p-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-white/25 disabled:cursor-default disabled:hover:translate-y-0"
              >
                {stat ? <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-black text-white ${ratingTone(Number(stat.rating))}`}>{formatNumber(stat.rating)}</span> : null}
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white font-black text-emerald-700">
                    {initials(name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-black">#{registration?.shirt_number ?? player.shirt_number ?? "-"} {name}</p>
                    <p className="text-xs text-white/75">{registration?.football_position ?? player.football_position ?? registration?.position ?? "POS"} · {player.is_starter ? "Starter" : "Bench"}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-white/20 p-4 text-sm font-semibold text-white/80">No lineup players found.</div>
      )}
    </div>
  );
}

function MatchTeamStatsPanel({ home, away, stats }: { home: string; away: string; stats: MatchDetailTeamStat[] }) {
  const [first, second] = stats;
  if (!first || !second) return null;
  const rows: Array<[string, keyof MatchDetailTeamStat, "number" | "percent" | "passes" | "rating"]> = [
    ["Team Rating", "rating", "rating"],
    ["Possession", "possession", "percent"],
    ["Total Shots", "shots", "number"],
    ["Shots on Target", "shots_on_target", "number"],
    ["Big Chances Created", "big_chances", "number"],
    ["Big Chances Missed", "big_chances_missed", "number"],
    ["Accurate Passes", "accurate_passes", "passes"],
    ["Corners", "corners", "number"],
    ["Offsides", "offsides", "number"],
    ["Fouls", "fouls", "number"],
    ["Yellow Cards", "yellow_cards", "number"],
    ["Red Cards", "red_cards", "number"]
  ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-black">Match Stats</h3>
      <div className="mt-5 space-y-3">
        {rows.map(([label, field, format]) => (
          <div key={label} className="grid grid-cols-[1fr_180px_1fr] items-center gap-4 text-sm">
            <div className="font-black">{formatTeamStat(first, field, format)}</div>
            <div className="text-center font-semibold text-slate-500">{label}</div>
            <div className="text-right font-black">{formatTeamStat(second, field, format)}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-full text-sm font-black text-white">
        <div className="bg-indigo-600 px-4 py-3">{home}</div>
        <div className="bg-slate-950 px-4 py-3 text-right">{away}</div>
      </div>
    </div>
  );
}

function PlayerMatchStatModal({ stat, onClose }: { stat: MatchDetailPlayerStat; onClose: () => void }) {
  const player = stat.player_season_registrations;
  const isGoalkeeper = (stat.position_played ?? player?.football_position) === "GK";
  const name = player?.players?.full_name ?? "Player";
  const items: Array<[string, unknown]> = isGoalkeeper
    ? [
        ["Minutes Played", stat.minutes],
        ["Saves", stat.saves],
        ["Goals Conceded", stat.goals_conceded],
        ["Accurate Passes", stat.accurate_passes],
        ["Accurate Long Balls", stat.accurate_long_balls],
        ["Diving Saves", stat.diving_saves],
        ["Saves Inside Box", stat.saves_inside_box],
        ["Clearances", stat.clearances],
        ["Yellow Cards", stat.yellow_cards],
        ["Red Cards", stat.red_cards],
        ["Rating", stat.rating]
      ]
    : [
        ["Minutes Played", stat.minutes],
        ["Position Played", stat.position_played],
        ["Goals", stat.goals],
        ["Assists", stat.assists],
        ["Shots", stat.shots],
        ["Shots on Target", stat.shots_on_target],
        ["Shot Accuracy", percent(stat.shots_on_target, stat.shots)],
        ["Chances Created", stat.chances_created],
        ["Big Chances Created", stat.big_chances_created],
        ["Big Chances Missed", stat.big_chances_missed],
        ["Total Passes", stat.passes],
        ["Accurate Passes", stat.accurate_passes],
        ["Pass Accuracy", percent(stat.accurate_passes, stat.passes)],
        ["Dribbles Attempted", stat.dribbles_attempted],
        ["Successful Dribbles", stat.successful_dribbles],
        ["Dribble Success Rate", percent(stat.successful_dribbles, stat.dribbles_attempted)],
        ["Dispossessed", stat.dispossessed],
        ["Tackles", stat.tackles],
        ["Interceptions", stat.interceptions],
        ["Clearances", stat.clearances],
        ["Blocks", stat.blocks],
        ["Fouls Committed", stat.fouls_committed],
        ["Yellow Cards", stat.yellow_cards],
        ["Red Cards", stat.red_cards],
        ["Rating", stat.rating]
      ];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-100 text-xl font-black text-indigo-700">{initials(name)}</div>
            <div>
              <h3 className="text-2xl font-black">{name}</h3>
              <p className="font-semibold text-slate-500">#{player?.shirt_number ?? "-"} · {stat.position_played ?? player?.football_position ?? player?.position ?? "POS"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">Close</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-black">{formatValue(value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StandingsView({ groupMode, teams }: { groupMode: boolean; teams: StandingTeam[] }) {
  if (groupMode) {
    return (
      <div>
        <PageTitle title="Group Standings" subtitle="Group table with qualified and eliminated status." />
        <EmptyState label="Group standings will appear after groups are generated and matches are finalized." />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Standings" subtitle="League table. Table topper becomes champion for round robin formats." />
      <StandingTable title="Current Table" teams={teams} />
    </div>
  );
}

function PlayerStatsView({ data }: { data: AdminSeasonData }) {
  const [openCard, setOpenCard] = useState<StatCardData | null>(null);
  return (
    <div>
      <PageTitle
        title="Player Stats"
        subtitle="Player leaderboards update after confirmed match simulations. xG/xA are intentionally not tracked in this project."
      />
      <LeaderboardSections title="Player Stats" sections={data.statsReport.player_sections} onOpen={setOpenCard} />
      {openCard ? <LeaderboardModal card={openCard} onClose={() => setOpenCard(null)} /> : null}
    </div>
  );
}

function TeamStatsView({ data }: { data: AdminSeasonData }) {
  const [openCard, setOpenCard] = useState<StatCardData | null>(null);
  return (
    <div>
      <PageTitle
        title="Team Stats"
        subtitle="Team leaderboards update after confirmed match simulations. xG/xA are intentionally not tracked in this project."
      />
      <LeaderboardSections title="Team Stats" sections={data.statsReport.team_sections} onOpen={setOpenCard} />
      {openCard ? <LeaderboardModal card={openCard} onClose={() => setOpenCard(null)} /> : null}
    </div>
  );
}

function LeaderboardSections({ title, sections, onOpen }: { title: string; sections: StatSectionData[]; onOpen: (card: StatCardData) => void }) {
  const hasData = sections.some((section) => section.cards.some((card) => card.entries.length > 0));
  return (
    <section>
      <h2 className="mb-4 text-2xl font-black">{title}</h2>
      {!hasData ? <EmptyState label={`${title} will appear after confirmed match results generate stats.`} /> : null}
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-lg font-black">{section.title}</h3>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {section.cards.map((card) => (
                <LeaderboardCard key={card.id} card={card} onOpen={() => onOpen(card)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeaderboardCard({ card, onOpen }: { card: StatCardData; onOpen: () => void }) {
  const topEntries = card.entries.slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl active:translate-y-0 active:scale-[0.99]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-lg font-black">{card.title}</h4>
        <span className="text-2xl font-black text-slate-300">›</span>
      </div>
      {topEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-bold text-slate-500">No data yet.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {topEntries.map((entry, index) => (
            <LeaderboardEntryRow key={entry.id} entry={entry} rank={index + 1} />
          ))}
        </div>
      )}
    </button>
  );
}

function LeaderboardEntryRow({ entry, rank }: { entry: StatEntry; rank: number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="w-5 text-sm font-black text-slate-400">{rank}</span>
        <PlayerOrTeamAvatar entry={entry} />
        <div className="min-w-0">
          <p className="truncate font-black">{entry.name}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
            {entry.teamLogoUrl ? <img src={entry.teamLogoUrl} alt="" className="h-4 w-4 rounded-full object-cover" /> : null}
            <span className="truncate">{entry.subLabel}</span>
          </div>
        </div>
      </div>
      <span className={`rounded-full px-3 py-1 text-sm font-black ${rank === 1 ? "bg-blue-500 text-white" : "text-slate-900"}`}>{entry.value}</span>
    </div>
  );
}

function PlayerOrTeamAvatar({ entry }: { entry: StatEntry }) {
  const [failed, setFailed] = useState(false);
  if (entry.logoUrl && !failed) {
    return <img src={entry.logoUrl} alt={entry.name} onError={() => setFailed(true)} className="h-9 w-9 rounded-full object-cover" />;
  }
  return <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-700">{entry.initials}</div>;
}

function LeaderboardModal({ card, onClose }: { card: StatCardData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">Full Leaderboard</p>
            <h2 className="mt-1 text-2xl font-black">{card.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">Close</button>
        </div>
        {card.entries.length === 0 ? <EmptyState label="No data yet." /> : (
          <div className="divide-y divide-slate-100">
            {card.entries.map((entry, index) => (
              <LeaderboardEntryRow key={entry.id} entry={entry} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesView({ messages }: { messages: AdminMessageRow[] }) {
  return (
    <CrudPage
      title="Messages"
      subtitle="Messages sent to managers after rejection, blocking, removal, or notices."
      columns={["Manager Name", "Team Name", "Message", "Related Type", "Read Status"]}
      rows={messages.map((row) => [
        row.manager,
        row.team,
        row.message,
        row.type,
        <StatusPill key="read" tone={row.read === "Read" ? "green" : "orange"}>{row.read}</StatusPill>
      ])}
    />
  );
}

function DivideGroupsView({ season, onSaved }: { season: SeasonDto; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<AdminGroupsResponse | null>(null);
  const [draftGroups, setDraftGroups] = useState<AdminFixtureGroup[]>([]);
  const [message, setMessage] = useState("");

  async function loadGroups() {
    const result = await api<AdminGroupsResponse>(`/admin/seasons/${season.id}/groups`);
    setData(result);
    setDraftGroups(result.groups);
  }

  useEffect(() => {
    void loadGroups().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load group data"));
  }, [season.id]);

  const assignedTeamIds = new Set(draftGroups.flatMap((group) => group.teams.map((team) => team.id)));
  const unassignedTeams = (data?.approved_teams ?? []).filter((team) => !assignedTeamIds.has(team.id));
  const requiredTeams = Number(season.group_count ?? 0) * Number(season.teams_per_group ?? 0);
  const canSave =
    draftGroups.length === Number(season.group_count ?? 0) &&
    draftGroups.every((group) => group.teams.length === Number(season.teams_per_group ?? 0)) &&
    unassignedTeams.length === 0;

  async function randomizeGroups() {
    setMessage("");
    const result = await api<{ groups: AdminFixtureGroup[] }>(`/admin/seasons/${season.id}/groups/randomize`, { method: "POST" });
    setDraftGroups(result.groups);
    await loadGroups();
  }

  function moveTeam(teamId: string, targetGroupId: string) {
    const team = (data?.approved_teams ?? []).find((item) => item.id === teamId);
    if (!team) return;
    setDraftGroups((groups) =>
      groups.map((group) => ({
        ...group,
        teams:
          group.id === targetGroupId
            ? group.teams.some((item) => item.id === teamId)
              ? group.teams
              : [...group.teams, team]
            : group.teams.filter((item) => item.id !== teamId)
      }))
    );
  }

  async function saveGroups() {
    await api(`/admin/seasons/${season.id}/groups/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        groups: draftGroups.map((group) => ({
          group_id: group.id,
          team_registration_ids: group.teams.map((team) => team.id)
        }))
      })
    });
    await onSaved();
  }

  if (!data) {
    return (
      <div>
        <PageTitle title="Divide Teams Into Groups" subtitle="Loading group settings from the database." />
        <EmptyState label={message || "Loading groups..."} />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Divide Teams Into Groups" subtitle="Generate groups randomly, then manually move or swap teams before saving." />
      {message ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{message}</div> : null}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <SummaryCard label="Group Count" value={String(season.group_count ?? 0)} />
        <SummaryCard label="Teams Per Group" value={String(season.teams_per_group ?? 0)} />
        <SummaryCard label="Approved Teams" value={`${data.approved_teams.length}/${requiredTeams}`} />
        <SummaryCard label="Groups Ready" value={canSave ? "Yes" : "No"} color={canSave ? "green" : "orange"} />
      </div>
      <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <button type="button" onClick={() => void randomizeGroups().catch((error) => setMessage(error.message))} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-indigo-700">
          Generate Groups Randomly
        </button>
        <button type="button" disabled={!canSave} onClick={() => void saveGroups().catch((error) => setMessage(error.message))} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
          Save Group Division
        </button>
        {!canSave ? <p className="self-center text-sm font-semibold text-slate-500">Each group must have exactly {season.teams_per_group ?? 0} approved teams.</p> : null}
      </div>
      {draftGroups.length === 0 ? (
        <EmptyState label="No groups created yet. Click Generate Groups Randomly first, then adjust manually if needed." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {draftGroups.map((group) => (
            <Panel key={group.id} title={`${group.name} (${group.teams.length}/${season.teams_per_group ?? 0})`}>
              {group.teams.length === 0 ? <EmptyState label="No teams in this group yet." /> : group.teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
                  <TeamCompact name={team.name ?? "Unnamed team"} logoUrl={team.logo_url ?? null} />
                  <select
                    value={group.id}
                    onChange={(event) => moveTeam(team.id, event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    {draftGroups.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                  </select>
                </div>
              ))}
            </Panel>
          ))}
          {unassignedTeams.length > 0 ? (
            <Panel title="Unassigned Teams">
              {unassignedTeams.map((team) => (
                <div key={team.id} className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
                  <TeamCompact name={team.name ?? "Unnamed team"} logoUrl={team.logo_url ?? null} />
                  <select defaultValue="" onChange={(event) => moveTeam(team.id, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
                    <option value="" disabled>Move to...</option>
                    {draftGroups.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api<AdminGroupsResponse>(`/admin/seasons/${season.id}/groups`)
      .then(setData)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load groups"));
  }, [season.id]);

  return (
    <div>
      <PageTitle title="Groups" subtitle="Saved group division for this season." />
      {!data ? <EmptyState label={message || "Loading groups..."} /> : data.groups.length === 0 ? <EmptyState label="Groups are not divided yet." /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.groups.map((group) => (
            <Panel key={group.id} title={`${group.name} (${group.teams.length}/${season.teams_per_group ?? 0})`}>
              {group.teams.length === 0 ? <EmptyState label="No teams in this group." /> : group.teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
                  <TeamCompact name={team.name ?? "Unnamed team"} logoUrl={team.logo_url ?? null} />
                  <StatusPill tone="blue">Assigned</StatusPill>
                </div>
              ))}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function KnockoutView() {
  return (
    <div>
      <PageTitle title="Knockout Bracket" subtitle="Generated after group stage is finished. Knockout matches cannot end in draw." />
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <EmptyState label="Knockout bracket will appear after qualifiers are generated from real group standings." />
      </div>
    </div>
  );
}

function SettingsView({ league, season, onSaved }: { league: LeagueDto; season: SeasonDto; onSaved: () => Promise<void> }) {
  const [leagueDraft, setLeagueDraft] = useState({
    name: league.name,
    short_name: league.short_name ?? "",
    logo_url: league.logo_url ?? "",
    organizer_name: league.organizer_name ?? "",
    country: league.country ?? "",
    description: league.description ?? ""
  });
  const [seasonDraft, setSeasonDraft] = useState({
    format: season.format,
    phase: season.phase,
    total_teams: String(season.total_teams ?? ""),
    lineup_size: String(season.lineup_size ?? ""),
    substitute_limit: String(season.substitute_limit ?? ""),
    registration_start_date: season.registration_start_date ?? "",
    registration_deadline: season.registration_deadline ?? "",
    start_date: season.start_date ?? "",
    end_date: season.end_date ?? ""
  });
  const [saving, setSaving] = useState(false);
  async function saveSettings() {
    setSaving(true);
    try {
      await Promise.all([
        api(`/admin/leagues/${league.id}`, {
          method: "PATCH",
          body: JSON.stringify(leagueDraft)
        }),
        api(`/admin/seasons/${season.id}`, {
          method: "PATCH",
          body: JSON.stringify(seasonDraft)
        })
      ]);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <PageTitle title="Settings" subtitle="Edit selected league and season configuration." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="League Settings">
          <div className="grid gap-4">
            <EditableField label="League Name" value={leagueDraft.name} onChange={(value) => setLeagueDraft((current) => ({ ...current, name: value }))} />
            <EditableField label="Short Name" value={leagueDraft.short_name} onChange={(value) => setLeagueDraft((current) => ({ ...current, short_name: value }))} />
            <EditableField label="League Logo URL" value={leagueDraft.logo_url} onChange={(value) => setLeagueDraft((current) => ({ ...current, logo_url: value }))} />
            <EditableField label="Organizer Name" value={leagueDraft.organizer_name} onChange={(value) => setLeagueDraft((current) => ({ ...current, organizer_name: value }))} />
            <EditableField label="Country / Category" value={leagueDraft.country} onChange={(value) => setLeagueDraft((current) => ({ ...current, country: value }))} />
            <EditableField label="Description" value={leagueDraft.description} onChange={(value) => setLeagueDraft((current) => ({ ...current, description: value }))} textarea />
          </div>
        </Panel>
        <Panel title="Season Settings">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Format</span>
              <select value={seasonDraft.format} onChange={(event) => setSeasonDraft((current) => ({ ...current, format: event.target.value as SeasonFormat }))} className="rounded-xl border border-slate-200 px-4 py-3 font-bold">
                {Object.values(SeasonFormat).map((format) => <option key={format} value={format}>{formatLabel(format)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Phase</span>
              <select value={seasonDraft.phase} onChange={(event) => setSeasonDraft((current) => ({ ...current, phase: event.target.value as SeasonPhase }))} className="rounded-xl border border-slate-200 px-4 py-3 font-bold">
                {Object.values(SeasonPhase).map((phase) => <option key={phase} value={phase}>{formatPhase(phase)}</option>)}
              </select>
            </label>
            <EditableField label="Total Teams" value={seasonDraft.total_teams} type="number" onChange={(value) => setSeasonDraft((current) => ({ ...current, total_teams: value }))} />
            <EditableField label="Lineup Size" value={seasonDraft.lineup_size} type="number" onChange={(value) => setSeasonDraft((current) => ({ ...current, lineup_size: value }))} />
            <EditableField label="Substitute Limit" value={seasonDraft.substitute_limit} type="number" onChange={(value) => setSeasonDraft((current) => ({ ...current, substitute_limit: value }))} />
            <EditableField label="Registration Start" value={seasonDraft.registration_start_date} type="date" onChange={(value) => setSeasonDraft((current) => ({ ...current, registration_start_date: value }))} />
            <EditableField label="Registration Deadline" value={seasonDraft.registration_deadline} type="date" onChange={(value) => setSeasonDraft((current) => ({ ...current, registration_deadline: value }))} />
            <EditableField label="Season Start" value={seasonDraft.start_date} type="date" onChange={(value) => setSeasonDraft((current) => ({ ...current, start_date: value }))} />
            <EditableField label="Season End" value={seasonDraft.end_date} type="date" onChange={(value) => setSeasonDraft((current) => ({ ...current, end_date: value }))} />
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
  textarea = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
      )}
    </label>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-3xl font-black tracking-tight text-slate-950">{title}</h1>
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
  onAction
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
    cyan: "bg-cyan-100 text-cyan-700"
  };
  const text = {
    blue: "text-blue-700",
    green: "text-green-700",
    orange: "text-orange-600",
    purple: "text-violet-700",
    cyan: "text-cyan-700"
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex gap-4">
        {icon ? <div className={`grid h-[70px] w-[70px] place-items-center rounded-xl ${tones[cardColor]}`}>{icon}</div> : null}
        <div className="min-w-0">
          <p className={`${icon ? "min-h-[48px]" : ""} text-base font-black leading-snug`}>{label}</p>
          <p className={`mt-2 ${icon ? "text-4xl" : "text-2xl"} font-black ${text[cardColor]}`}>{value}</p>
        </div>
      </div>
      {action ? (
        <>
          <div className="my-4 h-px bg-slate-200" />
          <button className="w-full rounded-lg py-2 text-center text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 active:translate-y-0 active:scale-[0.98]" onClick={onAction}>
            {action} →
          </button>
        </>
      ) : null}
    </div>
  );
}

function FeatureCard({ title, icon, children, className = "", iconTone = "yellow" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; iconTone?: "yellow" | "green" | "purple" }) {
  const tone = iconTone === "green" ? "bg-green-100 text-green-700" : iconTone === "purple" ? "bg-violet-100 text-violet-700" : "bg-yellow-100 text-yellow-700";
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-5 flex items-center gap-4">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>{icon}</span>
        <h2 className="font-black">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Panel({ title, action, onAction, children }: { title: string; action?: string | undefined; onAction?: (() => void) | undefined; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black">{title}</h2>
        {action ? (
          <button className="rounded-md px-2 py-1 text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 active:translate-y-0 active:scale-[0.97]" onClick={onAction}>
            {action} →
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function CrudPage({ title, subtitle, columns, rows }: { title: string; subtitle: string; columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4 font-black">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
                  No records yet.
                </td>
              </tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-5 py-4 align-middle font-medium text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
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

function ReadyMatchCard({ match }: { match: ReadyMatchRow }) {
  return (
    <div className="rounded-xl border border-slate-200 p-6 text-center">
      <div className="flex items-center justify-center gap-14">
        <TeamCompact name={match.home} />
        <span className="font-black">vs</span>
        <TeamCompact name={match.away} />
      </div>
      <p className="mt-7 text-sm text-slate-600">{match.kickoff}</p>
      <p className="mt-3 text-sm text-slate-600">{match.stage}</p>
      <button className="group mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98]">
        <PlayCircle className="transition-transform duration-200 group-hover:scale-110" size={17} />
        Simulate Match
      </button>
    </div>
  );
}

function StandingTable({ title, teams: tableTeams }: { title: string; teams: StandingTeam[] }) {
  return (
    <Panel title={title} action="Recalculate Standings">
      <div className="overflow-x-auto">
        {tableTeams.length === 0 ? <EmptyState label="No standings yet." /> : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {["Rank", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((header) => (
                  <th key={header} className="px-3 py-3 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableTeams.map((team, index) => (
                <tr key={team.name}>
                  <td className="px-3 py-3 font-black">{index + 1}</td>
                  <td className="px-3 py-3"><TeamCompact name={team.name} /></td>
                  <td className="px-3 py-3">{team.played}</td>
                  <td className="px-3 py-3">{team.won}</td>
                  <td className="px-3 py-3">{team.draw}</td>
                  <td className="px-3 py-3">{team.lost}</td>
                  <td className="px-3 py-3">{team.gf}</td>
                  <td className="px-3 py-3">{team.ga}</td>
                  <td className="px-3 py-3">{team.gf - team.ga}</td>
                  <td className="px-3 py-3 font-black text-indigo-700">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function SidebarButton({ item, active, onClick }: { item: { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-md px-4 py-3 text-left text-base transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/20" : "text-slate-100 hover:bg-white/10 hover:shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
        }`}
    >
      <Icon className="transition-transform duration-200 group-hover:scale-110" size={22} />
      <span>{item.label}</span>
    </button>
  );
}

function TeamBadge({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null | undefined; size?: "md" | "lg" | "xl" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = size === "xl" ? "h-28 w-28 text-xl" : size === "lg" ? "h-20 w-20 text-sm" : "h-12 w-12 text-xs";
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
    <div className={`${dimensions} grid shrink-0 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-blue-700 to-sky-400 text-center font-black text-white shadow`}>
      {name.split(" ").map((part) => part[0]).join("").slice(0, 3)}
    </div>
  );
}

function TeamCompact({ name, logoUrl }: { name: string; logoUrl?: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge name={name} logoUrl={logoUrl} />
      <span className="font-black">{name}</span>
    </div>
  );
}

function PlayerHero({ name, team, shirt, color }: { name: string; team: string; shirt: string; color: "blue" | "black" }) {
  return (
    <div className="flex items-center gap-6">
      <div className={`grid h-24 w-24 place-items-center rounded-full ${color === "blue" ? "bg-blue-100" : "bg-slate-100"}`}>
        <div className={`grid h-16 w-14 place-items-center rounded-t-2xl text-2xl font-black text-white ${color === "blue" ? "bg-blue-800" : "bg-slate-900"}`}>
          {shirt}
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black">{name}</h3>
        <p className="text-base text-slate-600">{team}</p>
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

function StatusPill({ tone, children }: { tone: "blue" | "green" | "orange"; children: React.ReactNode }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${styles[tone]}`}>{children}</span>;
}

type ActionItem = string | { label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; selected?: boolean };

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
            title={item.disabled ? "Approve the team before rating or approving players." : undefined}
            className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold transition-all duration-200 active:translate-y-0 active:scale-[0.96] ${item.selected
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
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-black text-green-700">{value}</p>
    </div>
  );
}

function InfoBox({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
      {children}
    </div>
  );
}

function BracketColumn({ title, matches }: { title: string; matches: string[] }) {
  return (
    <div>
      <h3 className="mb-4 font-black text-slate-700">{title}</h3>
      <div className="space-y-4">
        {matches.map((match) => (
          <div key={match} className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-bold">
            {match}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLabel(format: string) {
  return format.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPhase(phase: SeasonDto["phase"] | null | undefined) {
  if (!phase || phase === SeasonPhase.REGISTRATION_OPEN) return "Registration Open";
  return formatLabel(phase);
}
