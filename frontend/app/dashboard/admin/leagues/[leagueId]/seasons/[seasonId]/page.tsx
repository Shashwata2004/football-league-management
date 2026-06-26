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
  | "messages"
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
  topRated: { name: string; team: string; rating: string; matches: number } | null;
}

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
  topRated: null
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
  stage?: string | null;
  home_team_registration_id: string;
  away_team_registration_id: string;
  kickoff_at?: string | null;
  venue?: string | null;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
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
  goals?: number | null;
  assists?: number | null;
  appearances?: number | null;
  yellow_cards?: number | null;
  red_cards?: number | null;
  average_rating?: number | string | null;
  player_season_registrations?: {
    position?: string | null;
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

function zeroLeagueStats(stat?: PlayerSeasonStatApiRow): AdminPlayer["leagueStats"] {
  const shots = 0;
  const shotsOnTarget = 0;
  const totalPasses = 0;
  const accuratePasses = 0;
  const dribblesAttempted = 0;
  const successfulDribbles = 0;
  return {
    matchesPlayed: stat?.appearances ?? 0,
    starts: 0,
    minutesPlayed: 0,
    goals: stat?.goals ?? 0,
    assists: stat?.assists ?? 0,
    shots,
    shotsOnTarget,
    shotAccuracy: shots ? `${Math.round((shotsOnTarget / shots) * 100)}%` : "0%",
    chancesCreated: 0,
    totalPasses,
    accuratePasses,
    passAccuracy: totalPasses ? `${Math.round((accuratePasses / totalPasses) * 100)}%` : "0%",
    dribblesAttempted,
    successfulDribbles,
    dispossessed: 0,
    tackles: 0,
    interceptions: 0,
    yellowCards: stat?.yellow_cards ?? 0,
    redCards: stat?.red_cards ?? 0,
    averageRating: stat?.average_rating ? String(stat.average_rating) : "N/A",
    bestMatchRating: "N/A",
    lowestMatchRating: "N/A",
    playerOfTheMatch: 0
  };
}

function buildAdminSeasonData(input: {
  season: SeasonDto;
  teamRegistrations: TeamRegistrationApiRow[];
  playerRegistrations: PlayerRegistrationApiRow[];
  fixtures: FixtureApiRow[];
  standings: StandingApiRow[];
  playerStats: PlayerSeasonStatApiRow[];
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
        home: teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team",
        away: teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team",
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
      const activePlayers = players.filter((player) => player.playerStatus !== "Suspended" && player.playerStatus !== "Removed");
      const teamFixtures = fixturesByTeam(row.id);
      return {
        id: row.id,
	        logo: row.teams?.short_name ?? row.teams?.name ?? "TM",
	        logoUrl: row.teams?.logo_url ?? null,
	        primaryColor: row.teams?.primary_color ?? null,
	        secondaryColor: row.teams?.secondary_color ?? null,
	        accentColor: row.teams?.accent_color ?? null,
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
    home: teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team",
    away: teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team",
    stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
    status: statusLabel(fixture.status),
    venue: fixture.venue ?? "Not set"
  }));

  const completedMatches = input.fixtures
    .filter((fixture) => fixture.status === FixtureStatus.FINAL)
    .map((fixture) => ({
      date: safeDate(fixture.kickoff_at),
      home: teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team",
      away: teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team",
      score: `${fixture.home_score ?? 0} - ${fixture.away_score ?? 0}`
    }));

  const standings = input.standings.map((row) => {
    const team = teamByRegistration.get(row.team_registration_id);
    const name = team?.teams?.name ?? "Unnamed team";
    return {
      name,
      short: team?.teams?.short_name ?? initials(name),
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
    .filter((fixture) => fixture.status === FixtureStatus.LINEUPS_CONFIRMED)
    .map((fixture) => ({
      id: fixture.id,
      home: teamByRegistration.get(fixture.home_team_registration_id)?.teams?.name ?? "Home team",
      away: teamByRegistration.get(fixture.away_team_registration_id)?.teams?.name ?? "Away team",
      stage: fixture.stage ?? `Round ${fixture.round_no ?? ""}`.trim(),
      kickoff: fixture.kickoff_at ? safeDate(fixture.kickoff_at) : "Kickoff not set",
      status: statusLabel(fixture.status)
    }));

  const sortedStats = [...input.playerStats].sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0));
  const topGoal = sortedStats[0];
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
    topScorer: topGoal
      ? {
          name: topGoal.player_season_registrations?.players?.full_name ?? "Unnamed player",
          team: "Season team",
          goals: topGoal.goals ?? 0,
          matches: topGoal.appearances ?? 0
        }
      : null,
    topRated: topRated
      ? {
          name: topRated.player_season_registrations?.players?.full_name ?? "Unnamed player",
          team: "Season team",
          rating: String(topRated.average_rating),
          matches: topRated.appearances ?? 0
        }
      : null
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

export default function AdminLeagueSeasonDashboard() {
  const params = useParams<{ leagueId: string; seasonId: string }>();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [season, setSeason] = useState<SeasonDto | null>(null);
  const [adminData, setAdminData] = useState<AdminSeasonData>(emptyAdminSeasonData);
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
      return;
    }
    const [teamRegistrationData, playerRegistrationData, fixtureData, standingData, playerStatData] = await Promise.all([
      api<{ team_registrations: TeamRegistrationApiRow[] }>("/admin/team-registrations"),
      api<{ player_registrations: PlayerRegistrationApiRow[] }>("/admin/player-registrations"),
      publicApi<{ fixtures: FixtureApiRow[] }>(`/public/seasons/${selectedSeason.id}/fixtures`),
      publicApi<{ standings: StandingApiRow[] }>(`/public/seasons/${selectedSeason.id}/standings`),
      publicApi<{ player_stats: PlayerSeasonStatApiRow[] }>(`/public/seasons/${selectedSeason.id}/player-stats`)
    ]);
    setAdminData(
      buildAdminSeasonData({
        season: selectedSeason,
        teamRegistrations: teamRegistrationData.team_registrations ?? [],
        playerRegistrations: playerRegistrationData.player_registrations ?? [],
        fixtures: fixtureData.fixtures ?? [],
        standings: standingData.standings ?? [],
        playerStats: playerStatData.player_stats ?? []
      })
    );
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
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "messages", label: "Messages", icon: Mail }
      ] as const,
    []
  );

  const tournamentItems = useMemo(
    () =>
      isGroupKnockout
        ? ([
            { id: "groups", label: "Groups", icon: Users },
            { id: "knockout", label: "Knockout Bracket", icon: GitBranch }
          ] as const)
        : [],
    [isGroupKnockout]
  );

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
		          {activeTab === "teams" ? <TeamsView season={season} teams={adminData.teams} onKickOutTeam={kickOutTeam} onSendTeamMessage={sendTeamMessage} onPlayerDecision={decidePlayerRequest} onPlayerAbility={ratePlayer} onPlayerAction={(action, player) => setPlayerAction({ action, player })} onAbilityScoresUpdate={updateAbilityScores} /> : null}
	          {activeTab === "team-requests" ? <TeamRequestsView teamRequests={adminData.teamRequests} onDecision={decideTeamRequest} /> : null}
	          {activeTab === "player-requests" ? <PlayerRequestsView playerRequests={adminData.playerRequests} onDecision={decidePlayerRequest} onAbility={ratePlayer} onPlayerAction={(action, player) => setPlayerAction({ action, player })} /> : null}
          {activeTab === "fixtures" ? <FixturesView fixtures={adminData.fixtures} teams={adminData.teams} onGenerateFixtures={generateFixtures} onScheduleFixture={scheduleFixture} onPostponeFixture={postponeFixture} onCancelFixture={cancelFixture} /> : null}
          {activeTab === "matches-ready" ? <MatchesReadyView matches={adminData.readyMatches} /> : null}
          {activeTab === "standings" ? <StandingsView groupMode={isGroupKnockout} teams={adminData.standings} /> : null}
          {activeTab === "reports" ? <ReportsView data={adminData} /> : null}
          {activeTab === "messages" ? <MessagesView messages={adminData.messages} /> : null}
          {activeTab === "groups" ? <GroupsView teams={adminData.teams} /> : null}
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

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <FeatureCard title="Current Table Topper" icon={<Trophy size={20} />} className="xl:col-span-1">
          {tableTopper ? (
            <>
              <div className="flex items-center gap-6">
                <TeamBadge name={tableTopper.short || tableTopper.name} size="xl" />
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

        <FeatureCard title="Top Scorer" icon={<Target size={20} />} iconTone="green">
          {data.topScorer ? (
            <>
              <PlayerHero name={data.topScorer.name} team={data.topScorer.team} shirt="-" color="blue" />
              <StatStrip stats={[[String(data.topScorer.goals), "Goals"], [String(data.topScorer.matches), "Matches"]]} />
            </>
          ) : <EmptyState label="No scorer data yet." />}
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
  onPlayerAction,
  onAbilityScoresUpdate
}: {
  season: SeasonDto;
  teams: AdminTeam[];
  onKickOutTeam: (id: string) => Promise<void>;
  onSendTeamMessage: (id: string) => Promise<void>;
  onPlayerDecision: (id: string, status: "APPROVED" | "REJECTED") => Promise<void>;
  onPlayerAbility: (id: string, ability: "LOW" | "MODERATE" | "HIGH") => Promise<void>;
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
  onPlayerAction: (action: PlayerLifecycleAction, player: AdminPlayer) => void;
  onAbilityScoresUpdate: (id: string, scores: Record<string, number>) => Promise<void>;
  onOpenPlayer: (playerId: string) => void;
}) {
  const approvedPlayers = team.players.filter((player) => player.approvalStatus === "Approved");
  const pendingPlayers = team.players.filter((player) => player.approvalStatus === "Pending");
  const [playerPanel, setPlayerPanel] = useState<"approved" | "pending" | null>(null);

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

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Team Profile">
          <div className="grid gap-3">
            <InfoBox label="Team Name" value={team.name} />
            <InfoBox label="Team Status" value={team.status} />
            <InfoBox label="Squad Count" value={String(team.squadCount)} />
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

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Panel title="Approved Players" action="View all" onAction={() => setPlayerPanel("approved")}>
          <PlayerMiniTable players={approvedPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} />
        </Panel>

        <Panel title="Pending Player Requests" action="Review all" onAction={() => setPlayerPanel("pending")}>
          <PlayerMiniTable players={pendingPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} pending />
        </Panel>
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
            <PlayerMiniTable players={playerPanel === "approved" ? approvedPlayers : pendingPlayers} onOpenPlayer={onOpenPlayer} onDecision={onPlayerDecision} onAbility={onPlayerAbility} onPlayerAction={onPlayerAction} pending={playerPanel === "pending"} />
          </div>
        </div>
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
                  <DetailRow key={ability.label} label={ability.label} value={ability.value} />
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
            {["Player", "Code", "Position", "Jersey", "Status", "Actions"].map((header) => (
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
                  className="font-black text-indigo-700 transition hover:text-indigo-950"
                >
                  {player.fullName}
                </button>
              </td>
              <td className="px-4 py-3">{player.code}</td>
	              <td className="px-4 py-3">{player.footballPosition}</td>
              <td className="px-4 py-3">#{player.jerseyNumber}</td>
              <td className="px-4 py-3"><StatusPill tone={player.approvalStatus === "Approved" ? "green" : "orange"}>{player.approvalStatus}</StatusPill></td>
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

function PlayerAvatar({ player }: { player: AdminPlayer }) {
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-600 to-sky-400 text-xl font-black text-white shadow-lg">
      {player.avatar}
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-black transition-all duration-200 ${
        active ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-white hover:text-indigo-700"
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
        selected ? "border-green-300 bg-green-100 text-green-800 ring-2 ring-green-200" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
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
        columns={["Player Code", "Player Name", "Team Name", "Position", "Jersey", "ID Type", "Approval", "Actions"]}
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

function FixturesView({
  fixtures,
  teams,
  onGenerateFixtures,
  onScheduleFixture,
  onPostponeFixture,
  onCancelFixture
}: {
  fixtures: FixtureRow[];
  teams: AdminTeam[];
  onGenerateFixtures: () => Promise<void>;
  onScheduleFixture: (id: string, currentVenue: string) => Promise<void>;
  onPostponeFixture: (id: string, currentVenue: string) => Promise<void>;
  onCancelFixture: (id: string) => Promise<void>;
}) {
  const [showTeams, setShowTeams] = useState(false);
  const [openFixture, setOpenFixture] = useState<FixtureRow | null>(null);
  return (
    <div>
      <PageTitle title="Fixtures" subtitle="Generate, schedule, postpone, cancel, and review all matches." />
      <div className="mb-5 flex gap-3">
        <button type="button" onClick={() => void onGenerateFixtures()} className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98]">Generate Fixtures</button>
        <button type="button" onClick={() => setShowTeams(true)} className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]">Check Team List</button>
      </div>
      <CrudPage
        title="Fixture List"
        subtitle="Completed matches stay inside Fixtures."
        columns={["Date", "Home", "Away", "Stage", "Venue", "Status", "Actions"]}
        rows={fixtures.map((row) => [
          row.date,
          row.home,
          row.away,
          row.stage,
          row.venue,
          <StatusPill key="status" tone={row.status === "Completed" ? "green" : row.status === "Postponed" ? "orange" : "blue"}>{row.status}</StatusPill>,
          <ActionGroup
            key="actions"
            actions={[
              { label: "Edit Date", onClick: () => void onScheduleFixture(row.id, row.venue) },
              { label: "Edit Venue", onClick: () => void onScheduleFixture(row.id, row.venue) },
              { label: "Postpone", onClick: () => void onPostponeFixture(row.id, row.venue) },
              { label: "Cancel", onClick: () => void onCancelFixture(row.id), danger: true },
              { label: "Open", onClick: () => setOpenFixture(row) }
            ]}
          />
        ])}
      />
      {showTeams ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div className="max-h-[86vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">Approved Team List</p>
                <h2 className="mt-1 text-2xl font-black">Teams available for fixture generation</h2>
              </div>
              <button type="button" onClick={() => setShowTeams(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">Close</button>
            </div>
            {teams.length === 0 ? <EmptyState label="No approved teams yet. Approve teams first before generating fixtures." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>{["Team", "Manager", "Squad", "Approved", "Pending"].map((header) => <th key={header} className="px-4 py-3 text-left font-black">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teams.map((team) => (
                      <tr key={team.id}>
                        <td className="px-4 py-3"><TeamCompact name={team.name} logoUrl={team.logoUrl} /></td>
                        <td className="px-4 py-3 font-semibold">{team.managerName}</td>
                        <td className="px-4 py-3">{team.squadCount}</td>
                        <td className="px-4 py-3">{team.approvedPlayers}</td>
                        <td className="px-4 py-3">{team.pendingPlayers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {openFixture ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">Fixture Detail</p>
                <h2 className="mt-1 text-2xl font-black">{openFixture.home} vs {openFixture.away}</h2>
              </div>
              <button type="button" onClick={() => setOpenFixture(null)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-black transition hover:bg-slate-200">Close</button>
            </div>
            <div className="grid gap-3">
              <DetailRow label="Date" value={openFixture.date} />
              <DetailRow label="Stage" value={openFixture.stage} />
              <DetailRow label="Venue" value={openFixture.venue} />
              <DetailRow label="Status" value={openFixture.status} />
            </div>
          </div>
        </div>
      ) : null}
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
                <DetailRow key={ability.label} label={ability.label} value={ability.value} />
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

function MatchesReadyView({ matches }: { matches: ReadyMatchRow[] }) {
  return (
    <div>
      <PageTitle title="Matches Ready" subtitle="Matches appear here only after both lineups are confirmed." />
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
                className="rounded-md bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98]"
              >
                Simulate Match
              </button>
            </div>
          </Panel>
        ))}
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

function ReportsView({ data }: { data: AdminSeasonData }) {
  const reportRows = [
    ...(data.topScorer ? [["Top Scorer", data.topScorer.name, `${data.topScorer.goals} goals`]] : []),
    ...(data.topRated ? [["Top Rated Player", data.topRated.name, `${data.topRated.rating} rating`]] : []),
    ["Approved Teams", "Season", `${data.teams.length} teams`],
    ["Completed Matches", "Season", `${data.completedMatches.length} matches`],
    ["Pending Player Requests", "Season", `${data.playerRequests.length} requests`]
  ] as Array<[string, string, string]>;

  return (
    <CrudPage
      title="Reports"
      subtitle="Reports update after confirmed match results."
      columns={["Report", "Leader", "Metric"]}
      rows={reportRows}
    />
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

function GroupsView({ teams }: { teams: AdminTeam[] }) {
  return (
    <div>
      <PageTitle title="Groups" subtitle="Generate groups, lock groups, then generate group fixtures." />
      <div className="mb-5 flex gap-3">
        <button className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow transition-all duration-200 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 active:translate-y-0 active:scale-[0.98]">Generate Groups</button>
        <button className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]">Lock Groups</button>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Group A">
          {teams.length === 0 ? <EmptyState label="No approved teams available for group assignment." /> : teams.slice(0, Math.ceil(teams.length / 2)).map((team) => (
            <div key={team.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
              <TeamCompact name={team.name} />
              <StatusPill tone="blue">Available</StatusPill>
            </div>
          ))}
        </Panel>
        <Panel title="Group B">
          {teams.length === 0 ? <EmptyState label="No approved teams available for group assignment." /> : teams.slice(Math.ceil(teams.length / 2)).map((team) => (
            <div key={team.id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
              <TeamCompact name={team.name} />
              <StatusPill tone="blue">Available</StatusPill>
            </div>
          ))}
        </Panel>
      </div>
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
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "orange" | "purple" | "cyan";
  action: string;
  onAction?: () => void;
}) {
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
        <div className={`grid h-[70px] w-[70px] place-items-center rounded-xl ${tones[color]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="min-h-[48px] text-base font-black leading-snug">{label}</p>
          <p className={`mt-2 text-4xl font-black ${text[color]}`}>{value}</p>
        </div>
      </div>
      <div className="my-4 h-px bg-slate-200" />
      <button className="w-full rounded-lg py-2 text-center text-sm font-bold text-indigo-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-900 active:translate-y-0 active:scale-[0.98]" onClick={onAction}>
        {action} →
      </button>
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
      className={`group flex w-full items-center gap-4 rounded-md px-4 py-3 text-left text-base transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
        active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-950/20" : "text-slate-100 hover:bg-white/10 hover:shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
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
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-black text-green-700">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
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
