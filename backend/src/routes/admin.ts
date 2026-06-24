import { Router } from "express";
import {
  createLeagueSchema,
  createSeasonSchema,
  editSimulationSchema,
  FixtureStatus,
  generateFixturesSchema,
  registrationDecisionSchema,
  roleRequestDecisionSchema,
  simulateMatchSchema,
  updateSeasonScheduleSchema,
  UserRole,
  VenueSide
} from "@flms/shared";
import { generateSeasonPairings } from "../domain/fixtures.js";
import { applyFinalResultToStandings, emptyStanding } from "../domain/standings.js";
import {
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

adminRouter.post(
  "/leagues",
  asyncHandler(async (req, res) => {
    const input = createLeagueSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("leagues").insert(input).select("*").single();
    if (error) throw error;
    res.status(201).json({ league: data });
  })
);

adminRouter.post(
  "/seasons",
  asyncHandler(async (req, res) => {
    const input = createSeasonSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("seasons").insert(input).select("*").single();
    if (error) throw error;
    res.status(201).json({ season: data });
  })
);

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
      .select("*,teams(*),seasons(name)")
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
      .select("*,players(full_name,date_of_birth,nationality,id_type,id_number_last4),team_registrations(teams(name))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ player_registrations: data });
  })
);

adminRouter.patch(
  "/player-registrations/:id/decision",
  asyncHandler(async (req, res) => {
    const input = registrationDecisionSchema.parse(req.body);
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
    if (fixture.status !== FixtureStatus.LINEUPS_CONFIRMED && fixture.status !== FixtureStatus.SCHEDULED) {
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
        away_score: result.away_score
      })
      .eq("id", fixture.id)
      .select("*")
      .single();
    if (error) throw error;
    res.json({ fixture: data, simulation: result });
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
      events: []
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

    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .update({ status: FixtureStatus.FINAL, finalized_by: req.auth!.userId, finalized_at: new Date().toISOString() })
      .eq("id", fixture.id)
      .select("*")
      .single();
    if (error) throw error;
    await maybeSetChampion(fixture.season_id);
    res.json({ fixture: data });
  })
);

function emptyStandingForSeason(seasonId: string, teamRegistrationId: string) {
  return { ...emptyStanding(teamRegistrationId), season_id: seasonId };
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
    .select("player_registration_id,is_starter,position,player_season_registrations(player_hidden_attributes(*))")
    .eq("lineup_id", lineup.id);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const reg = Array.isArray(row.player_season_registrations)
      ? row.player_season_registrations[0]
      : row.player_season_registrations;
    const attrs = Array.isArray(reg?.player_hidden_attributes)
      ? reg.player_hidden_attributes[0]
      : reg?.player_hidden_attributes;
    if (!attrs) throw new AppError(400, "Every lineup player must have approved hidden attributes");
    return {
      player_registration_id: row.player_registration_id,
      position: row.position,
      side,
      is_starter: row.is_starter,
      pace: attrs.pace,
      shooting: attrs.shooting,
      passing: attrs.passing,
      dribbling: attrs.dribbling,
      defending: attrs.defending,
      physical: attrs.physical,
      goalkeeping: attrs.goalkeeping
    };
  });
}

async function persistSimulation(fixtureId: string, result: SimulationResult) {
  const fixture = await getFixture(fixtureId);
  await Promise.all([
    supabaseAdmin.from("match_events").delete().eq("fixture_id", fixtureId),
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
}

function teamStatsRow(fixtureId: string, teamRegistrationId: string, stats: SimTeamStats) {
  return {
    fixture_id: fixtureId,
    team_registration_id: teamRegistrationId,
    ...stats
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
      goals: (current?.goals ?? 0) + stat.goals,
      assists: (current?.assists ?? 0) + stat.assists,
      yellow_cards: (current?.yellow_cards ?? 0) + stat.yellow_cards,
      red_cards: (current?.red_cards ?? 0) + stat.red_cards,
      average_rating: Number(((priorRatingTotal + stat.rating) / appearances).toFixed(2))
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
