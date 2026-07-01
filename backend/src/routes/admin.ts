import { Router } from "express";
import { z } from "zod";
import {
  createLeagueSchema,
  createSeasonSchema,
  editSimulationSchema,
  FixtureStatus,
  FootballPosition,
  generateFixturesSchema,
  playerAbilityDecisionSchema,
  PlayerAbilityRating,
  PlayerLifecycleStatus,
  RegistrationStatus,
  registrationDecisionSchema,
  roleRequestDecisionSchema,
  SeasonFormat,
  simulateMatchSchema,
  updateSeasonScheduleSchema,
  UserRole,
  VenueSide
} from "@flms/shared";
import { generateSeasonPairings } from "../domain/fixtures.js";
import {
  assertPowerOfTwoQualifiers,
  generateGroupFixturePreview,
  generateKnockoutFixturePreview,
  generateLeagueFixturePreview,
  type FixtureGroup,
  type ScheduledFixturePreview
} from "../domain/fixtures.js";
import { applyFinalResultToStandings, emptyStanding } from "../domain/standings.js";
import {
  generateAbilityScores,
  simulateMatch,
  validateSimulationConsistency,
  type SimPlayer,
  type SimulationResult,
  type SimTeamStats
} from "../domain/simulator.js";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError, assertFound, asyncHandler } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole(UserRole.ADMIN));

const fixturePreviewSchema = z.object({ stage: z.enum(["all", "group", "knockout"]).optional().default("all") });
const groupAssignmentSchema = z.object({
  groups: z.array(
    z.object({
      group_id: z.string().uuid(),
      team_registration_ids: z.array(z.string().uuid())
    })
  )
});

adminRouter.post(
  "/leagues",
  asyncHandler(async (req, res) => {
    const input = createLeagueSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("leagues").insert(input).select("*").single();
    if (error && isSchemaCacheColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from("leagues")
        .insert({
          name: input.name,
          country: input.country ?? null,
          description: input.description ?? null
        })
        .select("*")
        .single();
      if (fallbackError) throw fallbackError;
      return res.status(201).json({ league: fallbackData, warning: "Created with old database schema. Run supabase/update-season-flow.sql to store all new fields." });
    }
    if (error) throw error;
    res.status(201).json({ league: data });
  })
);

adminRouter.post(
  "/seasons",
  asyncHandler(async (req, res) => {
    const input = createSeasonSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("seasons").insert(input).select("*").single();
    if (error && isSchemaCacheColumnError(error)) {
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from("seasons")
        .insert({
          league_id: input.league_id,
          name: input.name,
          format: input.format,
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          group_count: input.group_count ?? null,
          qualifiers_per_group: input.qualifiers_per_group ?? null
        })
        .select("*")
        .single();
      if (fallbackError) throw fallbackError;
      return res.status(201).json({ season: fallbackData, warning: "Created with old database schema. Run supabase/update-season-flow.sql to store all new fields." });
    }
    if (error) throw error;
    res.status(201).json({ season: data });
  })
);

adminRouter.patch(
  "/leagues/:id",
  asyncHandler(async (req, res) => {
    const allowed = ["name", "short_name", "logo_url", "organizer_name", "country", "description"] as const;
    const updates = Object.fromEntries(
      allowed
        .filter((key) => Object.prototype.hasOwnProperty.call(req.body, key))
        .map((key) => [key, req.body[key] === "" ? null : req.body[key]])
    );
    if (Object.keys(updates).length === 0) throw new AppError(400, "No league settings provided");
    const { data, error } = await supabaseAdmin.from("leagues").update(updates).eq("id", req.params.id).select("*").single();
    if (error) throw error;
    res.json({ league: data });
  })
);

adminRouter.patch(
  "/seasons/:id",
  asyncHandler(async (req, res) => {
    const allowed = [
      "format",
      "round_format",
      "phase",
      "registration_start_date",
      "registration_deadline",
      "start_date",
      "end_date",
      "total_teams",
      "min_players_per_team",
      "max_players_per_team",
      "lineup_size",
      "substitute_limit",
      "lineup_submission_deadline_hours",
      "group_count",
      "teams_per_group",
      "qualifiers_per_group",
      "best_third_place_teams",
      "total_knockout_teams"
    ] as const;
    const numberFields = new Set([
      "total_teams",
      "min_players_per_team",
      "max_players_per_team",
      "lineup_size",
      "substitute_limit",
      "lineup_submission_deadline_hours",
      "group_count",
      "teams_per_group",
      "qualifiers_per_group",
      "best_third_place_teams",
      "total_knockout_teams"
    ]);
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(req.body, key)) continue;
      const value = req.body[key];
      updates[key] = value === "" ? null : numberFields.has(key) && value !== null && value !== undefined ? Number(value) : value;
    }
    if (Object.keys(updates).length === 0) throw new AppError(400, "No season settings provided");
    const { data, error } = await supabaseAdmin.from("seasons").update(updates).eq("id", req.params.id).select("*").single();
    if (error) throw error;
    res.json({ season: data });
  })
);

function isSchemaCacheColumnError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "PGRST204" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("schema cache")
  );
}

adminRouter.get(
  "/role-requests",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("role_requests")
      .select("*,profiles(email,full_name,role)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ role_requests: data });
  })
);

adminRouter.patch(
  "/role-requests/:id",
  asyncHandler(async (req, res) => {
    const input = roleRequestDecisionSchema.parse(req.body);
    const { data: roleRequest, error: requestError } = await supabaseAdmin
      .from("role_requests")
      .update({
        status: input.status,
        decided_by: req.auth!.userId,
        decided_at: new Date().toISOString(),
        decision_reason: input.reason ?? null
      })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (requestError) throw requestError;
    if (input.status === "APPROVED") {
      const { error } = await supabaseAdmin.from("profiles").update({ role: "MANAGER" }).eq("id", roleRequest.user_id);
      if (error) throw error;
    }
    res.json({ role_request: roleRequest });
  })
);

adminRouter.get(
  "/team-registrations",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select("*,teams(*),seasons!team_registrations_season_id_fkey(name),manager:profiles!team_registrations_manager_id_fkey(full_name,email)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ team_registrations: data });
  })
);

adminRouter.patch(
  "/team-registrations/:id/decision",
  asyncHandler(async (req, res) => {
    const input = registrationDecisionSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .update({
        status: input.status,
        reviewed_by: req.auth!.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: input.status === "REJECTED" ? input.reason ?? null : null
      })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    if (input.status === "APPROVED") {
      await supabaseAdmin.from("standings").upsert(emptyStandingForSeason(data.season_id, data.id), {
        onConflict: "season_id,team_registration_id"
      });
    }
    res.json({ team_registration: data });
  })
);

adminRouter.get(
  "/player-registrations",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .select("*,players(full_name,date_of_birth,nationality,id_type,id_number_last4,avatar_url),team_registrations(status,teams(name)),player_abilities(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ player_registrations: data });
  })
);

adminRouter.get(
  "/seasons/:seasonId/stat-leaderboards",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "Season id");
    const [
      teamRegistrationsResult,
      playerRegistrationsResult,
      standingsResult,
      fixturesResult
    ] = await Promise.all([
      supabaseAdmin
        .from("team_registrations")
        .select("id,season_id,status,teams(name,short_name,logo_url)")
        .eq("season_id", seasonId),
      supabaseAdmin
        .from("player_season_registrations")
        .select("id,season_id,team_registration_id,position,football_position,shirt_number,players(full_name,avatar_url)")
        .eq("season_id", seasonId),
      supabaseAdmin.from("standings").select("*").eq("season_id", seasonId),
      supabaseAdmin
        .from("fixtures")
        .select("id,home_team_registration_id,away_team_registration_id,home_score,away_score,status")
        .eq("season_id", seasonId)
    ]);
    if (teamRegistrationsResult.error) throw teamRegistrationsResult.error;
    if (playerRegistrationsResult.error) throw playerRegistrationsResult.error;
    if (standingsResult.error) throw standingsResult.error;
    if (fixturesResult.error) throw fixturesResult.error;

    const teamRegistrations = teamRegistrationsResult.data ?? [];
    const playerRegistrations = playerRegistrationsResult.data ?? [];
    const teamIds = teamRegistrations.map((team) => team.id);
    const playerIds = playerRegistrations.map((player) => player.id);

    const [playerSeasonStatsResult, playerMatchStatsResult, teamMatchStatsResult] = await Promise.all([
      playerIds.length
        ? supabaseAdmin.from("player_season_stats").select("*").eq("season_id", seasonId).in("player_registration_id", playerIds)
        : Promise.resolve({ data: [], error: null }),
      playerIds.length
        ? supabaseAdmin.from("player_match_stats").select("*").in("player_registration_id", playerIds)
        : Promise.resolve({ data: [], error: null }),
      teamIds.length
        ? supabaseAdmin.from("team_match_stats").select("*").in("team_registration_id", teamIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (playerSeasonStatsResult.error) throw playerSeasonStatsResult.error;
    if (playerMatchStatsResult.error) throw playerMatchStatsResult.error;
    if (teamMatchStatsResult.error) throw teamMatchStatsResult.error;

    const teamById = new Map(teamRegistrations.map((team) => [team.id, team]));
    const playerById = new Map(playerRegistrations.map((player) => [player.id, player]));
    const playerMatchStats = playerMatchStatsResult.data ?? [];

    const playerRows = (playerSeasonStatsResult.data ?? []).map((seasonStat) => {
      const player = playerById.get(seasonStat.player_registration_id);
      const team = player ? teamById.get(player.team_registration_id) : null;
      const matchRows = playerMatchStats.filter((row) => row.player_registration_id === seasonStat.player_registration_id);
      const minutes = Number(seasonStat.minutes_played ?? 0);
      const sum = (field: string) => matchRows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
      const gkRows = matchRows.filter((row) => row.position_played === FootballPosition.GK);
      const cleanSheets = gkRows.filter((row) => Number(row.goals_conceded ?? 0) === 0 && Number(row.minutes ?? 0) >= 45).length;
      return {
        id: seasonStat.player_registration_id,
        name: relatedName(player?.players, "full_name") ?? "Unnamed player",
        avatarUrl: relatedName(player?.players, "avatar_url"),
        team: relatedName(team?.teams, "name") ?? "Unassigned team",
        teamLogoUrl: relatedName(team?.teams, "logo_url"),
        minutes,
        matches: Number(seasonStat.appearances ?? 0),
        goals: Number(seasonStat.goals ?? 0),
        assists: Number(seasonStat.assists ?? 0),
        goalAssists: Number(seasonStat.goals ?? 0) + Number(seasonStat.assists ?? 0),
        successfulDribblesPer90: per90(Number(seasonStat.successful_dribbles ?? 0), minutes),
        shotsOnTargetPer90: per90(Number(seasonStat.shots_on_target ?? 0), minutes),
        accuratePassesPer90: per90(Number(seasonStat.accurate_passes ?? 0), minutes),
        bigChancesCreated: Number(seasonStat.big_chances_created ?? sum("big_chances_created") ?? 0),
        bigChancesMissed: sum("big_chances_missed"),
        tacklesPer90: per90(Number(seasonStat.tackles ?? 0), minutes),
        interceptionsPer90: per90(Number(seasonStat.interceptions ?? 0), minutes),
        blocksPer90: per90(sum("blocks"), minutes),
        clearancesPer90: per90(sum("clearances"), minutes),
        cleanSheets,
        savesPer90: per90(sum("saves"), minutes),
        goalsConcededPer90: per90(sum("goals_conceded"), minutes),
        yellowCards: Number(seasonStat.yellow_cards ?? 0),
        redCards: Number(seasonStat.red_cards ?? 0),
        foulsCommittedPer90: per90(sum("fouls_committed"), minutes),
        rating: Number(seasonStat.average_rating ?? 0)
      };
    });

    const standingsByTeam = new Map((standingsResult.data ?? []).map((standing) => [standing.team_registration_id, standing]));
    const fixtures = fixturesResult.data ?? [];
    const teamMatchStats = teamMatchStatsResult.data ?? [];
    const teamRows = teamRegistrations
      .filter((team) => team.status === RegistrationStatus.APPROVED)
      .map((team) => {
        const teamStats = teamMatchStats.filter((row) => row.team_registration_id === team.id);
        const standing = standingsByTeam.get(team.id);
        const played = Math.max(Number(standing?.played ?? 0), teamStats.length);
        const teamPlayers = playerRegistrations.filter((player) => player.team_registration_id === team.id).map((player) => player.id);
        const teamPlayerMatchRows = playerMatchStats.filter((row) => teamPlayers.includes(row.player_registration_id));
        const sumTeam = (field: string) => teamStats.reduce((total, row) => total + Number(row[field] ?? 0), 0);
        const sumPlayers = (field: string) => teamPlayerMatchRows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
        const cleanSheets = fixtures.filter((fixture) => {
          if (fixture.status !== FixtureStatus.FINAL) return false;
          if (fixture.home_team_registration_id === team.id) return Number(fixture.away_score ?? 0) === 0;
          if (fixture.away_team_registration_id === team.id) return Number(fixture.home_score ?? 0) === 0;
          return false;
        }).length;
        const teamMatchRatings = teamStats.map((teamStat) => {
          const storedRating = Number(teamStat.rating ?? 0);
          if (storedRating > 0) return storedRating;
          const matchPlayerRatings = teamPlayerMatchRows
            .filter((row) => row.fixture_id === teamStat.fixture_id)
            .map((row) => Number(row.rating ?? 0))
            .filter((rating) => rating > 0);
          return avg(matchPlayerRatings);
        }).filter((rating) => rating > 0);
        return {
          id: team.id,
          name: relatedName(team.teams, "name") ?? "Unnamed team",
          logoUrl: relatedName(team.teams, "logo_url"),
          played,
          avgPossession: avg(teamStats.map((row) => Number(row.possession ?? 0))),
          rating: teamMatchRatings.length ? avg(teamMatchRatings) : 0,
          goalsPerMatch: perMatch(Number(standing?.goals_for ?? 0), played),
          shotsOnTargetPerMatch: perMatch(sumTeam("shots_on_target"), played),
          bigChancesPerMatch: perMatch(sumTeam("big_chances"), played),
          bigChancesMissedPerMatch: perMatch(sumTeam("big_chances_missed"), played),
          accuratePassesPerMatch: perMatch(sumTeam("accurate_passes"), played),
          cornersPerMatch: perMatch(sumTeam("corners"), played),
          cleanSheets,
          goalsConcededPerMatch: perMatch(Number(standing?.goals_against ?? 0), played),
          tacklesPerMatch: perMatch(sumPlayers("tackles"), played),
          clearancesPerMatch: perMatch(sumPlayers("clearances"), played),
          penaltiesConceded: 0,
          gkSavesPerMatch: perMatch(sumPlayers("saves"), played),
          foulsPerMatch: perMatch(sumTeam("fouls"), played),
          yellowCards: sumTeam("yellow_cards"),
          redCards: sumTeam("red_cards")
        };
      });

    res.json({
      player_sections: [
        {
          title: "General",
          cards: [
            makeLeaderboard("minutes_played", "Minutes Played", playerRows, "minutes", "number"),
            makeLeaderboard("rating", "Rating", playerRows, "rating", "decimal")
          ]
        },
        {
          title: "Attack",
          cards: [
            makeLeaderboard("top_scorer", "Top Scorer", playerRows, "goals", "number"),
            makeLeaderboard("assists", "Assists", playerRows, "assists", "number"),
            makeLeaderboard("goal_assists", "Goal + Assists", playerRows, "goalAssists", "number"),
            makeLeaderboard("successful_dribbles_per_90", "Successful Dribbles per 90", playerRows, "successfulDribblesPer90", "decimal"),
            makeLeaderboard("shots_on_target_per_90", "Shots on Target per 90", playerRows, "shotsOnTargetPer90", "decimal"),
            makeLeaderboard("accurate_passes_per_90", "Accurate Passes per 90", playerRows, "accuratePassesPer90", "decimal"),
            makeLeaderboard("big_chances_created", "Big Chances Created", playerRows, "bigChancesCreated", "number"),
            makeLeaderboard("big_chances_missed", "Big Chances Missed", playerRows, "bigChancesMissed", "number")
          ]
        },
        {
          title: "Defense",
          cards: [
            makeLeaderboard("tackles_per_90", "Tackles per 90", playerRows, "tacklesPer90", "decimal"),
            makeLeaderboard("interceptions_per_90", "Interceptions per 90", playerRows, "interceptionsPer90", "decimal"),
            makeLeaderboard("blocks_per_90", "Blocks per 90", playerRows, "blocksPer90", "decimal"),
            makeLeaderboard("clearances_per_90", "Clearances per 90", playerRows, "clearancesPer90", "decimal")
          ]
        },
        {
          title: "Goalkeeping",
          cards: [
            makeLeaderboard("clean_sheets", "Clean Sheets", playerRows, "cleanSheets", "number"),
            makeLeaderboard("saves_per_90", "Saves per 90", playerRows, "savesPer90", "decimal"),
            makeLeaderboard("goals_conceded_per_90", "Goals Conceded per 90", playerRows, "goalsConcededPer90", "decimal", "asc")
          ]
        },
        {
          title: "Discipline",
          cards: [
            makeLeaderboard("yellow_cards", "Yellow Cards", playerRows, "yellowCards", "number"),
            makeLeaderboard("red_cards", "Red Cards", playerRows, "redCards", "number"),
            makeLeaderboard("fouls_committed_per_90", "Fouls Committed per 90", playerRows, "foulsCommittedPer90", "decimal")
          ]
        }
      ],
      team_sections: [
        {
          title: "General",
          cards: [
            makeTeamLeaderboard("avg_possession", "Avg Possession", teamRows, "avgPossession", "percent"),
            makeTeamLeaderboard("rating", "Rating", teamRows, "rating", "decimal")
          ]
        },
        {
          title: "Attack",
          cards: [
            makeTeamLeaderboard("goals_per_match", "Goals per Match", teamRows, "goalsPerMatch", "decimal"),
            makeTeamLeaderboard("shots_on_target_per_match", "Shots on Target per Match", teamRows, "shotsOnTargetPerMatch", "decimal"),
            makeTeamLeaderboard("big_chances", "Big Chances", teamRows, "bigChancesPerMatch", "decimal"),
            makeTeamLeaderboard("big_chances_missed", "Big Chances Missed", teamRows, "bigChancesMissedPerMatch", "decimal"),
            makeTeamLeaderboard("accurate_passes_per_match", "Accurate Passes per Match", teamRows, "accuratePassesPerMatch", "decimal"),
            makeTeamLeaderboard("corners", "Corners", teamRows, "cornersPerMatch", "decimal")
          ]
        },
        {
          title: "Defense",
          cards: [
            makeTeamLeaderboard("clean_sheets", "Clean Sheets", teamRows, "cleanSheets", "number"),
            makeTeamLeaderboard("goals_conceded_per_match", "Goals Conceded per Match", teamRows, "goalsConcededPerMatch", "decimal", "asc"),
            makeTeamLeaderboard("tackles_per_match", "Tackles per Match", teamRows, "tacklesPerMatch", "decimal"),
            makeTeamLeaderboard("clearances_per_match", "Clearances per Match", teamRows, "clearancesPerMatch", "decimal"),
            makeTeamLeaderboard("penalties_conceded", "Penalties Conceded", teamRows, "penaltiesConceded", "number", "asc"),
            makeTeamLeaderboard("gk_saves_per_match", "GK Saves per Match", teamRows, "gkSavesPerMatch", "decimal")
          ]
        },
        {
          title: "Discipline",
          cards: [
            makeTeamLeaderboard("fouls_per_match", "Fouls per Match", teamRows, "foulsPerMatch", "decimal", "asc"),
            makeTeamLeaderboard("yellow_cards", "Yellow Cards", teamRows, "yellowCards", "number", "asc"),
            makeTeamLeaderboard("red_cards", "Red Cards", teamRows, "redCards", "number", "asc")
          ]
        }
      ]
    });
  })
);

adminRouter.patch(
  "/player-registrations/:id/decision",
  asyncHandler(async (req, res) => {
    const input = registrationDecisionSchema.parse(req.body);
    const { data: currentRegistration, error: currentError } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,team_registrations(status)")
      .eq("id", req.params.id)
      .single();
    if (currentError) throw currentError;
    const teamRegistration = Array.isArray(currentRegistration.team_registrations)
      ? currentRegistration.team_registrations[0]
      : currentRegistration.team_registrations;
    if (input.status === "APPROVED" && teamRegistration?.status !== RegistrationStatus.APPROVED) {
      throw new AppError(400, "Approve the team before approving its players.");
    }
    if (input.status === "APPROVED") {
      const { data: ability, error: abilityError } = await supabaseAdmin
        .from("player_abilities")
        .select("id")
        .eq("player_registration_id", req.params.id)
        .maybeSingle();
      if (abilityError) throw abilityError;
      if (!ability) throw new AppError(400, "Rate this player Low, Moderate, or High before approving.");
    }
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        status: input.status,
        reviewed_by: req.auth!.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: input.status === "REJECTED" ? input.reason ?? null : null
      })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    if (input.status === "APPROVED") {
      await supabaseAdmin
        .from("player_season_stats")
        .upsert(
          {
            season_id: data.season_id,
            player_registration_id: data.id,
            appearances: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            average_rating: null
          },
          { onConflict: "season_id,player_registration_id" }
        );
    }
    res.json({ player_registration: data });
  })
);

adminRouter.post(
  "/teams/:teamId/pending-players/rate-randomly",
  asyncHandler(async (req, res) => {
    const teamRegistrationId = routeParam(req.params.teamId, "Team registration id");
    const seasonId = requiredBodyText(req.body?.seasonId, "Season id");
    const rerate = Boolean(req.body?.rerate);
    const teamRegistration = await getApprovedTeamRegistration(teamRegistrationId, seasonId);
    let query = supabaseAdmin
      .from("player_season_registrations")
      .select("id,player_id,season_id,team_registration_id,position,football_position,status,player_status,ability_rating")
      .eq("team_registration_id", teamRegistrationId)
      .eq("season_id", seasonId)
      .eq("status", RegistrationStatus.PENDING)
      .neq("player_status", PlayerLifecycleStatus.REMOVED)
      .neq("player_status", PlayerLifecycleStatus.SUSPENDED);
    if (!rerate) query = query.is("ability_rating", null);
    const { data: players, error } = await query;
    if (error) throw error;
    const pendingPlayers = players ?? [];
    if (pendingPlayers.length === 0) return res.json({ player_registrations: [] });

    const assignments = assignBellCurveRatings(pendingPlayers, `${teamRegistrationId}:${seasonId}:${Date.now()}`);
    const abilityRows = assignments.map(({ player, tier }) => buildAbilityUpsertRow(player, tier, req.auth!.userId));
    const { error: abilityError } = await supabaseAdmin
      .from("player_abilities")
      .upsert(abilityRows, { onConflict: "player_registration_id" });
    if (abilityError) throw abilityError;

    for (const tier of [PlayerAbilityRating.LOW, PlayerAbilityRating.MODERATE, PlayerAbilityRating.HIGH] as const) {
      const ids = assignments.filter((assignment) => assignment.tier === tier).map((assignment) => assignment.player.id);
      if (ids.length === 0) continue;
      const { error: updateError } = await supabaseAdmin
        .from("player_season_registrations")
        .update({ ability_rating: tier, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (updateError) throw updateError;
    }

    await supabaseAdmin.from("manager_messages").insert({
      season_id: seasonId,
      manager_id: teamRegistration.manager_id,
      team_registration_id: teamRegistrationId,
      related_type: "GENERAL_NOTICE",
      message: `${assignments.length} pending players were ${rerate ? "re-rated" : "rated"} automatically by admin.`,
      created_by: req.auth!.userId
    });

    const { data: updated, error: updatedError } = await supabaseAdmin
      .from("player_season_registrations")
      .select("*,players(full_name,date_of_birth,nationality,id_type,id_number_last4),team_registrations(status,teams(name)),player_abilities(*)")
      .in("id", assignments.map((assignment) => assignment.player.id));
    if (updatedError) throw updatedError;
    res.json({ player_registrations: updated ?? [] });
  })
);

adminRouter.post(
  "/teams/:teamId/pending-players/approve-all-rated",
  asyncHandler(async (req, res) => {
    const teamRegistrationId = routeParam(req.params.teamId, "Team registration id");
    const seasonId = requiredBodyText(req.body?.seasonId, "Season id");
    const teamRegistration = await getApprovedTeamRegistration(teamRegistrationId, seasonId);
    const { data: pendingPlayers, error } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,season_id,ability_rating,status,player_status")
      .eq("team_registration_id", teamRegistrationId)
      .eq("season_id", seasonId)
      .eq("status", RegistrationStatus.PENDING)
      .neq("player_status", PlayerLifecycleStatus.REMOVED)
      .neq("player_status", PlayerLifecycleStatus.SUSPENDED);
    if (error) throw error;
    const rows = pendingPlayers ?? [];
    const unrated = rows.filter((player) => !player.ability_rating);
    if (unrated.length > 0) throw new AppError(400, "Some pending players are not rated yet.");
    if (rows.length === 0) return res.json({ player_registrations: [] });

    const ids = rows.map((player) => player.id);
    const { data: abilityRows, error: abilityError } = await supabaseAdmin
      .from("player_abilities")
      .select("player_registration_id")
      .in("player_registration_id", ids);
    if (abilityError) throw abilityError;
    const abilityIds = new Set((abilityRows ?? []).map((row) => row.player_registration_id));
    if (ids.some((id) => !abilityIds.has(id))) throw new AppError(400, "Some pending players are not rated yet.");

    const { data: approved, error: updateError } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        status: RegistrationStatus.APPROVED,
        player_status: PlayerLifecycleStatus.ACTIVE,
        reviewed_by: req.auth!.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in("id", ids)
      .select("*");
    if (updateError) throw updateError;

    const statsRows = (approved ?? []).map((player) => ({
      season_id: player.season_id,
      player_registration_id: player.id,
      appearances: 0,
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      average_rating: null
    }));
    if (statsRows.length > 0) {
      const { error: statsError } = await supabaseAdmin
        .from("player_season_stats")
        .upsert(statsRows, { onConflict: "season_id,player_registration_id" });
      if (statsError) throw statsError;
    }

    await supabaseAdmin.from("manager_messages").insert({
      season_id: seasonId,
      manager_id: teamRegistration.manager_id,
      team_registration_id: teamRegistrationId,
      related_type: "GENERAL_NOTICE",
      message: `${approved?.length ?? 0} rated pending players were approved. They are now available for lineup selection.`,
      created_by: req.auth!.userId
    });

    res.json({ player_registrations: approved ?? [] });
  })
);

adminRouter.patch(
  "/player-registrations/:id/reject",
  asyncHandler(async (req, res) => {
    const registrationId = routeParam(req.params.id, "Player registration id");
    const reason = requiredBodyText(req.body?.reason, "Rejection reason");
    const allowResubmission = Boolean(req.body?.allow_resubmission);
    const registration = await getPlayerRegistrationForAction(registrationId);
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        status: RegistrationStatus.REJECTED,
        player_status: PlayerLifecycleStatus.REJECTED,
        rejection_reason: reason,
        allow_resubmission: allowResubmission,
        reviewed_by: req.auth!.userId,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", registrationId)
      .select("*")
      .single();
    if (error) throw error;
    await notifyManager(registration, "PLAYER_REJECTION", reason, req.auth!.userId);
    res.json({ player_registration: data });
  })
);

adminRouter.patch(
  "/player-registrations/:id/remove",
  asyncHandler(async (req, res) => {
    const registrationId = routeParam(req.params.id, "Player registration id");
    const reason = requiredBodyText(req.body?.reason, "Removal reason");
    const registration = await getPlayerRegistrationForAction(registrationId);
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        player_status: PlayerLifecycleStatus.REMOVED,
        removed_by: req.auth!.userId,
        removed_at: new Date().toISOString(),
        removal_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq("id", registrationId)
      .select("*")
      .single();
    if (error) throw error;
    await markLineupsForResubmission(registrationId, reason, req.auth!.userId);
    await notifyManager(registration, "PLAYER_REMOVAL", reason, req.auth!.userId);
    res.json({ player_registration: data });
  })
);

adminRouter.patch(
  "/player-registrations/:id/suspend",
  asyncHandler(async (req, res) => {
    const registrationId = routeParam(req.params.id, "Player registration id");
    const reason = requiredBodyText(req.body?.reason, "Suspension reason");
    const suspensionType = requiredBodyText(req.body?.suspension_type, "Suspension type");
    const suspensionUntil = req.body?.suspension_until ? String(req.body.suspension_until) : null;
    const suspensionMatchesRemaining = req.body?.suspension_matches_remaining === undefined || req.body.suspension_matches_remaining === null || req.body.suspension_matches_remaining === ""
      ? null
      : Number(req.body.suspension_matches_remaining);
    if (!["UNTIL_ADMIN_UNSUSPENDS", "UNTIL_DATE", "NEXT_MATCHES"].includes(suspensionType)) {
      throw new AppError(400, "Invalid suspension type.");
    }
    if (suspensionType === "UNTIL_DATE" && !suspensionUntil) throw new AppError(400, "Suspension date is required.");
    if (suspensionType === "NEXT_MATCHES" && (!Number.isInteger(suspensionMatchesRemaining) || Number(suspensionMatchesRemaining) < 1)) {
      throw new AppError(400, "Next match count must be a positive number.");
    }
    const registration = await getPlayerRegistrationForAction(registrationId);
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        player_status: PlayerLifecycleStatus.SUSPENDED,
        suspended_by: req.auth!.userId,
        suspended_at: new Date().toISOString(),
        suspension_reason: reason,
        suspension_type: suspensionType,
        suspension_until: suspensionUntil,
        suspension_matches_remaining: suspensionType === "NEXT_MATCHES" ? suspensionMatchesRemaining : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", registrationId)
      .select("*")
      .single();
    if (error) throw error;
    await markLineupsForResubmission(registrationId, reason, req.auth!.userId);
    await notifyManager(registration, "GENERAL_NOTICE", `Player suspended: ${reason}`, req.auth!.userId);
    res.json({ player_registration: data });
  })
);

adminRouter.patch(
  "/player-registrations/:id/unsuspend",
  asyncHandler(async (req, res) => {
    const registrationId = routeParam(req.params.id, "Player registration id");
    const message = typeof req.body?.message === "string" && req.body.message.trim() ? req.body.message.trim().slice(0, 500) : "Player suspension has been lifted.";
    const registration = await getPlayerRegistrationForAction(registrationId);
    const { data, error } = await supabaseAdmin
      .from("player_season_registrations")
      .update({
        player_status: PlayerLifecycleStatus.ACTIVE,
        suspension_reason: null,
        suspension_type: null,
        suspension_until: null,
        suspension_matches_remaining: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", registrationId)
      .select("*")
      .single();
    if (error) throw error;
    await notifyManager(registration, "GENERAL_NOTICE", message, req.auth!.userId);
    res.json({ player_registration: data });
  })
);

adminRouter.patch(
  "/player-registrations/:id/ability",
  asyncHandler(async (req, res) => {
    const input = playerAbilityDecisionSchema.parse(req.body);
    const { data: registration, error } = await supabaseAdmin
      .from("player_season_registrations")
      .select("id,player_id,season_id,team_registration_id,position,football_position,team_registrations(status)")
      .eq("id", req.params.id)
      .single();
    if (error) throw error;
    const teamRegistration = Array.isArray(registration.team_registrations)
      ? registration.team_registrations[0]
      : registration.team_registrations;
    if (teamRegistration?.status !== RegistrationStatus.APPROVED) {
      throw new AppError(400, "Approve the team before rating player abilities.");
    }
    const footballPosition = input.football_position ?? registration.football_position ?? coarseToFootballPosition(registration.position);
    const generated = generateAbilityScores(input.ability_rating, footballPosition, `${registration.id}:${input.ability_rating}:${footballPosition}`);
    const row =
      generated.position === FootballPosition.GK
        ? {
            player_registration_id: registration.id,
            player_id: registration.player_id,
            season_id: registration.season_id,
            team_registration_id: registration.team_registration_id,
            position: generated.position,
            rating_tier: generated.rating_tier,
            shooting: null,
            passing: null,
            dribbling: null,
            defending: null,
            pace: null,
            stamina: null,
            physical: generated.physical,
            shot_stopping: generated.shot_stopping,
            reflexes: generated.reflexes,
            positioning: generated.positioning,
            handling: generated.handling,
            diving: generated.diving,
            distribution: generated.distribution,
            communication: generated.communication,
            overall_rating: generated.overall_rating,
            generated_by_admin_id: req.auth!.userId,
            generated_at: new Date().toISOString(),
            is_hidden_from_manager: true
          }
        : {
            player_registration_id: registration.id,
            player_id: registration.player_id,
            season_id: registration.season_id,
            team_registration_id: registration.team_registration_id,
            position: generated.position,
            rating_tier: generated.rating_tier,
            shooting: generated.shooting,
            passing: generated.passing,
            dribbling: generated.dribbling,
            defending: generated.defending,
            physical: generated.physical,
            pace: generated.pace,
            stamina: generated.stamina,
            shot_stopping: null,
            reflexes: null,
            positioning: null,
            handling: null,
            diving: null,
            distribution: null,
            communication: null,
            overall_rating: generated.overall_rating,
            generated_by_admin_id: req.auth!.userId,
            generated_at: new Date().toISOString(),
            is_hidden_from_manager: true
          };
    const { data: ability, error: abilityError } = await supabaseAdmin
      .from("player_abilities")
      .upsert(row, { onConflict: "player_registration_id" })
      .select("*")
      .single();
    if (abilityError) throw abilityError;
    const { data: updatedRegistration, error: updateError } = await supabaseAdmin
      .from("player_season_registrations")
      .update({ ability_rating: input.ability_rating })
      .eq("id", registration.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    res.json({ player_registration: updatedRegistration, ability });
  })
);

adminRouter.patch(
  "/player-registrations/:id/ability-scores",
  asyncHandler(async (req, res) => {
    const allowedKeys = [
      "shooting",
      "passing",
      "dribbling",
      "defending",
      "physical",
      "pace",
      "stamina",
      "shot_stopping",
      "reflexes",
      "positioning",
      "handling",
      "diving",
      "distribution",
      "communication"
    ] as const;
    const updates: Record<string, number> = {};
    for (const key of allowedKeys) {
      const value = req.body?.[key];
      if (value === undefined || value === null || value === "") continue;
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 1 || numeric > 92) {
        throw new AppError(400, `${key} must be between 1 and 92.`);
      }
      updates[key] = Math.round(numeric);
    }
    if (Object.keys(updates).length === 0) throw new AppError(400, "No ability scores provided.");
    const { data: currentAbility, error: currentError } = await supabaseAdmin
      .from("player_abilities")
      .select("*")
      .eq("player_registration_id", req.params.id)
      .single();
    if (currentError) throw currentError;
    const merged = { ...currentAbility, ...updates };
    const outfieldValues = ["shooting", "passing", "dribbling", "defending", "physical", "pace", "stamina"]
      .map((key) => merged[key])
      .filter((value) => typeof value === "number");
    const gkValues = ["shot_stopping", "reflexes", "positioning", "handling", "diving", "distribution", "physical", "communication"]
      .map((key) => merged[key])
      .filter((value) => typeof value === "number");
    const values = merged.position === FootballPosition.GK ? gkValues : outfieldValues;
    const overall_rating = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : merged.overall_rating;
    const { data, error } = await supabaseAdmin
      .from("player_abilities")
      .update({ ...updates, overall_rating, generated_by_admin_id: req.auth!.userId, generated_at: new Date().toISOString() })
      .eq("player_registration_id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ ability: data });
  })
);

adminRouter.patch(
  "/team-registrations/:id/kick-out",
  asyncHandler(async (req, res) => {
    const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim().slice(0, 500) : "Team removed by admin.";
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .update({
        removed_by: req.auth!.userId,
        removed_at: new Date().toISOString(),
        removal_reason: reason
      })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    await supabaseAdmin.from("manager_messages").insert({
      season_id: data.season_id,
      manager_id: data.manager_id,
      team_registration_id: data.id,
      related_type: "TEAM_REMOVAL",
      message: reason,
      created_by: req.auth!.userId
    });
    res.json({ team_registration: data });
  })
);

adminRouter.post(
  "/team-registrations/:id/message",
  asyncHandler(async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) throw new AppError(400, "Message is required.");
    const { data: teamRegistration, error: teamError } = await supabaseAdmin
      .from("team_registrations")
      .select("id,season_id,manager_id")
      .eq("id", req.params.id)
      .single();
    if (teamError) throw teamError;
    const { data, error } = await supabaseAdmin
      .from("manager_messages")
      .insert({
        season_id: teamRegistration.season_id,
        manager_id: teamRegistration.manager_id,
        team_registration_id: teamRegistration.id,
        related_type: "GENERAL_NOTICE",
        message,
        created_by: req.auth!.userId
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ message: data });
  })
);

adminRouter.get(
  "/hidden-attributes",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("player_hidden_attributes")
      .select("*,player_season_registrations(players(full_name),team_registrations(teams(name)))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ hidden_attributes: data });
  })
);

adminRouter.get(
  "/seasons/:seasonId/groups",
  asyncHandler(async (req, res) => {
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    const [teams, groups] = await Promise.all([loadApprovedFixtureTeams(season.id), loadSeasonGroups(season.id)]);
    res.json({
      season,
      approved_teams: teams,
      groups,
      groups_ready: groups.length === Number(season.group_count ?? 0) && groups.every((group) => group.teams.length === Number(season.teams_per_group ?? 0))
    });
  })
);

adminRouter.post(
  "/seasons/:seasonId/groups/randomize",
  asyncHandler(async (req, res) => {
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    if (season.format !== SeasonFormat.GROUP_STAGE_KNOCKOUT) throw new AppError(400, "Groups are only available for group + knockout seasons.");
    const groupCount = Number(season.group_count ?? 0);
    const teamsPerGroup = Number(season.teams_per_group ?? 0);
    if (!groupCount || !teamsPerGroup) throw new AppError(400, "Group settings are missing.");
    const teams = await loadApprovedFixtureTeams(season.id);
    if (teams.length !== groupCount * teamsPerGroup) {
      throw new AppError(400, `Approved teams must be exactly ${groupCount * teamsPerGroup} before group division.`);
    }
    const groups = await recreateGroups(season.id, groupCount);
    const shuffled = shuffleRows(teams, `${season.id}:groups`);
    const inserts = shuffled.map((team, index) => ({
      group_id: groups[Math.floor(index / teamsPerGroup)]!.id,
      team_registration_id: team.id,
      seed_no: (index % teamsPerGroup) + 1
    }));
    const { error } = await supabaseAdmin.from("season_group_teams").insert(inserts);
    if (error) throw error;
    res.status(201).json({ groups: await loadSeasonGroups(season.id) });
  })
);

adminRouter.patch(
  "/seasons/:seasonId/groups/assign",
  asyncHandler(async (req, res) => {
    const input = groupAssignmentSchema.parse(req.body);
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    if (season.format !== SeasonFormat.GROUP_STAGE_KNOCKOUT) throw new AppError(400, "Groups are only available for group + knockout seasons.");
    const teamsPerGroup = Number(season.teams_per_group ?? 0);
    const flatTeamIds = input.groups.flatMap((group) => group.team_registration_ids);
    if (new Set(flatTeamIds).size !== flatTeamIds.length) throw new AppError(400, "A team cannot appear in more than one group.");
    if (input.groups.some((group) => group.team_registration_ids.length !== teamsPerGroup)) {
      throw new AppError(400, `Each group must have exactly ${teamsPerGroup} teams.`);
    }
    const approved = new Set((await loadApprovedFixtureTeams(season.id)).map((team) => team.id));
    if (flatTeamIds.some((teamId) => !approved.has(teamId))) throw new AppError(400, "Only approved teams can be assigned to groups.");
    let existingGroups = await loadSeasonGroups(season.id);
    if (existingGroups.length === 0) {
      await recreateGroups(season.id, Number(season.group_count ?? 0));
      existingGroups = await loadSeasonGroups(season.id);
    }
    const validGroups = new Set(existingGroups.map((group) => group.id));
    if (input.groups.some((group) => !validGroups.has(group.group_id))) throw new AppError(400, "Invalid group selected.");

    const { error: deleteError } = await supabaseAdmin
      .from("season_group_teams")
      .delete()
      .in("group_id", existingGroups.map((group) => group.id));
    if (deleteError) throw deleteError;
    const inserts = input.groups.flatMap((group) =>
      group.team_registration_ids.map((teamId, index) => ({ group_id: group.group_id, team_registration_id: teamId, seed_no: index + 1 }))
    );
    const { error } = await supabaseAdmin.from("season_group_teams").insert(inserts);
    if (error) throw error;
    res.json({ groups: await loadSeasonGroups(season.id) });
  })
);

adminRouter.get(
  "/seasons/:seasonId/fixtures",
  asyncHandler(async (req, res) => {
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    const [teams, groups, fixtures] = await Promise.all([
      loadApprovedFixtureTeams(season.id),
      loadSeasonGroups(season.id),
      loadSeasonFixtures(season.id)
    ]);
    res.json({
      season,
      approved_teams: teams,
      groups,
      fixtures,
      can_regenerate: season.fixture_status !== "FINALIZED" && canRegenerateFixtures(fixtures),
      fixture_status: season.fixture_status === "FINALIZED" ? "FINALIZED" : fixtureStatus(fixtures)
    });
  })
);

adminRouter.post(
  "/seasons/:seasonId/fixtures/preview",
  asyncHandler(async (req, res) => {
    const input = fixturePreviewSchema.parse(req.body ?? {});
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    const preview = await buildFixturePreview(season, input.stage);
    res.json(preview);
  })
);

adminRouter.post(
  "/seasons/:seasonId/fixtures/confirm",
  asyncHandler(async (req, res) => {
    const input = fixturePreviewSchema.parse(req.body ?? {});
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    const existing = await loadSeasonFixtures(season.id);
    if (!canRegenerateFixtures(existing)) throw new AppError(400, "Fixtures cannot be regenerated because matches have already started or completed.");
    const preview = await buildFixturePreview(season, input.stage);
    await replaceFixtures(season, preview.fixtures, input.stage);
    const fixtures = await loadSeasonFixtures(season.id);
    res.status(201).json({ fixtures, warnings: preview.warnings });
  })
);

adminRouter.delete(
  "/seasons/:seasonId/fixtures/regenerate",
  asyncHandler(async (req, res) => {
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    if (season.fixture_status === "FINALIZED") throw new AppError(400, "Fixtures are finalized and cannot be regenerated.");
    const existing = await loadSeasonFixtures(season.id);
    if (!canRegenerateFixtures(existing)) throw new AppError(400, "Fixtures cannot be regenerated because matches have already started or completed.");
    const { error } = await supabaseAdmin.from("fixtures").delete().eq("season_id", season.id);
    if (error) throw error;
    await supabaseAdmin.from("seasons").update({ fixture_status: "NOT_GENERATED", updated_at: new Date().toISOString() }).eq("id", season.id);
    res.status(204).send();
  })
);

adminRouter.post(
  "/seasons/:seasonId/fixtures/finalize",
  asyncHandler(async (req, res) => {
    const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
    const fixtures = await loadSeasonFixtures(season.id);
    if (fixtures.length === 0) throw new AppError(400, "Generate fixtures before finalizing.");
    await supabaseAdmin.from("seasons").update({ fixture_status: "FINALIZED", updated_at: new Date().toISOString() }).eq("id", season.id);
    res.json({ fixture_status: "FINALIZED" });
  })
);

adminRouter.post(
  "/seasons/:seasonId/matches/jump-to-matchday",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({ status: FixtureStatus.READY_TO_SIMULATE, updated_at: new Date().toISOString() })
      .eq("season_id", seasonId)
      .eq("status", FixtureStatus.LINEUPS_CONFIRMED)
      .select("id");
    if (error) throw error;
    res.json({ updated_count: data?.length ?? 0 });
  })
);

adminRouter.post("/seasons/:seasonId/fixtures/group/preview", asyncHandler(async (req, res) => {
  const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
  res.json(await buildFixturePreview(season, "group"));
}));

adminRouter.post("/seasons/:seasonId/fixtures/group/confirm", asyncHandler(async (req, res) => {
  const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
  const existing = await loadSeasonFixtures(season.id);
  if (!canRegenerateFixtures(existing.filter((fixture) => fixture.stage === "GROUP"))) throw new AppError(400, "Group fixtures cannot be regenerated because matches have already started or completed.");
  const preview = await buildFixturePreview(season, "group");
  await replaceFixtures(season, preview.fixtures, "group");
  res.status(201).json({ fixtures: await loadSeasonFixtures(season.id), warnings: preview.warnings });
}));

adminRouter.post("/seasons/:seasonId/fixtures/knockout/preview", asyncHandler(async (req, res) => {
  const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
  res.json(await buildFixturePreview(season, "knockout"));
}));

adminRouter.post("/seasons/:seasonId/fixtures/knockout/confirm", asyncHandler(async (req, res) => {
  const season = await loadFixtureSeason(routeParam(req.params.seasonId, "seasonId"));
  const existing = await loadSeasonFixtures(season.id);
  if (!canRegenerateFixtures(existing.filter((fixture) => fixture.stage !== "GROUP"))) throw new AppError(400, "Knockout fixtures cannot be regenerated because matches have already started or completed.");
  const preview = await buildFixturePreview(season, "knockout");
  await replaceFixtures(season, preview.fixtures, "knockout");
  res.status(201).json({ fixtures: await loadSeasonFixtures(season.id), warnings: preview.warnings });
}));

adminRouter.patch(
  "/fixtures/:id/schedule",
  asyncHandler(async (req, res) => {
    const input = updateSeasonScheduleSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({ kickoff_at: input.kickoff_at ?? null, venue: input.venue ?? null })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ fixture: data });
  })
);

adminRouter.patch(
  "/fixtures/:id/status",
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (status !== FixtureStatus.SCHEDULED && status !== FixtureStatus.CANCELLED) {
      throw new AppError(400, "Invalid fixture status.");
    }
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({ status })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ fixture: data });
  })
);

adminRouter.post(
  "/fixtures/generate",
  asyncHandler(async (req, res) => {
    const input = generateFixturesSchema.parse(req.body);
    const { data: season, error: seasonError } = await supabaseAdmin.from("seasons").select("*").eq("id", input.season_id).single();
    if (seasonError) throw seasonError;
    const { data: teams, error: teamError } = await supabaseAdmin
      .from("team_registrations")
      .select("id")
      .eq("season_id", input.season_id)
      .eq("status", "APPROVED")
      .order("created_at");
    if (teamError) throw teamError;
    const teamIds = (teams ?? []).map((team) => team.id);
    const pairings = generateSeasonPairings(season.format, teamIds, season.group_count, season.qualifiers_per_group);
    await supabaseAdmin.from("fixtures").delete().eq("season_id", input.season_id).neq("status", "FINAL");
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .insert(
        pairings.map((pairing) => ({
          season_id: input.season_id,
          round_no: pairing.round_no,
          stage: pairing.stage,
          group_name: pairing.group_name ?? null,
          home_team_registration_id: pairing.home_team_registration_id,
          away_team_registration_id: pairing.away_team_registration_id,
          status: FixtureStatus.SCHEDULED
        }))
      )
      .select("*")
      .order("round_no");
    if (error) throw error;
    res.status(201).json({ fixtures: data });
  })
);

adminRouter.patch(
  "/lineups/:id/decision",
  asyncHandler(async (req, res) => {
    const input = registrationDecisionSchema.parse(req.body);
    const lineupStatus = input.status === "APPROVED" ? "CONFIRMED" : "REJECTED";
    const { data, error } = await supabaseAdmin
      .from("lineups")
      .update({
        status: lineupStatus,
        reviewed_by: req.auth!.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: input.status === "REJECTED" ? input.reason ?? null : null
      })
      .eq("id", req.params.id)
      .select("*")
      .single();
    if (error) throw error;
    await updateFixtureLineupStatus(data.fixture_id);
    res.json({ lineup: data });
  })
);

adminRouter.post(
  "/matches/simulate",
  asyncHandler(async (req, res) => {
    const input = simulateMatchSchema.parse(req.body);
    const fixture = await getFixture(input.fixture_id);
    if (fixture.status !== FixtureStatus.LINEUPS_CONFIRMED && fixture.status !== FixtureStatus.READY_TO_SIMULATE && fixture.status !== FixtureStatus.SCHEDULED) {
      throw new AppError(400, "Match cannot be simulated in its current status");
    }
    const homePlayers = await getConfirmedLineupPlayers(input.fixture_id, fixture.home_team_registration_id, VenueSide.HOME);
    const awayPlayers = await getConfirmedLineupPlayers(input.fixture_id, fixture.away_team_registration_id, VenueSide.AWAY);
    const result = simulateMatch(homePlayers, awayPlayers, fixture.id);
    await persistSimulation(fixture.id, result);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({
        status: FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION,
        home_score: result.home_score,
        away_score: result.away_score,
        simulation_seed: result.simulation_seed,
        simulated_at: new Date().toISOString(),
        extra_time_played: result.extra_time_played ?? false,
        penalties_home: result.penalties_home ?? null,
        penalties_away: result.penalties_away ?? null
      })
      .eq("id", fixture.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ fixture: data, simulation: result });
  })
);

adminRouter.get(
  "/matches/:fixtureId/detail",
  asyncHandler(async (req, res) => {
    const fixtureId = routeParam(req.params.fixtureId, "Fixture id");
    const fixture = await getFixture(fixtureId);
    const [
      lineupsResult,
      teamStatsResult,
      playerStatsResult,
      eventsResult,
      substitutionsResult
    ] = await Promise.all([
      supabaseAdmin
        .from("lineups")
        .select("*,lineup_players(*,player_season_registrations(id,shirt_number,football_position,position,players(full_name,avatar_url)))")
        .eq("fixture_id", fixture.id),
      supabaseAdmin.from("team_match_stats").select("*").eq("fixture_id", fixture.id),
      supabaseAdmin
        .from("player_match_stats")
        .select("*,player_season_registrations(id,shirt_number,football_position,position,players(full_name,avatar_url))")
        .eq("fixture_id", fixture.id),
      supabaseAdmin.from("match_events").select("*").eq("fixture_id", fixture.id).order("minute", { ascending: true }),
      supabaseAdmin.from("match_substitutions").select("*").eq("fixture_id", fixture.id).order("minute", { ascending: true })
    ]);
    if (lineupsResult.error) throw lineupsResult.error;
    if (teamStatsResult.error) throw teamStatsResult.error;
    if (playerStatsResult.error) throw playerStatsResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (substitutionsResult.error) throw substitutionsResult.error;
    res.json({
      fixture,
      lineups: lineupsResult.data ?? [],
      team_stats: teamStatsResult.data ?? [],
      player_stats: playerStatsResult.data ?? [],
      events: eventsResult.data ?? [],
      substitutions: substitutionsResult.data ?? []
    });
  })
);

adminRouter.patch(
  "/matches/simulation",
  asyncHandler(async (req, res) => {
    const input = editSimulationSchema.parse(req.body);
    const result: SimulationResult = {
      home_score: input.home_score,
      away_score: input.away_score,
      home_stats: input.home_stats,
      away_stats: input.away_stats,
      player_stats: [],
      events: [],
      substitutions: [],
      simulation_seed: input.fixture_id
    };
    validateSimulationConsistency(result);
    const fixture = await getFixture(input.fixture_id);
    if (fixture.status !== FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION) {
      throw new AppError(400, "Only pending simulations can be edited");
    }
    await supabaseAdmin.from("team_match_stats").upsert([
      teamStatsRow(input.fixture_id, fixture.home_team_registration_id, input.home_stats),
      teamStatsRow(input.fixture_id, fixture.away_team_registration_id, input.away_stats)
    ], { onConflict: "fixture_id,team_registration_id" });
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({ home_score: input.home_score, away_score: input.away_score })
      .eq("id", input.fixture_id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ fixture: data });
  })
);

adminRouter.post(
  "/matches/:fixtureId/final-confirmation",
  asyncHandler(async (req, res) => {
    const fixtureId = String(req.params.fixtureId);
    if (!fixtureId) throw new AppError(400, "fixtureId is required");
    const fixture = await getFixture(fixtureId);
    if (fixture.status !== FixtureStatus.SIMULATED_PENDING_ADMIN_CONFIRMATION) {
      throw new AppError(400, "Only simulated pending matches can be finalized");
    }
    const homeScore = assertFound(fixture.home_score, "Home score missing");
    const awayScore = assertFound(fixture.away_score, "Away score missing");
    const { data: teamStats, error: statsError } = await supabaseAdmin
      .from("team_match_stats")
      .select("*")
      .eq("fixture_id", fixture.id);
    if (statsError) throw statsError;
    const homeStats = teamStats?.find((row) => row.team_registration_id === fixture.home_team_registration_id);
    const awayStats = teamStats?.find((row) => row.team_registration_id === fixture.away_team_registration_id);
    if (!homeStats || !awayStats) throw new AppError(400, "Team stats missing");

    const [homeStanding, awayStanding] = await Promise.all([
      getOrCreateStanding(fixture.season_id, fixture.home_team_registration_id),
      getOrCreateStanding(fixture.season_id, fixture.away_team_registration_id)
    ]);
    const [nextHome, nextAway] = applyFinalResultToStandings(
      homeStanding,
      awayStanding,
      homeScore,
      awayScore,
      homeStats,
      awayStats
    );
    const { error: standingsError } = await supabaseAdmin.from("standings").upsert(
      [
        { ...nextHome, season_id: fixture.season_id },
        { ...nextAway, season_id: fixture.season_id }
      ],
      { onConflict: "season_id,team_registration_id" }
    );
    if (standingsError) throw standingsError;

    await rollupPlayerStats(fixture.id, fixture.season_id);
    const winnerTeamRegistrationId =
      fixture.penalty_winner_team_registration_id ??
      (homeScore > awayScore ? fixture.home_team_registration_id : awayScore > homeScore ? fixture.away_team_registration_id : null);

    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({
        status: FixtureStatus.FINAL,
        result_confirmed: true,
        winner_team_registration_id: winnerTeamRegistrationId,
        finalized_by: req.auth!.userId,
        finalized_at: new Date().toISOString()
      })
      .eq("id", fixture.id)
      .select("*")
      .single();
    if (error) throw error;
    if (winnerTeamRegistrationId) await advanceKnockoutWinner(data, winnerTeamRegistrationId);
    await maybeSetChampion(fixture.season_id);
    res.json({ fixture: data });
  })
);

function requiredBodyText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new AppError(400, `${label} is required.`);
  return value.trim().slice(0, 500);
}

function routeParam(value: string | string[] | undefined, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new AppError(400, `${label} is required.`);
  return value;
}

type BulkRatingTier = typeof PlayerAbilityRating.LOW | typeof PlayerAbilityRating.MODERATE | typeof PlayerAbilityRating.HIGH;
type BulkRatingPlayer = {
  id: string;
  player_id: string;
  season_id: string;
  team_registration_id: string;
  position: string;
  football_position?: string | null;
};

async function getApprovedTeamRegistration(teamRegistrationId: string, seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select("id,season_id,manager_id,status")
    .eq("id", teamRegistrationId)
    .eq("season_id", seasonId)
    .single();
  if (error) throw error;
  if (data.status !== RegistrationStatus.APPROVED) throw new AppError(400, "Approve the team before rating or approving its players.");
  return data;
}

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string) {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

function getBulkRatingCounts(total: number, seed: string) {
  if (total <= 0) return { low: 0, moderate: 0, high: 0 };
  const random = seededRandom(`${seed}:counts`);
  if (total < 4) {
    const high = total >= 3 && random() > 0.72 ? 1 : 0;
    const low = total >= 3 && high === 0 && random() > 0.72 ? 1 : 0;
    return { low, high, moderate: total - low - high };
  }

  const baseExtreme = Math.max(1, Math.round(total * 0.15));
  const allowException = total >= 10 && random() > 0.78;
  const jitter = () => (allowException && random() > 0.5 ? 1 : random() < 0.18 ? -1 : 0);
  const maxExtreme = Math.max(1, Math.floor(total * 0.25));
  let low = Math.max(1, Math.min(maxExtreme, baseExtreme + jitter()));
  let high = Math.max(1, Math.min(maxExtreme, baseExtreme + jitter()));
  let moderate = total - low - high;

  while (moderate <= Math.max(low, high) && (low > 1 || high > 1)) {
    if (low >= high && low > 1) low -= 1;
    else if (high > 1) high -= 1;
    moderate = total - low - high;
  }

  return { low, moderate, high };
}

function assignBellCurveRatings(players: BulkRatingPlayer[], seed: string) {
  const counts = getBulkRatingCounts(players.length, seed);
  const order = shuffled(players, `${seed}:players`);
  const assignments: Array<{ player: BulkRatingPlayer; tier: BulkRatingTier }> = [];
  for (const player of order.slice(0, counts.low)) assignments.push({ player, tier: PlayerAbilityRating.LOW });
  for (const player of order.slice(counts.low, counts.low + counts.high)) assignments.push({ player, tier: PlayerAbilityRating.HIGH });
  for (const player of order.slice(counts.low + counts.high)) assignments.push({ player, tier: PlayerAbilityRating.MODERATE });
  return shuffled(assignments, `${seed}:assignments`);
}

function buildAbilityUpsertRow(registration: BulkRatingPlayer, tier: BulkRatingTier, adminId: string) {
  const footballPosition = (registration.football_position as FootballPosition | null) ?? coarseToFootballPosition(registration.position);
  const generated = generateAbilityScores(tier, footballPosition, `${registration.id}:${tier}:${footballPosition}`);
  const base = {
    player_registration_id: registration.id,
    player_id: registration.player_id,
    season_id: registration.season_id,
    team_registration_id: registration.team_registration_id,
    position: generated.position,
    rating_tier: generated.rating_tier,
    overall_rating: generated.overall_rating,
    generated_by_admin_id: adminId,
    generated_at: new Date().toISOString(),
    is_hidden_from_manager: true
  };
  if (generated.position === FootballPosition.GK) {
    return {
      ...base,
      shooting: null,
      passing: null,
      dribbling: null,
      defending: null,
      pace: null,
      stamina: null,
      physical: generated.physical,
      shot_stopping: generated.shot_stopping,
      reflexes: generated.reflexes,
      positioning: generated.positioning,
      handling: generated.handling,
      diving: generated.diving,
      distribution: generated.distribution,
      communication: generated.communication
    };
  }
  return {
    ...base,
    shooting: generated.shooting,
    passing: generated.passing,
    dribbling: generated.dribbling,
    defending: generated.defending,
    physical: generated.physical,
    pace: generated.pace,
    stamina: generated.stamina,
    shot_stopping: null,
    reflexes: null,
    positioning: null,
    handling: null,
    diving: null,
    distribution: null,
    communication: null
  };
}

async function getPlayerRegistrationForAction(playerRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select("id,season_id,team_registration_id,manager:team_registrations(manager_id)")
    .eq("id", playerRegistrationId)
    .single();
  if (error) throw error;
  return data;
}

async function notifyManager(registration: any, relatedType: "PLAYER_REJECTION" | "PLAYER_REMOVAL" | "GENERAL_NOTICE", message: string, adminId: string) {
  const manager = Array.isArray(registration.manager) ? registration.manager[0] : registration.manager;
  if (!manager?.manager_id) return;
  const { error } = await supabaseAdmin.from("manager_messages").insert({
    season_id: registration.season_id,
    manager_id: manager.manager_id,
    team_registration_id: registration.team_registration_id,
    player_registration_id: registration.id,
    related_type: relatedType,
    message,
    created_by: adminId
  });
  if (error) throw error;
}

async function markLineupsForResubmission(playerRegistrationId: string, reason: string, adminId: string) {
  const { data, error } = await supabaseAdmin
    .from("lineup_players")
    .select("lineup_id,lineups(id,status,fixture_id,team_registration_id,fixtures(status,season_id))")
    .eq("player_registration_id", playerRegistrationId);
  if (error) throw error;
  const affectedLineups = (data ?? [])
    .map((row) => (Array.isArray(row.lineups) ? row.lineups[0] : row.lineups))
    .filter((lineup): lineup is NonNullable<typeof lineup> => Boolean(lineup))
    .filter((lineup) => ["PENDING", "CONFIRMED"].includes(lineup.status))
    .filter((lineup) => {
      const fixture = Array.isArray(lineup.fixtures) ? lineup.fixtures[0] : lineup.fixtures;
      return fixture && fixture.status !== FixtureStatus.FINAL && fixture.status !== FixtureStatus.CANCELLED;
    });
  for (const lineup of affectedLineups) {
    const { error: lineupError } = await supabaseAdmin
      .from("lineups")
      .update({
        status: "REJECTED",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: `Resubmission required: ${reason}`
      })
      .eq("id", lineup.id);
    if (lineupError) throw lineupError;
    await updateFixtureLineupStatus(lineup.fixture_id);
  }
}

function emptyStandingForSeason(seasonId: string, teamRegistrationId: string) {
  return { ...emptyStanding(teamRegistrationId), season_id: seasonId };
}

function coarseToFootballPosition(position: string): FootballPosition {
  if (position === "GK") return FootballPosition.GK;
  if (position === "DEF") return FootballPosition.CB;
  if (position === "MID") return FootballPosition.CM;
  return FootballPosition.ST;
}

async function updateFixtureLineupStatus(fixtureId: string) {
  const { data, error } = await supabaseAdmin.from("lineups").select("status").eq("fixture_id", fixtureId);
  if (error) throw error;
  if ((data ?? []).filter((lineup) => lineup.status === "CONFIRMED").length === 2) {
    const { error: updateError } = await supabaseAdmin.from("fixtures").update({ status: FixtureStatus.LINEUPS_CONFIRMED }).eq("id", fixtureId);
    if (updateError) throw updateError;
  }
}

async function getFixture(fixtureId: string) {
  const { data, error } = await supabaseAdmin.from("fixtures").select("*").eq("id", fixtureId).single();
  if (error) throw error;
  return data;
}

async function getConfirmedLineupPlayers(fixtureId: string, teamRegistrationId: string, side: VenueSide): Promise<SimPlayer[]> {
  const { data: lineup, error: lineupError } = await supabaseAdmin
    .from("lineups")
    .select("id")
    .eq("fixture_id", fixtureId)
    .eq("team_registration_id", teamRegistrationId)
    .eq("status", "CONFIRMED")
    .single();
  if (lineupError) throw lineupError;
  const { data, error } = await supabaseAdmin
    .from("lineup_players")
    .select("player_registration_id,is_starter,position,football_position,player_season_registrations(player_abilities(*),player_hidden_attributes(*))")
    .eq("lineup_id", lineup.id);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const reg = Array.isArray(row.player_season_registrations)
      ? row.player_season_registrations[0]
      : row.player_season_registrations;
    const ability = Array.isArray(reg?.player_abilities)
      ? reg.player_abilities[0]
      : reg?.player_abilities;
    const attrs = Array.isArray(reg?.player_hidden_attributes)
      ? reg.player_hidden_attributes[0]
      : reg?.player_hidden_attributes;
    if (!ability && !attrs) throw new AppError(400, "Every lineup player must have generated hidden abilities");
    return {
      player_registration_id: row.player_registration_id,
      position: row.position,
      football_position: row.football_position ?? ability?.position ?? coarseToFootballPosition(row.position),
      side,
      is_starter: row.is_starter,
      pace: ability?.pace ?? attrs?.pace ?? 40,
      shooting: ability?.shooting ?? attrs?.shooting ?? 40,
      passing: ability?.passing ?? ability?.distribution ?? attrs?.passing ?? 40,
      dribbling: ability?.dribbling ?? attrs?.dribbling ?? 40,
      defending: ability?.defending ?? attrs?.defending ?? 40,
      physical: ability?.physical ?? attrs?.physical ?? 40,
      stamina: ability?.stamina ?? attrs?.physical ?? 40,
      goalkeeping: ability?.shot_stopping ?? attrs?.goalkeeping ?? 40,
      shot_stopping: ability?.shot_stopping ?? attrs?.goalkeeping ?? undefined,
      reflexes: ability?.reflexes ?? attrs?.goalkeeping ?? undefined,
      positioning: ability?.positioning ?? attrs?.goalkeeping ?? undefined,
      handling: ability?.handling ?? attrs?.goalkeeping ?? undefined,
      diving: ability?.diving ?? attrs?.goalkeeping ?? undefined,
      distribution: ability?.distribution ?? attrs?.passing ?? undefined,
      communication: ability?.communication ?? attrs?.physical ?? undefined
    };
  });
}

async function persistSimulation(fixtureId: string, result: SimulationResult) {
  const fixture = await getFixture(fixtureId);
  await Promise.all([
    supabaseAdmin.from("match_events").delete().eq("fixture_id", fixtureId),
    supabaseAdmin.from("match_substitutions").delete().eq("fixture_id", fixtureId),
    supabaseAdmin.from("player_match_stats").delete().eq("fixture_id", fixtureId),
    supabaseAdmin.from("team_match_stats").delete().eq("fixture_id", fixtureId)
  ]);
  const { error: teamError } = await supabaseAdmin.from("team_match_stats").insert([
    teamStatsRow(fixtureId, fixture.home_team_registration_id, result.home_stats),
    teamStatsRow(fixtureId, fixture.away_team_registration_id, result.away_stats)
  ]);
  if (teamError) throw teamError;
  if (result.player_stats.length > 0) {
    const { error } = await supabaseAdmin.from("player_match_stats").insert(
      result.player_stats.map((stat) => ({
        fixture_id: fixtureId,
        ...stat
      }))
    );
    if (error) throw error;
  }
  if (result.events.length > 0) {
    const { error } = await supabaseAdmin.from("match_events").insert(
      result.events.map((event) => ({
        fixture_id: fixtureId,
        ...event
      }))
    );
    if (error) throw error;
  }
  if (result.substitutions.length > 0) {
    const sideTeam = (side: VenueSide) => side === VenueSide.HOME ? fixture.home_team_registration_id : fixture.away_team_registration_id;
    const { error } = await supabaseAdmin.from("match_substitutions").insert(
      result.substitutions.map((substitution) => ({
        fixture_id: fixtureId,
        team_registration_id: sideTeam(substitution.side),
        minute: substitution.minute,
        player_out_registration_id: substitution.player_out_registration_id,
        player_in_registration_id: substitution.player_in_registration_id,
        reason: substitution.reason
      }))
    );
    if (error) throw error;
  }
}

function teamStatsRow(fixtureId: string, teamRegistrationId: string, stats: SimTeamStats) {
  return {
    fixture_id: fixtureId,
    team_registration_id: teamRegistrationId,
    ...stats
  };
}

function relatedName(value: unknown, key: string) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object" || !(key in row)) return null;
  const resolved = (row as Record<string, unknown>)[key];
  return typeof resolved === "string" && resolved.trim() ? resolved : null;
}

function per90(value: number, minutes: number) {
  if (!minutes || minutes <= 0) return 0;
  return Number(((value / minutes) * 90).toFixed(2));
}

function perMatch(value: number, matches: number) {
  if (!matches || matches <= 0) return 0;
  return Number((value / matches).toFixed(2));
}

function avg(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return 0;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2));
}

type LeaderboardDirection = "asc" | "desc";
type LeaderboardFormat = "number" | "decimal" | "percent";

function formatLeaderboardValue(value: number, format: LeaderboardFormat) {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "decimal") return value.toFixed(2).replace(/\.00$/, "");
  return String(Math.round(value));
}

function makeLeaderboard<T extends { id: string; name: string; team: string; teamLogoUrl: string | null; avatarUrl: string | null }>(
  id: string,
  title: string,
  rows: T[],
  field: keyof T,
  format: LeaderboardFormat,
  direction: LeaderboardDirection = "desc"
) {
  const entries = rows
    .map((row) => ({ row, numericValue: Number(row[field] ?? 0) }))
    .filter(({ numericValue }) => Number.isFinite(numericValue) && numericValue > 0)
    .sort((a, b) => (direction === "asc" ? a.numericValue - b.numericValue : b.numericValue - a.numericValue))
    .map(({ row, numericValue }) => ({
      id: row.id,
      name: row.name,
      subLabel: row.team,
      logoUrl: row.avatarUrl,
      teamLogoUrl: row.teamLogoUrl,
      initials: row.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "NA",
      value: formatLeaderboardValue(numericValue, format),
      numericValue
    }));
  return { id, title, entries };
}

function makeTeamLeaderboard<T extends { id: string; name: string; logoUrl: string | null }>(
  id: string,
  title: string,
  rows: T[],
  field: keyof T,
  format: LeaderboardFormat,
  direction: LeaderboardDirection = "desc"
) {
  const entries = rows
    .map((row) => ({ row, numericValue: Number(row[field] ?? 0) }))
    .filter(({ numericValue }) => Number.isFinite(numericValue) && numericValue > 0)
    .sort((a, b) => (direction === "asc" ? a.numericValue - b.numericValue : b.numericValue - a.numericValue))
    .map(({ row, numericValue }) => ({
      id: row.id,
      name: row.name,
      subLabel: "Team",
      logoUrl: row.logoUrl,
      teamLogoUrl: row.logoUrl,
      initials: row.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "TM",
      value: formatLeaderboardValue(numericValue, format),
      numericValue
    }));
  return { id, title, entries };
}

async function loadFixtureSeason(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select("*,leagues(id,name)")
    .eq("id", seasonId)
    .single();
  if (error) throw error;
  return data;
}

async function loadApprovedFixtureTeams(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select("id,team_id,season_id,status,created_at,teams(name,short_name,logo_url)")
    .eq("season_id", seasonId)
    .eq("status", RegistrationStatus.APPROVED)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    team_id: row.team_id,
    name: relatedName(row.teams, "name") ?? row.id,
    short_name: relatedName(row.teams, "short_name"),
    logo_url: relatedName(row.teams, "logo_url")
  }));
}

async function loadSeasonGroups(seasonId: string): Promise<FixtureGroup[]> {
  const { data, error } = await supabaseAdmin
    .from("season_groups")
    .select("id,name,locked,season_group_teams(id,team_registration_id,seed_no,team_registrations(id,teams(name,short_name,logo_url)))")
    .eq("season_id", seasonId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    teams: ((group.season_group_teams ?? []) as Array<Record<string, unknown>>)
      .sort((a, b) => Number(a.seed_no ?? 0) - Number(b.seed_no ?? 0))
      .map((groupTeam) => {
        const registration = Array.isArray(groupTeam.team_registrations) ? groupTeam.team_registrations[0] : groupTeam.team_registrations;
        return {
          id: String(groupTeam.team_registration_id),
          name: relatedName((registration as Record<string, unknown> | null)?.teams, "name"),
          short_name: relatedName((registration as Record<string, unknown> | null)?.teams, "short_name"),
          logo_url: relatedName((registration as Record<string, unknown> | null)?.teams, "logo_url")
        };
      })
  }));
}

async function recreateGroups(seasonId: string, groupCount: number) {
  const existing = await loadSeasonGroups(seasonId);
  if (existing.length > 0) {
    const { error } = await supabaseAdmin.from("season_groups").delete().eq("season_id", seasonId);
    if (error) throw error;
  }
  const rows = Array.from({ length: groupCount }, (_, index) => ({
    season_id: seasonId,
    name: `Group ${String.fromCharCode(65 + index)}`
  }));
  const { data, error } = await supabaseAdmin.from("season_groups").insert(rows).select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

async function loadSeasonFixtures(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("fixtures")
    .select(
      "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url)),season_groups(id,name)"
    )
    .eq("season_id", seasonId)
    .order("round_no", { ascending: true })
    .order("kickoff_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

function seasonRoundFormat(season: Record<string, unknown>): "SINGLE_ROUND_ROBIN" | "DOUBLE_ROUND_ROBIN" {
  const roundFormat = season.round_format;
  if (roundFormat === SeasonFormat.DOUBLE_ROUND_ROBIN) return SeasonFormat.DOUBLE_ROUND_ROBIN;
  if (season.format === SeasonFormat.DOUBLE_ROUND_ROBIN) return SeasonFormat.DOUBLE_ROUND_ROBIN;
  return SeasonFormat.SINGLE_ROUND_ROBIN;
}

async function buildFixturePreview(season: Record<string, unknown>, stage: "all" | "group" | "knockout") {
  if (season.format === SeasonFormat.GROUP_STAGE_KNOCKOUT) {
    if (stage === "knockout") return buildKnockoutPreview(season);
    if (stage === "all") stage = "group";
    const groups = await loadSeasonGroups(String(season.id));
    return generateGroupFixturePreview({
      groups,
      roundFormat: seasonRoundFormat(season),
      teamsPerGroup: Number(season.teams_per_group ?? 0),
      qualifiersPerGroup: Number(season.qualifiers_per_group ?? 0),
      startDate: String(season.start_date ?? ""),
      endDate: String(season.end_date ?? "")
    });
  }

  if (stage === "knockout" || stage === "group") throw new AppError(400, "This season is not a group + knockout season.");
  const teams = await loadApprovedFixtureTeams(String(season.id));
  return generateLeagueFixturePreview({
    seasonId: String(season.id),
    leagueId: String(season.league_id ?? ""),
    teams,
    roundFormat: seasonRoundFormat(season),
    startDate: String(season.start_date ?? ""),
    endDate: String(season.end_date ?? "")
  });
}

async function buildKnockoutPreview(season: Record<string, unknown>) {
  const groupFixtures = (await loadSeasonFixtures(String(season.id))).filter((fixture) => fixture.stage === "GROUP");
  if (groupFixtures.length === 0) throw new AppError(400, "Generate group fixtures first.");
  if (groupFixtures.some((fixture) => fixture.status !== FixtureStatus.FINAL && fixture.status !== "COMPLETED")) {
    throw new AppError(400, "Knockout fixtures will unlock after all group stage results are confirmed.");
  }
  const groups = await loadSeasonGroups(String(season.id));
  const { data: standings, error } = await supabaseAdmin
    .from("standings")
    .select("*")
    .eq("season_id", String(season.id));
  if (error) throw error;
  const standingByTeam = new Map((standings ?? []).map((row) => [row.team_registration_id, row]));
  const qualifiersPerGroup = Number(season.qualifiers_per_group ?? 0);
  const qualifiers = groups.flatMap((group) => {
    const ranked = [...group.teams].sort((a, b) => compareStanding(standingByTeam.get(a.id), standingByTeam.get(b.id)));
    return ranked.slice(0, qualifiersPerGroup).map((team, index) => ({
      groupName: group.name,
      rank: index + 1,
      team_registration_id: team.id
    }));
  });
  assertPowerOfTwoQualifiers(qualifiers.length);
  return generateKnockoutFixturePreview({
    qualifiers,
    startDate: nextDateAfterFixtures(groupFixtures, String(season.start_date ?? "")),
    endDate: String(season.end_date ?? "")
  });
}

function compareStanding(a?: Record<string, unknown>, b?: Record<string, unknown>) {
  const pointDiff = Number(b?.points ?? 0) - Number(a?.points ?? 0);
  if (pointDiff) return pointDiff;
  const gdDiff = Number(b?.goal_difference ?? 0) - Number(a?.goal_difference ?? 0);
  if (gdDiff) return gdDiff;
  const gfDiff = Number(b?.goals_for ?? 0) - Number(a?.goals_for ?? 0);
  if (gfDiff) return gfDiff;
  return Number(a?.fair_play_score ?? 0) - Number(b?.fair_play_score ?? 0);
}

function nextDateAfterFixtures(fixtures: Array<Record<string, unknown>>, fallback: string) {
  const dates = fixtures
    .map((fixture) => String(fixture.kickoff_at ?? "").slice(0, 10))
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? fallback;
}

async function replaceFixtures(season: Record<string, unknown>, fixtures: ScheduledFixturePreview[], mode: "all" | "group" | "knockout") {
  const seasonId = String(season.id);
  if (mode === "group") {
    const { error } = await supabaseAdmin.from("fixtures").delete().eq("season_id", seasonId).eq("stage", "GROUP");
    if (error) throw error;
  } else if (mode === "knockout") {
    const { error } = await supabaseAdmin.from("fixtures").delete().eq("season_id", seasonId).not("stage", "in", "(LEAGUE,GROUP)");
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("fixtures").delete().eq("season_id", seasonId);
    if (error) throw error;
  }
  if (fixtures.length === 0) return;
  const rows = fixtures.map((fixture) => ({
    league_id: season.league_id ?? null,
    season_id: seasonId,
    round_no: fixture.round_no,
    matchday_number: fixture.matchday_number,
    stage: fixture.stage,
    group_id: fixture.group_id ?? null,
    group_name: fixture.group_name ?? null,
    home_team_registration_id: fixture.home_team_registration_id ?? null,
    away_team_registration_id: fixture.away_team_registration_id ?? null,
    home_source: fixture.home_source ?? null,
    away_source: fixture.away_source ?? null,
    kickoff_at: fixture.kickoff_at ?? null,
    status: fixture.status,
    result_confirmed: false
  }));
  const { error } = await supabaseAdmin.from("fixtures").insert(rows);
  if (error) throw error;
  await supabaseAdmin.from("seasons").update({ fixture_status: "GENERATED", updated_at: new Date().toISOString() }).eq("id", seasonId);
}

function canRegenerateFixtures(fixtures: Array<Record<string, unknown>>) {
  return fixtures.every((fixture) => {
    const status = fixture.status;
    return (
      status === FixtureStatus.SCHEDULED ||
      status === FixtureStatus.CANCELLED ||
      status === "WAITING_FOR_TEAMS" ||
      status === "POSTPONED" ||
      status === "LINEUP_PENDING"
    ) && !fixture.finalized_at && fixture.result_confirmed !== true;
  });
}

function fixtureStatus(fixtures: Array<Record<string, unknown>>) {
  if (fixtures.length === 0) return "NOT_GENERATED";
  if (fixtures.some((fixture) => fixture.status === FixtureStatus.FINAL || fixture.result_confirmed === true)) return "IN_PROGRESS";
  return "GENERATED";
}

async function advanceKnockoutWinner(fixture: Record<string, unknown>, winnerTeamRegistrationId: string) {
  if (fixture.stage === "LEAGUE" || fixture.stage === "GROUP") return;
  const fixtures = (await loadSeasonFixtures(String(fixture.season_id)))
    .filter((row) => row.stage !== "LEAGUE" && row.stage !== "GROUP")
    .sort((a, b) => {
      const roundDiff = Number(a.round_no ?? 0) - Number(b.round_no ?? 0);
      if (roundDiff) return roundDiff;
      const dateDiff = String(a.kickoff_at ?? "").localeCompare(String(b.kickoff_at ?? ""));
      if (dateDiff) return dateDiff;
      return String(a.id).localeCompare(String(b.id));
    });
  const currentIndex = fixtures.findIndex((row) => row.id === fixture.id);
  if (currentIndex < 0) return;
  const sourceLabel = `Winner of KO${currentIndex + 1}`;
  const nextFixture = fixtures.find((row) => row.home_source === sourceLabel || row.away_source === sourceLabel);
  if (!nextFixture) return;
  const updates: Record<string, unknown> = {};
  if (nextFixture.home_source === sourceLabel) {
    updates.home_team_registration_id = winnerTeamRegistrationId;
    updates.home_source = null;
  }
  if (nextFixture.away_source === sourceLabel) {
    updates.away_team_registration_id = winnerTeamRegistrationId;
    updates.away_source = null;
  }
  const homeReady = updates.home_team_registration_id || nextFixture.home_team_registration_id;
  const awayReady = updates.away_team_registration_id || nextFixture.away_team_registration_id;
  if (homeReady && awayReady) updates.status = FixtureStatus.SCHEDULED;
  const { error } = await supabaseAdmin.from("fixtures").update(updates).eq("id", nextFixture.id);
  if (error) throw error;
}

function shuffleRows<T>(rows: T[], seed: string) {
  const random = seededRandomForFixtures(seed);
  const copy = [...rows];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

function seededRandomForFixtures(seed: string) {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function getOrCreateStanding(seasonId: string, teamRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("standings")
    .select("*")
    .eq("season_id", seasonId)
    .eq("team_registration_id", teamRegistrationId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const row = emptyStandingForSeason(seasonId, teamRegistrationId);
  const { data: inserted, error: insertError } = await supabaseAdmin.from("standings").insert(row).select("*").single();
  if (insertError) throw insertError;
  return inserted;
}

async function rollupPlayerStats(fixtureId: string, seasonId: string) {
  const { data, error } = await supabaseAdmin.from("player_match_stats").select("*").eq("fixture_id", fixtureId);
  if (error) throw error;
  for (const stat of data ?? []) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from("player_season_stats")
      .select("*")
      .eq("season_id", seasonId)
      .eq("player_registration_id", stat.player_registration_id)
      .maybeSingle();
    if (currentError) throw currentError;
    const appearances = (current?.appearances ?? 0) + 1;
    const priorRatingTotal = (current?.average_rating ?? 0) * (current?.appearances ?? 0);
    const next = {
      season_id: seasonId,
      player_registration_id: stat.player_registration_id,
      appearances,
      starts: (current?.starts ?? 0) + (stat.minutes >= 45 ? 1 : 0),
      minutes_played: (current?.minutes_played ?? 0) + stat.minutes,
      goals: (current?.goals ?? 0) + stat.goals,
      assists: (current?.assists ?? 0) + stat.assists,
      shots: (current?.shots ?? 0) + stat.shots,
      shots_on_target: (current?.shots_on_target ?? 0) + (stat.shots_on_target ?? 0),
      chances_created: (current?.chances_created ?? 0) + (stat.chances_created ?? 0),
      big_chances_created: (current?.big_chances_created ?? 0) + (stat.big_chances_created ?? 0),
      total_passes: (current?.total_passes ?? 0) + stat.passes,
      accurate_passes: (current?.accurate_passes ?? 0) + stat.accurate_passes,
      dribbles_attempted: (current?.dribbles_attempted ?? 0) + stat.dribbles_attempted,
      successful_dribbles: (current?.successful_dribbles ?? 0) + stat.successful_dribbles,
      dispossessed: (current?.dispossessed ?? 0) + (stat.dispossessed ?? 0),
      tackles: (current?.tackles ?? 0) + stat.tackles,
      interceptions: (current?.interceptions ?? 0) + (stat.interceptions ?? 0),
      yellow_cards: (current?.yellow_cards ?? 0) + stat.yellow_cards,
      red_cards: (current?.red_cards ?? 0) + stat.red_cards,
      average_rating: Number(((priorRatingTotal + stat.rating) / appearances).toFixed(2)),
      best_match_rating: Math.max(current?.best_match_rating ?? 0, stat.rating),
      lowest_match_rating: current?.lowest_match_rating ? Math.min(current.lowest_match_rating, stat.rating) : stat.rating,
      player_of_match_count: (current?.player_of_match_count ?? 0) + (stat.rating >= 8.8 ? 1 : 0)
    };
    const { error: upsertError } = await supabaseAdmin
      .from("player_season_stats")
      .upsert(next, { onConflict: "season_id,player_registration_id" });
    if (upsertError) throw upsertError;
  }
}

async function maybeSetChampion(seasonId: string) {
  const { data: unfinished, error: unfinishedError } = await supabaseAdmin
    .from("fixtures")
    .select("id")
    .eq("season_id", seasonId)
    .neq("status", FixtureStatus.FINAL)
    .limit(1);
  if (unfinishedError) throw unfinishedError;
  if ((unfinished ?? []).length > 0) return;
  const { data: standings, error } = await supabaseAdmin
    .from("standings")
    .select("*")
    .eq("season_id", seasonId)
    .order("points", { ascending: false })
    .order("goal_difference", { ascending: false })
    .order("goals_for", { ascending: false })
    .order("fair_play_score", { ascending: true })
    .limit(1);
  if (error) throw error;
  const champion = standings?.[0];
  if (!champion) return;
  const { error: seasonError } = await supabaseAdmin
    .from("seasons")
    .update({ champion_team_registration_id: champion.team_registration_id })
    .eq("id", seasonId);
  if (seasonError) throw seasonError;
}
