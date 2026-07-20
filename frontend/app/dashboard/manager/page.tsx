"use client";

import {
  CSSProperties,
  DragEvent,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Star,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import {
  FootballPosition,
  fixtureOutcomeLabel,
  fixtureOutcomeScore,
  PreferredFoot,
  RegistrationStatus,
} from "@flms/shared";
import { api } from "@/lib/api";
import { clearAuth, updateStoredProfile } from "@/lib/auth";
import { OwnGoalIcon } from "@/components/ui/own-goal-icon";
import { PenaltyMissIcon } from "@/components/ui/penalty-miss-icon";
import {
  KnockoutBracket,
  type KnockoutBracketFixture,
} from "@/components/knockout-bracket";
import { PlayerSeasonContributionBadges } from "@/components/player-season-contribution-badges";

type Section =
  | "Dashboard"
  | "My Team"
  | "Players"
  | "Fixtures"
  | "Knockout Bracket"
  | "Submit Lineup"
  | "Results"
  | "Standings"
  | "Other Teams"
  | "Player Stats"
  | "Team Stats"
  | "Messages"
  | "Profile & Settings";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at?: string;
}

interface League {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  seasons?: Season[];
}

interface Season {
  id: string;
  name: string;
  season_year: number | null;
  format: string;
  phase?: string;
  max_players_per_team: number | null;
  lineup_size?: number | null;
  substitute_limit?: number | null;
  leagues?: League | League[] | null;
}

interface TeamRecord {
  id: string;
  season_id: string;
  team_id: string;
  manager_id: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
  teams?: {
    id: string;
    name: string;
    short_name: string;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    home_jersey_url?: string | null;
    away_jersey_url?: string | null;
    gk_home_jersey_url?: string | null;
    gk_away_jersey_url?: string | null;
  } | null;
  seasons?: Season | Season[] | null;
  manager?:
    | { id: string; full_name?: string | null; email?: string | null }
    | Array<{ id: string; full_name?: string | null; email?: string | null }>
    | null;
}

interface PlayerRecord {
  id: string;
  player_id: string;
  team_registration_id?: string;
  season_id?: string;
  position: string;
  football_position?: FootballPosition | null;
  position_category?: string | null;
  shirt_number: number | null;
  status: string;
  preferred_foot?: PreferredFoot | null;
  player_status?: string | null;
  player_code?: string | null;
  identity_mode?: string | null;
  is_generated?: boolean | null;
  created_at: string;
  rejection_reason?: string | null;
  removal_reason?: string | null;
  suspension_reason?: string | null;
  suspension_type?: string | null;
  suspension_until?: string | null;
  suspension_matches_remaining?: number | null;
  active_injury?: {
    id?: string;
    injury_type?: string | null;
    severity?: string | null;
    minute?: number | null;
    expected_matches_out?: number | null;
  } | null;
  active_suspension?: {
    reason?: string | null;
    suspension_type?: string | null;
    suspension_until?: string | null;
    suspension_matches_remaining?: number | null;
  } | null;
  league_rating?: number | null;
  season_goals?: number;
  season_assists?: number;
  overall_rating?: number | null;
  players?: {
    full_name: string;
    date_of_birth?: string | null;
    id_type?: string | null;
    id_number_last4?: string | null;
    generated_identity_number?: string | null;
    avatar_url?: string | null;
  } | null;
  player_abilities?: Array<{
    rating_tier?: "LOW" | "MODERATE" | "HIGH" | null;
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
  }> | null;
}

type PlayingStyle =
  | "BALANCED"
  | "HOLDING_POSSESSION"
  | "COUNTER_ATTACKING"
  | "HIGH_PRESS"
  | "TIKI_TAKA"
  | "WING_PLAY"
  | "LOW_BLOCK";

interface FormationSlot {
  slotKey: string;
  displayRole: string;
  line: "GK" | "DEF" | "MID" | "ATT";
  x: number;
  y: number;
  primaryPositions: FootballPosition[];
  compatiblePositions: FootballPosition[];
  emergencyPositions: FootballPosition[];
}

interface LineupSelection {
  player_registration_id: string;
  is_starter: boolean;
  position: string;
  slot_key?: string | null;
  display_role?: string | null;
  player_natural_position?: FootballPosition | null;
  display_order?: number | null;
  is_captain?: boolean | null;
  fit_label?: string | null;
  score?: number | null;
}

interface LineupBuilderPayload {
  match: FixtureRecord;
  team: TeamRecord;
  previousLineup: unknown | null;
  existingLineup: unknown | null;
  preferredFormation: string;
  preferredPlayingStyle: PlayingStyle;
  selectedFormation: string;
  selectedPlayingStyle: PlayingStyle;
  availableFormations: Record<string, string>;
  availablePlayingStyles: Record<PlayingStyle, string>;
  formationSlots: FormationSlot[];
  approvedPlayers: PlayerRecord[];
  unavailablePlayers?: PlayerRecord[];
  discipline?: {
    phase: "LEAGUE" | "GROUP" | "KNOCKOUT";
    yellow_card_suspension_threshold: number;
    players: Array<{
      player_registration_id: string;
      full_name: string;
      avatar_url?: string | null;
      shirt_number?: number | null;
      yellow_cards: number;
      total_phase_yellow_cards: number;
      suspended_for_accumulation?: boolean;
    }>;
  };
  benchSize: number;
  initialLineupMode: string;
  warnings: string[];
  initialLineup: {
    formation: string;
    playing_style: PlayingStyle;
    penalty_taker_ids?: string[];
    free_kick_taker_ids?: string[];
    players: LineupSelection[];
  };
}

interface LineupAlternativesPayload {
  slot: FormationSlot;
  alternatives: Array<{
    player: PlayerRecord;
    natural_position: FootballPosition;
    fitScore: number;
    fitLabel: string;
    score: number;
  }>;
}

type PositionBreakdown = Record<FootballPosition, number>;

interface SquadSummary {
  total: number;
  approved: number;
  pending: number;
  draft: number;
  rejected: number;
  removed: number;
  suspended: number;
  max_squad_size: number;
  remaining_slots: number;
  distribution?: {
    goalkeepers: number;
    defenders: number;
    midfielders: number;
    forwards: number;
  };
}

interface FixtureRecord {
  id: string;
  round_no: number;
  stage: string;
  kickoff_at: string | null;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  extra_time_played?: boolean | null;
  penalties_home?: number | null;
  penalties_away?: number | null;
  penalty_winner_team_registration_id?: string | null;
  home_team_registration_id: string;
  away_team_registration_id: string;
  home_team?: { id: string; teams?: TeamRecord["teams"] } | null;
  away_team?: { id: string; teams?: TeamRecord["teams"] } | null;
  lineups?: Array<{
    team_registration_id: string;
    status: string;
    formation: string;
    playing_style?: string | null;
  }>;
}

type MatchDetailLineupPlayer = {
  id: string;
  player_registration_id: string;
  is_starter?: boolean | null;
  shirt_number?: number | null;
  football_position?: string | null;
  player_natural_position?: string | null;
  display_role?: string | null;
  slot_key?: string | null;
  is_captain?: boolean | null;
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
  formation?: string | null;
  playing_style?: string | null;
  status?: string | null;
  formation_slots?: Array<{
    slotKey: string;
    displayRole: string;
    line: "GK" | "DEF" | "MID" | "ATT";
    x: number;
    y: number;
  }> | null;
  lineup_players?: MatchDetailLineupPlayer[] | null;
};

function managerLineupForFixtureTeam(
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

type MatchDetailPayload = {
  fixture: FixtureRecord;
  lineups: MatchDetailLineup[];
  team_stats: MatchDetailTeamStat[];
  player_stats: MatchDetailPlayerStat[];
  events: Record<string, unknown>[];
  substitutions: Record<string, unknown>[];
};

interface SeasonGroupRecord {
  id: string;
  name: string;
  teams: Array<{
    id: string;
    seed_no?: number | null;
    team_registration?: TeamRecord | null;
  }>;
}

interface StandingRecord {
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
  head_to_head_points?: number;
  position?: number;
  group_id?: string | null;
  group_name?: string | null;
  team_registrations?: { id: string; teams?: TeamRecord["teams"] } | null;
}

interface MessageRecord {
  id: string;
  related_type: string;
  message: string;
  read_at: string | null;
  created_at: string;
  sender_role?: string | null;
  parent_message_id?: string | null;
  team_registration_id?: string | null;
  fixtures?:
    | {
        id: string;
        kickoff_at?: string | null;
      }
    | Array<{
        id: string;
        kickoff_at?: string | null;
      }>
    | null;
  player_season_registrations?:
    | {
        id: string;
        players?: {
          full_name?: string | null;
          avatar_url?: string | null;
        } | null;
      }
    | Array<{
        id: string;
        players?: {
          full_name?: string | null;
          avatar_url?: string | null;
        } | null;
      }>
    | null;
}

interface DashboardPayload {
  profile: Profile;
  active_team: TeamRecord | null;
  teams: TeamRecord[];
  squad_summary: SquadSummary | null;
  fixtures: FixtureRecord[];
  results: FixtureRecord[];
  standings: StandingRecord[];
  messages: MessageRecord[];
}

interface ManagerTheme {
  primary: string;
  secondary: string;
  accent: string;
}

const defaultManagerTheme: ManagerTheme = {
  primary: "#6D28D9",
  secondary: "#111827",
  accent: "#F59E0B",
};

const managerThemeStorageKey = "scoreline-manager-team-theme";

function readCachedManagerTheme(): ManagerTheme {
  if (typeof window === "undefined") return defaultManagerTheme;
  try {
    const cached = JSON.parse(
      window.localStorage.getItem(managerThemeStorageKey) ?? "null",
    ) as Partial<ManagerTheme> | null;
    return {
      primary: normalizeThemeColor(
        cached?.primary,
        defaultManagerTheme.primary,
      ),
      secondary: normalizeThemeColor(
        cached?.secondary,
        defaultManagerTheme.secondary,
      ),
      accent: normalizeThemeColor(cached?.accent, defaultManagerTheme.accent),
    };
  } catch {
    return defaultManagerTheme;
  }
}

function themeFromTeam(team: TeamRecord | null | undefined): ManagerTheme {
  return {
    primary: normalizeThemeColor(
      team?.teams?.primary_color,
      defaultManagerTheme.primary,
    ),
    secondary: normalizeThemeColor(
      team?.teams?.secondary_color,
      defaultManagerTheme.secondary,
    ),
    accent: normalizeThemeColor(
      team?.teams?.accent_color,
      defaultManagerTheme.accent,
    ),
  };
}

function normalizeThemeColor(
  color: string | null | undefined,
  fallback: string,
): string {
  return color && /^#[0-9a-f]{6}$/iu.test(color.trim())
    ? color.trim().toUpperCase()
    : fallback;
}

interface TeamViewPayload {
  team: TeamRecord;
  players: PlayerRecord[];
  fixtures: FixtureRecord[];
  results: FixtureRecord[];
  squad_summary: SquadSummary;
}

interface PlayerLeagueStatsPayload {
  season_stats: Record<string, number | string | null> | null;
  match_stats: Array<Record<string, any>>;
}

interface PlayerProfilePayload extends PlayerLeagueStatsPayload {
  player: PlayerRecord;
  overall_rating: number | null;
  league_rating: number | null;
  can_view_ability_scores: boolean;
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

interface ManagerStatsReport {
  player_sections: StatSectionData[];
  team_sections: StatSectionData[];
}

const menu: { label: Section; icon: ReactNode }[] = [
  { label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "My Team", icon: <ShieldAlert size={18} /> },
  { label: "Players", icon: <Users size={18} /> },
  { label: "Fixtures", icon: <CalendarDays size={18} /> },
  { label: "Knockout Bracket", icon: <GitBranch size={18} /> },
  { label: "Submit Lineup", icon: <Home size={18} /> },
  { label: "Results", icon: <Trophy size={18} /> },
  { label: "Standings", icon: <CheckCircle2 size={18} /> },
  { label: "Player Stats", icon: <BarChart3 size={18} /> },
  { label: "Team Stats", icon: <ShieldAlert size={18} /> },
  { label: "Messages", icon: <Mail size={18} /> },
  { label: "Profile & Settings", icon: <User size={18} /> },
];

const managerSectionPaths: Record<Exclude<Section, "Other Teams">, string> = {
  Dashboard: "/dashboard/manager",
  "My Team": "/dashboard/manager/my-team",
  Players: "/dashboard/manager/players",
  Fixtures: "/dashboard/manager/fixtures",
  "Knockout Bracket": "/dashboard/manager/knockout-bracket",
  "Submit Lineup": "/dashboard/manager/submit-lineup",
  Results: "/dashboard/manager/results",
  Standings: "/dashboard/manager/standings",
  "Player Stats": "/dashboard/manager/player-stats",
  "Team Stats": "/dashboard/manager/team-stats",
  Messages: "/dashboard/manager/messages",
  "Profile & Settings": "/dashboard/manager/profile",
};

const positions = [
  FootballPosition.GK,
  FootballPosition.CB,
  FootballPosition.LB,
  FootballPosition.RB,
  FootballPosition.DM,
  FootballPosition.CM,
  FootballPosition.AM,
  FootballPosition.LW,
  FootballPosition.RW,
  FootballPosition.ST,
];

const teamColorPalette = [
  "#FFFFFF",
  "#FAFAFA",
  "#F8FAFC",
  "#F1F5F9",
  "#E2E8F0",
  "#E5E7EB",
  "#D1D5DB",
  "#CBD5E1",
  "#F3F4F6",
  "#F5F5F5",
  "#111827",
  "#1F2937",
  "#374151",
  "#4B5563",
  "#6B7280",
  "#0F172A",
  "#1E293B",
  "#334155",
  "#475569",
  "#64748B",
  "#581C87",
  "#6D28D9",
  "#7E22CE",
  "#9333EA",
  "#A855F7",
  "#1E3A8A",
  "#1D4ED8",
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#164E63",
  "#0891B2",
  "#06B6D4",
  "#22D3EE",
  "#67E8F9",
  "#064E3B",
  "#047857",
  "#059669",
  "#10B981",
  "#34D399",
  "#14532D",
  "#15803D",
  "#16A34A",
  "#22C55E",
  "#4ADE80",
  "#713F12",
  "#B45309",
  "#D97706",
  "#F59E0B",
  "#FBBF24",
  "#7C2D12",
  "#C2410C",
  "#EA580C",
  "#F97316",
  "#FB923C",
  "#7F1D1D",
  "#B91C1C",
  "#DC2626",
  "#EF4444",
  "#F87171",
  "#831843",
  "#BE185D",
  "#DB2777",
  "#EC4899",
  "#F472B6",
];

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function statusClass(status?: string | null) {
  if (status === "APPROVED" || status === "ACTIVE" || status === "CONFIRMED")
    return "bg-green-50 text-green-700 ring-green-200";
  if (status === "PENDING" || status === "SUBMITTED")
    return "bg-yellow-50 text-yellow-700 ring-yellow-200";
  if (status === "DRAFT") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (
    status === "REJECTED" ||
    status === "REMOVED" ||
    status === "SUSPENDED" ||
    status === "KICKED_OUT"
  ) {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  return "bg-purple-50 text-purple-700 ring-purple-200";
}

function cleanUrl(value: string) {
  return value.trim() || null;
}

type TeamJerseyFields = Pick<
  NonNullable<TeamRecord["teams"]>,
  | "home_jersey_url"
  | "away_jersey_url"
  | "gk_home_jersey_url"
  | "gk_away_jersey_url"
>;

function assertJerseySave(
  requested: TeamJerseyFields,
  saved: TeamJerseyFields | null | undefined,
) {
  const hasRequestedJersey = Object.values(requested).some(Boolean);
  if (!hasRequestedJersey) return;
  if (!saved) {
    throw new Error(
      "Jersey URLs were not saved. Restart the backend/frontend and try again.",
    );
  }
  const fields = [
    "home_jersey_url",
    "away_jersey_url",
    "gk_home_jersey_url",
    "gk_away_jersey_url",
  ] as const;
  const failed = fields.some(
    (field) => (requested[field] ?? null) !== (saved[field] ?? null),
  );
  if (failed) {
    throw new Error(
      "Jersey URLs were not saved by the server. Restart pnpm dev, then submit again.",
    );
  }
}

function displayPlayerStatus(player: PlayerRecord) {
  if (
    player.player_status === "REMOVED" ||
    player.player_status === "SUSPENDED"
  )
    return player.player_status;
  return player.status;
}

function availabilityLabel(player: PlayerRecord) {
  if (player.active_injury) {
    const matchesOut = Number(player.active_injury.expected_matches_out ?? 0);
    const injuryType = (player.active_injury.injury_type ?? "INJURY")
      .replaceAll("_", " ")
      .toLowerCase();
    return `✚ ${injuryType} · out for ${matchesOut} match${matchesOut === 1 ? "" : "es"}`;
  }
  if (player.active_suspension) {
    if (player.active_suspension.suspension_type === "NEXT_MATCHES") {
      const remaining = Number(
        player.active_suspension.suspension_matches_remaining ?? 0,
      );
      return `Suspended · ${remaining} match${remaining === 1 ? "" : "es"} left`;
    }
    if (player.active_suspension.suspension_type === "UNTIL_DATE") {
      return `Suspended until ${player.active_suspension.suspension_until ?? "-"}`;
    }
    return "Suspended until admin unsuspends";
  }
  return player.player_status ?? "Unavailable";
}

function playerOverall(player: PlayerRecord) {
  return (
    player.overall_rating ??
    one(player.player_abilities)?.overall_rating ??
    null
  );
}

function ratingTierFromOverall(overall?: number | null) {
  if (overall === null || overall === undefined) return null;
  if (overall >= 73) return "HIGH";
  if (overall >= 55) return "MODERATE";
  return "LOW";
}

function playerAbility(player: PlayerRecord) {
  return one(player.player_abilities);
}

function rankSetPieceTakers(
  approvedPlayers: PlayerRecord[],
  selectedPlayers: LineupSelection[],
) {
  const selectedIds = new Set(
    selectedPlayers.map((player) => player.player_registration_id),
  );
  return approvedPlayers
    .filter((player) => selectedIds.has(player.id))
    .sort((a, b) => {
      const shootingDifference =
        Number(playerAbility(b)?.shooting ?? 0) -
        Number(playerAbility(a)?.shooting ?? 0);
      if (shootingDifference) return shootingDifference;
      const overallDifference =
        Number(playerOverall(b) ?? 0) - Number(playerOverall(a) ?? 0);
      if (overallDifference) return overallDifference;
      return a.id.localeCompare(b.id);
    })
    .map((player) => player.id);
}

function mergeTakerOrder(savedIds: string[] | undefined, rankedIds: string[]) {
  const validIds = new Set(rankedIds);
  const saved = (savedIds ?? []).filter(
    (id, index, ids) => validIds.has(id) && ids.indexOf(id) === index,
  );
  return [...saved, ...rankedIds.filter((id) => !saved.includes(id))];
}

function playerRatingTier(player: PlayerRecord) {
  return (
    one(player.player_abilities)?.rating_tier ??
    ratingTierFromOverall(playerOverall(player))
  );
}

function naturalPlayerPosition(player: PlayerRecord): FootballPosition {
  if (player.football_position) return player.football_position;
  if (player.position === "GK") return FootballPosition.GK;
  if (player.position === "DEF") return FootballPosition.CB;
  if (player.position === "MID") return FootballPosition.CM;
  return FootballPosition.ST;
}

function coarseFromNatural(position: FootballPosition) {
  if (position === FootballPosition.GK) return "GK";
  if (
    position === FootballPosition.CB ||
    position === FootballPosition.LB ||
    position === FootballPosition.RB
  )
    return "DEF";
  if (
    position === FootballPosition.DM ||
    position === FootballPosition.CM ||
    position === FootballPosition.AM
  )
    return "MID";
  return "FWD";
}

function fitBorderClass(fit?: string | null) {
  if (!fit) return "border-white/70";
  if (fit.includes("Exact") || fit.includes("Role"))
    return "border-emerald-300";
  if (fit.includes("Compatible")) return "border-yellow-300";
  if (fit.includes("Emergency")) return "border-orange-300";
  return "border-red-300";
}

function overallCapsule(value?: number | null, tier?: string | null) {
  if (value === null || value === undefined)
    return <span className="text-xs font-bold text-slate-400">N/A</span>;
  const cls =
    tier === "HIGH"
      ? "bg-sky-100 text-sky-700 ring-sky-200"
      : tier === "MODERATE"
        ? "bg-green-100 text-green-700 ring-green-200"
        : "bg-amber-100 text-amber-700 ring-amber-200";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${cls}`}
    >
      {value}
    </span>
  );
}

function leagueRatingCapsule(
  value: unknown,
  options: { prefix?: string; fallback?: string } = {},
) {
  const numeric = Number(value);
  const { prefix = "LG", fallback = "—" } = options;
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(numeric)
  ) {
    return (
      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
        {prefix ? `${prefix} ${fallback}` : fallback}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-black text-white shadow-sm ${managerRatingBadgeClass(numeric)}`}
      title="Average league rating"
    >
      {prefix ? `${prefix} ` : ""}
      {managerFormatRating(numeric)}
    </span>
  );
}

function overallCapsuleClass(tier?: string | null) {
  return tier === "HIGH"
    ? "bg-sky-100 text-sky-700 ring-sky-200"
    : tier === "MODERATE"
      ? "bg-green-100 text-green-700 ring-green-200"
      : "bg-amber-100 text-amber-700 ring-amber-200";
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function initials(name?: string | null) {
  return (name ?? "NA")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function opponentName(fixture: FixtureRecord, activeTeamId?: string) {
  const opponent =
    fixture.home_team_registration_id === activeTeamId
      ? fixture.away_team
      : fixture.home_team;
  return opponent?.teams?.name ?? "Opponent pending";
}

function matchLabel(fixture: FixtureRecord) {
  return `${fixture.home_team?.teams?.name ?? "Home"} vs ${fixture.away_team?.teams?.name ?? "Away"}`;
}

function matchStageLabel(stage?: string | null) {
  const normalized = (stage ?? "").toUpperCase();
  const labels: Record<string, string> = {
    GROUP: "Group",
    LEAGUE: "League",
    ROUND_OF_64: "Round of 64",
    ROUND_OF_32: "Round of 32",
    ROUND_OF_16: "Round of 16",
    QUARTER_FINAL: "Quarter Final",
    SEMI_FINAL: "Semi Final",
    FINAL: "Final",
  };
  return labels[normalized] ?? (normalized.replaceAll("_", " ") || "Match");
}

function teamName(team?: TeamRecord["teams"] | null) {
  return team?.name ?? "Team";
}

function TeamLogoName({
  team,
  teamId,
  onTeamClick,
  muted = false,
}: {
  team?: TeamRecord["teams"] | null | undefined;
  teamId?: string | null | undefined;
  onTeamClick?: ((teamId: string) => void) | undefined;
  muted?: boolean;
}) {
  const text = (
    <span className="min-w-0">
      <span
        className={`block truncate font-black ${muted ? "text-slate-600" : "text-slate-950"}`}
      >
        {teamName(team)}
      </span>
      {team?.short_name ? (
        <span className="block text-xs font-bold text-slate-500">
          {team.short_name}
        </span>
      ) : null}
    </span>
  );
  if (teamId && onTeamClick) {
    return (
      <div className="flex max-w-full items-center gap-3">
        <Avatar name={teamName(team)} src={team?.logo_url} small />
        <button
          type="button"
          className="min-w-0 text-left transition hover:text-[var(--team-primary)] hover:underline"
          onClick={() => onTeamClick(teamId)}
        >
          {text}
        </button>
      </div>
    );
  }
  return (
    <div className="flex max-w-full items-center gap-3">
      <Avatar name={teamName(team)} src={team?.logo_url} small />
      {text}
    </div>
  );
}

export default function ManagerDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ matchId?: string | string[] }>();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [teamDetail, setTeamDetail] = useState<{
    players: PlayerRecord[];
    squad_summary: SquadSummary;
  } | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [managerTheme, setManagerTheme] = useState<ManagerTheme>(
    readCachedManagerTheme,
  );
  const [message, setMessage] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(
    null,
  );
  const [selectedTeamViewId, setSelectedTeamViewId] = useState<string | null>(
    null,
  );
  const [teamView, setTeamView] = useState<TeamViewPayload | null>(null);
  const [teamViewLoading, setTeamViewLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<FixtureRecord | null>(
    null,
  );
  const [matchDetail, setMatchDetail] = useState<MatchDetailPayload | null>(
    null,
  );
  const [matchDetailLoading, setMatchDetailLoading] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] =
    useState<MessageRecord | null>(null);
  const [dismissedAvailabilityNoticeIds, setDismissedAvailabilityNoticeIds] =
    useState<Set<string>>(() => new Set());
  const [hasPresentedAvailabilityNotice, setHasPresentedAvailabilityNotice] =
    useState(false);
  const [matchBackOrigin, setMatchBackOrigin] = useState<string | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const routeMatchId = pathname.startsWith("/dashboard/manager/results/")
    ? Array.isArray(params.matchId)
      ? params.matchId[0]
      : params.matchId
    : undefined;
  const section: Section = selectedTeamViewId
    ? "Other Teams"
    : sectionFromPath(pathname);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavigationOpen]);

  function navigateSection(nextSection: Section) {
    setMobileNavigationOpen(false);
    if (nextSection === "Other Teams") return;
    setSelectedTeamViewId(null);
    setTeamView(null);
    router.push(managerSectionPaths[nextSection]);
  }

  async function load() {
    setLoading(true);
    setMessage("");
    const [dashboard, leagueData] = await Promise.all([
      api<DashboardPayload>("/manager/dashboard"),
      api<{ leagues: League[] }>("/manager/leagues"),
    ]);
    setPayload(dashboard);
    setLeagues(leagueData.leagues);
    const activeId = selectedTeamId || dashboard.active_team?.id || "";
    setSelectedTeamId(activeId);
    if (activeId) {
      const detail = await api<{
        players: PlayerRecord[];
        squad_summary: SquadSummary;
      }>(`/manager/teams/${activeId}`);
      setTeamDetail({
        players: detail.players,
        squad_summary: detail.squad_summary,
      });
    } else {
      setTeamDetail(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => {
      setMessage(
        error instanceof Error ? error.message : "Failed to load manager panel",
      );
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeTeam(teamId: string) {
    setSelectedTeamId(teamId);
    if (!teamId) return setTeamDetail(null);
    const nextTeam = payload?.teams.find((team) => team.id === teamId);
    if (nextTeam) setManagerTheme(themeFromTeam(nextTeam));
    const detail = await api<{
      players: PlayerRecord[];
      squad_summary: SquadSummary;
    }>(`/manager/teams/${teamId}`);
    setTeamDetail({
      players: detail.players,
      squad_summary: detail.squad_summary,
    });
  }

  async function openTeamView(teamId: string) {
    setSelectedTeamViewId(teamId);
    setTeamViewLoading(true);
    setMessage("");
    try {
      const detail = await api<TeamViewPayload>(
        `/manager/teams/${teamId}/view`,
      );
      setTeamView(detail);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to open team",
      );
      setSelectedTeamViewId(null);
      setTeamView(null);
    } finally {
      setTeamViewLoading(false);
    }
  }

  function closeTeamView() {
    setSelectedTeamViewId(null);
    setTeamView(null);
  }

  async function openMatchDetail(
    fixture: FixtureRecord,
    from?: "dashboard" | "results",
  ) {
    if (fixture.status === "FINAL" || from === "results") {
      router.push(
        `/dashboard/manager/results/${fixture.id}?from=${from ?? "results"}`,
      );
      return;
    }
    setSelectedFixture(fixture);
    setMatchDetail(null);
    setMatchDetailLoading(true);
    setMessage("");
    try {
      const detail = await api<MatchDetailPayload>(
        `/manager/matches/${fixture.id}/detail`,
      );
      setMatchDetail(detail);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to open match detail",
      );
    } finally {
      setMatchDetailLoading(false);
    }
  }

  useEffect(() => {
    if (!routeMatchId) return;
    let alive = true;
    setSelectedFixture(null);
    setMatchDetail(null);
    setMatchDetailLoading(true);
    setMessage("");
    api<MatchDetailPayload>(`/manager/matches/${routeMatchId}/detail`)
      .then((detail) => {
        if (!alive) return;
        setMatchDetail(detail);
        setSelectedFixture(detail.fixture);
      })
      .catch((error) => {
        if (!alive) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to open match detail",
        );
      })
      .finally(() => {
        if (alive) setMatchDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [routeMatchId]);

  useEffect(() => {
    setMatchBackOrigin(new URLSearchParams(window.location.search).get("from"));
  }, [pathname]);
  const matchBackToDashboard = matchBackOrigin === "dashboard";
  function closeMatchDetail() {
    setSelectedFixture(null);
    setMatchDetail(null);
    if (routeMatchId) {
      router.push(
        matchBackToDashboard
          ? "/dashboard/manager"
          : "/dashboard/manager/results",
      );
    }
  }

  async function closeAvailabilityNotice() {
    const notice = availabilityNotice;
    if (notice) {
      setDismissedAvailabilityNoticeIds((current) => {
        const next = new Set(current);
        next.add(notice.id);
        return next;
      });
      setPayload((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === notice.id
                  ? {
                      ...item,
                      read_at: item.read_at ?? new Date().toISOString(),
                    }
                  : item,
              ),
            }
          : current,
      );
    }
    setAvailabilityNotice(null);
    if (!notice || notice.read_at) return;
    try {
      await api(`/manager/messages/${notice.id}/read`, { method: "PATCH" });
    } catch {
      // Non-critical: dismissal should not block the manager panel.
    }
  }

  const activeTeam = useMemo(() => {
    return (
      payload?.teams.find((team) => team.id === selectedTeamId) ??
      payload?.active_team ??
      null
    );
  }, [payload, selectedTeamId]);

  useEffect(() => {
    if (!activeTeam) return;
    const nextTheme = themeFromTeam(activeTeam);
    setManagerTheme(nextTheme);
    try {
      window.localStorage.setItem(
        managerThemeStorageKey,
        JSON.stringify(nextTheme),
      );
    } catch {
      // The in-memory palette still prevents loading-state theme resets.
    }
  }, [activeTeam]);

  const activeSeason = one(activeTeam?.seasons);
  const activeLeague = one(activeSeason?.leagues);
  const unreadMessages =
    payload?.messages.filter((item) => !item.read_at).length ?? 0;
  const teamPrimary = managerTheme.primary;
  const teamSecondary = managerTheme.secondary;
  const teamAccent = managerTheme.accent;
  const teamText = getReadableTextColor(teamPrimary);
  const sidebarText = getReadableTextColor(teamSecondary);
  const sidebarUsesDarkText = sidebarText === "#111827";
  const sidebarMutedText = sidebarUsesDarkText ? "#475569" : "#CBD5E1";
  const sidebarBorder = sidebarUsesDarkText
    ? "rgba(15, 23, 42, 0.12)"
    : "rgba(255, 255, 255, 0.12)";
  const sidebarPanel = sidebarUsesDarkText
    ? "rgba(15, 23, 42, 0.04)"
    : "rgba(255, 255, 255, 0.06)";
  const sidebarHover = sidebarUsesDarkText
    ? "rgba(15, 23, 42, 0.08)"
    : "rgba(255, 255, 255, 0.12)";

  useEffect(() => {
    if (
      !payload?.messages?.length ||
      availabilityNotice ||
      hasPresentedAvailabilityNotice
    )
      return;
    const notice = payload.messages.find(
      (item) =>
        !item.read_at &&
        !dismissedAvailabilityNoticeIds.has(item.id) &&
        /injur|suspend|out for|submit your lineup|today is your match|matchday/i.test(
          `${item.related_type} ${item.message}`,
        ),
    );
    if (notice) {
      setAvailabilityNotice(notice);
      setHasPresentedAvailabilityNotice(true);
    }
  }, [
    payload?.messages,
    availabilityNotice,
    dismissedAvailabilityNoticeIds,
    hasPresentedAvailabilityNotice,
  ]);

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-[#F8FAFC] text-slate-950"
      style={
        {
          "--team-primary": teamPrimary,
          "--team-secondary": teamSecondary,
          "--team-accent": teamAccent,
          "--team-primary-text": teamText,
          "--team-sidebar-text": sidebarText,
          "--team-sidebar-muted": sidebarMutedText,
          "--team-sidebar-border": sidebarBorder,
          "--team-sidebar-panel": sidebarPanel,
          "--team-sidebar-hover": sidebarHover,
        } as CSSProperties
      }
    >
      <ManagerSidebar
        profile={payload?.profile ?? null}
        activeTeam={activeTeam}
        activeSeason={activeSeason}
        section={section}
        unreadMessages={unreadMessages}
        onSection={navigateSection}
        mobileOpen={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
      />
      <main className="min-h-screen lg:pl-72">
        <ManagerTopbar
          profile={payload?.profile ?? null}
          teams={payload?.teams ?? []}
          activeTeamId={selectedTeamId}
          activeLeague={activeLeague}
          activeSeason={activeSeason}
          unreadMessages={unreadMessages}
          mobileOpen={mobileNavigationOpen}
          onMenuOpen={() => setMobileNavigationOpen(true)}
          onTeamChange={(teamId) =>
            void changeTeam(teamId).catch((error) => setMessage(error.message))
          }
        />
        <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
          {message ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          ) : null}
          {loading ? (
            <LoadingState label="Loading manager dashboard..." />
          ) : selectedFixture ? (
            <MatchDetailModal
              fixture={selectedFixture}
              detail={matchDetail}
              loading={matchDetailLoading}
              activeTeamId={activeTeam?.id}
              backLabel={
                routeMatchId
                  ? matchBackToDashboard
                    ? "Back to Dashboard"
                    : "Back to Results"
                  : "Back"
              }
              onClose={closeMatchDetail}
              onTeamClick={(teamId) => void openTeamView(teamId)}
            />
          ) : routeMatchId ? (
            <LoadingState label="Loading match detail..." />
          ) : (
            <SectionView
              section={section}
              profile={payload?.profile ?? null}
              leagues={leagues}
              activeTeam={activeTeam}
              activeSeason={activeSeason}
              activeLeague={activeLeague}
              summary={
                teamDetail?.squad_summary ?? payload?.squad_summary ?? null
              }
              players={teamDetail?.players ?? []}
              fixtures={payload?.fixtures ?? []}
              results={payload?.results ?? []}
              standings={payload?.standings ?? []}
              messages={payload?.messages ?? []}
              selectedTeamViewId={selectedTeamViewId}
              teamView={teamView}
              teamViewLoading={teamViewLoading}
              onRefresh={() =>
                void load().catch((error) => setMessage(error.message))
              }
              onCreateTeam={() =>
                void load().catch((error) => setMessage(error.message))
              }
              onGenerate={() => setGenerateOpen(true)}
              onPlayerClick={setSelectedPlayer}
              onTeamClick={(teamId) => void openTeamView(teamId)}
              onOpenMatch={(fixture, from) =>
                void openMatchDetail(fixture, from)
              }
              onCloseTeamView={closeTeamView}
              onSectionChange={navigateSection}
            />
          )}
        </div>
      </main>

      {generateOpen && activeTeam && (
        <GenerateSquadModal
          team={activeTeam}
          summary={teamDetail?.squad_summary ?? payload?.squad_summary ?? null}
          onClose={() => setGenerateOpen(false)}
          onPlayerClick={setSelectedPlayer}
          onGenerated={() => {
            setGenerateOpen(false);
            void load().catch((error) => setMessage(error.message));
          }}
        />
      )}
      {selectedPlayer ? (
        <PlayerDetailModal
          player={selectedPlayer}
          theme={
            teamView?.team.id === selectedPlayer.team_registration_id
              ? themeFromTeam(teamView?.team)
              : managerTheme
          }
          onClose={() => setSelectedPlayer(null)}
          onDeleted={() => {
            setSelectedPlayer(null);
            void load().catch((error) => setMessage(error.message));
          }}
        />
      ) : null}
      {availabilityNotice ? (
        <AvailabilityNoticeModal
          message={availabilityNotice}
          onClose={() => void closeAvailabilityNotice()}
        />
      ) : null}
    </div>
  );
}

function sectionFromPath(path: string): Section {
  if (path.includes("/my-team")) return "My Team";
  if (path.includes("/players")) return "Players";
  if (path.includes("/knockout-bracket")) return "Knockout Bracket";
  if (path.includes("/fixtures")) return "Fixtures";
  if (path.includes("/submit-lineup")) return "Submit Lineup";
  if (path.includes("/player-stats")) return "Player Stats";
  if (path.includes("/team-stats")) return "Team Stats";
  if (path.includes("/other-teams")) return "Other Teams";
  if (path.includes("/results")) return "Results";
  if (path.includes("/standings")) return "Standings";
  if (path.includes("/messages")) return "Messages";
  if (path.includes("/profile")) return "Profile & Settings";
  return "Dashboard";
}

function ManagerSidebar({
  profile,
  activeTeam,
  activeSeason,
  section,
  unreadMessages,
  onSection,
  mobileOpen,
  onClose,
}: {
  profile: Profile | null;
  activeTeam: TeamRecord | null;
  activeSeason: Season | null;
  section: Section;
  unreadMessages: number;
  onSection: (section: Section) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const visibleMenu = menu.filter(
    (item) =>
      item.label !== "Knockout Bracket" ||
      isManagerGroupKnockoutFormat(activeSeason?.format),
  );
  return (
    <>
      <button
        type="button"
        aria-label="Close manager navigation"
        className={`fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        id="manager-navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(88vw,18rem)] flex-col overflow-hidden bg-[var(--team-secondary)] text-[var(--team-sidebar-text)] shadow-2xl transition-transform duration-300 lg:z-30 lg:w-72 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-[var(--team-sidebar-border)] px-6 py-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--team-primary)]">
            <Trophy size={22} />
          </div>
          <div>
            <p className="text-lg font-black tracking-wide">Scoreline</p>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--team-sidebar-muted)]">
              Manager
            </p>
          </div>
          <button
            type="button"
            aria-label="Close manager navigation"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-[var(--team-sidebar-border)] lg:hidden"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-4 mt-5 rounded-3xl border border-[var(--team-sidebar-border)] bg-[var(--team-sidebar-panel)] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={profile?.full_name ?? profile?.email ?? "Manager"} />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {profile?.full_name ?? "Manager"}
              </p>
              <p className="truncate text-xs text-[var(--team-sidebar-muted)]">
                {activeTeam?.teams?.name ?? "No team selected"}
              </p>
            </div>
          </div>
        </div>
        <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleMenu.map((item) => (
            <button
              key={item.label}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black tracking-wide transition-all duration-200 ${
                section === item.label
                  ? "bg-[var(--team-primary)] text-[var(--team-primary-text)] shadow-lg shadow-purple-950/30"
                  : "text-[var(--team-sidebar-text)] hover:bg-[var(--team-sidebar-hover)] hover:text-[var(--team-sidebar-text)]"
              }`}
              onClick={() => {
                onClose();
                onSection(item.label);
              }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.label === "Messages" && unreadMessages > 0 ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                  {unreadMessages}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <button
          className="m-4 flex items-center gap-3 rounded-2xl border border-[var(--team-sidebar-border)] px-4 py-3 text-sm font-black tracking-wide text-[var(--team-sidebar-text)] transition hover:bg-[var(--team-sidebar-hover)]"
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
        >
          <LogOut size={18} />
          Logout
        </button>
      </aside>
    </>
  );
}

function ManagerTopbar({
  profile,
  teams,
  activeTeamId,
  activeLeague,
  activeSeason,
  unreadMessages,
  mobileOpen,
  onMenuOpen,
  onTeamChange,
}: {
  profile: Profile | null;
  teams: TeamRecord[];
  activeTeamId: string;
  activeLeague: League | null;
  activeSeason: Season | null;
  unreadMessages: number;
  mobileOpen: boolean;
  onMenuOpen: () => void;
  onTeamChange: (teamId: string) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 sm:items-center sm:gap-4">
        <button
          type="button"
          aria-label="Open manager navigation"
          aria-controls="manager-navigation"
          aria-expanded={mobileOpen}
          className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          onClick={onMenuOpen}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <select
            aria-label="Active team"
            className="w-full max-w-xl truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-[var(--team-primary)] focus:ring-4 focus:ring-purple-100"
            value={activeTeamId}
            onChange={(event) => onTeamChange(event.target.value)}
          >
            {teams.length === 0 ? <option value="">No team yet</option> : null}
            {teams.map((team) => {
              const season = one(team.seasons);
              const league = one(season?.leagues);
              return (
                <option key={team.id} value={team.id}>
                  {league?.name ?? "League"} - {season?.name ?? "Season"} /{" "}
                  {team.teams?.name ?? "Team"}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {activeLeague?.name ?? "Select a league"} ·{" "}
            {activeSeason?.name ?? "No season selected"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="relative rounded-full bg-slate-100 p-3 text-slate-700">
            <Bell size={18} />
            {unreadMessages > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">
                {unreadMessages}
              </span>
            ) : null}
          </div>
          <Avatar name={profile?.full_name ?? profile?.email ?? "Manager"} />
        </div>
      </div>
    </header>
  );
}

function SectionView(props: {
  section: Section;
  profile: Profile | null;
  leagues: League[];
  activeTeam: TeamRecord | null;
  activeSeason: Season | null;
  activeLeague: League | null;
  summary: SquadSummary | null;
  players: PlayerRecord[];
  fixtures: FixtureRecord[];
  results: FixtureRecord[];
  standings: StandingRecord[];
  messages: MessageRecord[];
  selectedTeamViewId: string | null;
  teamView: TeamViewPayload | null;
  teamViewLoading: boolean;
  onRefresh: () => void;
  onCreateTeam: () => void;
  onGenerate: () => void;
  onPlayerClick: (player: PlayerRecord) => void;
  onTeamClick: (teamId: string) => void;
  onOpenMatch: (fixture: FixtureRecord, from?: "dashboard" | "results") => void;
  onCloseTeamView: () => void;
  onSectionChange: (section: Section) => void;
}) {
  if (!props.activeTeam && props.section !== "Profile & Settings") {
    return (
      <CreateTeamEmpty leagues={props.leagues} onCreated={props.onCreateTeam} />
    );
  }
  if (props.section === "Dashboard") return <DashboardSection {...props} />;
  if (props.section === "My Team") return <MyTeamSection {...props} />;
  if (props.section === "Players") return <PlayersSection {...props} />;
  if (props.section === "Fixtures") return <FixturesSection {...props} />;
  if (props.section === "Knockout Bracket")
    return <ManagerKnockoutBracketSection {...props} />;
  if (props.section === "Submit Lineup")
    return <SubmitLineupSection {...props} />;
  if (props.section === "Results") return <ResultsSection {...props} />;
  if (props.section === "Standings") return <StandingsSection {...props} />;
  if (props.section === "Other Teams") return <OtherTeamsSection {...props} />;
  if (props.section === "Player Stats")
    return <StatsSection {...props} mode="player" />;
  if (props.section === "Team Stats")
    return <StatsSection {...props} mode="team" />;
  if (props.section === "Messages") return <MessagesSection {...props} />;
  return <ProfileSection profile={props.profile} onRefresh={props.onRefresh} />;
}

function DashboardSection({
  profile,
  activeTeam,
  activeLeague,
  activeSeason,
  summary,
  fixtures,
  results,
  messages,
  onGenerate,
  onSectionChange,
  onOpenMatch,
}: Parameters<typeof SectionView>[0]) {
  const nextMatch = fixtures.find((fixture) => fixture.status !== "FINAL");
  const latestResult = results[0];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--team-primary)]">
          Manager Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
          Welcome back, {profile?.full_name ?? "Manager"}
        </h1>
        <p className="mt-2 text-slate-600">
          Team: <b>{activeTeam?.teams?.name}</b> · League:{" "}
          <b>{activeLeague?.name}</b> · Season: <b>{activeSeason?.name}</b>
        </p>
      </div>
      <TeamHero
        team={activeTeam}
        season={activeSeason}
        league={activeLeague}
        summary={summary}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          label="Team Status"
          value={activeTeam?.status ?? "-"}
          color="purple"
        />
        <DashboardCard
          label="Approved Players"
          value={summary?.approved ?? 0}
          color="green"
        />
        <DashboardCard
          label="Pending Players"
          value={summary?.pending ?? 0}
          color="yellow"
        />
        <DashboardCard
          label="Remaining Slots"
          value={summary?.remaining_slots ?? 0}
          color="slate"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Upcoming Fixture">
          {nextMatch ? (
            <FixtureMini
              fixture={nextMatch}
              activeTeamId={activeTeam?.id}
              onOpen={onOpenMatch}
            />
          ) : (
            <EmptyState label="No fixtures yet. Fixtures will appear after admin generates them." />
          )}
        </Panel>
        <Panel title="Latest Result">
          {latestResult ? (
            <ResultMini
              fixture={latestResult}
              activeTeamId={activeTeam?.id}
              onOpen={(fixture) => onOpenMatch(fixture, "dashboard")}
            />
          ) : (
            <EmptyState label="No results yet. Results will appear after matches are confirmed." />
          )}
        </Panel>
        <Panel title="Admin Messages">
          {messages.length ? (
            <div className="space-y-3">
              {messages.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-slate-50 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {item.related_type.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-slate-600">
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No messages yet." />
          )}
        </Panel>
      </div>
      <TeamJerseysPanel team={activeTeam} />
      <Panel title="Quick Actions">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ActionButton
            label="Open My Team"
            onClick={() => onSectionChange("My Team")}
          />
          <ActionButton label="Generate Squad" onClick={onGenerate} />
          <ActionButton
            label="Add Player"
            onClick={() => onSectionChange("Players")}
          />
          <ActionButton
            label="Submit Lineup"
            onClick={() => onSectionChange("Submit Lineup")}
          />
          <ActionButton
            label="View Fixtures"
            onClick={() => onSectionChange("Fixtures")}
          />
        </div>
      </Panel>
    </div>
  );
}

function MyTeamSection({
  activeTeam,
  activeSeason,
  activeLeague,
  summary,
  onGenerate,
  onRefresh,
}: Parameters<typeof SectionView>[0]) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageTitle
        title="My Team"
        subtitle="Team profile, admin status, and squad capacity."
      />
      <TeamHero
        team={activeTeam}
        season={activeSeason}
        league={activeLeague}
        summary={summary}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Team Profile">
          <Detail label="Team Name" value={activeTeam?.teams?.name} />
          <Detail
            label="Team Short Name"
            value={activeTeam?.teams?.short_name}
          />
          <Detail
            label="Logo URL"
            value={activeTeam?.teams?.logo_url || "Not set"}
          />
          <Detail
            label="Primary Color"
            value={activeTeam?.teams?.primary_color || "#6D28D9"}
          />
          <Detail
            label="Secondary Color"
            value={activeTeam?.teams?.secondary_color || "#0B1626"}
          />
          <Detail
            label="Accent Color"
            value={activeTeam?.teams?.accent_color || "#16A34A"}
          />
          <Detail
            label="Home Jersey URL"
            value={activeTeam?.teams?.home_jersey_url || "Not set"}
          />
          <Detail
            label="Away Jersey URL"
            value={activeTeam?.teams?.away_jersey_url || "Not set"}
          />
          <Detail
            label="GK Home Jersey URL"
            value={activeTeam?.teams?.gk_home_jersey_url || "Not set"}
          />
          <Detail
            label="GK Away Jersey URL"
            value={activeTeam?.teams?.gk_away_jersey_url || "Not set"}
          />
          <Detail
            label="Registered Date"
            value={
              activeTeam?.created_at ? formatDate(activeTeam.created_at) : "-"
            }
          />
          <Detail label="Team Status" value={activeTeam?.status} />
          <button
            className="mt-5 rounded-2xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-bold text-[var(--team-primary)] transition hover:-translate-y-0.5 hover:bg-purple-100"
            onClick={() => setSettingsOpen(true)}
          >
            Team Settings
          </button>
        </Panel>
        <Panel title="Squad Summary">
          <StatGrid summary={summary} />
          <button
            className="mt-5 rounded-2xl bg-[var(--team-primary)] px-5 py-3 text-sm font-bold text-[var(--team-primary-text)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-200"
            onClick={onGenerate}
          >
            Generate Squad
          </button>
        </Panel>
      </div>
      {activeTeam?.rejection_reason ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {activeTeam.rejection_reason}
        </div>
      ) : null}
      {settingsOpen && activeTeam ? (
        <TeamSettingsModal
          team={activeTeam}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function PlayersSection({
  players,
  summary,
  onGenerate,
  onPlayerClick,
  activeTeam,
  onRefresh,
}: Parameters<typeof SectionView>[0]) {
  const [tab, setTab] = useState("ALL");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PlayerRecord | null>(null);
  const [minifaceDrafts, setMinifaceDrafts] = useState<Record<string, string>>(
    {},
  );
  const [savingMinifaces, setSavingMinifaces] = useState(false);
  const [minifaceError, setMinifaceError] = useState("");

  useEffect(() => {
    setMinifaceDrafts((current) => {
      const next: Record<string, string> = {};
      players.forEach((player) => {
        next[player.id] =
          current[player.id] ?? player.players?.avatar_url ?? "";
      });
      return next;
    });
  }, [players]);

  const statusFiltered =
    tab === "ALL"
      ? players
      : players.filter(
          (player) => player.status === tab || player.player_status === tab,
        );
  const positionFiltered =
    positionFilter === "ALL"
      ? statusFiltered
      : statusFiltered.filter(
          (player) =>
            (player.position_category ?? "").toUpperCase() === positionFilter,
        );
  const filtered = positionFiltered.filter((player) => {
    const text =
      `${player.players?.full_name ?? ""} ${player.player_code ?? ""} ${player.shirt_number ?? ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const dirtyMinifaceUpdates = players
    .map((player) => ({
      player_registration_id: player.id,
      avatar_url: (minifaceDrafts[player.id] ?? "").trim(),
      current_avatar_url: player.players?.avatar_url ?? "",
    }))
    .filter((update) => update.avatar_url !== update.current_avatar_url);

  async function submitAll() {
    const ids = players
      .filter((player) => player.status === RegistrationStatus.DRAFT)
      .map((player) => player.id);
    if (!activeTeam || ids.length === 0) return;
    await api(`/manager/teams/${activeTeam.id}/submit-players`, {
      method: "POST",
      body: JSON.stringify({ playerIds: ids }),
    });
    onRefresh();
  }
  async function removePlayer(player: PlayerRecord) {
    await api(`/manager/players/${player.id}`, { method: "DELETE" });
    onRefresh();
  }
  async function saveAllMinifaces() {
    if (dirtyMinifaceUpdates.length === 0) return;
    setSavingMinifaces(true);
    setMinifaceError("");
    try {
      await api("/manager/players/minifaces", {
        method: "PATCH",
        body: JSON.stringify({
          updates: dirtyMinifaceUpdates.map((update) => ({
            player_registration_id: update.player_registration_id,
            avatar_url: update.avatar_url || null,
          })),
        }),
      });
      onRefresh();
    } catch (err) {
      setMinifaceError(
        err instanceof Error ? err.message : "Failed to save miniface URLs",
      );
    } finally {
      setSavingMinifaces(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageTitle
        title="Players"
        subtitle="Players for this team. Draft and Pending players can be edited until admin approval."
      />
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 text-sm font-bold text-[var(--team-primary-text)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-200"
          onClick={onGenerate}
        >
          Generate Squad
        </button>
        <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)]">
          Add Player
        </button>
        <button
          className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-bold text-green-700 transition hover:bg-green-100"
          onClick={() => void submitAll()}
        >
          Submit Draft Players
        </button>
        <button
          className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={dirtyMinifaceUpdates.length === 0 || savingMinifaces}
          onClick={() => void saveAllMinifaces()}
        >
          {savingMinifaces
            ? "Saving Minifaces..."
            : `Save All Minifaces${dirtyMinifaceUpdates.length ? ` (${dirtyMinifaceUpdates.length})` : ""}`}
        </button>
      </div>
      {minifaceError ? (
        <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {minifaceError}
        </div>
      ) : null}
      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto]">
        <input
          className="manager-input"
          placeholder="Search by player name, code, or jersey number"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--team-primary)]">
          Search
        </button>
      </div>
      <Tabs
        values={["ALL", "GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"]}
        value={positionFilter}
        onChange={setPositionFilter}
      />
      <Tabs
        values={[
          "ALL",
          "DRAFT",
          "PENDING",
          "APPROVED",
          "REJECTED",
          "REMOVED",
          "SUSPENDED",
        ]}
        value={tab}
        onChange={setTab}
      />
      <PlayerTable
        players={filtered}
        onPlayerClick={onPlayerClick}
        onEdit={setEditing}
        onRemove={(player) => void removePlayer(player)}
        minifaceDrafts={minifaceDrafts}
        onMinifaceChange={(playerId, value) =>
          setMinifaceDrafts((current) => ({ ...current, [playerId]: value }))
        }
        emptyLabel={
          summary?.total
            ? "No players match this filter."
            : "No players yet. Click Generate Squad to create your squad."
        }
      />
      {editing ? (
        <EditDraftPlayerModal
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      ) : null}
    </div>
  );
}

function isCompletedFixture(fixture: FixtureRecord) {
  return fixture.status === "FINAL" || fixture.status === "COMPLETED";
}

function compareFixturesNewestFirst(a: FixtureRecord, b: FixtureRecord) {
  const aKickoff = a.kickoff_at ? Date.parse(a.kickoff_at) : 0;
  const bKickoff = b.kickoff_at ? Date.parse(b.kickoff_at) : 0;
  return bKickoff - aKickoff;
}

function mergeFixtureRows(
  ...fixtureGroups: FixtureRecord[][]
): FixtureRecord[] {
  const rows = new Map<string, FixtureRecord>();
  for (const fixtures of fixtureGroups) {
    for (const fixture of fixtures) rows.set(fixture.id, fixture);
  }
  return [...rows.values()];
}

function FixturesSection({
  fixtures,
  results,
  activeTeam,
  activeSeason,
  standings,
  onTeamClick,
}: Parameters<typeof SectionView>[0]) {
  const [seasonTeams, setSeasonTeams] = useState<TeamRecord[]>([]);
  const [fixtureRows, setFixtureRows] = useState<FixtureRecord[]>(() =>
    mergeFixtureRows(fixtures, results),
  );
  const [teamFilter, setTeamFilter] = useState("MY_TEAM");
  const [showGroups, setShowGroups] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<FixtureRecord | null>(
    null,
  );
  const [detail, setDetail] = useState<unknown>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const showHomeAway = !isManagerGroupKnockoutFormat(activeSeason?.format);

  useEffect(() => {
    setFixtureRows(mergeFixtureRows(fixtures, results));
  }, [fixtures, results]);

  useEffect(() => {
    if (!activeSeason?.id) return;
    let alive = true;
    const queryTeamId = teamFilter === "MY_TEAM" ? activeTeam?.id : teamFilter;
    const query =
      queryTeamId === "ALL"
        ? `seasonId=${activeSeason.id}&teamId=ALL`
        : `seasonId=${activeSeason.id}&teamId=${queryTeamId ?? "ALL"}`;

    api<{ fixtures: FixtureRecord[] }>(`/manager/fixtures?${query}`)
      .then((payload) => {
        if (alive) setFixtureRows(payload.fixtures);
      })
      .catch(() => {
        // Keep the dashboard's already-loaded rows visible if refresh fails.
      });

    return () => {
      alive = false;
    };
  }, [activeSeason?.id, activeTeam?.id, teamFilter]);

  useEffect(() => {
    if (!activeSeason?.id) return;
    let alive = true;
    api<{ teams: TeamRecord[] }>(`/manager/seasons/${activeSeason.id}/teams`)
      .then((payload) => {
        if (alive) setSeasonTeams(payload.teams);
      })
      .catch(() => {
        if (alive) setSeasonTeams([]);
      });
    return () => {
      alive = false;
    };
  }, [activeSeason?.id]);

  function changeFixtureFilter(value: string) {
    setTeamFilter(value);
  }

  async function openFixture(fixture: FixtureRecord) {
    setSelectedFixture(fixture);
    setDetail(null);
    setDetailLoading(true);
    try {
      const payload = await api(`/manager/matches/${fixture.id}/detail`);
      setDetail(payload);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Fixtures"
        subtitle="Upcoming fixtures and previous confirmed scorelines for your selected team."
      />
      <div className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <button
          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${teamFilter === "MY_TEAM" ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-slate-50 text-slate-700 hover:bg-purple-50"}`}
          onClick={() => changeFixtureFilter("MY_TEAM")}
        >
          My Fixtures
        </button>
        <button
          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${teamFilter === "ALL" ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-slate-50 text-slate-700 hover:bg-purple-50"}`}
          onClick={() => changeFixtureFilter("ALL")}
        >
          All Fixtures
        </button>
        <select
          className="manager-input max-w-xs"
          value={teamFilter}
          onChange={(event) => changeFixtureFilter(event.target.value)}
        >
          <option value="MY_TEAM">My team only</option>
          <option value="ALL">All season fixtures</option>
          {seasonTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.teams?.name ?? "Team"}
            </option>
          ))}
        </select>
        {isManagerGroupKnockoutFormat(activeSeason?.format) ? (
          <button
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${showGroups ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"}`}
            onClick={() => setShowGroups((value) => !value)}
          >
            Group Current Condition
          </button>
        ) : null}
      </div>
      {showGroups && isManagerGroupKnockoutFormat(activeSeason?.format) ? (
        <GroupConditionPanel
          standings={standings}
          activeTeam={activeTeam}
          activeSeason={activeSeason}
          onTeamClick={onTeamClick}
        />
      ) : null}
      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-900">Upcoming Matches</h2>
        <FixtureTable
          fixtures={fixtureRows.filter(
            (fixture) => !isCompletedFixture(fixture),
          )}
          activeTeamId={activeTeam?.id}
          showHomeAway={showHomeAway}
          emptyLabel="No upcoming fixtures."
          onTeamClick={onTeamClick}
          onOpen={openFixture}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-900">Previous Matches</h2>
        <FixtureTable
          fixtures={fixtureRows
            .filter(isCompletedFixture)
            .sort(compareFixturesNewestFirst)}
          activeTeamId={activeTeam?.id}
          showHomeAway={showHomeAway}
          emptyLabel="No completed matches yet. Scorelines will appear after results are confirmed."
          onTeamClick={onTeamClick}
          onOpen={openFixture}
        />
      </section>
      {selectedFixture ? (
        <MatchDetailModal
          fixture={selectedFixture}
          detail={detail}
          loading={detailLoading}
          activeTeamId={activeTeam?.id}
          backLabel="Back to Fixtures"
          onClose={() => setSelectedFixture(null)}
          onTeamClick={onTeamClick}
        />
      ) : null}
    </div>
  );
}

function ManagerKnockoutBracketSection({
  activeSeason,
}: Parameters<typeof SectionView>[0]) {
  const [fixtures, setFixtures] = useState<KnockoutBracketFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (
      !activeSeason?.id ||
      !isManagerGroupKnockoutFormat(activeSeason.format)
    ) {
      setFixtures([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    void api<{ fixtures: KnockoutBracketFixture[] }>(
      `/manager/seasons/${activeSeason.id}/knockout-bracket`,
    )
      .then((payload) => {
        if (active) setFixtures(payload.fixtures);
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
  }, [activeSeason?.format, activeSeason?.id]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Knockout Bracket"
        subtitle="Follow every knockout pairing from qualification through the final."
      />
      {loading ? (
        <LoadingState label="Loading knockout bracket..." />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : (
        <KnockoutBracket
          fixtures={fixtures}
          accentColor="var(--team-primary)"
          emptyMessage="The knockout bracket will appear after the admin saves the qualified teams and fixtures."
        />
      )}
    </div>
  );
}

function SubmitLineupSection({
  fixtures,
  players,
  activeTeam,
  onPlayerClick,
}: Parameters<typeof SectionView>[0]) {
  const selectedMatch =
    fixtures.find(
      (fixture) =>
        ![
          "FINAL",
          "COMPLETED",
          "CANCELLED",
          "POSTPONED",
          "WAITING_FOR_TEAMS",
        ].includes(fixture.status),
    ) ?? null;
  const matchId = selectedMatch?.id ?? "";
  const [builder, setBuilder] = useState<LineupBuilderPayload | null>(null);
  const [loadingBuilder, setLoadingBuilder] = useState(false);
  const [formation, setFormation] = useState("4-3-3");
  const [playingStyle, setPlayingStyle] = useState<PlayingStyle>("BALANCED");
  const [slots, setSlots] = useState<FormationSlot[]>([]);
  const [lineupPlayers, setLineupPlayers] = useState<LineupSelection[]>([]);
  const [penaltyTakerIds, setPenaltyTakerIds] = useState<string[]>([]);
  const [freeKickTakerIds, setFreeKickTakerIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [alternativesSlot, setAlternativesSlot] =
    useState<FormationSlot | null>(null);
  const [alternatives, setAlternatives] = useState<
    LineupAlternativesPayload["alternatives"]
  >([]);
  const [draggedSlotKey, setDraggedSlotKey] = useState<string | null>(null);
  const [captainMenuSlotKey, setCaptainMenuSlotKey] = useState<string | null>(
    null,
  );
  const [showLeagueRatings, setShowLeagueRatings] = useState(false);
  const playerMap = useMemo(
    () =>
      new Map(
        (builder?.approvedPlayers ?? []).map((player) => [player.id, player]),
      ),
    [builder],
  );
  const starters = lineupPlayers.filter((player) => player.is_starter);
  const starterIds = new Set(
    starters.map((player) => player.player_registration_id),
  );
  const bench = lineupPlayers.filter((player) => !player.is_starter);
  const benchIds = new Set(
    bench.map((player) => player.player_registration_id),
  );
  const captainId =
    starters.find((player) => player.is_captain)?.player_registration_id ??
    null;
  const unavailablePlayers = (
    builder?.unavailablePlayers?.length ? builder.unavailablePlayers : players
  ).filter(
    (player) =>
      player.player_status === "SUSPENDED" ||
      Boolean(player.active_injury) ||
      Boolean(player.active_suspension),
  );
  const existingLineupStatus =
    (builder?.existingLineup as { status?: string | null } | null)?.status ??
    null;
  const lineupLocked =
    existingLineupStatus === "PENDING" || existingLineupStatus === "CONFIRMED";
  const lineupLockMessage =
    existingLineupStatus === "PENDING"
      ? "Lineup already submitted. It is locked until admin confirms or rejects it."
      : existingLineupStatus === "CONFIRMED"
        ? "Lineup confirmed by admin and locked for simulation."
        : "";

  useEffect(() => {
    if (!activeTeam || !matchId) return;
    void loadBuilder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTeam?.id, matchId]);

  function applyBuilder(payload: LineupBuilderPayload) {
    const rankedTakers = rankSetPieceTakers(
      payload.approvedPlayers,
      payload.initialLineup.players,
    );
    setBuilder(payload);
    setFormation(payload.initialLineup.formation);
    setPlayingStyle(payload.initialLineup.playing_style);
    setSlots(payload.formationSlots);
    setLineupPlayers(payload.initialLineup.players);
    setPenaltyTakerIds(
      mergeTakerOrder(payload.initialLineup.penalty_taker_ids, rankedTakers),
    );
    setFreeKickTakerIds(
      mergeTakerOrder(payload.initialLineup.free_kick_taker_ids, rankedTakers),
    );
    setMessage(payload.warnings?.[0] ?? "");
  }

  async function loadBuilder() {
    if (!activeTeam || !matchId) return;
    setLoadingBuilder(true);
    setMessage("");
    try {
      const payload = await api<LineupBuilderPayload>(
        `/manager/matches/${matchId}/lineup-builder?teamId=${activeTeam.id}`,
      );
      applyBuilder(payload);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to load lineup builder",
      );
    } finally {
      setLoadingBuilder(false);
    }
  }

  async function autoPick(nextFormation = formation, nextStyle = playingStyle) {
    if (!activeTeam || !builder) return;
    setLoadingBuilder(true);
    setMessage("");
    try {
      const payload = await api<{
        formationSlots: FormationSlot[];
        lineup: LineupBuilderPayload["initialLineup"];
      }>(`/manager/matches/${matchId}/lineup/auto-pick`, {
        method: "POST",
        body: JSON.stringify({
          teamId: activeTeam.id,
          seasonId: activeTeam.season_id,
          formation: nextFormation,
          playingStyle: nextStyle,
        }),
      });
      setFormation(payload.lineup.formation);
      setPlayingStyle(payload.lineup.playing_style);
      setSlots(payload.formationSlots);
      setLineupPlayers(payload.lineup.players);
      const rankedTakers = rankSetPieceTakers(
        builder.approvedPlayers,
        payload.lineup.players,
      );
      setPenaltyTakerIds((current) => mergeTakerOrder(current, rankedTakers));
      setFreeKickTakerIds((current) => mergeTakerOrder(current, rankedTakers));
      setMessage(
        nextFormation !== formation
          ? "Formation changed. Best-fit XI was recalculated."
          : "Best-fit XI selected.",
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to auto-pick lineup",
      );
    } finally {
      setLoadingBuilder(false);
    }
  }

  async function savePreference(
    nextFormation = formation,
    nextStyle = playingStyle,
  ) {
    if (!activeTeam) return;
    await api(`/manager/teams/${activeTeam.id}/preferences`, {
      method: "PATCH",
      body: JSON.stringify({
        seasonId: activeTeam.season_id,
        preferredFormation: nextFormation,
        preferredPlayingStyle: nextStyle,
      }),
    });
  }

  function changeFormation(next: string) {
    setFormation(next);
    void autoPick(next, playingStyle);
  }

  async function openAlternatives(slot: FormationSlot) {
    if (!activeTeam) return;
    setAlternativesSlot(slot);
    try {
      const payload = await api<LineupAlternativesPayload>(
        `/manager/matches/${matchId}/lineup/alternatives?teamId=${activeTeam.id}&slotKey=${encodeURIComponent(slot.slotKey)}&formation=${encodeURIComponent(formation)}&playingStyle=${encodeURIComponent(playingStyle)}`,
      );
      setAlternatives(payload.alternatives);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to load alternatives",
      );
    }
  }

  function selectAlternative(slot: FormationSlot, nextPlayer: PlayerRecord) {
    setLineupPlayers((current) => {
      const existingStarter = current.find(
        (item) => item.is_starter && item.slot_key === slot.slotKey,
      );
      const nextExisting = current.find(
        (item) => item.player_registration_id === nextPlayer.id,
      );
      const nextNatural = naturalPlayerPosition(nextPlayer);
      return current.map((item) => {
        if (item.slot_key === slot.slotKey) {
          return {
            ...item,
            player_registration_id: nextPlayer.id,
            position: coarseFromNatural(nextNatural),
            player_natural_position: nextNatural,
            display_role: slot.displayRole,
          };
        }
        if (
          nextExisting &&
          existingStarter &&
          item.player_registration_id === nextPlayer.id
        ) {
          return {
            ...item,
            player_registration_id: existingStarter.player_registration_id,
          };
        }
        return item;
      });
    });
    setAlternativesSlot(null);
  }

  function swapStarterSlots(sourceSlotKey: string, targetSlotKey: string) {
    if (sourceSlotKey === targetSlotKey) return;
    const sourceSlot = slots.find((slot) => slot.slotKey === sourceSlotKey);
    const targetSlot = slots.find((slot) => slot.slotKey === targetSlotKey);
    if (!sourceSlot || !targetSlot) return;
    setLineupPlayers((current) => {
      const source = current.find(
        (item) => item.is_starter && item.slot_key === sourceSlotKey,
      );
      const target = current.find(
        (item) => item.is_starter && item.slot_key === targetSlotKey,
      );
      if (!source) return current;
      return current.map((item) => {
        if (item.is_starter && item.slot_key === sourceSlotKey) {
          const sourcePlayer = playerMap.get(source.player_registration_id);
          const sourceNatural = sourcePlayer
            ? naturalPlayerPosition(sourcePlayer)
            : (item.player_natural_position ?? null);
          return {
            ...item,
            slot_key: targetSlotKey,
            display_role: targetSlot.displayRole,
            position: sourceNatural
              ? coarseFromNatural(sourceNatural)
              : item.position,
            player_natural_position: sourceNatural,
            fit_label: null,
            score: null,
          };
        }
        if (target && item.is_starter && item.slot_key === targetSlotKey) {
          const targetPlayer = playerMap.get(target.player_registration_id);
          const targetNatural = targetPlayer
            ? naturalPlayerPosition(targetPlayer)
            : (item.player_natural_position ?? null);
          return {
            ...item,
            slot_key: sourceSlotKey,
            display_role: sourceSlot.displayRole,
            position: targetNatural
              ? coarseFromNatural(targetNatural)
              : item.position,
            player_natural_position: targetNatural,
            fit_label: null,
            score: null,
          };
        }
        return item;
      });
    });
  }

  function handleSlotDrop(
    event: DragEvent<HTMLElement>,
    targetSlotKey: string,
  ) {
    event.preventDefault();
    const sourceSlotKey =
      event.dataTransfer.getData("text/scoreline-slot") || draggedSlotKey;
    if (sourceSlotKey) swapStarterSlots(sourceSlotKey, targetSlotKey);
    setDraggedSlotKey(null);
  }

  function setCaptain(playerRegistrationId: string) {
    setLineupPlayers((current) =>
      current.map((item) => ({
        ...item,
        is_captain:
          item.is_starter &&
          item.player_registration_id === playerRegistrationId,
      })),
    );
    setCaptainMenuSlotKey(null);
    setMessage("");
  }

  function makePrimaryTaker(
    playerRegistrationId: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setter((current) => [
      playerRegistrationId,
      ...current.filter((id) => id !== playerRegistrationId),
    ]);
  }

  async function submitLineup() {
    if (!activeTeam || !selectedMatch) return;
    if (lineupLocked) {
      setMessage(lineupLockMessage);
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      if (starters.length !== 11)
        throw new Error("Exactly 11 starters are required.");
      if (
        starters.filter(
          (item) =>
            item.player_natural_position === FootballPosition.GK ||
            playerMap.get(item.player_registration_id)?.football_position ===
              FootballPosition.GK,
        ).length !== 1
      ) {
        throw new Error(
          "Exactly one goalkeeper is required in the starting XI.",
        );
      }
      if (!captainId)
        throw new Error("Select a captain before submitting the lineup.");
      await api(`/manager/matches/${selectedMatch.id}/lineup`, {
        method: "POST",
        body: JSON.stringify({
          team_registration_id: activeTeam.id,
          formation,
          playing_style: playingStyle,
          captain_id: captainId,
          penalty_taker_ids: penaltyTakerIds,
          free_kick_taker_ids: freeKickTakerIds,
          players: lineupPlayers.map((item) => ({
            player_registration_id: item.player_registration_id,
            is_starter: item.is_starter,
            position: item.position,
            ...(item.slot_key ? { slot_key: item.slot_key } : {}),
            ...(item.display_role ? { display_role: item.display_role } : {}),
            ...(item.player_natural_position
              ? { player_natural_position: item.player_natural_position }
              : {}),
            ...(typeof item.display_order === "number"
              ? { display_order: item.display_order }
              : {}),
            is_captain: item.player_registration_id === captainId,
          })),
        }),
      });
      setBuilder((current) =>
        current
          ? {
              ...current,
              existingLineup: {
                ...((current.existingLineup as object | null) ?? {}),
                status: "PENDING",
              },
            }
          : current,
      );
      setMessage("Lineup submitted. Admin can now review it.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to submit lineup",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAvailable = (builder?.approvedPlayers ?? []).filter(
    (player) => {
      const text =
        `${player.players?.full_name ?? ""} ${player.player_code ?? ""} ${player.shirt_number ?? ""}`.toLowerCase();
      const matchesSearch = text.includes(search.trim().toLowerCase());
      const matchesPosition =
        positionFilter === "ALL" ||
        naturalPlayerPosition(player) === positionFilter;
      return benchIds.has(player.id) && matchesSearch && matchesPosition;
    },
  );
  const visibleAlternatives = alternatives.filter(
    (item) => !starterIds.has(item.player.id),
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Submit Lineup"
        subtitle="Prepare the lineup for your team's next match. The following fixture unlocks after this match is finalized."
      />
      {!selectedMatch ? (
        <EmptyState label="No upcoming fixture is available for lineup submission." />
      ) : null}
      {selectedMatch ? (
        <>
          <Panel title="Lineup Controls">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="text-sm font-bold lg:col-span-2">
                Next eligible match
                <div className="manager-input mt-2 cursor-default bg-slate-50">
                  {matchLabel(selectedMatch)} ·{" "}
                  {formatDate(selectedMatch.kickoff_at)}
                </div>
              </div>
              <label className="text-sm font-bold">
                Formation
                <select
                  className="manager-input mt-2"
                  value={formation}
                  onChange={(event) => changeFormation(event.target.value)}
                >
                  {Object.entries(
                    builder?.availableFormations ?? { "4-3-3": "4-3-3" },
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Playing Style
                <select
                  className="manager-input mt-2"
                  value={playingStyle}
                  onChange={(event) => {
                    const next = event.target.value as PlayingStyle;
                    setPlayingStyle(next);
                    void savePreference(formation, next).catch((error) =>
                      setMessage(error.message),
                    );
                  }}
                >
                  {Object.entries(
                    builder?.availablePlayingStyles ?? {
                      BALANCED: "Balanced Play",
                    },
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button
                  className="rounded-2xl bg-[var(--team-primary)] px-4 py-3 text-sm font-black text-[var(--team-primary-text)] transition hover:-translate-y-0.5 disabled:opacity-50"
                  disabled={loadingBuilder}
                  onClick={() => void autoPick()}
                >
                  Auto Pick Best XI
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)]"
                onClick={() => void loadBuilder()}
              >
                Reset to Previous Lineup
              </button>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-600">
                Mode:{" "}
                {builder?.initialLineupMode?.replaceAll("_", " ") ?? "Loading"}
              </span>
              <span className="rounded-full bg-green-50 px-3 py-1 font-bold text-green-700">
                Preference saved after formation/style changes
              </span>
              <button
                type="button"
                aria-pressed={showLeagueRatings}
                className={`rounded-full px-4 py-2 font-black ring-1 transition hover:-translate-y-0.5 ${
                  showLeagueRatings
                    ? "bg-sky-500 text-white ring-sky-600 shadow-md"
                    : "bg-white text-slate-700 ring-slate-200 hover:ring-sky-300"
                }`}
                onClick={() => setShowLeagueRatings((current) => !current)}
              >
                {showLeagueRatings ? "Hide LG" : "Show LG"}
              </button>
            </div>
            {message ? (
              <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
                {message}
              </p>
            ) : null}
            {lineupLocked ? (
              <p className="mt-4 rounded-2xl bg-indigo-50 p-3 text-sm font-bold text-indigo-700">
                {lineupLockMessage}
              </p>
            ) : null}
          </Panel>
          {loadingBuilder ? (
            <LoadingState label="Preparing lineup builder..." />
          ) : null}
          {!loadingBuilder && builder ? (
            <>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,760px)_420px]">
                <div className="relative h-[760px] overflow-hidden rounded-2xl bg-[#05A967] p-2 shadow-xl ring-1 ring-emerald-800/20 sm:h-[820px] sm:rounded-[2rem] sm:p-5">
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/10" />
                  <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white/10" />
                  <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" />
                  <div className="absolute left-1/2 top-0 h-24 w-44 -translate-x-1/2 rounded-b-3xl border-x-[5px] border-b-[5px] border-white/10" />
                  <div className="absolute left-1/2 top-0 h-12 w-20 -translate-x-1/2 rounded-b-2xl border-x-[5px] border-b-[5px] border-white/10" />
                  <div className="absolute bottom-0 left-1/2 h-24 w-44 -translate-x-1/2 rounded-t-3xl border-x-[5px] border-t-[5px] border-white/10" />
                  <div className="absolute bottom-0 left-1/2 h-12 w-20 -translate-x-1/2 rounded-t-2xl border-x-[5px] border-t-[5px] border-white/10" />
                  <div className="absolute inset-y-0 left-[35%] w-1 bg-white/5" />
                  <div className="absolute inset-y-0 right-[35%] w-1 bg-white/5" />
                  {slots.map((slot) => {
                    const selected = lineupPlayers.find(
                      (item) =>
                        item.is_starter && item.slot_key === slot.slotKey,
                    );
                    const player = selected
                      ? playerMap.get(selected.player_registration_id)
                      : null;
                    return (
                      <div
                        key={slot.slotKey}
                        className={`absolute z-10 w-[82px] -translate-x-1/2 -translate-y-1/2 rounded-3xl py-1 text-center transition sm:w-[112px] ${draggedSlotKey && draggedSlotKey !== slot.slotKey ? "bg-white/10 ring-2 ring-white/25" : ""}`}
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleSlotDrop(event, slot.slotKey)}
                      >
                        {player ? (
                          <div
                            role="button"
                            tabIndex={0}
                            draggable
                            className="group relative inline-flex flex-col items-center outline-none"
                            onDragStart={(event) => {
                              setDraggedSlotKey(slot.slotKey);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "text/scoreline-slot",
                                slot.slotKey,
                              );
                            }}
                            onDragEnd={() => setDraggedSlotKey(null)}
                            onClick={() =>
                              setCaptainMenuSlotKey((current) =>
                                current === slot.slotKey ? null : slot.slotKey,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ")
                                setCaptainMenuSlotKey((current) =>
                                  current === slot.slotKey
                                    ? null
                                    : slot.slotKey,
                                );
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              void openAlternatives(slot);
                            }}
                          >
                            <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                              <div
                                className={`grid h-full w-full place-items-center overflow-hidden rounded-full border-[3px] bg-white shadow-md transition group-hover:brightness-110 ${fitBorderClass(selected?.fit_label)}`}
                              >
                                {player.players?.avatar_url ? (
                                  <img
                                    src={player.players.avatar_url}
                                    alt={player.players?.full_name ?? "Player"}
                                    className="h-[118%] w-full rounded-full object-cover object-top"
                                  />
                                ) : (
                                  <span className="grid h-full w-full place-items-center rounded-full bg-emerald-700 text-sm font-black text-white">
                                    {initials(player.players?.full_name)}
                                  </span>
                                )}
                              </div>
                              {showLeagueRatings ? (
                                <PlayerSeasonContributionBadges
                                  goals={player.season_goals ?? 0}
                                  assists={player.season_assists ?? 0}
                                  variant="overlay"
                                />
                              ) : null}
                            </div>
                            {showLeagueRatings &&
                            player.league_rating !== null &&
                            player.league_rating !== undefined ? (
                              <span
                                className={`absolute left-[calc(50%+12px)] top-0 z-20 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow ${managerRatingBadgeClass(Number(player.league_rating))}`}
                                title="Average league rating"
                              >
                                {Number(player.league_rating).toFixed(1)}
                              </span>
                            ) : null}
                            <div className="mt-1 flex w-full items-center justify-center gap-1 px-0.5 sm:w-32 sm:max-w-[8rem]">
                              {selected?.is_captain ? (
                                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-black lowercase leading-none text-slate-700 shadow">
                                  c
                                </span>
                              ) : null}
                              <span className="min-w-0 truncate text-[13px] font-black text-white drop-shadow">
                                {player.shirt_number
                                  ? `${player.shirt_number} `
                                  : ""}
                                {player.players?.full_name ?? "Player"}
                              </span>
                              <span
                                className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-black ring-1 ${overallCapsuleClass(playerRatingTier(player))}`}
                              >
                                {playerOverall(player) ?? "N/A"}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">
                              {slot.displayRole}
                            </p>
                            {captainMenuSlotKey === slot.slotKey ? (
                              <div
                                className={`absolute left-1/2 z-30 w-24 -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/90 p-1 text-white shadow-2xl backdrop-blur sm:w-40 sm:p-2 ${
                                  slot.y > 72
                                    ? "bottom-[calc(100%+0.35rem)]"
                                    : "top-[calc(100%+0.35rem)]"
                                }`}
                              >
                                <button
                                  type="button"
                                  className="w-full rounded-xl px-3 py-2 text-xs font-black transition hover:bg-white/15"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setCaptain(player.id);
                                  }}
                                >
                                  {selected?.is_captain
                                    ? "Captain selected"
                                    : "Set captain"}
                                </button>
                                <button
                                  type="button"
                                  className="mt-1 w-full rounded-xl px-3 py-2 text-xs font-black transition hover:bg-white/15"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setCaptainMenuSlotKey(null);
                                    onPlayerClick(player);
                                  }}
                                >
                                  View player
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="group inline-flex flex-col items-center">
                            <span className="relative grid h-12 w-12 place-items-center rounded-full border-[3px] border-emerald-300/70 bg-emerald-800/20 text-emerald-100 shadow-inner transition group-hover:scale-110 group-hover:border-white sm:h-14 sm:w-14">
                              <User size={28} className="opacity-40" />
                            </span>
                            <span className="mt-1 text-[11px] font-black uppercase tracking-wide text-white/80">
                              {slot.displayRole}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="absolute bottom-4 left-4">
                    <select
                      className="max-w-[calc(100vw-3rem)] rounded-full border border-white/15 bg-emerald-700/80 px-3 py-2 text-xs font-black text-white shadow outline-none transition hover:bg-emerald-800/90 sm:max-w-[280px] sm:px-4 sm:text-sm"
                      value={formation}
                      onChange={(event) => changeFormation(event.target.value)}
                      aria-label="Select formation"
                    >
                      {Object.entries(builder.availableFormations).map(
                        ([key, label]) => (
                          <option
                            key={key}
                            value={key}
                            className="bg-emerald-900 text-white"
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
                <Panel title="Players">
                  <div className="space-y-3">
                    <input
                      className="manager-input"
                      placeholder="Search players"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <select
                      className="manager-input"
                      value={positionFilter}
                      onChange={(event) =>
                        setPositionFilter(event.target.value)
                      }
                    >
                      {["ALL", ...positions].map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <div>
                      <p className="font-black">
                        Squad Selection · Bench {bench.length}
                      </p>
                      <div className="mt-2 max-h-[540px] space-y-2 overflow-auto pr-1">
                        {filteredAvailable.map((player) => {
                          return (
                            <LineupPlayerRow
                              key={player.id}
                              player={player}
                              label="Bench"
                              showLeagueStats={showLeagueRatings}
                              onOpen={() => onPlayerClick(player)}
                            />
                          );
                        })}
                      </div>
                    </div>
                    {unavailablePlayers.length ? (
                      <div className="rounded-3xl border border-red-100 bg-red-50 p-4">
                        <p className="font-black text-red-700">
                          Suspended / Injured
                        </p>
                        <div className="mt-2 max-h-44 space-y-2 overflow-auto">
                          {unavailablePlayers.map((player) => (
                            <LineupPlayerRow
                              key={player.id}
                              player={player}
                              label={availabilityLabel(player)}
                              onOpen={() => onPlayerClick(player)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!captainId ? (
                      <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
                        Left-click a starting player and choose Set captain
                        before submitting.
                      </p>
                    ) : null}
                    <button
                      className="w-full rounded-2xl bg-[var(--team-primary)] px-5 py-4 text-sm font-black text-[var(--team-primary-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        lineupLocked ||
                        submitting ||
                        starters.length !== 11 ||
                        !captainId
                      }
                      onClick={() => void submitLineup()}
                    >
                      {lineupLocked
                        ? "Lineup Submitted"
                        : submitting
                          ? "Submitting..."
                          : "Submit Lineup"}
                    </button>
                    {builder.discipline?.players.length ? (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black text-amber-950">
                            Yellow-card watch
                          </p>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                            {builder.discipline.phase === "GROUP"
                              ? "Resets after group stage"
                              : `${builder.discipline.phase.toLowerCase()} phase`}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {builder.discipline.players.map((item) => (
                            <div
                              key={item.player_registration_id}
                              className="flex min-w-0 items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-amber-100"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-amber-100 text-xs font-black text-amber-800">
                                {item.avatar_url ? (
                                  <img
                                    src={item.avatar_url}
                                    alt={item.full_name}
                                    className="h-[118%] w-full object-cover object-top"
                                  />
                                ) : (
                                  initials(item.full_name)
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-800">
                                {item.shirt_number
                                  ? `#${item.shirt_number} `
                                  : ""}
                                {item.full_name}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                                  item.suspended_for_accumulation
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {item.yellow_cards}/
                                {
                                  builder.discipline!
                                    .yellow_card_suspension_threshold
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs font-bold leading-5 text-amber-800">
                          Reaching the limit gives a one-match suspension. A
                          card reaching the limit in the final group match does
                          not carry into the knockout stage.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Panel>
              </div>
              <Panel title="Set-Piece Takers">
                <p className="mb-4 text-sm text-slate-500">
                  Players are initially ordered by shooting ability. If the
                  first choice is no longer on the pitch, the simulator tries
                  the next available player in this order.
                </p>
                <div className="grid grid-cols-1 gap-4">
                  {(
                    [
                      {
                        label: "Penalty taker",
                        ids: penaltyTakerIds,
                        setter: setPenaltyTakerIds,
                      },
                      {
                        label: "Free-kick taker",
                        ids: freeKickTakerIds,
                        setter: setFreeKickTakerIds,
                      },
                    ] as const
                  ).map(({ label, ids, setter }) => (
                    <label
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black"
                    >
                      {label}
                      <select
                        className="manager-input mt-2 bg-white"
                        value={ids[0] ?? ""}
                        disabled={lineupLocked || ids.length === 0}
                        onChange={(event) =>
                          makePrimaryTaker(event.target.value, setter)
                        }
                      >
                        {ids.map((id) => {
                          const player = playerMap.get(id);
                          return (
                            <option key={id} value={id}>
                              {player?.players?.full_name ?? "Player"} ·{" "}
                              {player
                                ? naturalPlayerPosition(player)
                                : "Unknown"}
                            </option>
                          );
                        })}
                      </select>
                      <span className="mt-3 block text-xs font-semibold leading-5 text-slate-500">
                        Fallback order:{" "}
                        {ids
                          .slice(1, 5)
                          .map(
                            (id) =>
                              playerMap.get(id)?.players?.full_name ?? "Player",
                          )
                          .join(" → ") || "No fallback"}
                      </span>
                    </label>
                  ))}
                </div>
              </Panel>
            </>
          ) : null}
          {alternativesSlot ? (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur"
              onClick={() => setAlternativesSlot(null)}
            >
              <div
                className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--team-primary)]">
                      Alternatives
                    </p>
                    <h3 className="text-2xl font-black">
                      {alternativesSlot.displayRole} role
                    </h3>
                  </div>
                  <button
                    className="rounded-full bg-slate-100 px-4 py-2 font-bold"
                    onClick={() => setAlternativesSlot(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="mt-5 space-y-2">
                  {visibleAlternatives.map((item) => (
                    <div
                      key={item.player.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex min-w-0 items-center gap-3 text-left"
                        onClick={() => onPlayerClick(item.player)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            onPlayerClick(item.player);
                        }}
                      >
                        <Avatar
                          name={item.player.players?.full_name ?? "Player"}
                          src={item.player.players?.avatar_url}
                          small
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-black">
                            {item.player.players?.full_name}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
                            <span>
                              {item.natural_position} · {item.fitLabel}
                            </span>
                            {overallCapsule(
                              playerOverall(item.player),
                              playerRatingTier(item.player),
                            )}
                            {showLeagueRatings ? (
                              <>
                                {leagueRatingCapsule(item.player.league_rating)}
                                <PlayerSeasonContributionBadges
                                  goals={item.player.season_goals ?? 0}
                                  assists={item.player.season_assists ?? 0}
                                />
                              </>
                            ) : null}
                          </span>
                        </span>
                      </div>
                      <button
                        className="rounded-xl bg-[var(--team-primary)] px-4 py-2 text-xs font-black text-[var(--team-primary-text)]"
                        onClick={() =>
                          selectAlternative(alternativesSlot, item.player)
                        }
                      >
                        Select / Swap
                      </button>
                    </div>
                  ))}
                  {!visibleAlternatives.length ? (
                    <EmptyState label="No bench alternatives available for this role." />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function LineupPlayerRow({
  player,
  label,
  actionLabel,
  showLeagueStats = true,
  onOpen,
  onAction,
}: {
  player: PlayerRecord;
  label: string;
  actionLabel?: string;
  showLeagueStats?: boolean;
  onOpen: () => void;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
      <div
        role="button"
        tabIndex={0}
        className="flex min-w-0 items-center gap-3 text-left"
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") onOpen();
        }}
      >
        <Avatar
          name={player.players?.full_name ?? "Player"}
          src={player.players?.avatar_url}
          small
        />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-black">
              {player.players?.full_name}
            </span>
            {overallCapsule(playerOverall(player), playerRatingTier(player))}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
            <span>
              {naturalPlayerPosition(player)} · #{player.shirt_number ?? "-"}
            </span>
            {showLeagueStats ? (
              <>
                {leagueRatingCapsule(player.league_rating)}
                <PlayerSeasonContributionBadges
                  goals={player.season_goals ?? 0}
                  assists={player.season_assists ?? 0}
                />
              </>
            ) : null}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-500 ring-1 ring-slate-200">
          {label}
        </span>
        {actionLabel && onAction ? (
          <button
            className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-black text-[var(--team-primary)] transition hover:bg-[var(--team-primary)] hover:text-[var(--team-primary-text)]"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ResultsSection({
  results,
  activeTeam,
  activeSeason,
  onTeamClick,
  onOpenMatch,
}: Parameters<typeof SectionView>[0]) {
  return (
    <div className="space-y-6">
      <PageTitle
        title="Results"
        subtitle="Confirmed results only. Manager cannot edit result or stats."
      />
      <FixtureTable
        fixtures={results}
        activeTeamId={activeTeam?.id}
        showHomeAway={!isManagerGroupKnockoutFormat(activeSeason?.format)}
        emptyLabel="No results yet. Results will appear after matches are confirmed."
        onTeamClick={onTeamClick}
        onOpen={(fixture) => onOpenMatch(fixture, "results")}
      />
    </div>
  );
}

function StandingsSection({
  standings,
  activeTeam,
  activeSeason,
  onTeamClick,
}: Parameters<typeof SectionView>[0]) {
  const [groups, setGroups] = useState<SeasonGroupRecord[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const isGroupKnockout = isManagerGroupKnockoutFormat(activeSeason?.format);
  useEffect(() => {
    if (!isGroupKnockout || !activeSeason?.id) return;
    let alive = true;
    setLoadingGroups(true);
    api<{ groups: SeasonGroupRecord[] }>(
      `/manager/seasons/${activeSeason.id}/groups`,
    )
      .then((payload) => {
        if (alive) setGroups(payload.groups);
      })
      .catch(() => {
        if (alive) setGroups([]);
      })
      .finally(() => {
        if (alive) setLoadingGroups(false);
      });
    return () => {
      alive = false;
    };
  }, [activeSeason?.id, isGroupKnockout]);
  const standingByTeam = useMemo(
    () => new Map(standings.map((row) => [row.team_registration_id, row])),
    [standings],
  );

  if (isGroupKnockout) {
    return (
      <div className="space-y-6">
        <PageTitle
          title="Standings"
          subtitle="Group tables for the selected group + knockout season."
        />
        {loadingGroups ? <LoadingState label="Loading groups..." /> : null}
        {!loadingGroups && groups.length === 0 ? (
          <EmptyState label="No groups created yet." />
        ) : null}
        <div className="grid gap-6 xl:grid-cols-2">
          {groups.map((group) => {
            const rows = group.teams
              .map((item) => {
                const team = item.team_registration;
                return {
                  team,
                  standing: team ? standingByTeam.get(team.id) : undefined,
                };
              })
              .sort(
                (a, b) =>
                  Number(a.standing?.position ?? Number.MAX_SAFE_INTEGER) -
                    Number(b.standing?.position ?? Number.MAX_SAFE_INTEGER) ||
                  String(a.team?.id ?? "").localeCompare(
                    String(b.team?.id ?? ""),
                  ),
              );
            return (
              <Panel key={group.id} title={group.name}>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {["#", "Team", "P", "W", "D", "L", "GD", "Pts"].map(
                          (head) => (
                            <th key={head} className="px-4 py-3">
                              {head}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ team, standing }, index) => (
                        <tr
                          key={team?.id ?? index}
                          className={`border-t ${team?.id === activeTeam?.id ? "bg-green-50" : "bg-white"}`}
                        >
                          <td className="px-4 py-3 font-bold">{index + 1}</td>
                          <td className="px-4 py-3">
                            <TeamLogoName
                              team={team?.teams}
                              teamId={team?.id}
                              onTeamClick={onTeamClick}
                            />
                          </td>
                          <td className="px-4 py-3">{standing?.played ?? 0}</td>
                          <td className="px-4 py-3">{standing?.won ?? 0}</td>
                          <td className="px-4 py-3">{standing?.drawn ?? 0}</td>
                          <td className="px-4 py-3">{standing?.lost ?? 0}</td>
                          <td className="px-4 py-3">
                            {standing?.goal_difference ?? 0}
                          </td>
                          <td className="px-4 py-3 font-black text-[var(--team-primary)]">
                            {standing?.points ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Standings"
        subtitle="League table for the selected season."
      />
      <Panel title="Table">
        {standings.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                  ].map((head) => (
                    <th key={head} className="px-4 py-3">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row, index) => (
                  <tr
                    key={row.team_registration_id}
                    className={`border-t ${row.team_registration_id === activeTeam?.id ? "bg-green-50" : "bg-white"}`}
                  >
                    <td className="px-4 py-3 font-bold">{index + 1}</td>
                    <td className="px-4 py-3">
                      <TeamLogoName
                        team={row.team_registrations?.teams}
                        teamId={row.team_registration_id}
                        onTeamClick={onTeamClick}
                      />
                    </td>
                    <td className="px-4 py-3">{row.played}</td>
                    <td className="px-4 py-3">{row.won}</td>
                    <td className="px-4 py-3">{row.drawn}</td>
                    <td className="px-4 py-3">{row.lost}</td>
                    <td className="px-4 py-3">{row.goals_for}</td>
                    <td className="px-4 py-3">{row.goals_against}</td>
                    <td className="px-4 py-3">{row.goal_difference}</td>
                    <td className="px-4 py-3 font-black text-[var(--team-primary)]">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No standings yet." />
        )}
      </Panel>
    </div>
  );
}

function GroupConditionPanel({
  standings,
  activeTeam,
  activeSeason,
  onTeamClick,
}: {
  standings: StandingRecord[];
  activeTeam: TeamRecord | null;
  activeSeason: Season | null;
  onTeamClick: (teamId: string) => void;
}) {
  const [groups, setGroups] = useState<SeasonGroupRecord[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  useEffect(() => {
    if (!activeSeason?.id) return;
    let alive = true;
    setLoadingGroups(true);
    api<{ groups: SeasonGroupRecord[] }>(
      `/manager/seasons/${activeSeason.id}/groups`,
    )
      .then((payload) => {
        if (alive) setGroups(payload.groups);
      })
      .catch(() => {
        if (alive) setGroups([]);
      })
      .finally(() => {
        if (alive) setLoadingGroups(false);
      });
    return () => {
      alive = false;
    };
  }, [activeSeason?.id]);
  const standingByTeam = useMemo(
    () => new Map(standings.map((row) => [row.team_registration_id, row])),
    [standings],
  );
  return (
    <Panel title="Group Current Condition">
      {loadingGroups ? <LoadingState label="Loading groups..." /> : null}
      {!loadingGroups && groups.length === 0 ? (
        <EmptyState label="No groups created yet." />
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((group) => {
          const rows = group.teams
            .map((item) => {
              const team = item.team_registration;
              return {
                team,
                standing: team ? standingByTeam.get(team.id) : undefined,
              };
            })
            .sort(
              (a, b) =>
                Number(a.standing?.position ?? Number.MAX_SAFE_INTEGER) -
                  Number(b.standing?.position ?? Number.MAX_SAFE_INTEGER) ||
                String(a.team?.id ?? "").localeCompare(
                  String(b.team?.id ?? ""),
                ),
            );
          return (
            <div
              key={group.id}
              className="overflow-hidden rounded-2xl border border-slate-200"
            >
              <div className="bg-slate-50 px-4 py-3 font-black">
                {group.name}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-xs uppercase text-slate-500">
                  <tr>
                    {["#", "Team", "P", "GD", "Pts"].map((head) => (
                      <th key={head} className="px-4 py-3">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ team, standing }, index) => (
                    <tr
                      key={team?.id ?? index}
                      className={`border-t ${team?.id === activeTeam?.id ? "bg-green-50" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 font-bold">{index + 1}</td>
                      <td className="px-4 py-3">
                        <TeamLogoName
                          team={team?.teams}
                          teamId={team?.id}
                          onTeamClick={onTeamClick}
                        />
                      </td>
                      <td className="px-4 py-3">{standing?.played ?? 0}</td>
                      <td className="px-4 py-3">
                        {standing?.goal_difference ?? 0}
                      </td>
                      <td className="px-4 py-3 font-black text-[var(--team-primary)]">
                        {standing?.points ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function StatsSection({
  mode,
  activeTeam,
  activeSeason,
}: Parameters<typeof SectionView>[0] & { mode: "player" | "team" }) {
  const [seasonTeams, setSeasonTeams] = useState<TeamRecord[]>([]);
  const [teamFilter, setTeamFilter] = useState(activeTeam?.id ?? "MY_TEAM");
  const [report, setReport] = useState<ManagerStatsReport | null>(null);
  const [openCard, setOpenCard] = useState<StatCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeSeason?.id) return;
    let alive = true;
    api<{ teams: TeamRecord[] }>(`/manager/seasons/${activeSeason.id}/teams`)
      .then((payload) => {
        if (alive) setSeasonTeams(payload.teams);
      })
      .catch(() => {
        if (alive) setSeasonTeams([]);
      });
    return () => {
      alive = false;
    };
  }, [activeSeason?.id]);

  useEffect(() => {
    if (!activeTeam?.id) return;
    setTeamFilter(activeTeam.id);
  }, [activeTeam?.id]);

  async function loadStats(value = teamFilter) {
    if (!activeSeason?.id) return;
    setLoading(true);
    setError("");
    try {
      const teamId = value === "MY_TEAM" ? (activeTeam?.id ?? "ALL") : value;
      const payload = await api<ManagerStatsReport>(
        `/manager/seasons/${activeSeason.id}/stat-leaderboards?teamId=${teamId}`,
      );
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats(activeTeam?.id ?? "ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeason?.id, activeTeam?.id, mode]);

  const title = mode === "player" ? "Player Stats" : "Team Stats";
  const sections =
    mode === "player"
      ? (report?.player_sections ?? [])
      : (report?.team_sections ?? []);
  return (
    <div className="space-y-6">
      <PageTitle
        title={title}
        subtitle={`${title} default to your selected team. Choose another team or All Stats to compare the full season.`}
      />
      <div className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <button
          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${teamFilter === activeTeam?.id ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-slate-50 text-slate-700 hover:bg-purple-50"}`}
          onClick={() => {
            const id = activeTeam?.id ?? "ALL";
            setTeamFilter(id);
            void loadStats(id);
          }}
        >
          My Team Stats
        </button>
        <button
          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${teamFilter === "ALL" ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-slate-50 text-slate-700 hover:bg-purple-50"}`}
          onClick={() => {
            setTeamFilter("ALL");
            void loadStats("ALL");
          }}
        >
          All Stats
        </button>
        <select
          className="manager-input max-w-xs"
          value={teamFilter}
          onChange={(event) => {
            setTeamFilter(event.target.value);
            void loadStats(event.target.value);
          }}
        >
          <option value={activeTeam?.id ?? "MY_TEAM"}>My team only</option>
          <option value="ALL">All season teams</option>
          {seasonTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.teams?.name ?? "Team"}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <LoadingState label={`Loading ${title.toLowerCase()}...`} />
      ) : (
        <LeaderboardSections
          title={title}
          sections={sections}
          onOpen={setOpenCard}
        />
      )}
      {openCard ? (
        <LeaderboardModal card={openCard} onClose={() => setOpenCard(null)} />
      ) : null}
    </div>
  );
}

function isManagerAuthored(item: MessageRecord) {
  return (item.sender_role ?? "ADMIN").toUpperCase() === "MANAGER";
}

// Group a flat message list into conversation threads. A thread is keyed by its
// root message (one with no parent); replies attach under their root. Threads
// are ordered by their most recent activity so active conversations float up.
function buildMessageThreads(messages: MessageRecord[]) {
  const byId = new Map(messages.map((item) => [item.id, item]));
  const rootOf = (item: MessageRecord): MessageRecord => {
    let current = item;
    const seen = new Set<string>();
    while (current.parent_message_id && byId.has(current.parent_message_id)) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      current = byId.get(current.parent_message_id)!;
    }
    return current;
  };
  const threads = new Map<string, MessageRecord[]>();
  for (const item of messages) {
    const root = rootOf(item);
    const list = threads.get(root.id) ?? [];
    list.push(item);
    threads.set(root.id, list);
  }
  return Array.from(threads.entries())
    .map(([rootId, items]) => {
      const sorted = [...items].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const root: MessageRecord = byId.get(rootId) ?? sorted[0]!;
      return {
        root,
        items: sorted,
        lastAt: sorted[sorted.length - 1]?.created_at ?? "",
        hasUnread: sorted.some((item) => !item.read_at),
      };
    })
    .sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
}

function MessagesSection({
  messages: dashboardMessages,
  activeTeam,
  onRefresh,
}: Parameters<typeof SectionView>[0]) {
  // The dashboard payload only carries the latest handful of messages; the
  // Messages section loads the full history so threads stay intact. We seed from
  // the dashboard slice so the list is never momentarily empty on entry.
  const [messages, setMessages] = useState<MessageRecord[]>(dashboardMessages);
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const reloadMessages = useCallback(async () => {
    const { messages: full } = await api<{ messages: MessageRecord[] }>(
      "/manager/messages",
    );
    setMessages(full);
    return full;
  }, []);

  useEffect(() => {
    void reloadMessages().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load messages"),
    );
  }, [reloadMessages]);

  const threads = buildMessageThreads(messages);

  const selectedThread =
    threads.find((thread) => thread.root.id === selectedRootId) ??
    threads[0] ??
    null;

  async function openThread(rootId: string) {
    setSelectedRootId(rootId);
    setReplyDraft("");
    const thread = threads.find((item) => item.root.id === rootId);
    const unread = (thread?.items ?? []).filter(
      (item) => !item.read_at && !isManagerAuthored(item),
    );
    if (unread.length) {
      await Promise.all(
        unread.map((item) =>
          api(`/manager/messages/${item.id}/read`, { method: "PATCH" }),
        ),
      );
      await reloadMessages();
      onRefresh();
    }
  }

  async function sendNew(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSending(true);
    setError("");
    try {
      await api("/manager/messages", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          team_registration_id: activeTeam?.id,
        }),
      });
      setDraft("");
      setComposeOpen(false);
      const full = await reloadMessages();
      const newest = buildMessageThreads(full)[0];
      if (newest) setSelectedRootId(newest.root.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const trimmed = replyDraft.trim();
    if (!trimmed || !selectedThread) return;
    setSending(true);
    setError("");
    try {
      await api("/manager/messages", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          parent_message_id: selectedThread.root.id,
        }),
      });
      setReplyDraft("");
      await reloadMessages();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  const canMessageAdmin = Boolean(activeTeam?.id);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Messages"
        subtitle="Admin notices and your conversations with the league office."
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canMessageAdmin}
          onClick={() => {
            setComposeOpen((open) => !open);
            setError("");
          }}
          className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--team-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {composeOpen ? "Cancel" : "Message admin"}
        </button>
        {!canMessageAdmin ? (
          <p className="text-sm text-slate-500">
            Register a team to message the league office.
          </p>
        ) : null}
      </div>
      {composeOpen ? (
        <Panel title="New message to admin">
          <form onSubmit={sendNew} className="space-y-3">
            <textarea
              className="manager-input min-h-[120px]"
              value={draft}
              maxLength={2000}
              placeholder="Write your message to the league office..."
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--team-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-red-600">{error}</p>
      ) : null}
      {threads.length === 0 && !composeOpen ? (
        <EmptyState label="No messages yet." />
      ) : null}
      {threads.length ? (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <Panel title="Conversations">
            <div className="space-y-2">
              {threads.map((thread) => (
                <button
                  key={thread.root.id}
                  className={`w-full rounded-2xl p-3 text-left text-sm transition hover:bg-purple-50 ${selectedThread?.root.id === thread.root.id ? "bg-purple-50" : "bg-slate-50"}`}
                  onClick={() => void openThread(thread.root.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">
                      {thread.root.related_type.replaceAll("_", " ")}
                    </p>
                    {thread.hasUnread ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    ) : null}
                  </div>
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
                <div className="space-y-3">
                  {selectedThread.items.map((item) => {
                    const mine = isManagerAuthored(item);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 ${mine ? "ml-6 bg-purple-50" : "mr-6 bg-slate-50"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            {mine ? "You" : "League office"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        <p className="mt-1 leading-7 text-slate-700">
                          {item.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {canMessageAdmin ? (
                  <form onSubmit={sendReply} className="space-y-2">
                    <textarea
                      className="manager-input min-h-[90px]"
                      value={replyDraft}
                      maxLength={2000}
                      placeholder="Reply to the league office..."
                      onChange={(event) => setReplyDraft(event.target.value)}
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={sending || !replyDraft.trim()}
                        className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--team-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sending ? "Sending..." : "Reply"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function ProfileSection({
  profile,
  onRefresh,
}: {
  profile: Profile | null;
  onRefresh: () => void;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const trimmed = fullName.trim();
  const dirty = trimmed !== (profile?.full_name ?? "").trim();

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { profile: updated } = await api<{ profile: Profile }>(
        "/manager/profile",
        {
          method: "PATCH",
          body: JSON.stringify({ full_name: trimmed }),
        },
      );
      updateStoredProfile(
        updated as unknown as Parameters<typeof updateStoredProfile>[0],
      );
      setSaved(true);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Profile & Settings"
        subtitle="Manager account information."
      />
      <Panel title="Profile">
        <form onSubmit={save} className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Full Name
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="manager-input"
              value={fullName}
              maxLength={160}
              onChange={(event) => {
                setFullName(event.target.value);
                setSaved(false);
              }}
              placeholder="Your full name"
            />
            <button
              type="submit"
              disabled={saving || !dirty || !trimmed}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--team-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>
          ) : null}
          {saved && !dirty ? (
            <p className="mt-2 text-sm font-semibold text-emerald-600">
              Name updated.
            </p>
          ) : null}
        </form>
        <Detail label="Email" value={profile?.email} />
        <Detail label="Role" value="Manager" />
        <Detail
          label="Joined On"
          value={profile?.created_at ? formatDate(profile.created_at) : "-"}
        />
      </Panel>
    </div>
  );
}

function CreateTeamEmpty({
  leagues,
  onCreated,
}: {
  leagues: League[];
  onCreated: () => void;
}) {
  const seasons = leagues.flatMap((league) =>
    (league.seasons ?? []).map((season) => ({ ...season, league })),
  );
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? "");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6D28D9");
  const [secondaryColor, setSecondaryColor] = useState("#111827");
  const [accentColor, setAccentColor] = useState("#F59E0B");
  const [homeJerseyUrl, setHomeJerseyUrl] = useState("");
  const [awayJerseyUrl, setAwayJerseyUrl] = useState("");
  const [gkHomeJerseyUrl, setGkHomeJerseyUrl] = useState("");
  const [gkAwayJerseyUrl, setGkAwayJerseyUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const requestedJerseys = {
        home_jersey_url: cleanUrl(homeJerseyUrl),
        away_jersey_url: cleanUrl(awayJerseyUrl),
        gk_home_jersey_url: cleanUrl(gkHomeJerseyUrl),
        gk_away_jersey_url: cleanUrl(gkAwayJerseyUrl),
      };
      const created = await api<{
        team?: NonNullable<TeamRecord["teams"]>;
        team_registration?: TeamRecord;
      }>("/manager/teams", {
        method: "POST",
        body: JSON.stringify({
          season_id: seasonId,
          name,
          short_name: shortName,
          logo_url: cleanUrl(logoUrl),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          ...requestedJerseys,
        }),
      });
      assertJerseySave(
        requestedJerseys,
        created.team_registration?.teams ?? created.team,
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Panel title="Create/Register Team">
        <p className="mb-5 text-slate-600">
          No team created yet. Create a team to get started. The team will be
          stored in the database.
        </p>
        {seasons.length === 0 ? (
          <EmptyState label="No leagues/seasons are open yet. Ask admin to create a league and season first." />
        ) : null}
        <form className="space-y-4" onSubmit={submit}>
          <select
            className="manager-input"
            value={seasonId}
            onChange={(event) => setSeasonId(event.target.value)}
            required
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.league.name} - {season.name}
              </option>
            ))}
          </select>
          <input
            className="manager-input"
            placeholder="Team name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            className="manager-input"
            placeholder="Team short name"
            value={shortName}
            onChange={(event) => setShortName(event.target.value)}
            required
          />
          <input
            className="manager-input"
            placeholder="Team logo URL (optional)"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="manager-input"
              placeholder="Home jersey URL (optional)"
              value={homeJerseyUrl}
              onChange={(event) => setHomeJerseyUrl(event.target.value)}
            />
            <input
              className="manager-input"
              placeholder="Away jersey URL (optional)"
              value={awayJerseyUrl}
              onChange={(event) => setAwayJerseyUrl(event.target.value)}
            />
            <input
              className="manager-input"
              placeholder="GK home jersey URL (optional)"
              value={gkHomeJerseyUrl}
              onChange={(event) => setGkHomeJerseyUrl(event.target.value)}
            />
            <input
              className="manager-input"
              placeholder="GK away jersey URL (optional)"
              value={gkAwayJerseyUrl}
              onChange={(event) => setGkAwayJerseyUrl(event.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ColorField
              label="Primary Color"
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorField
              label="Secondary Color"
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
            <ColorField
              label="Accent Color"
              value={accentColor}
              onChange={setAccentColor}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            disabled={saving || seasons.length === 0}
            className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Team"}
          </button>
        </form>
      </Panel>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`text-sm font-bold text-slate-700 ${disabled ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-500">
          {value.toUpperCase()}
        </span>
      </div>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-3">
          <input
            className="h-11 w-11 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 disabled:cursor-not-allowed"
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={label}
            disabled={disabled}
          />
          <div className="grid flex-1 grid-cols-10 gap-1.5">
            {teamColorPalette.map((color) => (
              <button
                key={`${label}-${color}`}
                type="button"
                disabled={disabled}
                className={`h-6 rounded-md border transition disabled:cursor-not-allowed ${disabled ? "" : "hover:scale-110"} ${value.toLowerCase() === color.toLowerCase() ? "border-slate-950 ring-2 ring-slate-300" : "border-white"}`}
                style={{ backgroundColor: color }}
                onClick={() => onChange(color)}
                title={color}
                aria-label={`${label} ${color}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamJerseysPanel({ team }: { team: TeamRecord | null }) {
  const jerseys = [
    { label: "Home", url: team?.teams?.home_jersey_url },
    { label: "Away", url: team?.teams?.away_jersey_url },
    { label: "GK Home", url: team?.teams?.gk_home_jersey_url },
    { label: "GK Away", url: team?.teams?.gk_away_jersey_url },
  ];
  const hasAnyJersey = jerseys.some((jersey) => jersey.url);

  return (
    <Panel title="Team Jerseys">
      {hasAnyJersey ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {jerseys.map((jersey) => (
            <ManagerJerseyCard
              key={jersey.label}
              label={jersey.label}
              url={jersey.url}
            />
          ))}
        </div>
      ) : (
        <EmptyState label="No jersey URLs set yet. Add home, away, GK home, and GK away jerseys from My Team → Team Settings." />
      )}
    </Panel>
  );
}

function ManagerJerseyCard({
  label,
  url,
}: {
  label: string;
  url: string | null | undefined;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <div className="mt-2 flex h-56 items-center justify-center rounded-2xl bg-white p-1">
        {url ? (
          <button
            type="button"
            className="flex h-full w-full items-center justify-center rounded-2xl transition hover:scale-[1.02] hover:bg-slate-50"
            onClick={() => setPreviewOpen(true)}
            title={`Open ${label} jersey`}
            aria-label={`Open ${label} jersey`}
          >
            <img
              className="max-h-full max-w-full object-contain"
              src={url}
              alt={`${label} jersey`}
            />
          </button>
        ) : (
          <span className="text-sm font-semibold text-slate-400">Not set</span>
        )}
      </div>
      {previewOpen && url ? (
        <FacePreviewModal
          name={`${label} Jersey`}
          src={url}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

function TeamSettingsModal({
  team,
  onClose,
  onSaved,
}: {
  team: TeamRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(team.teams?.name ?? "");
  const [shortName, setShortName] = useState(team.teams?.short_name ?? "");
  const [logoUrl, setLogoUrl] = useState(team.teams?.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    team.teams?.primary_color ?? "#6D28D9",
  );
  const [secondaryColor, setSecondaryColor] = useState(
    team.teams?.secondary_color ?? "#0B1626",
  );
  const [accentColor, setAccentColor] = useState(
    team.teams?.accent_color ?? "#16A34A",
  );
  const [homeJerseyUrl, setHomeJerseyUrl] = useState(
    team.teams?.home_jersey_url ?? "",
  );
  const [awayJerseyUrl, setAwayJerseyUrl] = useState(
    team.teams?.away_jersey_url ?? "",
  );
  const [gkHomeJerseyUrl, setGkHomeJerseyUrl] = useState(
    team.teams?.gk_home_jersey_url ?? "",
  );
  const [gkAwayJerseyUrl, setGkAwayJerseyUrl] = useState(
    team.teams?.gk_away_jersey_url ?? "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEditCoreTeamData =
    team.status === RegistrationStatus.DRAFT ||
    team.status === RegistrationStatus.PENDING;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const requestedJerseys = {
        home_jersey_url: cleanUrl(homeJerseyUrl),
        away_jersey_url: cleanUrl(awayJerseyUrl),
        gk_home_jersey_url: cleanUrl(gkHomeJerseyUrl),
        gk_away_jersey_url: cleanUrl(gkAwayJerseyUrl),
      };
      const saved = await api<{ team?: NonNullable<TeamRecord["teams"]> }>(
        `/manager/teams/${team.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...(canEditCoreTeamData
              ? {
                  name,
                  short_name: shortName,
                  logo_url: cleanUrl(logoUrl),
                  primary_color: primaryColor,
                  secondary_color: secondaryColor,
                  accent_color: accentColor,
                }
              : {}),
            ...requestedJerseys,
          }),
        },
      );
      assertJerseySave(requestedJerseys, saved.team);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update team settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur">
      <form
        className="mx-auto my-6 max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onSubmit={save}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[var(--team-primary)]">
              Team Settings
            </p>
            <h2 className="text-2xl font-black">{team.teams?.name}</h2>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Team Name
            <input
              className="manager-input mt-2 disabled:bg-slate-100 disabled:text-slate-500"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={!canEditCoreTeamData}
            />
          </label>
          <label className="text-sm font-bold">
            Short Name
            <input
              className="manager-input mt-2 disabled:bg-slate-100 disabled:text-slate-500"
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
              required
              disabled={!canEditCoreTeamData}
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Logo URL
            <input
              className="manager-input mt-2 disabled:bg-slate-100 disabled:text-slate-500"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              disabled={!canEditCoreTeamData}
            />
          </label>
          <ColorField
            label="Primary Color"
            value={primaryColor}
            onChange={setPrimaryColor}
            disabled={!canEditCoreTeamData}
          />
          <ColorField
            label="Secondary Color"
            value={secondaryColor}
            onChange={setSecondaryColor}
            disabled={!canEditCoreTeamData}
          />
          <ColorField
            label="Accent Color"
            value={accentColor}
            onChange={setAccentColor}
            disabled={!canEditCoreTeamData}
          />
          <label className="text-sm font-bold sm:col-span-2">
            Home Jersey URL
            <input
              className="manager-input mt-2"
              value={homeJerseyUrl}
              onChange={(event) => setHomeJerseyUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Away Jersey URL
            <input
              className="manager-input mt-2"
              value={awayJerseyUrl}
              onChange={(event) => setAwayJerseyUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            GK Home Jersey URL
            <input
              className="manager-input mt-2"
              value={gkHomeJerseyUrl}
              onChange={(event) => setGkHomeJerseyUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            GK Away Jersey URL
            <input
              className="manager-input mt-2"
              value={gkAwayJerseyUrl}
              onChange={(event) => setGkAwayJerseyUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>
        <p className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
          Team identity and colors can be changed until admin approval. Jersey
          URLs can be updated anytime.
        </p>
        {error ? (
          <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border px-5 py-3 font-bold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Team Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

function GenerateSquadModal({
  team,
  summary,
  onClose,
  onPlayerClick,
  onGenerated,
}: {
  team: TeamRecord;
  summary: SquadSummary | null;
  onClose: () => void;
  onPlayerClick: (player: PlayerRecord) => void;
  onGenerated: () => void;
}) {
  const max =
    summary?.max_squad_size ?? one(team.seasons)?.max_players_per_team ?? 22;
  const current = summary?.total ?? 0;
  const remaining = Math.max(0, max - current);
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState(remaining);
  const [breakdown, setBreakdown] = useState<PositionBreakdown>(() =>
    suggestedPositionBreakdown(remaining),
  );
  const [generated, setGenerated] = useState<PlayerRecord[]>([]);
  const [editing, setEditing] = useState<PlayerRecord | null>(null);
  const [error, setError] = useState("");

  const breakdownTotal = Object.values(breakdown).reduce(
    (sum, value) => sum + value,
    0,
  );
  const grouped = groupedBreakdown(breakdown);
  const currentGoalkeepers = summary?.distribution?.goalkeepers ?? 0;
  const breakdownError = validateBreakdown(
    breakdown,
    target,
    remaining,
    current,
    currentGoalkeepers,
  );

  async function generate() {
    setStep(3);
    setError("");
    try {
      const result = await api<{ generated_players: PlayerRecord[] }>(
        `/manager/teams/${team.id}/generate-squad`,
        {
          method: "POST",
          body: JSON.stringify({
            targetGenerateCount: target,
            positionBreakdown: breakdown,
            identityTypeMode: "mixed_generated",
            overwriteDraftPlayers: false,
          }),
        },
      );
      setGenerated(result.generated_players);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate squad");
      setStep(2);
    }
  }

  function updateBreakdown(position: FootballPosition, value: number) {
    setBreakdown((currentBreakdown) => ({
      ...currentBreakdown,
      [position]: Math.max(0, value),
    }));
  }

  async function removeDraft(player: PlayerRecord) {
    await api(`/manager/players/${player.id}`, { method: "DELETE" });
    setGenerated((currentPlayers) =>
      currentPlayers.filter((item) => item.id !== player.id),
    );
  }

  async function submitForApproval(playerIds: string[]) {
    await api(`/manager/teams/${team.id}/submit-players`, {
      method: "POST",
      body: JSON.stringify({ playerIds }),
    });
    onGenerated();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--team-primary)]">
              Generate Squad
            </p>
            <h2 className="text-2xl font-black">{team.teams?.name}</h2>
          </div>
          <button
            className="rounded-full bg-slate-100 px-4 py-2 font-bold transition hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {step === 1 ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <DashboardCard
                label="Current Squad Size"
                value={current}
                color="slate"
              />
              <DashboardCard
                label="Max Squad Size"
                value={max}
                color="purple"
              />
              <DashboardCard
                label="Remaining Slots"
                value={remaining}
                color="green"
              />
            </div>
            <label className="block text-sm font-bold text-slate-700">
              Target Generate Count
            </label>
            <input
              className="manager-input"
              type="number"
              min={1}
              max={remaining}
              value={target}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTarget(next);
                setBreakdown(suggestedPositionBreakdown(next));
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                className="rounded-2xl border px-5 py-3 font-bold"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50"
                disabled={remaining === 0}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {positions.map((position) => (
                <label
                  key={position}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {position}
                  </span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold outline-none focus:border-[var(--team-primary)]"
                    type="number"
                    min={0}
                    value={breakdown[position] ?? 0}
                    onChange={(event) =>
                      updateBreakdown(position, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <DashboardCard
                label="Goalkeepers"
                value={grouped.goalkeepers}
                color="slate"
              />
              <DashboardCard
                label="Defenders"
                value={grouped.defenders}
                color="green"
              />
              <DashboardCard
                label="Midfielders"
                value={grouped.midfielders}
                color="yellow"
              />
              <DashboardCard
                label="Forwards"
                value={grouped.forwards}
                color="purple"
              />
            </div>
            <p
              className={`text-sm font-bold ${breakdownError ? "text-red-600" : "text-green-700"}`}
            >
              {breakdownError ??
                `Total Selected: ${breakdownTotal} / ${target}. Remaining Slots: ${Math.max(0, target - breakdownTotal)}`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-2xl border px-5 py-3 font-bold"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                disabled={Boolean(breakdownError)}
                className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50"
                onClick={() => void generate()}
              >
                Generate Players
              </button>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="mt-8 space-y-3 text-slate-700">
            {[
              "Selecting Bangladeshi names",
              "Assigning positions",
              "Assigning realistic jersey numbers",
              "Creating numeric NID/Birth ID values",
              "Saving draft players",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"
              >
                <RefreshCcw
                  className="animate-spin text-[var(--team-primary)]"
                  size={18}
                />
                <span className="font-semibold">{item}</span>
              </div>
            ))}
          </div>
        ) : null}
        {step === 4 ? (
          <div className="mt-6 space-y-5">
            <PlayerTable
              players={generated}
              onPlayerClick={onPlayerClick}
              onEdit={setEditing}
              onRemove={(player) =>
                void removeDraft(player).catch((err) =>
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to remove player",
                  ),
                )
              }
              emptyLabel="No players were created."
            />
            <div className="flex justify-end gap-3">
              <button
                className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 font-bold text-green-700 transition hover:bg-green-100"
                onClick={() =>
                  void submitForApproval(generated.map((player) => player.id))
                }
                disabled={generated.length === 0}
              >
                Submit All for Approval
              </button>
              <button
                className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)]"
                onClick={onGenerated}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {editing ? (
        <EditDraftPlayerModal
          player={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setGenerated((items) =>
              items.map((item) => (item.id === updated.id ? updated : item)),
            );
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PlayerTable({
  players,
  onPlayerClick,
  onEdit,
  onRemove,
  minifaceDrafts,
  onMinifaceChange,
  emptyLabel,
}: {
  players: PlayerRecord[];
  onPlayerClick: (player: PlayerRecord) => void;
  onEdit?: (player: PlayerRecord) => void;
  onRemove?: (player: PlayerRecord) => void;
  minifaceDrafts?: Record<string, string>;
  onMinifaceChange?: (playerId: string, value: string) => void;
  emptyLabel: string;
}) {
  if (players.length === 0) return <EmptyState label={emptyLabel} />;
  const canEdit = (player: PlayerRecord) =>
    player.status === RegistrationStatus.DRAFT ||
    player.status === RegistrationStatus.PENDING;
  const showMinifaceEditor = Boolean(minifaceDrafts && onMinifaceChange);
  const tableHeads = showMinifaceEditor
    ? [
        "Avatar",
        "Miniface URL",
        "Code",
        "Player Name",
        "Age",
        "Position",
        "Category",
        "No.",
        "ID Type",
        "ID Number",
        "Foot",
        "OVR",
        "Status",
        "Action",
      ]
    : [
        "Avatar",
        "Code",
        "Player Name",
        "Age",
        "Position",
        "Category",
        "No.",
        "ID Type",
        "ID Number",
        "Foot",
        "OVR",
        "Status",
        "Action",
      ];
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
      <table
        className={`w-full text-left text-sm ${showMinifaceEditor ? "min-w-[1320px]" : "min-w-[980px]"}`}
      >
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {tableHeads.map((head) => (
              <th key={head} className="px-4 py-3">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const draftAvatarUrl =
              minifaceDrafts?.[player.id] ?? player.players?.avatar_url ?? "";
            return (
              <tr
                key={player.id}
                className="border-t transition hover:bg-purple-50/40"
              >
                <td className="px-4 py-3">
                  <Avatar
                    name={player.players?.full_name ?? "Player"}
                    src={draftAvatarUrl || null}
                    small
                  />
                </td>
                {showMinifaceEditor ? (
                  <td className="px-4 py-3">
                    <input
                      className="w-72 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-[var(--team-primary)] focus:ring-2 focus:ring-purple-100"
                      placeholder="Paste miniface URL"
                      value={draftAvatarUrl}
                      onChange={(event) =>
                        onMinifaceChange?.(player.id, event.target.value)
                      }
                    />
                  </td>
                ) : null}
                <td className="px-4 py-3 font-mono text-xs">
                  {player.player_code ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-left font-bold transition hover:text-[var(--team-primary)] hover:underline"
                    onClick={() => onPlayerClick(player)}
                  >
                    {player.players?.full_name ?? "-"}
                  </button>
                </td>
                <td className="px-4 py-3 font-bold">
                  {calculateAge(player.players?.date_of_birth)}
                </td>
                <td className="px-4 py-3">
                  {player.football_position ?? player.position}
                </td>
                <td className="px-4 py-3">{player.position_category ?? "-"}</td>
                <td className="px-4 py-3 font-bold">
                  #{player.shirt_number ?? "-"}
                </td>
                <td className="px-4 py-3">{player.players?.id_type ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {player.players?.generated_identity_number ?? "-"}
                </td>
                <td className="px-4 py-3">
                  {player.preferred_foot ?? "UNKNOWN"}
                </td>
                <td className="px-4 py-3">
                  {overallCapsule(
                    playerOverall(player),
                    playerRatingTier(player),
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={displayPlayerStatus(player)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-[var(--team-primary)] transition hover:bg-[var(--team-primary)] hover:text-[var(--team-primary-text)]"
                      onClick={() => onPlayerClick(player)}
                    >
                      Open
                    </button>
                    {canEdit(player) && onEdit ? (
                      <button
                        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                        onClick={() => onEdit(player)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {canEdit(player) && onRemove ? (
                      <button
                        className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"
                        onClick={() => onRemove(player)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditDraftPlayerModal({
  player,
  onClose,
  onSaved,
}: {
  player: PlayerRecord;
  onClose: () => void;
  onSaved: (player: PlayerRecord) => void;
}) {
  const [fullName, setFullName] = useState(player.players?.full_name ?? "");
  const [position, setPosition] = useState<FootballPosition>(
    (player.football_position as FootballPosition) ?? FootballPosition.CM,
  );
  const [jersey, setJersey] = useState(String(player.shirt_number ?? ""));
  const [preferredFoot, setPreferredFoot] = useState<PreferredFoot>(
    (player.preferred_foot as PreferredFoot) ?? PreferredFoot.RIGHT,
  );
  const [avatarUrl, setAvatarUrl] = useState(player.players?.avatar_url ?? "");
  const [idType, setIdType] = useState<string>(
    player.players?.id_type === "BIRTH_ID" ? "BIRTH_ID" : "NID",
  );
  const [identityNumber, setIdentityNumber] = useState(
    player.players?.generated_identity_number ?? "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api<{ player_registration: PlayerRecord }>(
        `/manager/players/${player.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            full_name: fullName,
            football_position: position,
            shirt_number: Number(jersey),
            preferred_foot: preferredFoot,
            avatar_url: avatarUrl || null,
            id_type: idType,
            generated_identity_number: identityNumber,
          }),
        },
      );
      onSaved(data.player_registration);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update draft player",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/60 p-4 backdrop-blur">
      <form
        className="mx-auto my-6 max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onSubmit={save}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[var(--team-primary)]">
              Edit Player
            </p>
            <h2 className="text-2xl font-black">{player.players?.full_name}</h2>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 font-bold"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Full Name
            <input
              className="manager-input mt-2"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-bold">
            Position
            <select
              className="manager-input mt-2"
              value={position}
              onChange={(event) =>
                setPosition(event.target.value as FootballPosition)
              }
            >
              {positions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Jersey Number
            <input
              className="manager-input mt-2"
              type="number"
              min={1}
              max={99}
              value={jersey}
              onChange={(event) => setJersey(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-bold">
            Preferred Foot
            <select
              className="manager-input mt-2"
              value={preferredFoot}
              onChange={(event) =>
                setPreferredFoot(event.target.value as PreferredFoot)
              }
            >
              {Object.values(PreferredFoot).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Avatar URL
            <input
              className="manager-input mt-2"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            ID Type
            <select
              className="manager-input mt-2"
              value={idType}
              onChange={(event) => setIdType(event.target.value)}
            >
              <option value="NID">NID</option>
              <option value="BIRTH_ID">Birth ID</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            ID Number
            <input
              className="manager-input mt-2"
              inputMode="numeric"
              pattern="[0-9]*"
              value={identityNumber}
              onChange={(event) =>
                setIdentityNumber(event.target.value.replace(/\D/gu, ""))
              }
              required
            />
          </label>
        </div>
        <div className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">
          If you change position, you may need to adjust the jersey number
          manually. It must remain unique in this squad.
        </div>
        {error ? (
          <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border px-5 py-3 font-bold"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            disabled={saving}
            className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 font-bold text-[var(--team-primary-text)] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Player"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlayerDetailModal({
  player,
  theme,
  onClose,
  onDeleted,
}: {
  player: PlayerRecord;
  theme: ManagerTheme;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState<
    "League Stats" | "Ability Scores" | "Personal Data"
  >("League Stats");
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(player.players?.avatar_url ?? "");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [profilePayload, setProfilePayload] =
    useState<PlayerProfilePayload | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const canDelete =
    player.status === RegistrationStatus.DRAFT ||
    player.status === RegistrationStatus.PENDING;
  const canEditMiniface =
    player.status === RegistrationStatus.DRAFT ||
    player.status === RegistrationStatus.PENDING;
  const activePlayer = profilePayload?.player ?? player;
  const isGoalkeeper =
    (activePlayer.football_position ?? activePlayer.position) ===
    FootballPosition.GK;
  const activeName =
    activePlayer.players?.full_name ?? player.players?.full_name ?? "Player";
  const activeAvatar =
    activePlayer.players?.avatar_url ?? player.players?.avatar_url;
  const activeCode = activePlayer.player_code ?? player.player_code ?? "-";
  const activePosition =
    activePlayer.football_position ??
    player.football_position ??
    activePlayer.position ??
    player.position ??
    "-";
  const activeOverall =
    profilePayload?.overall_rating ??
    playerOverall(activePlayer) ??
    playerOverall(player);
  const activeTier = ratingTierFromOverall(activeOverall);
  const activeAbility =
    one(activePlayer.player_abilities) ?? one(player.player_abilities);
  const canViewAbilityScores =
    profilePayload?.can_view_ability_scores ?? Boolean(activeAbility);

  useEffect(() => {
    let alive = true;
    setError("");
    setProfilePayload(null);
    setStatsLoading(true);
    api<PlayerProfilePayload>(`/manager/players/${player.id}/profile`)
      .then((payload) => {
        if (alive) setProfilePayload(payload);
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error ? err.message : "Failed to load player stats",
          );
      })
      .finally(() => {
        if (alive) setStatsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [player.id]);

  async function deletePlayer() {
    setError("");
    try {
      await api(`/manager/players/${player.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete player");
    }
  }

  async function saveMiniface() {
    if (!canEditMiniface) return;
    setSavingAvatar(true);
    setError("");
    try {
      await api(`/manager/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ avatar_url: avatarUrl || null }),
      });
      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save miniface URL",
      );
    } finally {
      setSavingAvatar(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 backdrop-blur"
      style={
        {
          "--team-primary": theme.primary,
          "--team-secondary": theme.secondary,
          "--team-accent": theme.accent,
          "--team-primary-text": getReadableTextColor(theme.primary),
        } as CSSProperties
      }
    >
      <div className="mx-auto my-6 max-h-[calc(100vh-3rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-[var(--team-primary)] to-[var(--team-secondary)] p-6 text-[var(--team-primary-text)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={activeName} src={activeAvatar} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="truncate text-3xl font-black">{activeName}</h2>
                  <span
                    className={`inline-flex rounded-full px-4 py-1.5 text-sm font-black ring-1 ${overallCapsuleClass(activeTier)}`}
                  >
                    OVR {activeOverall ?? "N/A"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--team-primary)] px-4 py-1.5 text-sm font-black text-[var(--team-primary-text)] ring-1 ring-white/30">
                    {activePosition}
                  </span>
                  <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold ring-1 ring-white/20">
                    #{activePlayer.shirt_number ?? "-"}
                  </span>
                  {leagueRatingCapsule(profilePayload?.league_rating)}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {canDelete ? (
                <button
                  className="rounded-full bg-red-50 px-4 py-2 font-bold text-red-700 transition hover:bg-red-100"
                  onClick={() => void deletePlayer()}
                >
                  Delete
                </button>
              ) : null}
              <button
                className="rounded-full bg-white/90 px-4 py-2 font-bold text-slate-950 transition hover:bg-white"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {error ? (
            <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          ) : null}
          <Tabs
            values={
              canViewAbilityScores
                ? ["League Stats", "Ability Scores", "Personal Data"]
                : ["League Stats", "Personal Data"]
            }
            value={tab}
            onChange={(value) => setTab(value as typeof tab)}
          />
          {tab === "Ability Scores" && canViewAbilityScores ? (
            <div className="mt-5">
              <AbilityScoresPanel
                player={activePlayer}
                ability={activeAbility ?? null}
              />
            </div>
          ) : null}
          {tab === "Personal Data" ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Detail label="Player Code" value={activeCode} />
              <Detail label="Full Name" value={activeName} />
              <Detail
                label="Date of Birth"
                value={activePlayer.players?.date_of_birth ?? "Not provided"}
              />
              <Detail
                label="Age"
                value={
                  activePlayer.players?.date_of_birth
                    ? calculateAge(activePlayer.players.date_of_birth)
                    : "-"
                }
              />
              <Detail label="Position" value={activePosition} />
              <Detail
                label="Jersey Number"
                value={
                  activePlayer.shirt_number
                    ? `#${activePlayer.shirt_number}`
                    : "-"
                }
              />
              <Detail
                label="Preferred Foot"
                value={activePlayer.preferred_foot ?? "UNKNOWN"}
              />
              <Detail
                label="Overall Rating"
                value={activeOverall ?? "Not rated"}
              />
              <Detail
                label="League Rating"
                value={leagueRatingCapsule(profilePayload?.league_rating, {
                  prefix: "",
                  fallback: "No league rating yet",
                })}
              />
              <Detail
                label="ID Type"
                value={activePlayer.players?.id_type ?? "-"}
              />
              <Detail
                label="ID Number"
                value={activePlayer.players?.generated_identity_number ?? "-"}
              />
              <Detail
                label="Masked ID"
                value={
                  activePlayer.players?.id_number_last4
                    ? `****${activePlayer.players.id_number_last4}`
                    : "-"
                }
              />
              <Detail label="Approval Status" value={activePlayer.status} />
              <Detail
                label="Player Status"
                value={activePlayer.player_status ?? "ACTIVE"}
              />
              <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Miniface / Avatar URL
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    className="manager-input flex-1"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="Paste player miniface image URL"
                    disabled={!canEditMiniface}
                  />
                  <button
                    type="button"
                    disabled={!canEditMiniface || savingAvatar}
                    onClick={() => void saveMiniface()}
                    className="rounded-2xl bg-[var(--team-primary)] px-5 py-3 text-sm font-black text-[var(--team-primary-text)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAvatar ? "Saving..." : "Save Miniface"}
                  </button>
                </div>
                {!canEditMiniface ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Approved players cannot be edited by manager.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {tab === "League Stats" ? (
            <div className="mt-5 space-y-5">
              {statsLoading ? (
                <LoadingState label="Loading player league stats..." />
              ) : null}
              {!statsLoading ? (
                <>
                  <PlayerStatsGrid
                    stats={profilePayload?.season_stats ?? null}
                    isGoalkeeper={isGoalkeeper}
                  />
                  <Panel title="Match-by-match">
                    {profilePayload?.match_stats?.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              {[
                                "Match",
                                "Minutes",
                                "Goals/Conceded",
                                "Assists/Saves",
                                "Pass Accuracy",
                                "Cards",
                                "Rating",
                              ].map((head) => (
                                <th key={head} className="px-3 py-2">
                                  {head}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {profilePayload.match_stats.map((row, index) => {
                              const fixture = one(
                                row.fixtures as
                                  | FixtureRecord
                                  | FixtureRecord[]
                                  | null
                                  | undefined,
                              );
                              const homeTeam = one(fixture?.home_team);
                              const awayTeam = one(fixture?.away_team);
                              const playerTeamId =
                                activePlayer.team_registration_id;
                              const playerIsHome =
                                fixture?.home_team_registration_id ===
                                playerTeamId;
                              const playerIsAway =
                                fixture?.away_team_registration_id ===
                                playerTeamId;
                              const ownTeam = playerIsAway
                                ? awayTeam
                                : homeTeam;
                              const opponentTeam = playerIsHome
                                ? awayTeam
                                : playerIsAway
                                  ? homeTeam
                                  : awayTeam;
                              const homeName =
                                homeTeam?.teams?.name ?? "Home team";
                              const awayName =
                                awayTeam?.teams?.name ?? "Away team";
                              const matchName = fixture
                                ? `${homeName} vs ${awayName}`
                                : String(row.fixture_id ?? "Match");
                              const score =
                                fixture?.home_score !== null &&
                                fixture?.home_score !== undefined &&
                                fixture?.away_score !== null &&
                                fixture?.away_score !== undefined
                                  ? (fixtureOutcomeScore(fixture) ?? "-")
                                  : (fixture?.status ?? "Scheduled");
                              const resolution = fixture
                                ? fixtureOutcomeLabel(fixture)
                                : null;
                              return (
                                <tr
                                  key={`${row.id ?? index}`}
                                  className="border-t"
                                >
                                  <td className="px-3 py-2">
                                    <div className="flex min-w-[260px] items-center gap-3">
                                      <Avatar
                                        name={
                                          opponentTeam?.teams?.name ??
                                          ownTeam?.teams?.name ??
                                          "Opponent"
                                        }
                                        src={
                                          opponentTeam?.teams?.logo_url ??
                                          ownTeam?.teams?.logo_url
                                        }
                                        small
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate font-black">
                                          {matchName}
                                        </p>
                                        <p className="text-xs font-bold text-slate-500">
                                          {fixture
                                            ? `${formatDate(fixture.kickoff_at)} · ${score}${resolution ? ` · ${resolution}` : ""}`
                                            : "Fixture detail unavailable"}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    {statValue(
                                      row.minutes ?? row.minutes_played,
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    {isGoalkeeper
                                      ? statValue(row.goals_conceded)
                                      : statValue(row.goals)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {isGoalkeeper
                                      ? statValue(row.saves)
                                      : statValue(row.assists)}
                                  </td>
                                  <td className="px-3 py-2">
                                    {percentage(
                                      row.accurate_passes,
                                      row.passes ?? row.total_passes,
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    {statValue(row.yellow_cards)}Y /{" "}
                                    {statValue(row.red_cards)}R
                                  </td>
                                  <td className="px-3 py-2 font-black">
                                    {leagueRatingCapsule(row.rating, {
                                      prefix: "",
                                    })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState label="No confirmed match stats yet." />
                    )}
                  </Panel>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AbilityScoresPanel({
  player,
  ability,
}: {
  player: PlayerRecord;
  ability: NonNullable<PlayerRecord["player_abilities"]>[number] | null;
}) {
  const isGoalkeeper =
    (player.football_position ?? player.position) === FootballPosition.GK;
  const fields: Array<
    [string, keyof NonNullable<PlayerRecord["player_abilities"]>[number]]
  > = isGoalkeeper
    ? [
        ["Tier", "rating_tier"],
        ["Overall", "overall_rating"],
        ["Shot Stopping", "shot_stopping"],
        ["Reflexes", "reflexes"],
        ["Positioning", "positioning"],
        ["Handling", "handling"],
        ["Diving", "diving"],
        ["Distribution", "distribution"],
        ["Physical", "physical"],
        ["Communication", "communication"],
      ]
    : [
        ["Tier", "rating_tier"],
        ["Overall", "overall_rating"],
        ["Shooting", "shooting"],
        ["Passing", "passing"],
        ["Dribbling", "dribbling"],
        ["Defending", "defending"],
        ["Physical", "physical"],
        ["Pace", "pace"],
        ["Stamina", "stamina"],
      ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-50 to-sky-50 p-4">
      <h3 className="text-lg font-black">Ability Scores</h3>
      {!ability ? (
        <p className="mt-3 rounded-2xl bg-white/70 p-4 text-sm font-bold text-slate-500">
          No ability rating has been assigned yet.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, key]) => (
            <div
              key={String(key)}
              className="rounded-2xl bg-white/80 p-3 ring-1 ring-white"
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {String(ability[key] ?? "-")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerStatsGrid({
  stats,
  isGoalkeeper,
}: {
  stats: Record<string, number | string | null> | null;
  isGoalkeeper: boolean;
}) {
  const sections: Array<{ title: string; items: Array<[string, string]> }> =
    isGoalkeeper
      ? [
          {
            title: "General",
            items: [
              ["Matches Played", "matches_played"],
              ["Starts", "starts"],
              ["Minutes Played", "minutes_played"],
              ["Average Rating", "average_rating"],
              ["Best Rating", "best_match_rating"],
              ["Lowest Rating", "lowest_match_rating"],
            ],
          },
          {
            title: "Goalkeeping",
            items: [
              ["Saves", "saves"],
              ["Goals Conceded", "goals_conceded"],
              ["Diving Saves", "diving_saves"],
              ["Saves Inside Box", "saves_inside_box"],
              ["Clean Sheets", "clean_sheets"],
            ],
          },
          {
            title: "Distribution",
            items: [
              ["Accurate Passes", "accurate_passes"],
              ["Accurate Long Balls", "accurate_long_balls"],
              ["Clearances", "clearances"],
            ],
          },
        ]
      : [
          {
            title: "General",
            items: [
              ["Matches Played", "matches_played"],
              ["Starts", "starts"],
              ["Minutes Played", "minutes_played"],
              ["Average Rating", "average_rating"],
              ["Best Rating", "best_match_rating"],
              ["Lowest Rating", "lowest_match_rating"],
            ],
          },
          {
            title: "Attack",
            items: [
              ["Goals", "goals"],
              ["Assists", "assists"],
              ["Shots", "shots"],
              ["Shots on Target", "shots_on_target"],
              ["Shot Accuracy", "shot_accuracy"],
              ["Chances Created", "chances_created"],
              ["Big Chances Created", "big_chances_created"],
              ["Big Chances Missed", "big_chances_missed"],
            ],
          },
          {
            title: "Passing + Dribbling",
            items: [
              ["Total Passes", "total_passes"],
              ["Accurate Passes", "accurate_passes"],
              ["Pass Accuracy", "pass_accuracy"],
              ["Dribbles Attempted", "dribbles_attempted"],
              ["Successful Dribbles", "successful_dribbles"],
              ["Dribble Success Rate", "dribble_success_rate"],
              ["Dispossessed", "dispossessed"],
            ],
          },
          {
            title: "Defense",
            items: [
              ["Tackles", "tackles"],
              ["Interceptions", "interceptions"],
              ["Clearances", "clearances"],
              ["Blocks", "blocks"],
            ],
          },
          {
            title: "Discipline",
            items: [
              ["Fouls Committed", "fouls_committed"],
              ["Yellow Cards", "yellow_cards"],
              ["Red Cards", "red_cards"],
            ],
          },
        ];

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--team-primary)]">
            {section.title}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map(([label, key]) => {
              const isRating =
                key === "average_rating" ||
                key === "best_match_rating" ||
                key === "lowest_match_rating";
              return (
                <Detail
                  key={key}
                  label={label}
                  value={
                    isRating
                      ? leagueRatingCapsule(stats?.[key], { prefix: "" })
                      : formatStat(stats, key)
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function statValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number" && Number.isFinite(value))
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function formatStat(
  stats: Record<string, number | string | null> | null,
  key: string,
) {
  if (!stats) return "0";
  if (key === "shot_accuracy")
    return percentage(stats.shots_on_target, stats.shots);
  if (key === "pass_accuracy")
    return percentage(stats.accurate_passes, stats.total_passes);
  if (key === "dribble_success_rate")
    return percentage(stats.successful_dribbles, stats.dribbles_attempted);
  if (
    key === "average_rating" ||
    key === "best_match_rating" ||
    key === "lowest_match_rating"
  )
    return managerFormatRating(stats[key]);
  return statValue(stats[key]);
}

function percentage(numerator: unknown, denominator: unknown) {
  const top =
    typeof numerator === "number" ? numerator : Number(numerator ?? 0);
  const bottom =
    typeof denominator === "number" ? denominator : Number(denominator ?? 0);
  if (!bottom || !Number.isFinite(top) || !Number.isFinite(bottom)) return "0%";
  return `${Math.round((top / bottom) * 100)}%`;
}

function managerFormatNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function managerFormatRating(value: unknown, fallback = "0.0") {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : fallback;
}

function managerRatingBadgeClass(value: number) {
  if (value > 7.9) return "bg-sky-500";
  if (value >= 7) return "bg-emerald-500";
  return "bg-orange-500";
}

function managerSafeColor(value: string | null | undefined, fallback: string) {
  const color = value?.trim();
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return fallback;
  return color;
}

function isManagerGroupKnockoutFormat(format?: string | null) {
  const normalized = String(format ?? "").toUpperCase();
  return normalized.includes("GROUP") && normalized.includes("KNOCKOUT");
}

type ManagerPlayerEventMeta = {
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

function managerBlankEventMeta(): ManagerPlayerEventMeta {
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

function managerEnsureEventMeta(
  map: Map<string, ManagerPlayerEventMeta>,
  playerId: string,
) {
  const existing = map.get(playerId);
  if (existing) return existing;
  const next = managerBlankEventMeta();
  map.set(playerId, next);
  return next;
}

function managerBuildEventMeta(
  events: Record<string, unknown>[],
  substitutions: Record<string, unknown>[],
) {
  const map = new Map<string, ManagerPlayerEventMeta>();
  for (const event of events) {
    const playerId = String(event.player_registration_id ?? "");
    if (!playerId) continue;
    const meta = managerEnsureEventMeta(map, playerId);
    const type = String(event.type ?? "");
    if (type === "GOAL" || type === "PENALTY_GOAL") meta.goals += 1;
    if (type === "OWN_GOAL") meta.ownGoals += 1;
    if (
      (type === "GOAL" || type === "PENALTY_GOAL") &&
      event.related_player_registration_id
    ) {
      managerEnsureEventMeta(
        map,
        String(event.related_player_registration_id),
      ).assists += 1;
    }
    if (type === "YELLOW_CARD") meta.yellow = true;
    if (type === "RED_CARD") meta.red = true;
    if (type === "PENALTY_MISS") meta.penaltyMiss = true;
    if (type === "PENALTY_SAVED") {
      // The event owner is the penalty taker; the related player is the
      // goalkeeper who made the save. The taker still missed the penalty.
      meta.penaltyMiss = true;
      if (event.related_player_registration_id) {
        managerEnsureEventMeta(
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
      const meta = managerEnsureEventMeta(map, outId);
      if (!meta.red) meta.subOutMinute = minute;
    }
    if (inId) managerEnsureEventMeta(map, inId).subInMinute = minute;
  }
  return map;
}

function managerBestRatedPlayer(stats: MatchDetailPlayerStat[]) {
  return (
    [...stats].sort((a, b) => Number(b.rating) - Number(a.rating))[0]
      ?.player_registration_id ?? null
  );
}

function FixtureTable({
  fixtures,
  activeTeamId,
  showHomeAway = true,
  emptyLabel,
  onTeamClick,
  onOpen,
}: {
  fixtures: FixtureRecord[];
  activeTeamId?: string | undefined;
  showHomeAway?: boolean;
  emptyLabel: string;
  onTeamClick?: ((teamId: string) => void) | undefined;
  onOpen?: (fixture: FixtureRecord) => void;
}) {
  if (fixtures.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {[
              "Date",
              "Team A",
              "Team B",
              showHomeAway ? "Home/Away" : "Fixture Type",
              "Competition",
              "Status",
              "Score",
              "Action",
            ].map((head) => (
              <th key={head} className="px-4 py-3">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fixtures.map((fixture) => {
            const side =
              fixture.home_team_registration_id === activeTeamId
                ? "Home"
                : fixture.away_team_registration_id === activeTeamId
                  ? "Away"
                  : "Other";
            const sideLabel = showHomeAway ? side : "Neutral";
            return (
              <tr key={fixture.id} className="border-t">
                <td className="px-4 py-3">{formatDate(fixture.kickoff_at)}</td>
                <td className="px-4 py-3">
                  <TeamLogoName
                    team={fixture.home_team?.teams}
                    teamId={fixture.home_team_registration_id}
                    onTeamClick={onTeamClick}
                  />
                </td>
                <td className="px-4 py-3">
                  <TeamLogoName
                    team={fixture.away_team?.teams}
                    teamId={fixture.away_team_registration_id}
                    onTeamClick={onTeamClick}
                  />
                </td>
                <td className="px-4 py-3">{sideLabel}</td>
                <td className="px-4 py-3">{fixture.stage}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={fixture.status} />
                </td>
                <td className="px-4 py-3 font-bold">
                  <span className="block">
                    {fixture.home_score === null
                      ? "-"
                      : fixtureOutcomeScore(fixture)}
                  </span>
                  {fixtureOutcomeLabel(fixture) ? (
                    <span className="block text-[11px] font-semibold text-slate-500">
                      {fixtureOutcomeLabel(fixture)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <button
                    className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-[var(--team-primary)] transition hover:bg-[var(--team-primary)] hover:text-[var(--team-primary-text)]"
                    onClick={() => onOpen?.(fixture)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OtherTeamsSection({
  activeTeam,
  activeSeason,
  teamView,
  teamViewLoading,
  selectedTeamViewId,
  onCloseTeamView,
  onPlayerClick,
}: Parameters<typeof SectionView>[0]) {
  if (!selectedTeamViewId) {
    return (
      <div className="space-y-6">
        <PageTitle
          title="Other Teams"
          subtitle="Open any team from Standings or Fixtures to inspect its public squad, fixtures, and results."
        />
        <EmptyState
          label={`Select a team from ${isManagerGroupKnockoutFormat(activeSeason?.format) ? "group standings" : "standings"} or fixtures to view details.`}
        />
      </div>
    );
  }
  return (
    <TeamViewPage
      loading={teamViewLoading}
      detail={teamView}
      activeTeamId={activeTeam?.id}
      onClose={onCloseTeamView}
      onPlayerClick={onPlayerClick}
    />
  );
}

function LeaderboardSections({
  title,
  sections,
  onOpen,
}: {
  title: string;
  sections: StatSectionData[];
  onOpen: (card: StatCardData) => void;
}) {
  const hasData = sections.some((section) =>
    section.cards.some((card) => card.entries.length > 0),
  );
  return (
    <section>
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
}: {
  card: StatCardData;
  onOpen: () => void;
}) {
  const topEntries = card.entries.slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--team-primary)] hover:shadow-xl active:translate-y-0 active:scale-[0.99]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-lg font-black">{card.title}</h4>
        <span className="text-2xl font-black text-slate-300">›</span>
      </div>
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
            />
          ))}
        </div>
      )}
    </button>
  );
}

function LeaderboardEntryRow({
  entry,
  rank,
}: {
  entry: StatEntry;
  rank: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
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
        className={`rounded-full px-3 py-1 text-sm font-black ${rank === 1 ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-slate-100 text-slate-900"}`}
      >
        {entry.value}
      </span>
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
  onClose,
}: {
  card: StatCardData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[var(--team-primary)]">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamViewPage({
  loading,
  detail,
  activeTeamId,
  onClose,
  onPlayerClick,
}: {
  loading: boolean;
  detail: TeamViewPayload | null;
  activeTeamId?: string | undefined;
  onClose: () => void;
  onPlayerClick: (player: PlayerRecord) => void;
}) {
  const team = detail?.team ?? null;
  const season = one(team?.seasons);
  const league = one(season?.leagues);
  const manager = one(team?.manager);
  const viewedTheme = themeFromTeam(team);
  const approvedPlayers =
    detail?.players.filter(
      (player) =>
        player.status === RegistrationStatus.APPROVED &&
        player.player_status !== "REMOVED" &&
        player.player_status !== "SUSPENDED",
    ) ?? [];
  return (
    <div
      className="space-y-6"
      style={
        {
          "--team-primary": viewedTheme.primary,
          "--team-secondary": viewedTheme.secondary,
          "--team-accent": viewedTheme.accent,
          "--team-primary-text": getReadableTextColor(viewedTheme.primary),
        } as CSSProperties
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title={team?.teams?.name ?? "Team Details"}
          subtitle="Team profile, manager details, public squad, fixtures, and confirmed results."
        />
        <button
          className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50"
          onClick={onClose}
        >
          Close Team View
        </button>
      </div>
      {loading ? <LoadingState label="Loading team..." /> : null}
      {!loading && detail ? (
        <div className="space-y-6">
          <TeamHero
            team={team}
            season={season}
            league={league}
            summary={detail.squad_summary}
          />
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Team Profile">
              <Detail label="Team Name" value={team?.teams?.name} />
              <Detail label="Team Status" value={team?.status} />
              <Detail label="Squad Count" value={detail.squad_summary.total} />
            </Panel>
            <Panel title="Manager Details">
              <Detail
                label="Manager Name"
                value={manager?.full_name ?? "Not connected"}
              />
              <Detail label="Email" value={manager?.email ?? "Not connected"} />
              <Detail label="Season" value={season?.name ?? "-"} />
            </Panel>
            <Panel title="Team Fixtures">
              {detail.fixtures.length ? (
                detail.fixtures
                  .slice(0, 4)
                  .map((fixture) => (
                    <FixtureMini
                      key={fixture.id}
                      fixture={fixture}
                      activeTeamId={team?.id ?? activeTeamId}
                    />
                  ))
              ) : (
                <EmptyState label="No upcoming fixtures." />
              )}
            </Panel>
          </div>
          <div className="grid gap-5">
            <Panel title="Approved Players">
              {approvedPlayers.length ? (
                <div className="space-y-2">
                  {approvedPlayers.slice(0, 12).map((player) => (
                    <LineupPlayerRow
                      key={player.id}
                      player={player}
                      label="Approved"
                      onOpen={() => onPlayerClick(player)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState label="No approved players." />
              )}
            </Panel>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Team Results">
              {detail.results.length ? (
                detail.results
                  .slice(0, 6)
                  .map((fixture) => (
                    <FixtureMini
                      key={fixture.id}
                      fixture={fixture}
                      activeTeamId={team?.id ?? activeTeamId}
                    />
                  ))
              ) : (
                <EmptyState label="No confirmed results." />
              )}
            </Panel>
            <TeamJerseysPanel team={team} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MatchDetailModal({
  fixture,
  detail,
  loading,
  activeTeamId,
  backLabel,
  onClose,
  onTeamClick,
}: {
  fixture: FixtureRecord;
  detail: unknown;
  loading: boolean;
  activeTeamId?: string | undefined;
  backLabel: string;
  onClose: () => void;
  onTeamClick?: ((teamId: string) => void) | undefined;
}) {
  const [activeTab, setActiveTab] = useState<"lineup" | "stats">("lineup");
  const [selectedStat, setSelectedStat] =
    useState<MatchDetailPlayerStat | null>(null);
  const payload = detail as MatchDetailPayload | null;
  const statsByPlayer = new Map(
    (payload?.player_stats ?? []).map((stat) => [
      stat.player_registration_id,
      stat,
    ]),
  );
  // Map each player to the position they actually played in the match (the
  // lineup slot's display_role, e.g. "AM"). Bench players carry "SUB", so we
  // fall back to their natural position.
  const roleByPlayer = new Map<string, string>();
  for (const lineup of payload?.lineups ?? []) {
    for (const lineupPlayer of lineup.lineup_players ?? []) {
      const natural =
        lineupPlayer.player_season_registrations?.football_position ??
        lineupPlayer.football_position ??
        lineupPlayer.player_natural_position ??
        null;
      let role = lineupPlayer.display_role ?? null;
      if (!role || role === "SUB") role = natural;
      if (role) roleByPlayer.set(lineupPlayer.player_registration_id, role);
    }
  }
  const metaByPlayer = managerBuildEventMeta(
    payload?.events ?? [],
    payload?.substitutions ?? [],
  );
  const bestRatedPlayerId = managerBestRatedPlayer(payload?.player_stats ?? []);
  const detailFixture = payload?.fixture ?? fixture;
  const homeLineup = managerLineupForFixtureTeam(
    payload?.lineups,
    detailFixture.home_team_registration_id,
  );
  const awayLineup = managerLineupForFixtureTeam(
    payload?.lineups,
    detailFixture.away_team_registration_id,
  );
  const homeTeam = detailFixture.home_team?.teams ?? fixture.home_team?.teams;
  const awayTeam = detailFixture.away_team?.teams ?? fixture.away_team?.teams;
  const playerNames = new Map<string, string>();
  for (const lineup of payload?.lineups ?? []) {
    for (const player of lineup.lineup_players ?? []) {
      playerNames.set(
        player.player_registration_id,
        player.player_season_registrations?.players?.full_name ?? "Player",
      );
    }
  }
  const scoreEventLines = (side: "HOME" | "AWAY") =>
    (payload?.events ?? [])
      .filter((event) => {
        const type = String(event.type ?? "");
        return (
          event.side === side &&
          ["GOAL", "PENALTY_GOAL", "OWN_GOAL"].includes(type)
        );
      })
      .map((event) => {
        const type = String(event.type ?? "");
        const suffix =
          type === "PENALTY_GOAL"
            ? " (Pen)"
            : type === "OWN_GOAL"
              ? " (OG)"
              : "";
        return `${playerNames.get(String(event.player_registration_id ?? "")) ?? "Player"} ${managerFormatNumber(event.minute)}'${suffix}`;
      });
  const homeScoreEvents = scoreEventLines("HOME");
  const awayScoreEvents = scoreEventLines("AWAY");
  const redCardEventLines = (side: "HOME" | "AWAY") =>
    (payload?.events ?? [])
      .filter(
        (event) =>
          event.side === side && String(event.type ?? "") === "RED_CARD",
      )
      .map((event) => {
        const name =
          playerNames.get(String(event.player_registration_id ?? "")) ??
          "Player";
        return `${name} ${managerFormatNumber(event.minute)}'`;
      });
  const homeRedCards = redCardEventLines("HOME");
  const awayRedCards = redCardEventLines("AWAY");
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
      >
        ← {backLabel}
      </button>
      <div className="w-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[var(--team-primary)]">
              Match Detail
            </p>
            <h2 className="mt-2 text-2xl font-black">{matchLabel(fixture)}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {formatDate(fixture.kickoff_at)} · {fixture.stage}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-50 p-4">
          <div>
            <TeamLogoName
              team={homeTeam}
              teamId={fixture.home_team_registration_id}
              onTeamClick={onTeamClick}
            />
            <div className="mt-2 space-y-1 text-xs font-semibold text-slate-500">
              {homeScoreEvents.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {homeRedCards.map((line, index) => (
                <p
                  key={`home-red-${line}-${index}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <span className="h-3.5 w-2.5 rounded-[2px] bg-red-600" />
                  {line}
                </p>
              ))}
            </div>
          </div>
          <span className="rounded-2xl bg-white px-5 py-2 text-center text-sm font-black shadow-sm">
            <span className="inline-flex items-center gap-2">
              {detailFixture.home_score === null ? (
                "VS"
              ) : (
                <>
                  <span>{detailFixture.home_score}</span>
                  {homeRedCards.length ? (
                    <span
                      className="h-3.5 w-2.5 rounded-[2px] bg-red-600"
                      title={`${homeRedCards.length} home red card${homeRedCards.length === 1 ? "" : "s"}`}
                    />
                  ) : null}
                  <span>-</span>
                  <span>{detailFixture.away_score}</span>
                  {awayRedCards.length ? (
                    <span
                      className="h-3.5 w-2.5 rounded-[2px] bg-red-600"
                      title={`${awayRedCards.length} away red card${awayRedCards.length === 1 ? "" : "s"}`}
                    />
                  ) : null}
                </>
              )}
            </span>
            {fixtureOutcomeLabel(detailFixture) ? (
              <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                {fixtureOutcomeLabel(detailFixture)}
              </span>
            ) : null}
          </span>
          <div className="text-right">
            <TeamLogoName
              team={awayTeam}
              teamId={fixture.away_team_registration_id}
              onTeamClick={onTeamClick}
            />
            <div className="mt-2 space-y-1 text-xs font-semibold text-slate-500">
              {awayScoreEvents.map((line) => (
                <p key={line}>{line}</p>
              ))}
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
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Detail label="Status" value={fixture.status} />
          <Detail
            label="Selected team"
            value={
              fixture.home_team_registration_id === activeTeamId
                ? homeTeam?.name
                : fixture.away_team_registration_id === activeTeamId
                  ? awayTeam?.name
                  : "Other"
            }
          />
          <Detail label="Kickoff" value={formatDate(fixture.kickoff_at)} />
        </div>
        {loading ? <LoadingState label="Loading match detail..." /> : null}
        {!loading && payload ? (
          <div className="mt-6 space-y-6">
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
              <div className="grid gap-6 xl:grid-cols-2">
                <ManagerMatchLineupPitch
                  title={homeTeam?.name ?? "Home"}
                  logoUrl={homeTeam?.logo_url}
                  lineup={homeLineup}
                  statsByPlayer={statsByPlayer}
                  metaByPlayer={metaByPlayer}
                  bestRatedPlayerId={bestRatedPlayerId}
                  onPlayerStat={setSelectedStat}
                />
                <ManagerMatchLineupPitch
                  title={awayTeam?.name ?? "Away"}
                  logoUrl={awayTeam?.logo_url}
                  lineup={awayLineup}
                  statsByPlayer={statsByPlayer}
                  metaByPlayer={metaByPlayer}
                  bestRatedPlayerId={bestRatedPlayerId}
                  onPlayerStat={setSelectedStat}
                />
              </div>
            ) : payload.team_stats.length ? (
              <ManagerMatchTeamStatsPanel
                home={homeTeam?.name ?? "Home"}
                away={awayTeam?.name ?? "Away"}
                homeTeamRegistrationId={detailFixture.home_team_registration_id}
                awayTeamRegistrationId={detailFixture.away_team_registration_id}
                homeColor={homeTeam?.primary_color}
                awayColor={awayTeam?.primary_color}
                stats={payload.team_stats}
              />
            ) : (
              <EmptyState label="No match stats yet." />
            )}
          </div>
        ) : null}
        {selectedStat ? (
          <ManagerPlayerMatchStatModal
            stat={selectedStat}
            role={roleByPlayer.get(selectedStat.player_registration_id)}
            onClose={() => setSelectedStat(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

function ManagerMatchLineupPitch({
  title,
  logoUrl,
  lineup,
  statsByPlayer,
  metaByPlayer,
  bestRatedPlayerId,
  onPlayerStat,
}: {
  title: string;
  logoUrl?: string | null | undefined;
  lineup: MatchDetailLineup | null;
  statsByPlayer: Map<string, MatchDetailPlayerStat>;
  metaByPlayer: Map<string, ManagerPlayerEventMeta>;
  bestRatedPlayerId: string | null;
  onPlayerStat: (stat: MatchDetailPlayerStat) => void;
}) {
  const slots = lineup?.formation_slots ?? [];
  const players = lineup?.lineup_players ?? [];
  const playerBySlot = new Map(
    players
      .filter((player) => player.is_starter && player.slot_key)
      .map((player) => [player.slot_key as string, player]),
  );
  const bench = players.filter((player) => !player.is_starter);
  return (
    <Panel title={title}>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={title} src={logoUrl} small />
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="text-sm font-semibold text-slate-500">
            {lineup?.formation ?? "Formation N/A"} ·{" "}
            {lineup?.playing_style?.replaceAll("_", " ") ?? "Style N/A"}
          </p>
        </div>
      </div>
      {!lineup ? <EmptyState label="No submitted lineup." /> : null}
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
                ? statsByPlayer.get(player.player_registration_id)
                : null;
              const meta = player
                ? metaByPlayer.get(player.player_registration_id)
                : null;
              return (
                <div
                  key={slot.slotKey}
                  className="absolute z-10 w-[82px] -translate-x-1/2 -translate-y-1/2 text-center sm:w-[116px]"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {player ? (
                    <button
                      type="button"
                      className="inline-flex flex-col items-center outline-none transition hover:-translate-y-0.5"
                      onClick={() => (stat ? onPlayerStat(stat) : undefined)}
                      title="View match stats"
                    >
                      <div className="relative h-12 w-12 sm:h-14 sm:w-14">
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
                            className={`absolute -right-1 -top-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white shadow ${managerRatingBadgeClass(Number(stat.rating))}`}
                          >
                            {managerFormatRating(stat.rating)}
                            {player.player_registration_id ===
                            bestRatedPlayerId ? (
                              <Star
                                size={10}
                                className="ml-0.5 inline fill-current"
                              />
                            ) : null}
                          </span>
                        ) : null}
                        {meta ? (
                          <ManagerLineupEventIcons meta={meta} overlay />
                        ) : null}
                      </div>
                      <div className="mt-1 flex w-full items-center justify-center gap-1 px-0.5 sm:max-w-[8rem]">
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
                        <span className="truncate text-[13px] font-black text-white drop-shadow">
                          #
                          {registration?.shirt_number ??
                            player.shirt_number ??
                            "-"}{" "}
                          {name}
                        </span>
                      </div>
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
            <h4 className="font-black">Substitutes · {bench.length}</h4>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {bench.map((player) => {
                const registration = player.player_season_registrations;
                const name = registration?.players?.full_name ?? "Player";
                const stat = statsByPlayer.get(player.player_registration_id);
                const meta = metaByPlayer.get(player.player_registration_id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-purple-50"
                    onClick={() => (stat ? onPlayerStat(stat) : undefined)}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[var(--team-primary)] text-xs font-black text-[var(--team-primary-text)] ring-2 ring-white">
                      {registration?.players?.avatar_url ? (
                        <img
                          src={registration.players.avatar_url}
                          alt={name}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        initials(name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {stat ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-black text-white ${managerRatingBadgeClass(Number(stat.rating))}`}
                          >
                            {managerFormatRating(stat.rating)}
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
                      {meta ? (
                        <ManagerLineupEventIcons meta={meta} dark />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </Panel>
  );
}

function ManagerLineupEventIcons({
  meta,
  dark = false,
  overlay = false,
}: {
  meta: ManagerPlayerEventMeta;
  dark?: boolean;
  overlay?: boolean;
}) {
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
            <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] text-white shadow">
              ↩
            </span>
          </span>
        ) : null}
        {meta.subInMinute ? (
          <span className="absolute -left-1 -top-3 inline-flex items-center gap-0.5 text-white drop-shadow">
            {meta.subInMinute}'
            <span className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-emerald-500 px-1 text-[9px] text-white shadow">
              ↪
            </span>
          </span>
        ) : null}
        {meta.yellow ? (
          <span className="absolute -left-2 bottom-5 h-4 w-3 rounded-[3px] border border-white/70 bg-yellow-300 shadow" />
        ) : null}
        {meta.red ? (
          <span className="absolute -left-2 bottom-5 h-4 w-3 rounded-[3px] border border-white/70 bg-red-500 shadow" />
        ) : null}
        {meta.goals ? (
          <span
            className={`absolute -right-1 ${meta.ownGoals ? "bottom-5" : "bottom-0"} inline-grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] text-slate-950 shadow`}
          >
            ⚽{meta.goals > 1 ? meta.goals : ""}
          </span>
        ) : null}
        {meta.ownGoals ? (
          <span
            className="absolute -right-1 bottom-0 inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full bg-white px-0.5 text-red-600 shadow ring-1 ring-red-200"
            title="Own goal"
          >
            <OwnGoalIcon />
            {meta.ownGoals > 1 ? meta.ownGoals : ""}
          </span>
        ) : null}
        {meta.assists ? (
          <span className="absolute -left-2 bottom-0 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] text-slate-800 shadow">
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
            className="absolute -right-1 bottom-5 inline-grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] text-slate-950 shadow"
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
      className={`mt-0.5 flex min-h-4 items-center justify-center gap-1 text-[10px] font-black ${dark ? "text-slate-700" : "text-white"}`}
    >
      {meta.subOutMinute ? <span>{meta.subOutMinute}' ↩</span> : null}
      {meta.subInMinute ? <span>{meta.subInMinute}' ↪</span> : null}
      {meta.goals ? (
        <span title="Goal">⚽{meta.goals > 1 ? meta.goals : ""}</span>
      ) : null}
      {meta.ownGoals ? (
        <span
          className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full bg-white px-0.5 text-red-600 shadow ring-1 ring-red-200"
          title="Own goal"
        >
          <OwnGoalIcon />
          {meta.ownGoals > 1 ? meta.ownGoals : ""}
        </span>
      ) : null}
      {meta.assists ? (
        <span
          className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] text-slate-800 shadow"
          title="Assist"
        >
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
        <span title="Penalty saved">⊗</span>
      ) : null}
      {meta.injured ? (
        <span
          className="inline-grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] text-red-600 shadow ring-1 ring-red-100"
          title="Injury"
        >
          +
        </span>
      ) : null}
      {meta.yellow ? (
        <span className="h-3 w-2 rounded-[2px] bg-yellow-300" />
      ) : null}
      {meta.red ? <span className="h-3 w-2 rounded-[2px] bg-red-500" /> : null}
    </div>
  );
}

function ManagerMatchTeamStatsPanel({
  home,
  away,
  homeTeamRegistrationId,
  awayTeamRegistrationId,
  homeColor,
  awayColor,
  stats,
}: {
  home: string;
  away: string;
  homeTeamRegistrationId: string;
  awayTeamRegistrationId: string;
  homeColor?: string | null | undefined;
  awayColor?: string | null | undefined;
  stats: MatchDetailTeamStat[];
}) {
  const first =
    stats.find(
      (stat) => stat.team_registration_id === homeTeamRegistrationId,
    ) ?? stats[0];
  const second =
    stats.find(
      (stat) => stat.team_registration_id === awayTeamRegistrationId,
    ) ?? stats.find((stat) => stat.id !== first?.id);
  if (!first || !second) return null;
  const leftColor = managerSafeColor(homeColor, "#C4003A");
  const rightColor = managerSafeColor(awayColor, "#0F172A");
  const rows: Array<{
    title: string;
    items: Array<
      [
        string,
        keyof MatchDetailTeamStat,
        "number" | "passes" | "decimal" | "rating",
      ]
    >;
  }> = [
    {
      title: "Top stats",
      items: [
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
      items: [
        ["Total shots", "shots", "number"],
        ["Shots off target", "shots_off_target", "number"],
        ["Shots on target", "shots_on_target", "number"],
        ["Hit woodwork", "hit_woodwork", "number"],
      ],
    },
    {
      title: "Defense",
      items: [
        ["Tackles", "tackles", "number"],
        ["Interceptions", "interceptions", "number"],
        ["Blocks", "blocks", "number"],
        ["Clearances", "clearances", "number"],
        ["Keeper saves", "keeper_saves", "number"],
      ],
    },
    {
      title: "General",
      items: [
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
          {home}
        </p>
        <h3 className="text-center text-lg font-black">Match stats</h3>
        <p className="text-right font-black" style={{ color: rightColor }}>
          {away}
        </p>
      </div>
      <div className="px-6 py-5">
        <p className="text-center text-sm font-semibold">Ball possession</p>
        <div className="mt-5 flex h-10 overflow-hidden rounded-full bg-white text-sm font-black">
          <div
            className="grid place-items-center"
            style={{
              width: `${firstPossession}%`,
              minWidth: firstPossession ? 56 : 0,
              background: leftColor,
              color: getReadableTextColor(leftColor),
            }}
          >
            {firstPossession}%
          </div>
          <div
            className="grid place-items-center"
            style={{
              width: `${secondPossession}%`,
              minWidth: secondPossession ? 56 : 0,
              background: rightColor,
              color: getReadableTextColor(rightColor),
            }}
          >
            {secondPossession}%
          </div>
        </div>
      </div>
      {rows.map((section) => (
        <div key={section.title} className="border-t border-white/10 px-6 py-6">
          <h4 className="mb-5 text-center text-base font-black">
            {section.title}
          </h4>
          <div className="space-y-5">
            {section.items.map(([label, field, format]) => (
              <ManagerStatComparisonRow
                key={`${section.title}-${label}`}
                label={label}
                homeValue={managerFormatTeamStat(first, field, format)}
                awayValue={managerFormatTeamStat(second, field, format)}
                homeWins={
                  Number(first[field] ?? 0) > Number(second[field] ?? 0)
                }
                awayWins={
                  Number(second[field] ?? 0) > Number(first[field] ?? 0)
                }
                homeColor={leftColor}
                awayColor={rightColor}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ManagerStatComparisonRow({
  label,
  homeValue,
  awayValue,
  homeWins,
  awayWins,
  homeColor,
  awayColor,
}: {
  label: string;
  homeValue: string;
  awayValue: string;
  homeWins: boolean;
  awayWins: boolean;
  homeColor: string;
  awayColor: string;
}) {
  return (
    <div className="grid grid-cols-[86px_1fr_86px] items-center gap-3 text-sm">
      <div className="justify-self-start">
        <span
          className="inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 font-black"
          style={{
            background: homeWins ? homeColor : "transparent",
            color: homeWins ? getReadableTextColor(homeColor) : "#FFFFFF",
          }}
        >
          {homeValue}
        </span>
      </div>
      <p className="text-center font-medium text-white/90">{label}</p>
      <div className="justify-self-end">
        <span
          className="inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 font-black"
          style={{
            background: awayWins ? awayColor : "transparent",
            color: awayWins ? getReadableTextColor(awayColor) : "#FFFFFF",
          }}
        >
          {awayValue}
        </span>
      </div>
    </div>
  );
}

function managerFormatTeamStat(
  stat: MatchDetailTeamStat,
  field: keyof MatchDetailTeamStat,
  format: "number" | "passes" | "decimal" | "rating",
) {
  if (format === "passes")
    return `${managerFormatNumber(stat.accurate_passes)}/${managerFormatNumber(stat.passes)} (${percentage(stat.accurate_passes, stat.passes)})`;
  if (format === "decimal")
    return Number(stat[field] ?? 0)
      .toFixed(2)
      .replace(/\.00$/, "");
  if (format === "rating") return managerFormatRating(stat[field]);
  return managerFormatNumber(stat[field]);
}

function ManagerPlayerMatchStatModal({
  stat,
  role,
  onClose,
}: {
  stat: MatchDetailPlayerStat;
  role?: string | null | undefined;
  onClose: () => void;
}) {
  const player = stat.player_season_registrations;
  const name = player?.players?.full_name ?? "Player";
  const position =
    role ??
    stat.position_played ??
    player?.football_position ??
    player?.position ??
    "POS";
  const isGoalkeeper = position === "GK";
  const defensiveContribution =
    Number(stat.tackles ?? 0) +
    Number(stat.interceptions ?? 0) +
    Number(stat.clearances ?? 0) +
    Number(stat.blocks ?? 0);
  const sections: Array<{
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
            [
              "Accurate passes",
              `${managerFormatNumber(stat.accurate_passes)}/${managerFormatNumber(stat.passes)} (${percentage(stat.accurate_passes, stat.passes)})`,
            ],
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
            ["Shot accuracy", percentage(stat.shots_on_target, stat.shots)],
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
              `${managerFormatNumber(stat.accurate_passes)}/${managerFormatNumber(stat.passes)} (${percentage(stat.accurate_passes, stat.passes)})`,
            ],
            ["Dribbles attempted", stat.dribbles_attempted],
            [
              "Successful dribbles",
              `${managerFormatNumber(stat.successful_dribbles)}/${managerFormatNumber(stat.dribbles_attempted)} (${percentage(stat.successful_dribbles, stat.dribbles_attempted)})`,
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
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-emerald-200 to-white p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="h-10 w-10" aria-hidden="true" />
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
              </div>
              <span
                className={`mx-auto -mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black text-white shadow ${managerRatingBadgeClass(Number(stat.rating))}`}
              >
                {managerFormatRating(stat.rating)}
              </span>
              <h3 className="mt-2 text-lg font-black">{name}</h3>
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
                  <p className="font-black">
                    {managerFormatNumber(stat.minutes)}
                  </p>
                  <p className="text-slate-500">Minutes</p>
                </div>
              </div>
            </div>
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
        <div className="space-y-6 p-6">
          {sections.map((section) => (
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
                        ? managerFormatRating(value)
                        : statValue(value)}
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

function TeamHero({
  team,
  season,
  league,
  summary,
}: {
  team: TeamRecord | null;
  season: Season | null;
  league: League | null;
  summary: SquadSummary | null;
}) {
  const viewedTheme = themeFromTeam(team);
  return (
    <div
      className="min-w-0 rounded-2xl p-4 shadow-xl sm:rounded-[2rem] sm:p-6"
      style={{
        background: `linear-gradient(135deg, ${viewedTheme.primary}, ${viewedTheme.secondary})`,
        color: getReadableTextColor(viewedTheme.primary),
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Avatar
            name={team?.teams?.name ?? "Team"}
            src={team?.teams?.logo_url}
          />
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-black sm:text-3xl">
              {team?.teams?.name ?? "No team"}
            </h2>
            <p className="text-sm opacity-80">
              {league?.name ?? "League"} · {season?.name ?? "Season"}
            </p>
          </div>
        </div>
        <StatusBadge status={team?.status ?? "NO TEAM"} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <MiniStat label="Approved" value={summary?.approved ?? 0} />
        <MiniStat label="Pending" value={summary?.pending ?? 0} />
        <MiniStat label="Draft" value={summary?.draft ?? 0} />
        <MiniStat
          label="Capacity"
          value={`${summary?.total ?? 0}/${summary?.max_squad_size ?? "-"}`}
        />
      </div>
    </div>
  );
}

function FixtureMini({
  fixture,
  activeTeamId,
  onOpen,
}: {
  fixture: FixtureRecord;
  activeTeamId?: string | undefined;
  onOpen?: (fixture: FixtureRecord) => void;
}) {
  const hasScore =
    fixture.home_score !== null &&
    fixture.home_score !== undefined &&
    fixture.away_score !== null &&
    fixture.away_score !== undefined;
  const content = hasScore ? (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <TeamLogoName
          team={fixture.home_team?.teams}
          teamId={fixture.home_team_registration_id}
        />
        <TeamLogoName
          team={fixture.away_team?.teams}
          teamId={fixture.away_team_registration_id}
        />
      </div>
      <span className="rounded-2xl bg-white px-4 py-2 text-center text-xl font-black text-slate-950 shadow-sm">
        <span className="block">{fixtureOutcomeScore(fixture)}</span>
        {fixtureOutcomeLabel(fixture) ? (
          <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
            {fixtureOutcomeLabel(fixture)}
          </span>
        ) : null}
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TeamLogoName
        team={fixture.home_team?.teams}
        teamId={fixture.home_team_registration_id}
      />
      <span className="rounded-2xl px-3 py-1 text-center text-xs font-black uppercase tracking-wide text-slate-400">
        vs
      </span>
      <TeamLogoName
        team={fixture.away_team?.teams}
        teamId={fixture.away_team_registration_id}
      />
    </div>
  );
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : -1}
      className={`block w-full rounded-3xl bg-slate-50 p-4 text-left transition ${
        onOpen
          ? "cursor-pointer hover:-translate-y-0.5 hover:bg-slate-100"
          : "cursor-default"
      }`}
      onClick={() => onOpen?.(fixture)}
      onKeyDown={(event) => {
        if (!onOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(fixture);
        }
      }}
    >
      {content}
      <p className="mt-2 text-sm text-slate-500">
        {formatDate(fixture.kickoff_at)} · {fixture.venue ?? "TBA"}
      </p>
      <p className="mt-2 text-sm">
        Opponent: <b>{opponentName(fixture, activeTeamId)}</b>
      </p>
      <StatusBadge status={fixture.status} />
    </div>
  );
}

function ResultMini({
  fixture,
  activeTeamId,
  onOpen,
}: {
  fixture: FixtureRecord;
  activeTeamId?: string | undefined;
  onOpen?: (fixture: FixtureRecord) => void;
}) {
  const homeScore = fixture.home_score ?? 0;
  const awayScore = fixture.away_score ?? 0;
  const homeIsActive = fixture.home_team_registration_id === activeTeamId;
  const awayIsActive = fixture.away_team_registration_id === activeTeamId;
  const opponent = opponentName(fixture, activeTeamId);
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : -1}
      className={`block w-full rounded-3xl bg-slate-50 p-4 text-left transition ${
        onOpen
          ? "cursor-pointer hover:-translate-y-0.5 hover:bg-slate-100"
          : "cursor-default"
      }`}
      onClick={() => onOpen?.(fixture)}
      onKeyDown={(event) => {
        if (!onOpen) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(fixture);
        }
      }}
    >
      <div className="space-y-3">
        <div
          className={`flex items-center justify-between gap-4 rounded-2xl px-3 py-2 ${
            homeIsActive ? "bg-green-50 ring-1 ring-green-200" : "bg-white"
          }`}
        >
          <TeamLogoName
            team={fixture.home_team?.teams}
            teamId={fixture.home_team_registration_id}
          />
          <span className="rounded-2xl bg-white px-4 py-2 text-xl font-black text-slate-950 shadow-sm ring-1 ring-slate-200">
            {homeScore}
          </span>
        </div>
        <div
          className={`flex items-center justify-between gap-4 rounded-2xl px-3 py-2 ${
            awayIsActive ? "bg-green-50 ring-1 ring-green-200" : "bg-white"
          }`}
        >
          <TeamLogoName
            team={fixture.away_team?.teams}
            teamId={fixture.away_team_registration_id}
          />
          <span className="rounded-2xl bg-white px-4 py-2 text-xl font-black text-slate-950 shadow-sm ring-1 ring-slate-200">
            {awayScore}
          </span>
        </div>
      </div>
      {fixtureOutcomeLabel(fixture) ? (
        <p className="mt-2 text-center text-xs font-bold text-slate-500">
          {fixtureOutcomeLabel(fixture)}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-slate-500">
        {formatDate(fixture.kickoff_at)} · {fixture.venue ?? "TBA"}
      </p>
      <p className="mt-2 text-sm">
        Opponent: <b>{opponent}</b>
      </p>
      <StageBadge stage={fixture.stage} />
    </div>
  );
}

function AvailabilityNoticeModal({
  message,
  onClose,
}: {
  message: MessageRecord;
  onClose: () => void;
}) {
  const playerRegistration = one(message.player_season_registrations);
  const player = playerRegistration?.players ?? null;
  const isLineupReminder =
    /submit your lineup|today is your match|matchday/i.test(
      `${message.related_type} ${message.message}`,
    );
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={player?.full_name ?? "Player"}
              src={player?.avatar_url}
            />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-primary)]">
                {isLineupReminder ? "Lineup Reminder" : "Availability Update"}
              </p>
              <h3 className="truncate text-2xl font-black">
                {player?.full_name ??
                  (isLineupReminder ? "Submit your lineup" : "Squad update")}
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black transition hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
          {message.message}
        </p>
      </div>
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="break-words text-3xl font-black leading-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-slate-600">{subtitle}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function DashboardCard({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color: "purple" | "green" | "yellow" | "slate";
}) {
  const colors = {
    purple: "bg-purple-50 text-[var(--team-primary)]",
    green: "bg-green-50 text-[#16A34A]",
    yellow: "bg-yellow-50 text-[#B45309]",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p
        className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-3xl font-black ${colors[color]}`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs uppercase tracking-widest text-purple-100">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function StatGrid({ summary }: { summary: SquadSummary | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Detail label="Approved Players" value={summary?.approved ?? 0} />
      <Detail label="Pending Players" value={summary?.pending ?? 0} />
      <Detail label="Draft Players" value={summary?.draft ?? 0} />
      <Detail label="Rejected Players" value={summary?.rejected ?? 0} />
      <Detail label="Current Squad Size" value={summary?.total ?? 0} />
      <Detail label="Max Squad Size" value={summary?.max_squad_size ?? 0} />
      <Detail label="Remaining Slots" value={summary?.remaining_slots ?? 0} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-bold text-slate-900">
        {value ?? "-"}
      </p>
    </div>
  );
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return "-";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span
      className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ring-1 ${statusClass(status)}`}
    >
      {status?.replaceAll("_", " ") ?? "-"}
    </span>
  );
}

function StageBadge({ stage }: { stage?: string | null }) {
  return (
    <span className="mt-2 inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700 ring-1 ring-violet-200">
      {matchStageLabel(stage)}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
      {label}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-4 font-bold shadow-sm">
        <RefreshCcw
          className="animate-spin text-[var(--team-primary)]"
          size={20}
        />
        {label}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left font-bold transition hover:-translate-y-0.5 hover:border-[var(--team-primary)] hover:bg-purple-50 hover:text-[var(--team-primary)]"
      onClick={onClick}
    >
      {label}
      <ChevronRight size={18} />
    </button>
  );
}

function Tabs({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="my-5 flex flex-wrap gap-2">
      {values.map((item) => (
        <button
          key={item}
          className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide transition ${item === value ? "bg-[var(--team-primary)] text-[var(--team-primary-text)]" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[var(--team-primary)]"}`}
          onClick={() => onChange(item)}
        >
          {item.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}

function Avatar({
  name,
  src,
  small = false,
}: {
  name: string;
  src?: string | null | undefined;
  small?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const size = small ? "h-9 w-9 text-xs" : "h-12 w-12";
  if (src) {
    return (
      <>
        <button
          type="button"
          className={`${size} shrink-0 overflow-hidden rounded-2xl ring-2 ring-white transition hover:scale-105 hover:ring-[var(--team-primary)]`}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewOpen(true);
          }}
          title={`Open ${name} miniface`}
          aria-label={`Open ${name} miniface`}
        >
          <img src={src} alt={name} className="h-full w-full object-cover" />
        </button>
        {previewOpen ? (
          <FacePreviewModal
            name={name}
            src={src}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null}
      </>
    );
  }
  return (
    <div
      className={`${size} grid place-items-center rounded-2xl bg-[var(--team-primary)] font-black text-[var(--team-primary-text)]`}
    >
      {initials(name)}
    </div>
  );
}

function FacePreviewModal({
  name,
  src,
  onClose,
}: {
  name: string;
  src: string;
  onClose: () => void;
}) {
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
          <h3 className="text-xl font-black">{name}</h3>
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
            alt={name}
            className="max-h-[70vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function previewDistribution(size: number) {
  if (size <= 0)
    return { goalkeepers: 0, defenders: 0, midfielders: 0, forwards: 0 };
  const goalkeepers = Math.max(1, Math.round(size * 0.12));
  const defenders = Math.max(1, Math.round(size * 0.32));
  const midfielders = Math.max(1, Math.round(size * 0.32));
  const forwards = Math.max(0, size - goalkeepers - defenders - midfielders);
  return { goalkeepers, defenders, midfielders, forwards };
}

function suggestedPositionBreakdown(size: number): PositionBreakdown {
  const empty = {
    [FootballPosition.GK]: 0,
    [FootballPosition.CB]: 0,
    [FootballPosition.LB]: 0,
    [FootballPosition.RB]: 0,
    [FootballPosition.DM]: 0,
    [FootballPosition.CM]: 0,
    [FootballPosition.AM]: 0,
    [FootballPosition.LW]: 0,
    [FootballPosition.RW]: 0,
    [FootballPosition.ST]: 0,
  };
  if (size <= 0) return empty;
  if (size === 18)
    return {
      ...empty,
      GK: 2,
      CB: 3,
      LB: 1,
      RB: 2,
      DM: 2,
      CM: 2,
      AM: 2,
      LW: 1,
      RW: 1,
      ST: 2,
    };
  if (size === 22)
    return {
      ...empty,
      GK: 3,
      CB: 3,
      LB: 2,
      RB: 2,
      DM: 2,
      CM: 3,
      AM: 2,
      LW: 1,
      RW: 1,
      ST: 3,
    };
  if (size === 25)
    return {
      ...empty,
      GK: 3,
      CB: 4,
      LB: 2,
      RB: 2,
      DM: 2,
      CM: 4,
      AM: 2,
      LW: 2,
      RW: 2,
      ST: 2,
    };
  const broad = previewDistribution(size);
  return {
    ...empty,
    GK: broad.goalkeepers,
    CB: Math.ceil(broad.defenders * 0.45),
    LB: Math.floor(broad.defenders * 0.275),
    RB:
      broad.defenders -
      Math.ceil(broad.defenders * 0.45) -
      Math.floor(broad.defenders * 0.275),
    DM: Math.floor(broad.midfielders * 0.3),
    CM: Math.ceil(broad.midfielders * 0.4),
    AM:
      broad.midfielders -
      Math.floor(broad.midfielders * 0.3) -
      Math.ceil(broad.midfielders * 0.4),
    LW: Math.floor(broad.forwards * 0.25),
    RW: Math.floor(broad.forwards * 0.25),
    ST: broad.forwards - Math.floor(broad.forwards * 0.25) * 2,
  };
}

function groupedBreakdown(breakdown: PositionBreakdown) {
  return {
    goalkeepers: breakdown.GK,
    defenders: breakdown.CB + breakdown.LB + breakdown.RB,
    midfielders: breakdown.DM + breakdown.CM + breakdown.AM,
    forwards: breakdown.LW + breakdown.RW + breakdown.ST,
  };
}

function validateBreakdown(
  breakdown: PositionBreakdown,
  target: number,
  remaining: number,
  currentSize: number,
  currentGoalkeepers: number,
) {
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  if (target > remaining)
    return `You only have ${remaining} remaining squad slots.`;
  if (total !== target) return `Total selected players must equal ${target}.`;
  if (currentSize + target >= 11 && currentGoalkeepers + breakdown.GK < 1)
    return "You need at least 1 goalkeeper.";
  if (currentSize + target >= 18 && currentGoalkeepers + breakdown.GK < 2)
    return "Recommended minimum 2 GK for squads 18+.";
  if (currentSize + target >= 22 && currentGoalkeepers + breakdown.GK < 3)
    return "Recommended minimum 3 GK for squads 22+.";
  return "";
}

function getReadableTextColor(backgroundColor: string): "#FFFFFF" | "#111827" {
  const hex = backgroundColor.replace("#", "");
  if (!/^[0-9a-f]{6}$/iu.test(hex)) return "#FFFFFF";
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}
