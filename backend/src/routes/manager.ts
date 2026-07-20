import { Router } from "express";
import { z } from "zod";
import {
  FixtureStatus,
  FootballPosition,
  generateSquadSchema,
  IdType,
  lineupSubmissionSchema,
  PlayerLifecycleStatus,
  PlayerPosition,
  playerSubmissionSchema,
  PreferredFoot,
  RegistrationStatus,
  submitPlayersSchema,
  teamRegistrationSchema,
  updateDraftPlayerSchema,
  UserRole,
  MatchEventType,
  VenueSide,
  type LineupSubmissionInput,
} from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError, assertFound, asyncHandler } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateLineupSubmission } from "../domain/lineups.js";
import {
  autoPickBestXI,
  fitForSlot,
  FORMATION_LABELS,
  getFormationSlots,
  isValidFormation,
  isValidPlayingStyle,
  naturalPosition,
  PLAYING_STYLE_LABELS,
  positionToCoarse,
  type LineupCandidate,
  type PlayingStyle,
} from "../domain/lineup-builder.js";
import { hashIdentityNumber, identityLast4 } from "../utils/hmac.js";
import {
  categoryForFootballPosition,
  coarsePosition,
  currentDistribution,
  generateSquadPlayers,
  neededDistribution,
  suggestedPositionBreakdown,
  targetDistribution,
} from "../domain/squad-generator.js";
import {
  disciplinePhaseForStage,
  isStageInDisciplinePhase,
  yellowCardProgress,
} from "../domain/discipline.js";
import { totalExpectedGoals } from "../domain/team-statistics.js";
import {
  isLineupSubmissionOpen,
  nextLineupFixture,
} from "../domain/lineup-eligibility.js";
import {
  loadSeasonStandings,
  standingReportToApiRow,
  type StandingReportRow,
} from "../services/standings-report.js";
import {
  buildPlayerSeasonStatsFromMatchRows,
  loadLeagueRatings,
  loadPlayerSeasonContributions,
} from "../services/player-stats.js";
import {
  avg,
  buildPlayerLeaderboardRows,
  makePlayerStatSections,
  makeTeamLeaderboard,
  perMatch,
  type PlayerLeaderboardRow,
  relatedName,
} from "../services/stat-leaderboards.js";

export const managerRouter = Router();
managerRouter.use(requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN));

const updatePlayerMinifacesSchema = z.object({
  updates: z
    .array(
      z.object({
        player_registration_id: z.string().uuid(),
        avatar_url: z.string().trim().max(2000).nullable(),
      }),
    )
    .min(1)
    .max(100),
});

const preferenceSchema = z.object({
  seasonId: z.string().uuid(),
  preferredFormation: z.string().trim().min(3).max(30),
  preferredPlayingStyle: z.string().trim().min(3).max(50),
});

const lineupBuilderAutoPickSchema = z.object({
  teamId: z.string().uuid(),
  seasonId: z.string().uuid(),
  formation: z.string().trim().min(3).max(30),
  playingStyle: z.string().trim().min(3).max(50),
});

async function assertManagerOwnsTeam(
  userId: string,
  teamRegistrationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select(
      "id,manager_id,season_id,team_id,status,rejection_reason,created_at,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,phase,max_players_per_team,total_teams,lineup_size,substitute_limit,yellow_card_suspension_threshold,league_id,leagues(id,name,short_name,logo_url))",
    )
    .eq("id", teamRegistrationId)
    .single();
  if (error) throw error;
  if (data.manager_id !== userId)
    throw new AppError(403, "You do not manage this team registration");
  return data;
}

function footballPositionFromCoarse(position: PlayerPosition) {
  if (position === PlayerPosition.GK) return FootballPosition.GK;
  if (position === PlayerPosition.DEF) return FootballPosition.CB;
  if (position === PlayerPosition.MID) return FootballPosition.CM;
  return FootballPosition.ST;
}

function maxSquadSize(
  teamRegistration: Awaited<ReturnType<typeof assertManagerOwnsTeam>>,
) {
  const season = Array.isArray(teamRegistration.seasons)
    ? teamRegistration.seasons[0]
    : teamRegistration.seasons;
  return Number(season?.max_players_per_team ?? 22);
}

function playerCode(id: string) {
  return `PLY-${id.slice(0, 8).toUpperCase()}`;
}

function generatedIdentity(idType: IdType, year: number, sequence: number) {
  if (idType === IdType.BIRTH_ID)
    return `${year}${String(sequence).padStart(13, "0")}`.slice(0, 17);
  return String(1000000000 + sequence).slice(0, 10);
}

function generatedDateOfBirth(idType: IdType, year: number, sequence: number) {
  const age =
    idType === IdType.BIRTH_ID ? 16 + (sequence % 4) : 20 + (sequence % 14);
  const birthYear = year - age;
  const month = String((sequence % 12) + 1).padStart(2, "0");
  const day = String((sequence % 27) + 1).padStart(2, "0");
  return `${birthYear}-${month}-${day}`;
}

function validateNumericIdentity(idType: IdType, value: string) {
  if (!/^\d+$/u.test(value))
    throw new AppError(400, "ID number must contain digits only.");
  if (idType === IdType.NID && ![10, 13, 17].includes(value.length)) {
    throw new AppError(400, "NID must be 10, 13, or 17 digits.");
  }
  if (idType === IdType.BIRTH_ID && value.length !== 17) {
    throw new AppError(400, "Birth ID must be 17 digits.");
  }
}

function routeParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || value.length === 0)
    throw new AppError(400, `${name} is required`);
  return value;
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function makeStatsReport(
  playerRows: PlayerLeaderboardRow[],
  teamRows: Array<
    Record<string, unknown> & {
      id: string;
      name: string;
      logoUrl: string | null;
    }
  >,
) {
  return {
    player_sections: makePlayerStatSections(playerRows),
    team_sections: [
      {
        title: "General",
        cards: [
          makeTeamLeaderboard(
            "avg_possession",
            "Avg Possession",
            teamRows,
            "avgPossession",
            "percent",
          ),
          makeTeamLeaderboard("rating", "Rating", teamRows, "rating", "rating"),
        ],
      },
      {
        title: "Attack",
        cards: [
          makeTeamLeaderboard(
            "goals_per_match",
            "Goals per Match",
            teamRows,
            "goalsPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "expected_goals",
            "Expected Goals (xG)",
            teamRows,
            "expectedGoals",
            "decimal",
          ),
          makeTeamLeaderboard(
            "shots_on_target_per_match",
            "Shots on Target per Match",
            teamRows,
            "shotsOnTargetPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "big_chances",
            "Big Chances",
            teamRows,
            "bigChancesPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "big_chances_missed",
            "Big Chances Missed",
            teamRows,
            "bigChancesMissedPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "accurate_passes_per_match",
            "Accurate Passes per Match",
            teamRows,
            "accuratePassesPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "corners",
            "Corners",
            teamRows,
            "cornersPerMatch",
            "decimal",
          ),
        ],
      },
      {
        title: "Defense",
        cards: [
          makeTeamLeaderboard(
            "clean_sheets",
            "Clean Sheets",
            teamRows,
            "cleanSheets",
            "number",
          ),
          makeTeamLeaderboard(
            "goals_conceded_per_match",
            "Goals Conceded per Match",
            teamRows,
            "goalsConcededPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "tackles_per_match",
            "Tackles per Match",
            teamRows,
            "tacklesPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "clearances_per_match",
            "Clearances per Match",
            teamRows,
            "clearancesPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "penalties_conceded",
            "Penalties Conceded",
            teamRows,
            "penaltiesConceded",
            "number",
          ),
          makeTeamLeaderboard(
            "gk_saves_per_match",
            "GK Saves per Match",
            teamRows,
            "gkSavesPerMatch",
            "decimal",
          ),
        ],
      },
      {
        title: "Discipline",
        cards: [
          makeTeamLeaderboard(
            "fouls_per_match",
            "Fouls per Match",
            teamRows,
            "foulsPerMatch",
            "decimal",
          ),
          makeTeamLeaderboard(
            "yellow_cards",
            "Yellow Cards",
            teamRows,
            "yellowCards",
            "number",
          ),
          makeTeamLeaderboard(
            "red_cards",
            "Red Cards",
            teamRows,
            "redCards",
            "number",
          ),
        ],
      },
    ],
  };
}

function statusCounts(
  players: Array<{ status?: string | null; player_status?: string | null }>,
) {
  const squadPlayers = players.filter(
    (player) =>
      player.status !== RegistrationStatus.REJECTED &&
      player.player_status !== PlayerLifecycleStatus.REMOVED,
  );
  return {
    total: squadPlayers.length,
    approved: players.filter(
      (player) =>
        player.status === RegistrationStatus.APPROVED &&
        player.player_status !== PlayerLifecycleStatus.REMOVED,
    ).length,
    pending: players.filter(
      (player) => player.status === RegistrationStatus.PENDING,
    ).length,
    draft: players.filter(
      (player) => player.status === RegistrationStatus.DRAFT,
    ).length,
    rejected: players.filter(
      (player) => player.status === RegistrationStatus.REJECTED,
    ).length,
    removed: players.filter(
      (player) => player.player_status === PlayerLifecycleStatus.REMOVED,
    ).length,
    suspended: players.filter(
      (player) => player.player_status === PlayerLifecycleStatus.SUSPENDED,
    ).length,
  };
}

async function loadTeamPlayers(teamRegistrationId: string): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select(
      "id,player_id,season_id,team_registration_id,position,football_position,position_category,shirt_number,status,preferred_foot,player_status,player_code,identity_mode,is_generated,created_by_manager_id,created_at,updated_at,rejection_reason,removal_reason,suspension_reason,suspension_type,suspension_until,suspension_matches_remaining,players(id,full_name,date_of_birth,id_type,id_number_last4,generated_identity_number,avatar_url),player_abilities(*)",
    )
    .eq("team_registration_id", teamRegistrationId)
    .order("shirt_number", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return attachAvailabilityFlags(data ?? []);
}

async function loadActiveInjuries(playerRegistrationIds: string[]) {
  if (playerRegistrationIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabaseAdmin
    .from("match_injuries")
    .select("*")
    .in("player_registration_id", playerRegistrationIds)
    .gt("expected_matches_out", 0)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const injuries = new Map<string, any>();
  for (const injury of data ?? []) {
    if (!injuries.has(injury.player_registration_id)) {
      injuries.set(injury.player_registration_id, injury);
    }
  }
  return injuries;
}

async function attachAvailabilityFlags(players: any[]): Promise<any[]> {
  const injuries = await loadActiveInjuries(players.map((player) => player.id));
  const today = new Date().toISOString().slice(0, 10);
  return players.map((player) => {
    const injury = injuries.get(player.id) ?? null;
    const suspendedByMatches =
      player.suspension_type === "NEXT_MATCHES" &&
      Number(player.suspension_matches_remaining ?? 0) > 0;
    const suspendedByDate =
      player.suspension_type === "UNTIL_DATE" &&
      player.suspension_until &&
      String(player.suspension_until) >= today;
    const suspendedIndefinitely =
      player.suspension_type === "UNTIL_ADMIN_UNSUSPENDS";
    const activeSuspension =
      player.player_status === PlayerLifecycleStatus.SUSPENDED &&
      (suspendedByMatches || suspendedByDate || suspendedIndefinitely);
    return {
      ...player,
      active_injury: injury,
      active_suspension: activeSuspension
        ? {
            reason: player.suspension_reason,
            suspension_type: player.suspension_type,
            suspension_until: player.suspension_until,
            suspension_matches_remaining: player.suspension_matches_remaining,
          }
        : null,
    };
  });
}

async function loadManagerTeams(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select(
      "id,season_id,team_id,manager_id,status,rejection_reason,created_at,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,phase,max_players_per_team,total_teams,lineup_size,substitute_limit,yellow_card_suspension_threshold,league_id,leagues(id,name,short_name,logo_url))",
    )
    .eq("manager_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function assertNextLineupFixture(
  teamRegistrationId: string,
  seasonId: string,
  fixtureId: string,
  requireOpenSubmission = false,
) {
  const { data, error } = await supabaseAdmin
    .from("fixtures")
    .select("id,status,kickoff_at,matchday_number,round_no,created_at")
    .eq("season_id", seasonId)
    .or(
      `home_team_registration_id.eq.${teamRegistrationId},away_team_registration_id.eq.${teamRegistrationId}`,
    );
  if (error) throw error;

  const nextFixture = nextLineupFixture(data ?? []);
  if (!nextFixture) {
    throw new AppError(
      409,
      "No upcoming fixture is available for lineup submission.",
    );
  }
  if (nextFixture.id !== fixtureId) {
    throw new AppError(
      409,
      "You can only prepare or submit a lineup for your team's next fixture.",
    );
  }
  if (requireOpenSubmission && !isLineupSubmissionOpen(nextFixture.status)) {
    throw new AppError(
      409,
      "Lineup submission is closed while the current match is being processed. The following fixture unlocks after this match is finalized.",
    );
  }

  return nextFixture;
}

async function assertManagerCanViewSeason(userId: string, seasonId: string) {
  const teams = await loadManagerTeams(userId);
  if (!teams.some((team) => team.season_id === seasonId))
    throw new AppError(403, "You do not manage a team in this season");
  return teams;
}

async function loadSeasonTeamsForManager(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select(
      "id,season_id,team_id,manager_id,status,rejection_reason,created_at,teams(*),manager:profiles!team_registrations_manager_id_fkey(id,full_name,email)",
    )
    .eq("season_id", seasonId)
    .eq("status", RegistrationStatus.APPROVED)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function loadSeasonGroupsForManager(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("season_groups")
    .select(
      "id,name,locked,season_group_teams(id,team_registration_id,seed_no,team_registrations(id,season_id,team_id,status,teams(*)))",
    )
    .eq("season_id", seasonId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((group) => ({
    ...group,
    teams: ((group.season_group_teams ?? []) as Array<Record<string, unknown>>)
      .sort((a, b) => Number(a.seed_no ?? 0) - Number(b.seed_no ?? 0))
      .map((groupTeam) => {
        const registration = relatedOne(
          groupTeam.team_registrations as
            | Record<string, unknown>
            | Array<Record<string, unknown>>
            | null,
        );
        return {
          id: String(groupTeam.team_registration_id),
          seed_no: Number(groupTeam.seed_no ?? 0),
          team_registration: registration,
        };
      }),
  }));
}

async function assertManagerOwnsPlayerRegistration(
  userId: string,
  playerRegistrationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select(
      "id,player_id,season_id,team_registration_id,status,shirt_number,football_position,position_category,preferred_foot,player_status,identity_mode,is_generated,players(id,full_name,date_of_birth,id_type,id_number_last4,generated_identity_number,avatar_url),player_abilities(*),team_registrations!inner(id,manager_id,season_id,team_id,teams(*),seasons!team_registrations_season_id_fkey(id,name,league_id,leagues(id,name)))",
    )
    .eq("id", playerRegistrationId)
    .single();
  if (error) throw error;
  const teamRegistration = relatedOne(data.team_registrations);
  if (!teamRegistration || teamRegistration.manager_id !== userId) {
    throw new AppError(403, "You do not manage this player");
  }
  return data;
}

async function loadManagerVisiblePlayerRegistration(
  userId: string,
  playerRegistrationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select(
      "id,player_id,season_id,team_registration_id,status,shirt_number,position,football_position,position_category,preferred_foot,player_status,player_code,identity_mode,is_generated,created_at,rejection_reason,removal_reason,suspension_reason,suspension_type,suspension_until,suspension_matches_remaining,players(id,full_name,date_of_birth,id_type,id_number_last4,generated_identity_number,avatar_url),player_abilities(*),team_registrations!inner(id,manager_id,season_id,team_id,teams(id,name,short_name,logo_url,primary_color,secondary_color,accent_color),seasons!team_registrations_season_id_fkey(id,name,league_id,leagues(id,name)))",
    )
    .eq("id", playerRegistrationId)
    .single();
  if (error) throw error;

  await assertManagerCanViewSeason(userId, data.season_id);
  const teamRegistration = relatedOne(data.team_registrations);
  const ownsPlayer = teamRegistration?.manager_id === userId;
  if (!ownsPlayer && data.status !== RegistrationStatus.APPROVED) {
    throw new AppError(403, "Only approved opposition players are visible");
  }

  const identity = relatedOne(data.players);
  const overallRating = Number(
    relatedOne(data.player_abilities)?.overall_rating ?? NaN,
  );
  return {
    player: {
      ...data,
      overall_rating: Number.isFinite(overallRating) ? overallRating : null,
      // Detailed ability scores belong to the owning manager and admin only.
      // Opposition managers still receive the public overall rating below.
      player_abilities: ownsPlayer ? data.player_abilities : undefined,
      players: identity
        ? {
            ...identity,
            generated_identity_number: ownsPlayer
              ? identity.generated_identity_number
              : null,
          }
        : null,
    },
    overallRating: Number.isFinite(overallRating) ? overallRating : null,
    canViewAbilityScores: ownsPlayer,
  };
}

async function loadYellowCardDiscipline(
  seasonId: string,
  fixtureStage: string,
  thresholdValue: unknown,
  players: any[],
) {
  const threshold = Math.max(2, Math.min(10, Number(thresholdValue ?? 3)));
  const phase = disciplinePhaseForStage(fixtureStage);
  const { data: fixtures, error: fixturesError } = await supabaseAdmin
    .from("fixtures")
    .select("id,stage")
    .eq("season_id", seasonId)
    .eq("result_confirmed", true);
  if (fixturesError) throw fixturesError;

  const fixtureIds = (fixtures ?? [])
    .filter((fixture) =>
      isStageInDisciplinePhase(String(fixture.stage ?? "LEAGUE"), phase),
    )
    .map((fixture) => String(fixture.id));
  const eligiblePlayers = players.filter(
    (player) =>
      player.status === RegistrationStatus.APPROVED &&
      player.player_status !== PlayerLifecycleStatus.REMOVED,
  );
  const totals = new Map<string, number>();
  if (fixtureIds.length && eligiblePlayers.length) {
    const { data: rows, error } = await supabaseAdmin
      .from("player_match_stats")
      .select("player_registration_id,yellow_cards")
      .in("fixture_id", fixtureIds)
      .in(
        "player_registration_id",
        eligiblePlayers.map((player) => player.id),
      )
      .gt("yellow_cards", 0);
    if (error) throw error;
    for (const row of rows ?? []) {
      const id = String(row.player_registration_id);
      totals.set(id, (totals.get(id) ?? 0) + Number(row.yellow_cards ?? 0));
    }
  }

  return {
    phase,
    yellow_card_suspension_threshold: threshold,
    players: eligiblePlayers
      .map((player) => {
        const total = totals.get(player.id) ?? 0;
        const yellowSuspensionActive = String(
          player.active_suspension?.reason ?? player.suspension_reason ?? "",
        )
          .toLowerCase()
          .includes("yellow card");
        const progress = yellowSuspensionActive
          ? threshold
          : yellowCardProgress(total, threshold);
        return {
          player_registration_id: player.id,
          full_name: player.players?.full_name ?? "Player",
          avatar_url: player.players?.avatar_url ?? null,
          shirt_number: player.shirt_number ?? null,
          yellow_cards: progress,
          total_phase_yellow_cards: total,
          suspended_for_accumulation: yellowSuspensionActive,
        };
      })
      .filter((player) => player.total_phase_yellow_cards > 0),
  };
}

async function loadAvailableLineupPlayers(
  teamRegistrationId: string,
  seasonId: string,
) {
  const players = await loadTeamPlayers(teamRegistrationId);
  const approved = players.filter(
    (player) =>
      player.status === RegistrationStatus.APPROVED &&
      player.player_status !== PlayerLifecycleStatus.REMOVED &&
      player.player_status !== PlayerLifecycleStatus.SUSPENDED &&
      !player.active_injury &&
      !player.active_suspension,
  ) as LineupCandidate[];
  const playerRegistrationIds = approved.map((player) => player.id);
  const [ratings, contributions] = await Promise.all([
    loadLeagueRatings(playerRegistrationIds),
    loadPlayerSeasonContributions(seasonId, playerRegistrationIds),
  ]);
  return approved.map((player) => ({
    ...player,
    league_rating: ratings.get(player.id) ?? null,
    season_goals: contributions.get(player.id)?.goals ?? 0,
    season_assists: contributions.get(player.id)?.assists ?? 0,
  }));
}

async function loadManagerPreference(
  managerId: string,
  teamRegistrationId: string,
  seasonId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("manager_team_preferences")
    .select("*")
    .eq("manager_id", managerId)
    .eq("team_registration_id", teamRegistrationId)
    .eq("season_id", seasonId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveManagerPreference(
  managerId: string,
  teamRegistrationId: string,
  seasonId: string,
  formation: string,
  playingStyle: PlayingStyle,
) {
  const { data, error } = await supabaseAdmin
    .from("manager_team_preferences")
    .upsert(
      {
        manager_id: managerId,
        team_registration_id: teamRegistrationId,
        season_id: seasonId,
        preferred_formation: formation,
        preferred_playing_style: playingStyle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "manager_id,team_registration_id,season_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function loadPreviousLineup(
  teamRegistrationId: string,
  seasonId: string,
  excludeFixtureId?: string,
) {
  let query = supabaseAdmin
    .from("lineups")
    .select(
      "*,lineup_players(*,player_season_registrations(id,player_id,football_position,position,shirt_number,status,player_status,players(full_name,avatar_url))),lineup_set_piece_takers(player_registration_id,set_piece_type,priority)",
    )
    .eq("team_registration_id", teamRegistrationId)
    .eq("season_id", seasonId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (excludeFixtureId) query = query.neq("fixture_id", excludeFixtureId);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] ?? null;
}

async function loadExistingLineup(
  teamRegistrationId: string,
  fixtureId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("lineups")
    .select(
      "*,lineup_players(*,player_season_registrations(id,player_id,football_position,position,shirt_number,status,player_status,players(full_name,avatar_url))),lineup_set_piece_takers(player_registration_id,set_piece_type,priority)",
    )
    .eq("team_registration_id", teamRegistrationId)
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type SetPieceType = "PENALTY" | "FREE_KICK";

function orderedSetPieceIds(
  lineup: Record<string, any> | null | undefined,
  type: SetPieceType,
) {
  return [...(lineup?.lineup_set_piece_takers ?? [])]
    .filter((row: any) => row.set_piece_type === type)
    .sort((a: any, b: any) => Number(a.priority) - Number(b.priority))
    .map((row: any) => String(row.player_registration_id));
}

async function saveLineupSetPieceTakers(
  lineupId: string,
  selectedPlayerIds: string[],
  penaltyTakerIds: string[],
  freeKickTakerIds: string[],
) {
  const selected = new Set(selectedPlayerIds);
  const assertValidOrder = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length)
      throw new AppError(400, `${label} order contains duplicate players`);
    if (ids.some((id) => !selected.has(id)))
      throw new AppError(400, `${label} must belong to the submitted lineup`);
  };
  assertValidOrder(penaltyTakerIds, "Penalty takers");
  assertValidOrder(freeKickTakerIds, "Free-kick takers");

  const { error: deleteError } = await supabaseAdmin
    .from("lineup_set_piece_takers")
    .delete()
    .eq("lineup_id", lineupId);
  if (deleteError) throw deleteError;

  const rows = (
    [
      ["PENALTY", penaltyTakerIds],
      ["FREE_KICK", freeKickTakerIds],
    ] as const
  ).flatMap(([setPieceType, ids]) =>
    ids.map((playerRegistrationId, index) => ({
      lineup_id: lineupId,
      player_registration_id: playerRegistrationId,
      set_piece_type: setPieceType,
      priority: index + 1,
    })),
  );
  if (!rows.length) return;
  const { error: insertError } = await supabaseAdmin
    .from("lineup_set_piece_takers")
    .insert(rows);
  if (insertError) throw insertError;
}

async function persistSubmittedLineup(
  input: LineupSubmissionInput,
  seasonId: string,
  managerId: string,
  captainId: string | null,
) {
  if (!captainId) {
    throw new AppError(400, "A starting captain is required");
  }

  const now = new Date().toISOString();
  const { data: stagedLineup, error: stageError } = await supabaseAdmin
    .from("lineups")
    .upsert(
      {
        fixture_id: input.fixture_id,
        team_registration_id: input.team_registration_id,
        season_id: seasonId,
        manager_id: managerId,
        formation: input.formation,
        playing_style: normalizedPlayingStyle(input.playing_style),
        captain_id: null,
        status: "REJECTED",
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        confirmed_at: null,
        rejection_reason:
          "Lineup update was interrupted. Submit the lineup again.",
        updated_at: now,
      },
      { onConflict: "fixture_id,team_registration_id" },
    )
    .select("*")
    .single();
  if (stageError) throw stageError;

  // Clear dependants before replacing the submitted squad. This ordering keeps
  // the database valid while captain and set-piece integrity triggers run.
  const { error: takerDeleteError } = await supabaseAdmin
    .from("lineup_set_piece_takers")
    .delete()
    .eq("lineup_id", stagedLineup.id);
  if (takerDeleteError) throw takerDeleteError;

  const { error: playerDeleteError } = await supabaseAdmin
    .from("lineup_players")
    .delete()
    .eq("lineup_id", stagedLineup.id);
  if (playerDeleteError) throw playerDeleteError;

  const { error: playerInsertError } = await supabaseAdmin
    .from("lineup_players")
    .insert(
      input.players.map((player) => ({
        lineup_id: stagedLineup.id,
        player_registration_id: player.player_registration_id,
        is_starter: player.is_starter,
        position: player.position,
        football_position: player.player_natural_position ?? null,
        player_natural_position: player.player_natural_position ?? null,
        slot_key: player.slot_key ?? null,
        display_role: player.display_role ?? null,
        display_order: player.display_order ?? null,
        is_captain: player.player_registration_id === captainId,
      })),
    );
  if (playerInsertError) throw playerInsertError;

  const selectedPlayerIds = input.players.map(
    (player) => player.player_registration_id,
  );
  await saveLineupSetPieceTakers(
    stagedLineup.id,
    selectedPlayerIds,
    input.penalty_taker_ids,
    input.free_kick_taker_ids,
  );

  const { data: publishedLineup, error: publishError } = await supabaseAdmin
    .from("lineups")
    .update({
      captain_id: captainId,
      status: "PENDING",
      submitted_at: now,
      reviewed_by: null,
      reviewed_at: null,
      confirmed_at: null,
      rejection_reason: null,
      updated_at: now,
    })
    .eq("id", stagedLineup.id)
    .select("*")
    .single();
  if (publishError) throw publishError;

  return publishedLineup;
}

function lineupPlayersFromPicks(
  picks: ReturnType<typeof autoPickBestXI>,
  bench: LineupCandidate[] = [],
) {
  return [
    ...picks.map((pick, index) => ({
      player_registration_id: pick.player_registration_id,
      is_starter: true,
      position: positionToCoarse(pick.playerNaturalPosition),
      slot_key: pick.slotKey,
      display_role: pick.displayRole,
      player_natural_position: pick.playerNaturalPosition,
      display_order: index,
      is_captain: false,
      fit_label: pick.fitLabel,
      score: pick.score,
    })),
    ...bench.map((player, index) => ({
      player_registration_id: player.id,
      is_starter: false,
      position: positionToCoarse(naturalPosition(player)),
      slot_key: null,
      display_role: "SUB",
      player_natural_position: naturalPosition(player),
      display_order: picks.length + index,
      is_captain: false,
    })),
  ];
}

function buildBench(
  availablePlayers: LineupCandidate[],
  starterIds: Set<string>,
  _benchSize: number,
) {
  return availablePlayers
    .filter((player) => !starterIds.has(player.id))
    .sort(
      (a, b) =>
        Number(naturalPosition(a) === FootballPosition.GK) -
          Number(naturalPosition(b) === FootballPosition.GK) ||
        (b.player_abilities ? 1 : 0) - (a.player_abilities ? 1 : 0),
    );
}

function normalizedPlayingStyle(value: unknown): PlayingStyle {
  return isValidPlayingStyle(value) ? value : "BALANCED";
}

function normalizedFormation(value: unknown) {
  return isValidFormation(value) ? value : "4-3-3";
}

managerRouter.post(
  "/team-registrations",
  asyncHandler(async (req, res) => {
    const input = teamRegistrationSchema.parse(req.body);
    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .insert({
        manager_id: req.auth!.userId,
        name: input.name,
        short_name: input.short_name,
        logo_url: input.logo_url ?? null,
        primary_color: input.primary_color ?? null,
        secondary_color: input.secondary_color ?? null,
        accent_color: input.accent_color ?? null,
        home_jersey_url: input.home_jersey_url ?? null,
        away_jersey_url: input.away_jersey_url ?? null,
        gk_home_jersey_url: input.gk_home_jersey_url ?? null,
        gk_away_jersey_url: input.gk_away_jersey_url ?? null,
      })
      .select("*")
      .single();
    if (teamError) throw teamError;

    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .insert({
        season_id: input.season_id,
        team_id: team.id,
        manager_id: req.auth!.userId,
        status: RegistrationStatus.DRAFT,
      })
      .select("*,teams(*)")
      .single();
    if (error) throw error;
    res.status(201).json({ team_registration: data, team: data.teams });
  }),
);

managerRouter.post(
  "/teams",
  asyncHandler(async (req, res) => {
    const input = teamRegistrationSchema.parse(req.body);
    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .insert({
        manager_id: req.auth!.userId,
        name: input.name,
        short_name: input.short_name,
        logo_url: input.logo_url ?? null,
        primary_color: input.primary_color ?? null,
        secondary_color: input.secondary_color ?? null,
        accent_color: input.accent_color ?? null,
        home_jersey_url: input.home_jersey_url ?? null,
        away_jersey_url: input.away_jersey_url ?? null,
        gk_home_jersey_url: input.gk_home_jersey_url ?? null,
        gk_away_jersey_url: input.gk_away_jersey_url ?? null,
      })
      .select("*")
      .single();
    if (teamError) throw teamError;

    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .insert({
        season_id: input.season_id,
        team_id: team.id,
        manager_id: req.auth!.userId,
        status: RegistrationStatus.DRAFT,
      })
      .select(
        "*,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,max_players_per_team,league_id,leagues(id,name,short_name,logo_url))",
      )
      .single();
    if (error) throw error;
    res.status(201).json({ team_registration: data, team: data.teams });
  }),
);

managerRouter.get(
  "/team-registrations",
  asyncHandler(async (req, res) => {
    const data = await loadManagerTeams(req.auth!.userId);
    res.json({ team_registrations: data });
  }),
);

managerRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const [profileResult, teams] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", req.auth!.userId)
        .single(),
      loadManagerTeams(req.auth!.userId),
    ]);
    if (profileResult.error) throw profileResult.error;
    const activeTeam = teams[0] ?? null;
    if (!activeTeam) {
      return res.json({
        profile: profileResult.data,
        active_team: null,
        teams: [],
        squad_summary: null,
        fixtures: [],
        results: [],
        standings: [],
        messages: [],
      });
    }

    const players = await loadTeamPlayers(activeTeam.id);
    const season = relatedOne(activeTeam.seasons);
    const maxPlayers = Number(season?.max_players_per_team ?? 22);
    const [
      { data: fixtures, error: fixturesError },
      { data: results, error: resultsError },
      standings,
      { data: messages, error: messagesError },
    ] = await Promise.all([
      supabaseAdmin
        .from("fixtures")
        .select(
          "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color))",
        )
        .or(
          `home_team_registration_id.eq.${activeTeam.id},away_team_registration_id.eq.${activeTeam.id}`,
        )
        .neq("status", FixtureStatus.FINAL)
        .neq("status", FixtureStatus.COMPLETED)
        .neq("status", FixtureStatus.CANCELLED)
        .neq("status", FixtureStatus.POSTPONED)
        .neq("status", FixtureStatus.WAITING_FOR_TEAMS)
        .order("kickoff_at", { ascending: true, nullsFirst: false })
        .limit(8),
      supabaseAdmin
        .from("fixtures")
        .select(
          "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color))",
        )
        .or(
          `home_team_registration_id.eq.${activeTeam.id},away_team_registration_id.eq.${activeTeam.id}`,
        )
        .eq("status", FixtureStatus.FINAL)
        .order("finalized_at", { ascending: false, nullsFirst: false })
        .limit(5),
      loadSeasonStandings(activeTeam.season_id),
      supabaseAdmin
        .from("manager_messages")
        .select(
          "*,player_season_registrations(id,players(full_name,avatar_url)),fixtures(id,kickoff_at)",
        )
        .eq("manager_id", req.auth!.userId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    if (fixturesError) throw fixturesError;
    if (resultsError) throw resultsError;
    if (messagesError) throw messagesError;

    const counts = statusCounts(players);
    res.json({
      profile: profileResult.data,
      active_team: activeTeam,
      teams,
      squad_summary: {
        ...counts,
        max_squad_size: maxPlayers,
        remaining_slots: Math.max(
          0,
          maxPlayers -
            players.filter(
              (player) =>
                player.status !== RegistrationStatus.REJECTED &&
                player.player_status !== PlayerLifecycleStatus.REMOVED,
            ).length,
        ),
      },
      fixtures: fixtures ?? [],
      results: results ?? [],
      standings,
      messages: messages ?? [],
    });
  }),
);

managerRouter.get(
  "/leagues",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("leagues")
      .select(
        "*,seasons(id,name,season_year,format,phase,registration_start_date,registration_deadline,start_date,end_date,max_players_per_team,lineup_size,substitute_limit,total_teams)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ leagues: data ?? [] });
  }),
);

managerRouter.get(
  "/seasons",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("seasons")
      .select("*,leagues(id,name,short_name,logo_url)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ seasons: data ?? [] });
  }),
);

managerRouter.get(
  "/seasons/:seasonId/teams",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertManagerCanViewSeason(req.auth!.userId, seasonId);
    const teams = await loadSeasonTeamsForManager(seasonId);
    res.json({ teams });
  }),
);

managerRouter.get(
  "/seasons/:seasonId/knockout-bracket",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertManagerCanViewSeason(req.auth!.userId, seasonId);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select(
        "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))",
      )
      .eq("season_id", seasonId)
      .not("stage", "in", "(LEAGUE,GROUP)")
      .order("round_no", { ascending: true })
      .order("kickoff_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
    if (error) throw error;
    res.json({ fixtures: data ?? [] });
  }),
);

managerRouter.get(
  "/seasons/:seasonId/groups",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertManagerCanViewSeason(req.auth!.userId, seasonId);
    const groups = await loadSeasonGroupsForManager(seasonId);
    res.json({ groups });
  }),
);

managerRouter.get(
  "/teams/:teamId/view",
  asyncHandler(async (req, res) => {
    const teamId = routeParam(req.params.teamId, "teamId");
    const { data: team, error } = await supabaseAdmin
      .from("team_registrations")
      .select(
        "id,season_id,team_id,manager_id,status,rejection_reason,created_at,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,max_players_per_team,league_id,leagues(id,name,short_name,logo_url)),manager:profiles!team_registrations_manager_id_fkey(id,full_name,email)",
      )
      .eq("id", teamId)
      .single();
    if (error) throw error;
    await assertManagerCanViewSeason(req.auth!.userId, team.season_id);
    const players = await loadTeamPlayers(team.id);
    const visiblePlayers = players.map((player) => {
      const ability = relatedOne(player.player_abilities);
      const identity = relatedOne(player.players);
      return {
        ...player,
        overall_rating: ability?.overall_rating ?? null,
        player_abilities: undefined,
        players: identity
          ? { ...identity, generated_identity_number: null }
          : null,
      };
    });
    const counts = statusCounts(players);
    const [
      { data: fixtures, error: fixturesError },
      { data: results, error: resultsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("fixtures")
        .select(
          "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))",
        )
        .eq("season_id", team.season_id)
        .or(
          `home_team_registration_id.eq.${team.id},away_team_registration_id.eq.${team.id}`,
        )
        .neq("status", FixtureStatus.FINAL)
        .order("kickoff_at", { ascending: true, nullsFirst: false })
        .limit(8),
      supabaseAdmin
        .from("fixtures")
        .select(
          "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))",
        )
        .eq("season_id", team.season_id)
        .or(
          `home_team_registration_id.eq.${team.id},away_team_registration_id.eq.${team.id}`,
        )
        .eq("status", FixtureStatus.FINAL)
        .order("finalized_at", { ascending: false, nullsFirst: false })
        .limit(8),
    ]);
    if (fixturesError) throw fixturesError;
    if (resultsError) throw resultsError;
    res.json({
      team,
      players: visiblePlayers,
      fixtures: fixtures ?? [],
      results: results ?? [],
      squad_summary: {
        ...counts,
        max_squad_size: Number(
          relatedOne(team.seasons)?.max_players_per_team ?? 22,
        ),
        remaining_slots: Math.max(
          0,
          Number(relatedOne(team.seasons)?.max_players_per_team ?? 22) -
            players.filter(
              (player) =>
                player.status !== RegistrationStatus.REJECTED &&
                player.player_status !== PlayerLifecycleStatus.REMOVED,
            ).length,
        ),
        distribution: currentDistribution(players),
      },
    });
  }),
);

managerRouter.get(
  "/teams/:teamId",
  asyncHandler(async (req, res) => {
    const team = await assertManagerOwnsTeam(
      req.auth!.userId,
      routeParam(req.params.teamId, "teamId"),
    );
    const players = await loadTeamPlayers(team.id);
    const season = relatedOne(team.seasons);
    const counts = statusCounts(players);
    res.json({
      team,
      players,
      squad_summary: {
        ...counts,
        max_squad_size: maxSquadSize(team),
        remaining_slots: Math.max(
          0,
          maxSquadSize(team) -
            players.filter(
              (player) =>
                player.status !== RegistrationStatus.REJECTED &&
                player.player_status !== PlayerLifecycleStatus.REMOVED,
            ).length,
        ),
        distribution: currentDistribution(players),
      },
      season,
    });
  }),
);

managerRouter.patch(
  "/teams/:teamId",
  asyncHandler(async (req, res) => {
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      routeParam(req.params.teamId, "teamId"),
    );
    const input = teamRegistrationSchema
      .omit({ season_id: true })
      .partial()
      .parse(req.body);
    const canEditCoreTeamData = [
      RegistrationStatus.DRAFT,
      RegistrationStatus.PENDING,
    ].includes(teamRegistration.status);
    const coreFields = [
      "name",
      "short_name",
      "logo_url",
      "primary_color",
      "secondary_color",
      "accent_color",
    ] as const;
    const hasCoreTeamUpdate = coreFields.some(
      (field) => input[field] !== undefined,
    );
    if (!canEditCoreTeamData && hasCoreTeamUpdate) {
      throw new AppError(
        400,
        "Team identity and colors can only be edited before admin approval",
      );
    }
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (canEditCoreTeamData) {
      for (const field of coreFields) {
        if (input[field] !== undefined) updatePayload[field] = input[field];
      }
    }
    const jerseyFields = [
      "home_jersey_url",
      "away_jersey_url",
      "gk_home_jersey_url",
      "gk_away_jersey_url",
    ] as const;
    for (const field of jerseyFields) {
      if (input[field] !== undefined) updatePayload[field] = input[field];
    }
    const { data, error } = await supabaseAdmin
      .from("teams")
      .update(updatePayload)
      .eq("id", teamRegistration.team_id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ team: data });
  }),
);

managerRouter.patch(
  "/teams/:teamId/preferences",
  asyncHandler(async (req, res) => {
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      routeParam(req.params.teamId, "teamId"),
    );
    const input = preferenceSchema.parse(req.body);
    if (input.seasonId !== teamRegistration.season_id)
      throw new AppError(400, "Preference season does not match this team");
    if (!isValidFormation(input.preferredFormation))
      throw new AppError(400, "Unsupported formation");
    if (!isValidPlayingStyle(input.preferredPlayingStyle))
      throw new AppError(400, "Unsupported playing style");
    const preference = await saveManagerPreference(
      req.auth!.userId,
      teamRegistration.id,
      input.seasonId,
      input.preferredFormation,
      input.preferredPlayingStyle,
    );
    res.json({ preference });
  }),
);

managerRouter.post(
  "/teams/:teamId/generate-squad",
  asyncHandler(async (req, res) => {
    const input = generateSquadSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      routeParam(req.params.teamId, "teamId"),
    );
    const maxPlayers = maxSquadSize(teamRegistration);
    const currentSeason = relatedOne(teamRegistration.seasons);
    const requestedTotalSize = input.targetSquadSize;
    const requestedGenerateCount = input.targetGenerateCount;
    if (requestedTotalSize && requestedTotalSize > maxPlayers) {
      throw new AppError(
        400,
        `Target squad size cannot exceed league max squad size (${maxPlayers})`,
      );
    }

    let existingPlayers = await loadTeamPlayers(teamRegistration.id);
    if (input.overwriteDraftPlayers) {
      const removable = existingPlayers
        .filter((player) => player.status === RegistrationStatus.DRAFT)
        .map((player) => player.id);
      if (removable.length > 0) {
        const { error } = await supabaseAdmin
          .from("player_season_registrations")
          .delete()
          .in("id", removable);
        if (error) throw error;
        existingPlayers = await loadTeamPlayers(teamRegistration.id);
      }
    }

    const currentSize = existingPlayers.filter(
      (player) =>
        player.status !== RegistrationStatus.REJECTED &&
        player.player_status !== PlayerLifecycleStatus.REMOVED,
    ).length;
    const availableSlots = Math.max(0, maxPlayers - currentSize);
    const targetSize = Math.min(
      requestedTotalSize ??
        currentSize + (requestedGenerateCount ?? availableSlots),
      maxPlayers,
    );
    const generateCount = Math.max(
      0,
      Math.min(
        availableSlots,
        requestedGenerateCount ?? targetSize - currentSize,
      ),
    );

    if (generateCount === 0) {
      return res.json({
        generated_players: [],
        squad_summary: {
          ...statusCounts(existingPlayers),
          max_squad_size: maxPlayers,
          remaining_slots: Math.max(
            0,
            maxPlayers -
              existingPlayers.filter(
                (player) =>
                  player.status !== RegistrationStatus.REJECTED &&
                  player.player_status !== PlayerLifecycleStatus.REMOVED,
              ).length,
          ),
          distribution: currentDistribution(existingPlayers),
        },
      });
    }
    if (input.positionBreakdown) {
      const breakdownTotal = Object.values(input.positionBreakdown).reduce(
        (sum, count) => sum + count,
        0,
      );
      if (breakdownTotal !== generateCount)
        throw new AppError(
          400,
          `Total selected players must equal ${generateCount}.`,
        );
      if (breakdownTotal > availableSlots)
        throw new AppError(
          400,
          `You only have ${availableSlots} remaining squad slots.`,
        );
      if (currentSize + breakdownTotal > maxPlayers)
        throw new AppError(400, "You cannot exceed max squad size.");
      if (currentSize + breakdownTotal >= 11) {
        const currentGk = existingPlayers.filter(
          (player) =>
            player.football_position === FootballPosition.GK ||
            player.position === PlayerPosition.GK,
        ).length;
        if (currentGk + input.positionBreakdown.GK < 1)
          throw new AppError(400, "You need at least 1 goalkeeper.");
      }
    }

    const target = targetDistribution(targetSize);
    const current = currentDistribution(existingPlayers);
    const needed = neededDistribution(target, current, generateCount);
    const positionBreakdown =
      input.positionBreakdown ??
      (requestedGenerateCount
        ? suggestedPositionBreakdown(generateCount)
        : undefined);
    const generated = generateSquadPlayers({
      count: generateCount,
      distribution: needed,
      positionBreakdown,
      usedNames: existingPlayers
        .map((player) => relatedOne(player.players)?.full_name)
        .filter(Boolean) as string[],
      usedJerseys: existingPlayers
        .map((player) => player.shirt_number)
        .filter((value): value is number => typeof value === "number"),
      seed: `${teamRegistration.id}:${teamRegistration.season_id}:${currentSize}:${targetSize}`,
    });

    const { data: existingIdentities, error: identityError } =
      await supabaseAdmin
        .from("players")
        .select("generated_identity_number")
        .not("generated_identity_number", "is", null);
    if (identityError) throw identityError;
    const usedIdentities = new Set(
      (existingIdentities ?? [])
        .map((row) => row.generated_identity_number)
        .filter(Boolean) as string[],
    );
    let identitySequence = usedIdentities.size + 1;
    const seasonYear = Number(
      currentSeason?.season_year ?? new Date().getFullYear(),
    );

    const createdRegistrations = [];
    for (const [index, playerInput] of generated.entries()) {
      const idType =
        input.identityTypeMode === "generated_birth_id"
          ? IdType.BIRTH_ID
          : input.identityTypeMode === "generated_nid"
            ? IdType.NID
            : index % 8 === 0
              ? IdType.BIRTH_ID
              : IdType.NID;
      let generatedIdentityNumber = generatedIdentity(
        idType,
        seasonYear,
        identitySequence,
      );
      while (usedIdentities.has(generatedIdentityNumber)) {
        identitySequence += 1;
        generatedIdentityNumber = generatedIdentity(
          idType,
          seasonYear,
          identitySequence,
        );
      }
      usedIdentities.add(generatedIdentityNumber);
      identitySequence += 1;
      const generatedHash = hashIdentityNumber(generatedIdentityNumber);
      const { data: player, error: playerError } = await supabaseAdmin
        .from("players")
        .insert({
          full_name: playerInput.full_name,
          date_of_birth: generatedDateOfBirth(
            idType,
            seasonYear,
            identitySequence,
          ),
          id_type: idType,
          id_number_hash: generatedHash,
          id_number_last4: identityLast4(generatedIdentityNumber),
          generated_identity_number: generatedIdentityNumber,
          avatar_url: playerInput.avatar_url || null,
        })
        .select("*")
        .single();
      if (playerError) throw playerError;

      const { data: registration, error: registrationError } =
        await supabaseAdmin
          .from("player_season_registrations")
          .insert({
            player_id: player.id,
            season_id: teamRegistration.season_id,
            team_registration_id: teamRegistration.id,
            position: playerInput.position,
            football_position: playerInput.football_position,
            position_category: playerInput.position_category,
            shirt_number: playerInput.shirt_number,
            preferred_foot: playerInput.preferred_foot,
            status: RegistrationStatus.DRAFT,
            player_status: PlayerLifecycleStatus.ACTIVE,
            identity_mode: "VERIFIED",
            is_generated: false,
            created_by_manager_id: req.auth!.userId,
          })
          .select("*,players(*)")
          .single();
      if (registrationError) throw registrationError;

      const code = playerCode(registration.id);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("player_season_registrations")
        .update({ player_code: code, updated_at: new Date().toISOString() })
        .eq("id", registration.id)
        .select("*,players(*)")
        .single();
      if (updateError) throw updateError;
      createdRegistrations.push(updated);
    }

    const refreshedPlayers = await loadTeamPlayers(teamRegistration.id);
    res.status(201).json({
      generated_players: createdRegistrations,
      distribution: needed,
      position_breakdown: positionBreakdown,
      squad_summary: {
        ...statusCounts(refreshedPlayers),
        max_squad_size: maxPlayers,
        remaining_slots: Math.max(
          0,
          maxPlayers -
            refreshedPlayers.filter(
              (player) =>
                player.status !== RegistrationStatus.REJECTED &&
                player.player_status !== PlayerLifecycleStatus.REMOVED,
            ).length,
        ),
        distribution: currentDistribution(refreshedPlayers),
      },
    });
  }),
);

managerRouter.post(
  "/teams/:teamId/submit-players",
  asyncHandler(async (req, res) => {
    const input = submitPlayersSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      routeParam(req.params.teamId, "teamId"),
    );
    const players = await loadTeamPlayers(teamRegistration.id);
    const selected = players.filter((player) =>
      input.playerIds.includes(player.id),
    );
    if (selected.length !== input.playerIds.length)
      throw new AppError(
        400,
        "Some selected players do not belong to this team",
      );
    if (selected.some((player) => player.status !== RegistrationStatus.DRAFT)) {
      throw new AppError(
        400,
        "Only Draft players can be submitted for approval",
      );
    }
    const jerseyNumbers = players
      .map((player) => player.shirt_number)
      .filter((number): number is number => typeof number === "number");
    if (new Set(jerseyNumbers).size !== jerseyNumbers.length)
      throw new AppError(400, "Player jersey numbers must be unique");

    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        status: RegistrationStatus.PENDING,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", input.playerIds)
      .eq("team_registration_id", teamRegistration.id)
      .select("*,players(*)");
    if (error) throw error;
    if (teamRegistration.status === RegistrationStatus.DRAFT) {
      const { error: teamStatusError } = await supabaseAdmin
        .from("team_registrations")
        .update({
          status: RegistrationStatus.PENDING,
          updated_at: new Date().toISOString(),
        })
        .eq("id", teamRegistration.id);
      if (teamStatusError) throw teamStatusError;
    }
    res.json({ player_registrations: data ?? [] });
  }),
);

managerRouter.get(
  "/teams/:teamId/players",
  asyncHandler(async (req, res) => {
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      routeParam(req.params.teamId, "teamId"),
    );
    const players = await loadTeamPlayers(teamRegistration.id);
    res.json({ players });
  }),
);

managerRouter.post(
  "/teams/:teamId/players",
  asyncHandler(async (req, res) => {
    const teamId = routeParam(req.params.teamId, "teamId");
    const input = playerSubmissionSchema.parse({
      ...req.body,
      team_registration_id: teamId,
    });
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      teamId,
    );
    validateNumericIdentity(input.id_type, input.id_number);
    const players = await loadTeamPlayers(teamRegistration.id);
    if (players.length >= maxSquadSize(teamRegistration))
      throw new AppError(400, "Squad max size reached");
    if (
      input.shirt_number &&
      players.some((player) => player.shirt_number === input.shirt_number)
    ) {
      throw new AppError(400, "Jersey number already exists in this team");
    }

    const idHash = hashIdentityNumber(input.id_number);
    const last4 = identityLast4(input.id_number);
    const footballPosition =
      input.football_position ?? footballPositionFromCoarse(input.position);

    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .upsert(
        {
          full_name: input.full_name,
          date_of_birth: input.date_of_birth,
          id_type: input.id_type,
          id_number_hash: idHash,
          id_number_last4: last4,
          avatar_url: input.avatar_url ?? null,
        },
        { onConflict: "id_number_hash" },
      )
      .select("*")
      .single();
    if (playerError) throw playerError;

    const { data: registration, error } = await supabaseAdmin
      .from("player_season_registrations")
      .insert({
        player_id: player.id,
        season_id: teamRegistration.season_id,
        team_registration_id: teamRegistration.id,
        position: coarsePosition(footballPosition),
        football_position: footballPosition,
        position_category: categoryForFootballPosition(footballPosition),
        shirt_number: input.shirt_number ?? null,
        preferred_foot: input.preferred_foot ?? PreferredFoot.UNKNOWN,
        status: RegistrationStatus.PENDING,
        player_status: PlayerLifecycleStatus.ACTIVE,
        identity_mode: "VERIFIED",
        is_generated: false,
        created_by_manager_id: req.auth!.userId,
      })
      .select("*,players(*)")
      .single();
    if (error) throw error;

    const { data: updated, error: codeError } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        player_code: playerCode(registration.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", registration.id)
      .select("*,players(*)")
      .single();
    if (codeError) throw codeError;

    if (teamRegistration.status === RegistrationStatus.DRAFT) {
      const { error: teamStatusError } = await supabaseAdmin
        .from("team_registrations")
        .update({
          status: RegistrationStatus.PENDING,
          updated_at: new Date().toISOString(),
        })
        .eq("id", teamRegistration.id);
      if (teamStatusError) throw teamStatusError;
    }

    res.status(201).json({ player_registration: updated });
  }),
);

managerRouter.patch(
  "/players/minifaces",
  asyncHandler(async (req, res) => {
    const input = updatePlayerMinifacesSchema.parse(req.body);
    const updates = Array.from(
      new Map(
        input.updates.map((update) => [update.player_registration_id, update]),
      ).values(),
    );
    const registrations = await Promise.all(
      updates.map((update) =>
        assertManagerOwnsPlayerRegistration(
          req.auth!.userId,
          update.player_registration_id,
        ),
      ),
    );
    const registrationsById = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );
    const updatedAt = new Date().toISOString();

    await Promise.all(
      updates.map(async (update) => {
        const registration = registrationsById.get(
          update.player_registration_id,
        );
        if (!registration)
          throw new AppError(404, "Player registration not found");
        const avatarUrl = update.avatar_url?.trim()
          ? update.avatar_url.trim()
          : null;
        const { error } = await supabaseAdmin
          .from("players")
          .update({ avatar_url: avatarUrl, updated_at: updatedAt })
          .eq("id", registration.player_id);
        if (error) throw error;
      }),
    );

    res.json({ updated_count: updates.length });
  }),
);

managerRouter.patch(
  "/players/:playerId",
  asyncHandler(async (req, res) => {
    const input = updateDraftPlayerSchema.parse(req.body);
    const registration = await assertManagerOwnsPlayerRegistration(
      req.auth!.userId,
      routeParam(req.params.playerId, "playerId"),
    );
    if (
      ![RegistrationStatus.DRAFT, RegistrationStatus.PENDING].includes(
        registration.status,
      )
    ) {
      throw new AppError(400, "Only Draft or Pending players can be edited");
    }
    const teamRegistration = relatedOne(registration.team_registrations);
    if (!teamRegistration)
      throw new AppError(404, "Team registration not found");

    if (input.shirt_number !== undefined) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("player_season_registrations")
        .select("id")
        .eq("team_registration_id", registration.team_registration_id)
        .eq("shirt_number", input.shirt_number)
        .neq("id", registration.id)
        .neq("player_status", PlayerLifecycleStatus.REMOVED)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate)
        throw new AppError(
          400,
          "This jersey number is already taken by another player in your squad.",
        );
    }

    if (
      input.generated_identity_number !== undefined ||
      input.id_type !== undefined
    ) {
      const nextIdType = (input.id_type ??
        relatedOne(registration.players)?.id_type) as IdType | undefined;
      const nextIdentityNumber =
        input.generated_identity_number ??
        relatedOne(registration.players)?.generated_identity_number;
      if (!nextIdType || !nextIdentityNumber)
        throw new AppError(400, "ID type and ID number are required.");
      validateNumericIdentity(nextIdType, nextIdentityNumber);
      const { data: duplicateIdentity, error: duplicateIdentityError } =
        await supabaseAdmin
          .from("players")
          .select("id")
          .eq("generated_identity_number", nextIdentityNumber)
          .neq("id", registration.player_id)
          .maybeSingle();
      if (duplicateIdentityError) throw duplicateIdentityError;
      if (duplicateIdentity)
        throw new AppError(
          400,
          "This ID number is already used by another player.",
        );
    }

    if (
      input.full_name !== undefined ||
      input.avatar_url !== undefined ||
      input.id_type !== undefined ||
      input.generated_identity_number !== undefined
    ) {
      const generatedIdentityNumber = input.generated_identity_number;
      const { error: playerError } = await supabaseAdmin
        .from("players")
        .update({
          full_name: input.full_name,
          id_type: input.id_type,
          generated_identity_number: generatedIdentityNumber,
          id_number_hash: generatedIdentityNumber
            ? hashIdentityNumber(generatedIdentityNumber)
            : undefined,
          id_number_last4: generatedIdentityNumber
            ? identityLast4(generatedIdentityNumber)
            : undefined,
          avatar_url: input.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration.player_id);
      if (playerError) throw playerError;
    }

    const footballPosition = input.football_position ?? input.position;
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        football_position: footballPosition,
        position: footballPosition
          ? coarsePosition(footballPosition)
          : undefined,
        position_category: footballPosition
          ? categoryForFootballPosition(footballPosition)
          : undefined,
        shirt_number: input.shirt_number,
        preferred_foot: input.preferred_foot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", registration.id)
      .select("*,players(*)")
      .single();
    if (error) throw error;
    res.json({ player_registration: data });
  }),
);

managerRouter.delete(
  "/players/:playerId",
  asyncHandler(async (req, res) => {
    const registration = await assertManagerOwnsPlayerRegistration(
      req.auth!.userId,
      routeParam(req.params.playerId, "playerId"),
    );
    if (
      ![RegistrationStatus.DRAFT, RegistrationStatus.PENDING].includes(
        registration.status,
      )
    ) {
      throw new AppError(
        400,
        "Only Draft or Pending players can be removed by manager",
      );
    }
    const { error } = await supabaseAdmin
      .from("player_season_registrations")
      .delete()
      .eq("id", registration.id);
    if (error) throw error;
    res.status(204).send();
  }),
);

managerRouter.get(
  "/players/:playerId",
  asyncHandler(async (req, res) => {
    const player = await assertManagerOwnsPlayerRegistration(
      req.auth!.userId,
      routeParam(req.params.playerId, "playerId"),
    );
    res.json({ player });
  }),
);

managerRouter.get(
  "/players/:playerId/league-stats",
  asyncHandler(async (req, res) => {
    const player = await assertManagerOwnsPlayerRegistration(
      req.auth!.userId,
      routeParam(req.params.playerId, "playerId"),
    );
    const [
      { data: seasonStats, error: seasonError },
      { data: matchStats, error: matchError },
    ] = await Promise.all([
      supabaseAdmin
        .from("player_season_stats")
        .select("*")
        .eq("player_registration_id", player.id)
        .maybeSingle(),
      supabaseAdmin
        .from("player_match_stats")
        .select(
          "*,fixtures(id,kickoff_at,stage,status,home_score,away_score,home_team_registration_id,away_team_registration_id,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url)))",
        )
        .eq("player_registration_id", player.id)
        .order("created_at", { ascending: false }),
    ]);
    if (seasonError) throw seasonError;
    if (matchError) throw matchError;
    res.json({
      season_stats: buildPlayerSeasonStatsFromMatchRows(matchStats ?? []),
      stored_season_stats: seasonStats,
      match_stats: matchStats ?? [],
    });
  }),
);

managerRouter.get(
  "/players/:playerId/profile",
  asyncHandler(async (req, res) => {
    const { player, overallRating, canViewAbilityScores } =
      await loadManagerVisiblePlayerRegistration(
        req.auth!.userId,
        routeParam(req.params.playerId, "playerId"),
      );
    const [
      { data: seasonStats, error: seasonError },
      { data: matchStats, error: matchError },
    ] = await Promise.all([
      supabaseAdmin
        .from("player_season_stats")
        .select("*")
        .eq("player_registration_id", player.id)
        .maybeSingle(),
      supabaseAdmin
        .from("player_match_stats")
        .select(
          "*,fixtures(id,kickoff_at,stage,status,home_score,away_score,home_team_registration_id,away_team_registration_id,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url)))",
        )
        .eq("player_registration_id", player.id)
        .order("created_at", { ascending: false }),
    ]);
    if (seasonError) throw seasonError;
    if (matchError) throw matchError;
    const leagueRatings = await loadLeagueRatings([player.id]);
    res.json({
      player,
      overall_rating: overallRating,
      can_view_ability_scores: canViewAbilityScores,
      league_rating: leagueRatings.get(player.id) ?? null,
      season_stats: buildPlayerSeasonStatsFromMatchRows(matchStats ?? []),
      stored_season_stats: seasonStats,
      match_stats: matchStats ?? [],
    });
  }),
);

managerRouter.get(
  "/fixtures",
  asyncHandler(async (req, res) => {
    const teamId =
      typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    const seasonId =
      typeof req.query.seasonId === "string" ? req.query.seasonId : undefined;
    const teams = seasonId
      ? await assertManagerCanViewSeason(req.auth!.userId, seasonId)
      : await loadManagerTeams(req.auth!.userId);
    let ids: string[] = [];
    if (teamId && teamId !== "ALL") {
      if (seasonId) {
        const seasonTeams = await loadSeasonTeamsForManager(seasonId);
        ids = seasonTeams
          .filter((team) => team.id === teamId)
          .map((team) => team.id);
      } else {
        ids = teams.filter((team) => team.id === teamId).map((team) => team.id);
      }
    } else if (seasonId) {
      ids = (await loadSeasonTeamsForManager(seasonId)).map((team) => team.id);
    } else {
      ids = teams.map((team) => team.id);
    }
    if (ids.length === 0) return res.json({ fixtures: [] });
    const clauses = ids.flatMap((id) => [
      `home_team_registration_id.eq.${id}`,
      `away_team_registration_id.eq.${id}`,
    ]);
    let query = supabaseAdmin
      .from("fixtures")
      .select(
        "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url)),lineups(id,team_registration_id,status,formation,playing_style)",
      )
      .or(clauses.join(","));
    if (seasonId) query = query.eq("season_id", seasonId);
    const { data, error } = await query.order("kickoff_at", {
      ascending: true,
      nullsFirst: false,
    });
    if (error) throw error;
    res.json({ fixtures: data ?? [] });
  }),
);

managerRouter.get(
  "/results",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teams.map((team) => team.id);
    if (ids.length === 0) return res.json({ results: [] });
    const clauses = ids.flatMap((id) => [
      `home_team_registration_id.eq.${id}`,
      `away_team_registration_id.eq.${id}`,
    ]);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select(
        "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color))",
      )
      .or(clauses.join(","))
      .eq("status", FixtureStatus.FINAL)
      .order("finalized_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    res.json({ results: data ?? [] });
  }),
);

managerRouter.get(
  "/standings",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const seasonId =
      typeof req.query.seasonId === "string"
        ? req.query.seasonId
        : relatedOne(teams[0]?.seasons)?.id;
    if (!seasonId) return res.json({ standings: [] });
    const standings = await loadSeasonStandings(seasonId);
    res.json({ standings });
  }),
);

managerRouter.get(
  "/seasons/:seasonId/stat-leaderboards",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    const requestedTeamId =
      typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    await assertManagerCanViewSeason(req.auth!.userId, seasonId);

    const [
      teamRegistrationsResult,
      playerRegistrationsResult,
      standingsResult,
      fixturesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("team_registrations")
        .select("id,season_id,status,teams(name,short_name,logo_url)")
        .eq("season_id", seasonId)
        .eq("status", RegistrationStatus.APPROVED),
      supabaseAdmin
        .from("player_season_registrations")
        .select(
          "id,season_id,team_registration_id,position,football_position,shirt_number,players(full_name,avatar_url)",
        )
        .eq("season_id", seasonId),
      supabaseAdmin
        .from("season_standings_report")
        .select("*")
        .eq("season_id", seasonId),
      supabaseAdmin
        .from("fixtures")
        .select(
          "id,home_team_registration_id,away_team_registration_id,home_score,away_score,status",
        )
        .eq("season_id", seasonId),
    ]);
    if (teamRegistrationsResult.error) throw teamRegistrationsResult.error;
    if (playerRegistrationsResult.error) throw playerRegistrationsResult.error;
    if (standingsResult.error) throw standingsResult.error;
    if (fixturesResult.error) throw fixturesResult.error;

    const allTeams = teamRegistrationsResult.data ?? [];
    const scopedTeams =
      requestedTeamId && requestedTeamId !== "ALL"
        ? allTeams.filter((team) => team.id === requestedTeamId)
        : allTeams;
    if (
      requestedTeamId &&
      requestedTeamId !== "ALL" &&
      scopedTeams.length === 0
    )
      throw new AppError(404, "Team not found in this season");
    const teamIds = scopedTeams.map((team) => team.id);
    const allPlayerRegistrations = playerRegistrationsResult.data ?? [];
    const playerRegistrations = allPlayerRegistrations.filter((player) =>
      teamIds.includes(player.team_registration_id),
    );
    const playerIds = playerRegistrations.map((player) => player.id);
    const fixtures = fixturesResult.data ?? [];
    const fixtureIds = fixtures.map((fixture) => fixture.id);

    const [
      playerSeasonStatsResult,
      playerMatchStatsResult,
      teamMatchStatsResult,
      penaltyEventsResult,
    ] = await Promise.all([
      playerIds.length
        ? supabaseAdmin
            .from("player_season_stats")
            .select("*")
            .eq("season_id", seasonId)
            .in("player_registration_id", playerIds)
        : Promise.resolve({ data: [], error: null }),
      playerIds.length
        ? supabaseAdmin
            .from("player_match_stats")
            .select("*")
            .in("player_registration_id", playerIds)
        : Promise.resolve({ data: [], error: null }),
      teamIds.length
        ? supabaseAdmin
            .from("team_match_stats")
            .select("*")
            .in("team_registration_id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      fixtureIds.length
        ? supabaseAdmin
            .from("match_events")
            .select("fixture_id,side,type")
            .in("fixture_id", fixtureIds)
            .in("type", [
              MatchEventType.PENALTY_GOAL,
              MatchEventType.PENALTY_MISS,
              MatchEventType.PENALTY_SAVED,
            ])
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (playerSeasonStatsResult.error) throw playerSeasonStatsResult.error;
    if (playerMatchStatsResult.error) throw playerMatchStatsResult.error;
    if (teamMatchStatsResult.error) throw teamMatchStatsResult.error;
    if (penaltyEventsResult.error) throw penaltyEventsResult.error;

    const allTeamById = new Map(allTeams.map((team) => [team.id, team]));
    const teamById = new Map(scopedTeams.map((team) => [team.id, team]));
    const playerById = new Map(
      playerRegistrations.map((player) => [player.id, player]),
    );
    const playerMatchStats = playerMatchStatsResult.data ?? [];

    const playerRows = buildPlayerLeaderboardRows(
      playerSeasonStatsResult.data ?? [],
      playerMatchStats,
      playerById,
      teamById,
    );

    const standingsByTeam = new Map(
      (standingsResult.data ?? []).map((standing) => [
        standing.team_registration_id,
        standing,
      ]),
    );
    const fixtureById = new Map(
      fixtures.map((fixture) => [fixture.id, fixture]),
    );
    const penaltyEvents = penaltyEventsResult.data ?? [];
    const allPlayerMatchStats = playerMatchStatsResult.data ?? [];
    const teamMatchStats = teamMatchStatsResult.data ?? [];
    const teamRows = scopedTeams.map((team) => {
      const teamStats = teamMatchStats.filter(
        (row) => row.team_registration_id === team.id,
      );
      const standing = standingsByTeam.get(team.id);
      const played = Math.max(Number(standing?.played ?? 0), teamStats.length);
      const teamPlayers = allPlayerRegistrations
        .filter((player) => player.team_registration_id === team.id)
        .map((player) => player.id);
      const teamPlayerMatchRows = allPlayerMatchStats.filter((row) =>
        teamPlayers.includes(row.player_registration_id),
      );
      const sumTeam = (field: string) =>
        teamStats.reduce((total, row) => total + Number(row[field] ?? 0), 0);
      const sumPlayers = (field: string) =>
        teamPlayerMatchRows.reduce(
          (total, row) => total + Number(row[field] ?? 0),
          0,
        );
      const cleanSheets = fixtures.filter((fixture) => {
        if (fixture.status !== FixtureStatus.FINAL) return false;
        if (fixture.home_team_registration_id === team.id)
          return Number(fixture.away_score ?? 0) === 0;
        if (fixture.away_team_registration_id === team.id)
          return Number(fixture.home_score ?? 0) === 0;
        return false;
      }).length;
      const teamMatchRatings = teamStats
        .map((teamStat) => {
          const storedRating = Number(teamStat.rating ?? 0);
          if (storedRating > 0) return storedRating;
          const matchPlayerRatings = teamPlayerMatchRows
            .filter((row) => row.fixture_id === teamStat.fixture_id)
            .map((row) => Number(row.rating ?? 0))
            .filter((rating) => rating > 0);
          return avg(matchPlayerRatings);
        })
        .filter((rating) => rating > 0);
      return {
        id: team.id,
        name:
          relatedName(team.teams, "name") ??
          relatedName(allTeamById.get(team.id)?.teams, "name") ??
          "Unnamed team",
        logoUrl: relatedName(team.teams, "logo_url"),
        played,
        avgPossession: avg(teamStats.map((row) => Number(row.possession ?? 0))),
        rating: teamMatchRatings.length ? avg(teamMatchRatings) : 0,
        goalsPerMatch: perMatch(Number(standing?.goals_for ?? 0), played),
        expectedGoals: totalExpectedGoals(teamStats),
        shotsOnTargetPerMatch: perMatch(sumTeam("shots_on_target"), played),
        bigChancesPerMatch: perMatch(sumTeam("big_chances"), played),
        bigChancesMissedPerMatch: perMatch(
          sumTeam("big_chances_missed"),
          played,
        ),
        accuratePassesPerMatch: perMatch(sumTeam("accurate_passes"), played),
        cornersPerMatch: perMatch(sumTeam("corners"), played),
        cleanSheets,
        goalsConcededPerMatch: perMatch(
          Number(standing?.goals_against ?? 0),
          played,
        ),
        tacklesPerMatch: perMatch(sumPlayers("tackles"), played),
        clearancesPerMatch: perMatch(sumPlayers("clearances"), played),
        penaltiesConceded: penaltyEvents.filter((event) => {
          const fixture = fixtureById.get(event.fixture_id);
          if (!fixture) return false;
          return event.side === VenueSide.HOME
            ? fixture.away_team_registration_id === team.id
            : fixture.home_team_registration_id === team.id;
        }).length,
        gkSavesPerMatch: perMatch(sumPlayers("saves"), played),
        foulsPerMatch: perMatch(sumTeam("fouls"), played),
        yellowCards: sumTeam("yellow_cards"),
        redCards: sumTeam("red_cards"),
      };
    });

    res.json(makeStatsReport(playerRows, teamRows));
  }),
);

managerRouter.get(
  "/messages",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("manager_messages")
      .select(
        "*,team_registrations(id,teams(name,short_name)),player_season_registrations(id,players(full_name)),fixtures(id,kickoff_at)",
      )
      .eq("manager_id", req.auth!.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ messages: data ?? [] });
  }),
);

managerRouter.patch(
  "/messages/:messageId/read",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("manager_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.messageId)
      .eq("manager_id", req.auth!.userId)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ message: data });
  }),
);

const managerMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(2000),
  team_registration_id: z.string().uuid().optional(),
  parent_message_id: z.string().uuid().optional(),
});

// A manager sends a free-form message to the admins, or replies within an
// existing thread. Every row keeps manager_id = the manager the thread belongs
// to (self) so both sides read the same conversation; sender_role marks the
// message as manager-authored. The season/team scope is derived from the parent
// message when replying, or from the chosen/only team registration otherwise.
managerRouter.post(
  "/messages",
  asyncHandler(async (req, res) => {
    const input = managerMessageSchema.parse(req.body);
    const managerId = req.auth!.userId;

    let seasonId: string;
    let teamRegistrationId: string | null;

    if (input.parent_message_id) {
      const { data: parent, error: parentError } = await supabaseAdmin
        .from("manager_messages")
        .select("id,season_id,team_registration_id,manager_id")
        .eq("id", input.parent_message_id)
        .eq("manager_id", managerId)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent) throw new AppError(404, "Message thread not found");
      seasonId = parent.season_id;
      teamRegistrationId = parent.team_registration_id;
    } else {
      const teams = await loadManagerTeams(managerId);
      const target = input.team_registration_id
        ? teams.find((team) => team.id === input.team_registration_id)
        : teams[0];
      if (!target) {
        throw new AppError(
          400,
          input.team_registration_id
            ? "You do not manage this team registration."
            : "Register a team before messaging the admins.",
        );
      }
      seasonId = target.season_id;
      teamRegistrationId = target.id;
    }

    const { data, error } = await supabaseAdmin
      .from("manager_messages")
      .insert({
        season_id: seasonId,
        manager_id: managerId,
        team_registration_id: teamRegistrationId,
        related_type: "GENERAL_NOTICE",
        message: input.message,
        sender_role: UserRole.MANAGER,
        parent_message_id: input.parent_message_id ?? null,
        created_by: managerId,
      })
      .select(
        "*,team_registrations(id,teams(name,short_name)),player_season_registrations(id,players(full_name)),fixtures(id,kickoff_at)",
      )
      .single();
    if (error) throw error;
    res.status(201).json({ message: data });
  }),
);

managerRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,role,created_at")
      .eq("id", req.auth!.userId)
      .single();
    if (error) throw error;
    res.json({ profile: data });
  }),
);

managerRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const fullName =
      typeof req.body?.full_name === "string"
        ? req.body.full_name.trim().slice(0, 160)
        : undefined;
    if (!fullName) throw new AppError(400, "Full name is required");
    const now = new Date().toISOString();
    // app_managers is the source of truth: ensureProfile() copies its full_name
    // into profiles on every login, so we must update it here or the edit would
    // silently revert on the manager's next sign-in.
    const { error: accountError } = await supabaseAdmin
      .from("app_managers")
      .update({ full_name: fullName, updated_at: now })
      .eq("id", req.auth!.userId);
    if (accountError) throw accountError;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName, updated_at: now })
      .eq("id", req.auth!.userId)
      .select("id,email,full_name,role,created_at")
      .single();
    if (error) throw error;
    res.json({ profile: data });
  }),
);

managerRouter.get(
  "/matches/:matchId/detail",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teams.map((team) => team.id);
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select(
        "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url,primary_color))",
      )
      .eq("id", req.params.matchId)
      .single();
    if (fixtureError) throw fixtureError;
    if (
      !ids.includes(fixture.home_team_registration_id) &&
      !ids.includes(fixture.away_team_registration_id)
    ) {
      await assertManagerCanViewSeason(req.auth!.userId, fixture.season_id);
    }
    const [
      { data: lineups, error: lineupsError },
      { data: teamStats, error: teamStatsError },
      { data: playerStats, error: playerStatsError },
      { data: events, error: eventsError },
      { data: substitutions, error: substitutionsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("lineups")
        .select(
          "*,lineup_players(*,player_season_registrations(id,shirt_number,football_position,players(full_name,avatar_url)))",
        )
        .eq("fixture_id", fixture.id),
      supabaseAdmin
        .from("team_match_stats")
        .select("*")
        .eq("fixture_id", fixture.id),
      supabaseAdmin
        .from("player_match_stats")
        .select(
          "*,player_season_registrations(id,shirt_number,football_position,position,players(full_name,avatar_url))",
        )
        .eq("fixture_id", fixture.id),
      supabaseAdmin
        .from("match_events")
        .select("*")
        .eq("fixture_id", fixture.id)
        .order("minute", { ascending: true }),
      supabaseAdmin
        .from("match_substitutions")
        .select("*")
        .eq("fixture_id", fixture.id)
        .order("minute", { ascending: true }),
    ]);
    if (lineupsError) throw lineupsError;
    if (teamStatsError) throw teamStatsError;
    if (playerStatsError) throw playerStatsError;
    if (eventsError) throw eventsError;
    if (substitutionsError) throw substitutionsError;
    res.json({
      fixture,
      lineups: (lineups ?? []).map((lineup) => ({
        ...lineup,
        formation_slots: getFormationSlots(lineup.formation ?? "4-3-3"),
      })),
      team_stats: teamStats ?? [],
      player_stats: playerStats ?? [],
      events: events ?? [],
      substitutions: substitutions ?? [],
    });
  }),
);

managerRouter.get(
  "/matches/:matchId/lineup-builder",
  asyncHandler(async (req, res) => {
    const matchId = routeParam(req.params.matchId, "matchId");
    const teams = await loadManagerTeams(req.auth!.userId);
    const teamIdQuery =
      typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select(
        "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url))",
      )
      .eq("id", matchId)
      .single();
    if (fixtureError) throw fixtureError;
    const ownedTeamIds = teams.map((team) => team.id);
    const teamRegistrationId =
      teamIdQuery && ownedTeamIds.includes(teamIdQuery)
        ? teamIdQuery
        : ownedTeamIds.find(
            (id) =>
              id === fixture.home_team_registration_id ||
              id === fixture.away_team_registration_id,
          );
    if (!teamRegistrationId)
      throw new AppError(403, "This fixture does not belong to your team");
    const teamRegistration =
      teams.find((team) => team.id === teamRegistrationId) ??
      (await assertManagerOwnsTeam(req.auth!.userId, teamRegistrationId));
    await assertNextLineupFixture(
      teamRegistrationId,
      fixture.season_id,
      fixture.id,
    );
    const season = relatedOne(teamRegistration.seasons);
    const preference = await loadManagerPreference(
      req.auth!.userId,
      teamRegistrationId,
      fixture.season_id,
    );
    const allTeamPlayers = await loadTeamPlayers(teamRegistrationId);
    const discipline = await loadYellowCardDiscipline(
      fixture.season_id,
      String(fixture.stage ?? "LEAGUE"),
      season?.yellow_card_suspension_threshold,
      allTeamPlayers,
    );
    const unavailablePlayers = allTeamPlayers.filter(
      (player) =>
        player.status === RegistrationStatus.APPROVED &&
        player.player_status !== PlayerLifecycleStatus.REMOVED &&
        (player.active_injury ||
          player.active_suspension ||
          player.player_status === PlayerLifecycleStatus.SUSPENDED),
    );
    const approvedPlayers = await loadAvailableLineupPlayers(
      teamRegistrationId,
      fixture.season_id,
    );
    const benchSize = Number(season?.substitute_limit ?? 7);
    const existingLineup = await loadExistingLineup(
      teamRegistrationId,
      matchId,
    );
    const previousLineup = await loadPreviousLineup(
      teamRegistrationId,
      fixture.season_id,
      matchId,
    );
    const availableIds = new Set(approvedPlayers.map((player) => player.id));

    let formation = normalizedFormation(
      existingLineup?.formation ??
        previousLineup?.formation ??
        preference?.preferred_formation,
    );
    let playingStyle = normalizedPlayingStyle(
      existingLineup?.playing_style ??
        previousLineup?.playing_style ??
        preference?.preferred_playing_style,
    );
    let initialLineupMode = "AUTO_PICKED_NO_PREVIOUS_LINEUP";
    let warnings: string[] = [];
    let playersForLineup: Array<Record<string, unknown>> = [];

    const sourceLineup = existingLineup ?? previousLineup;
    if (sourceLineup?.lineup_players?.length) {
      const sourcePlayers = [...sourceLineup.lineup_players].sort(
        (a: any, b: any) =>
          Number(a.display_order ?? 0) - Number(b.display_order ?? 0),
      );
      const preserved = sourcePlayers.filter((row: any) =>
        availableIds.has(row.player_registration_id),
      );
      const preservedStarters = preserved.filter((row: any) => row.is_starter);
      const preservedIds = new Set(
        preserved.map((row: any) => row.player_registration_id),
      );
      playersForLineup = preserved.map((row: any, index: number) => ({
        player_registration_id: row.player_registration_id,
        is_starter: row.is_starter,
        position: row.position,
        slot_key: row.slot_key,
        display_role: row.display_role,
        player_natural_position:
          row.player_natural_position ?? row.football_position,
        display_order: row.display_order ?? index,
        is_captain: row.is_captain,
      }));
      if (sourcePlayers.length !== preserved.length) {
        warnings.push(
          "Some players from your previous lineup are unavailable and were replaced.",
        );
      }
      if (preservedStarters.length === 11) {
        initialLineupMode = existingLineup
          ? "EXISTING_LINEUP_LOADED"
          : "PREVIOUS_LINEUP_LOADED";
      } else {
        initialLineupMode = "PREVIOUS_LINEUP_PARTIALLY_RESTORED";
        const slots = getFormationSlots(formation);
        const usedSlotKeys = new Set(
          preservedStarters.map((row: any) => row.slot_key).filter(Boolean),
        );
        const remainingSlots = slots.filter(
          (slot) => !usedSlotKeys.has(slot.slotKey),
        );
        const remainingPlayers = approvedPlayers.filter(
          (player) => !preservedIds.has(player.id),
        );
        for (const slot of remainingSlots) {
          const ranked = remainingPlayers
            .filter((player) => !preservedIds.has(player.id))
            .map((player) => ({
              player,
              ...fitForSlot(slot, player, playingStyle),
            }))
            .sort((a, b) => b.score - a.score);
          const best = ranked[0];
          if (!best) continue;
          preservedIds.add(best.player.id);
          playersForLineup.push({
            player_registration_id: best.player.id,
            is_starter: true,
            position: positionToCoarse(naturalPosition(best.player)),
            slot_key: slot.slotKey,
            display_role: slot.displayRole,
            player_natural_position: naturalPosition(best.player),
            display_order: playersForLineup.length,
            is_captain: false,
            fit_label: best.fitLabel,
            score: Number(best.score.toFixed(2)),
          });
          if (
            playersForLineup.filter((player) => player.is_starter).length === 11
          )
            break;
        }
      }
    } else {
      const picks = autoPickBestXI(approvedPlayers, formation, playingStyle);
      const starterIds = new Set(
        picks.map((pick) => pick.player_registration_id),
      );
      playersForLineup = lineupPlayersFromPicks(
        picks,
        buildBench(approvedPlayers, starterIds, benchSize),
      );
    }

    const selectedIds = new Set(
      playersForLineup.map((player) => String(player.player_registration_id)),
    );
    for (const player of approvedPlayers) {
      if (selectedIds.has(player.id)) continue;
      playersForLineup.push({
        player_registration_id: player.id,
        is_starter: false,
        position: positionToCoarse(naturalPosition(player)),
        slot_key: null,
        display_role: "SUB",
        player_natural_position: naturalPosition(player),
        display_order: playersForLineup.length,
        is_captain: false,
      });
      selectedIds.add(player.id);
    }

    res.json({
      match: fixture,
      team: teamRegistration,
      previousLineup,
      existingLineup,
      preferredFormation: preference?.preferred_formation ?? "4-3-3",
      preferredPlayingStyle: preference?.preferred_playing_style ?? "BALANCED",
      selectedFormation: formation,
      selectedPlayingStyle: playingStyle,
      availableFormations: FORMATION_LABELS,
      availablePlayingStyles: PLAYING_STYLE_LABELS,
      formationSlots: getFormationSlots(formation),
      approvedPlayers,
      unavailablePlayers,
      discipline,
      benchSize,
      initialLineupMode,
      warnings,
      initialLineup: {
        formation,
        playing_style: playingStyle,
        penalty_taker_ids: orderedSetPieceIds(sourceLineup, "PENALTY").filter(
          (id) => selectedIds.has(id),
        ),
        free_kick_taker_ids: orderedSetPieceIds(
          sourceLineup,
          "FREE_KICK",
        ).filter((id) => selectedIds.has(id)),
        players: playersForLineup,
      },
    });
  }),
);

managerRouter.post(
  "/matches/:matchId/lineup/auto-pick",
  asyncHandler(async (req, res) => {
    const input = lineupBuilderAutoPickSchema.parse(req.body);
    if (!isValidFormation(input.formation))
      throw new AppError(400, "Unsupported formation");
    if (!isValidPlayingStyle(input.playingStyle))
      throw new AppError(400, "Unsupported playing style");
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      input.teamId,
    );
    if (teamRegistration.season_id !== input.seasonId)
      throw new AppError(400, "Season does not match this team");
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("*")
      .eq("id", req.params.matchId)
      .single();
    if (fixtureError) throw fixtureError;
    if (
      ![
        fixture.home_team_registration_id,
        fixture.away_team_registration_id,
      ].includes(teamRegistration.id)
    )
      throw new AppError(400, "Team is not assigned to this fixture");
    await assertNextLineupFixture(
      teamRegistration.id,
      fixture.season_id,
      fixture.id,
    );
    const season = relatedOne(teamRegistration.seasons);
    const availablePlayers = await loadAvailableLineupPlayers(
      teamRegistration.id,
      teamRegistration.season_id,
    );
    const picks = autoPickBestXI(
      availablePlayers,
      input.formation,
      input.playingStyle as PlayingStyle,
    );
    const starterIds = new Set(
      picks.map((pick) => pick.player_registration_id),
    );
    const bench = buildBench(
      availablePlayers,
      starterIds,
      Number(season?.substitute_limit ?? 7),
    );
    await saveManagerPreference(
      req.auth!.userId,
      teamRegistration.id,
      teamRegistration.season_id,
      input.formation,
      input.playingStyle as PlayingStyle,
    );
    res.json({
      formationSlots: getFormationSlots(input.formation),
      lineup: {
        formation: input.formation,
        playing_style: input.playingStyle,
        players: lineupPlayersFromPicks(picks, bench),
      },
    });
  }),
);

managerRouter.get(
  "/matches/:matchId/lineup/alternatives",
  asyncHandler(async (req, res) => {
    const teamId =
      typeof req.query.teamId === "string" ? req.query.teamId : undefined;
    const slotKey =
      typeof req.query.slotKey === "string" ? req.query.slotKey : undefined;
    const formation = normalizedFormation(req.query.formation);
    const playingStyle = normalizedPlayingStyle(req.query.playingStyle);
    if (!teamId || !slotKey)
      throw new AppError(400, "teamId and slotKey are required");
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      teamId,
    );
    await assertNextLineupFixture(
      teamId,
      teamRegistration.season_id,
      routeParam(req.params.matchId, "matchId"),
    );
    const slot = getFormationSlots(formation).find(
      (item) => item.slotKey === slotKey,
    );
    if (!slot) throw new AppError(404, "Formation slot not found");
    const availablePlayers = await loadAvailableLineupPlayers(
      teamId,
      teamRegistration.season_id,
    );
    const alternatives = availablePlayers
      .map((player) => ({
        player,
        natural_position: naturalPosition(player),
        ...fitForSlot(slot, player, playingStyle),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.player.players?.full_name ?? "").localeCompare(
            b.player.players?.full_name ?? "",
          ),
      );
    res.json({ slot, alternatives });
  }),
);

managerRouter.post(
  "/matches/:matchId/lineup",
  asyncHandler(async (req, res) => {
    const input = lineupSubmissionSchema.parse({
      ...req.body,
      fixture_id: req.params.matchId,
    });
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      input.team_registration_id,
    );
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("*")
      .eq("id", input.fixture_id)
      .single();
    if (fixtureError) throw fixtureError;
    if (fixture.season_id !== teamRegistration.season_id)
      throw new AppError(400, "Fixture belongs to a different season");
    if (
      ![
        fixture.home_team_registration_id,
        fixture.away_team_registration_id,
      ].includes(input.team_registration_id)
    ) {
      throw new AppError(400, "Team is not assigned to this fixture");
    }
    await assertNextLineupFixture(
      input.team_registration_id,
      fixture.season_id,
      fixture.id,
      true,
    );
    const { data: existingLineup, error: existingLineupError } =
      await supabaseAdmin
        .from("lineups")
        .select("id,status")
        .eq("fixture_id", input.fixture_id)
        .eq("team_registration_id", input.team_registration_id)
        .maybeSingle();
    if (existingLineupError) throw existingLineupError;
    if (
      existingLineup &&
      ["PENDING", "CONFIRMED"].includes(existingLineup.status)
    ) {
      throw new AppError(
        400,
        "This lineup is already submitted or confirmed and cannot be changed until admin rejects it.",
      );
    }

    const { data: players, error: playersError } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,team_registration_id,season_id,status,player_status")
      .eq("season_id", fixture.season_id)
      .eq("team_registration_id", input.team_registration_id);
    if (playersError) throw playersError;
    validateLineupSubmission(input, players ?? [], fixture.season_id);
    const selectedPlayerIds = input.players.map(
      (player) => player.player_registration_id,
    );
    const activeInjuries = await loadActiveInjuries(selectedPlayerIds);
    if (activeInjuries.size > 0) {
      throw new AppError(
        400,
        "Injured players cannot be selected in a lineup.",
      );
    }
    const captainId =
      input.captain_id ??
      input.players.find((player) => player.is_captain)
        ?.player_registration_id ??
      null;

    const lineup = await persistSubmittedLineup(
      input,
      fixture.season_id,
      req.auth!.userId,
      captainId,
    );
    await saveManagerPreference(
      req.auth!.userId,
      input.team_registration_id,
      fixture.season_id,
      input.formation,
      normalizedPlayingStyle(input.playing_style),
    );
    res.status(201).json({
      lineup: {
        ...lineup,
        players: input.players,
        penalty_taker_ids: input.penalty_taker_ids,
        free_kick_taker_ids: input.free_kick_taker_ids,
      },
    });
  }),
);

managerRouter.get(
  "/matches/:matchId/lineup",
  asyncHandler(async (req, res) => {
    const teams = await loadManagerTeams(req.auth!.userId);
    const ids = teams.map((team) => team.id);
    const { data: lineups, error } = await supabaseAdmin
      .from("lineups")
      .select(
        "*,lineup_players(*,player_season_registrations(id,shirt_number,football_position,players(full_name,avatar_url))),lineup_set_piece_takers(player_registration_id,set_piece_type,priority)",
      )
      .eq("fixture_id", req.params.matchId)
      .in("team_registration_id", ids);
    if (error) throw error;
    res.json({ lineups: lineups ?? [] });
  }),
);

managerRouter.post(
  "/players",
  asyncHandler(async (req, res) => {
    const input = playerSubmissionSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      input.team_registration_id,
    );
    validateNumericIdentity(input.id_type, input.id_number);
    const idHash = hashIdentityNumber(input.id_number);
    const last4 = identityLast4(input.id_number);

    const { data: player, error: playerError } = await supabaseAdmin
      .from("players")
      .upsert(
        {
          full_name: input.full_name,
          date_of_birth: input.date_of_birth,
          id_type: input.id_type,
          id_number_hash: idHash,
          id_number_last4: last4,
        },
        { onConflict: "id_number_hash" },
      )
      .select("*")
      .single();
    if (playerError) throw playerError;

    const { data: registration, error } = await supabaseAdmin
      .from("player_season_registrations")
      .insert({
        player_id: player.id,
        season_id: teamRegistration.season_id,
        team_registration_id: input.team_registration_id,
        position: input.position,
        shirt_number: input.shirt_number ?? null,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error) throw error;

    if (teamRegistration.status === RegistrationStatus.DRAFT) {
      const { error: teamStatusError } = await supabaseAdmin
        .from("team_registrations")
        .update({
          status: RegistrationStatus.PENDING,
          updated_at: new Date().toISOString(),
        })
        .eq("id", teamRegistration.id);
      if (teamStatusError) throw teamStatusError;
    }

    res.status(201).json({ player_registration: registration });
  }),
);

managerRouter.post(
  "/lineups",
  asyncHandler(async (req, res) => {
    const input = lineupSubmissionSchema.parse(req.body);
    const teamRegistration = await assertManagerOwnsTeam(
      req.auth!.userId,
      input.team_registration_id,
    );
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("*")
      .eq("id", input.fixture_id)
      .single();
    if (fixtureError) throw fixtureError;
    if (fixture.season_id !== teamRegistration.season_id)
      throw new AppError(400, "Fixture belongs to a different season");
    if (
      ![
        fixture.home_team_registration_id,
        fixture.away_team_registration_id,
      ].includes(input.team_registration_id)
    ) {
      throw new AppError(400, "Team is not assigned to this fixture");
    }
    await assertNextLineupFixture(
      input.team_registration_id,
      fixture.season_id,
      fixture.id,
      true,
    );
    const { data: existingLineup, error: existingLineupError } =
      await supabaseAdmin
        .from("lineups")
        .select("id,status")
        .eq("fixture_id", input.fixture_id)
        .eq("team_registration_id", input.team_registration_id)
        .maybeSingle();
    if (existingLineupError) throw existingLineupError;
    if (
      existingLineup &&
      ["PENDING", "CONFIRMED"].includes(existingLineup.status)
    ) {
      throw new AppError(
        400,
        "This lineup is already submitted or confirmed and cannot be changed until admin rejects it.",
      );
    }

    const { data: players, error: playersError } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,team_registration_id,season_id,status,player_status")
      .eq("season_id", fixture.season_id)
      .eq("team_registration_id", input.team_registration_id);
    if (playersError) throw playersError;
    validateLineupSubmission(input, players ?? [], fixture.season_id);
    const selectedPlayerIds = input.players.map(
      (player) => player.player_registration_id,
    );
    const activeInjuries = await loadActiveInjuries(selectedPlayerIds);
    if (activeInjuries.size > 0) {
      throw new AppError(
        400,
        "Injured players cannot be selected in a lineup.",
      );
    }
    const captainId =
      input.captain_id ??
      input.players.find((player) => player.is_captain)
        ?.player_registration_id ??
      null;

    const lineup = await persistSubmittedLineup(
      input,
      fixture.season_id,
      req.auth!.userId,
      captainId,
    );
    await saveManagerPreference(
      req.auth!.userId,
      input.team_registration_id,
      fixture.season_id,
      input.formation,
      normalizedPlayingStyle(input.playing_style),
    );
    res.status(201).json({
      lineup: {
        ...lineup,
        players: input.players,
        penalty_taker_ids: input.penalty_taker_ids,
        free_kick_taker_ids: input.free_kick_taker_ids,
      },
    });
  }),
);

managerRouter.get(
  "/performance",
  asyncHandler(async (req, res) => {
    const { data: teams, error: teamError } = await supabaseAdmin
      .from("team_registrations")
      .select("id")
      .eq("manager_id", req.auth!.userId);
    if (teamError) throw teamError;
    const ids = (teams ?? []).map((team) => team.id);
    if (ids.length === 0) return res.json({ standings: [], player_stats: [] });

    const { data: standings, error: standingsError } = await supabaseAdmin
      .from("season_standings_report")
      .select("*")
      .in("team_registration_id", ids);
    if (standingsError) throw standingsError;

    const { data: players, error: playerError } = await supabaseAdmin
      .from("player_season_stats")
      .select(
        "*,player_season_registrations!inner(team_registration_id,players(full_name))",
      )
      .in("player_season_registrations.team_registration_id", ids);
    if (playerError) throw playerError;
    res.json({
      standings: ((standings ?? []) as StandingReportRow[]).map(
        standingReportToApiRow,
      ),
      player_stats: players,
    });
  }),
);
