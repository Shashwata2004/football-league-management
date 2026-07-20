import { Router } from "express";
import {
  addFavoriteTeamSchema,
  FixtureStatus,
  hideFixtureOutcome,
  PlayerLifecycleStatus,
  RegistrationStatus,
  UserRole,
} from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError, asyncHandler } from "../errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getFormationSlots } from "../domain/lineup-builder.js";
import { loadSeasonStandings } from "../services/standings-report.js";
import {
  buildPlayerSeasonStatsFromMatchRows,
  loadLeagueRatings,
} from "../services/player-stats.js";
import {
  buildPlayerLeaderboardRows,
  makePlayerStatSections,
} from "../services/stat-leaderboards.js";

// The fan experience is read-only over the same tournament data the public and
// manager surfaces expose, plus a personal list of favourite clubs. Everything
// is served through the service role and sanitised so fans never see private
// identity data or unconfirmed scores.
export const fanRouter = Router();
fanRouter.use(requireAuth, requireRole(UserRole.USER, UserRole.ADMIN));

// Fixture statuses whose scores fans are allowed to see. Everything else is
// still in flight, so scores are hidden until the match is finalised.
const FAN_VISIBLE_SCORE_STATUSES: string[] = [FixtureStatus.FINAL];

function routeParam(
  value: string | string[] | undefined,
  name: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AppError(400, `${name} is required`);
  }
  return value;
}

// Hide scores for fixtures that are not finalised so fans can't peek at
// in-progress or simulated-but-unconfirmed results.
function sanitizeFixtureScore<
  T extends {
    status: string;
    home_score?: number | null;
    away_score?: number | null;
  },
>(fixture: T) {
  if (FAN_VISIBLE_SCORE_STATUSES.includes(fixture.status)) return fixture;
  return hideFixtureOutcome(fixture);
}

const FIXTURE_TEAM_SELECT =
  "*,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(id,name,short_name,logo_url,primary_color)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(id,name,short_name,logo_url,primary_color))";

// A fan's favourite clubs, newest first, joined to persistent team identity.
async function loadFavorites(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_favorite_teams")
    .select(
      "id,team_id,is_primary,created_at,team:teams(id,name,short_name,logo_url,primary_color,secondary_color,accent_color)",
    )
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// The team_registration ids for a club across every season it has played, so we
// can find that club's fixtures/results regardless of which season they belong
// to. Fans follow a persistent club, not a single-season registration.
async function registrationIdsForTeams(teamIds: string[]) {
  if (teamIds.length === 0) return [] as string[];
  const { data, error } = await supabaseAdmin
    .from("team_registrations")
    .select("id,team_id")
    .in("team_id", teamIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

async function assertFanCanViewSeason(seasonId: string) {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("id", seasonId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, "Season not found");
}

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

fanRouter.get(
  "/favorites",
  asyncHandler(async (req, res) => {
    const favorites = await loadFavorites(req.auth!.userId);
    res.json({ favorites });
  }),
);

fanRouter.post(
  "/favorites",
  asyncHandler(async (req, res) => {
    const { team_id, is_primary } = addFavoriteTeamSchema.parse(req.body);

    const { data: team, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("id", team_id)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team) throw new AppError(404, "Team not found");

    const existingFavorites = await loadFavorites(req.auth!.userId);
    const already = existingFavorites.find(
      (favorite) => favorite.team_id === team_id,
    );

    // First club a fan follows automatically becomes their primary so the
    // dashboard always has a team to theme around.
    const shouldBePrimary = is_primary || existingFavorites.length === 0;

    if (shouldBePrimary) {
      await clearPrimaryFavorite(req.auth!.userId);
    }

    if (already) {
      const { data, error } = await supabaseAdmin
        .from("user_favorite_teams")
        .update({ is_primary: shouldBePrimary })
        .eq("id", already.id)
        .select("id")
        .single();
      if (error) throw error;
      const favorites = await loadFavorites(req.auth!.userId);
      return res.status(200).json({ favorites, favorite_id: data.id });
    }

    const { data, error } = await supabaseAdmin
      .from("user_favorite_teams")
      .insert({
        user_id: req.auth!.userId,
        team_id,
        is_primary: shouldBePrimary,
      })
      .select("id")
      .single();
    if (error) throw error;
    const favorites = await loadFavorites(req.auth!.userId);
    res.status(201).json({ favorites, favorite_id: data.id });
  }),
);

fanRouter.patch(
  "/favorites/:teamId/primary",
  asyncHandler(async (req, res) => {
    const teamId = routeParam(req.params.teamId, "teamId");
    const favorites = await loadFavorites(req.auth!.userId);
    const target = favorites.find((favorite) => favorite.team_id === teamId);
    if (!target) throw new AppError(404, "Favorite not found");
    await clearPrimaryFavorite(req.auth!.userId);
    const { error } = await supabaseAdmin
      .from("user_favorite_teams")
      .update({ is_primary: true })
      .eq("id", target.id);
    if (error) throw error;
    res.json({ favorites: await loadFavorites(req.auth!.userId) });
  }),
);

fanRouter.delete(
  "/favorites/:teamId",
  asyncHandler(async (req, res) => {
    const teamId = routeParam(req.params.teamId, "teamId");
    const favorites = await loadFavorites(req.auth!.userId);
    const target = favorites.find((favorite) => favorite.team_id === teamId);
    if (!target) throw new AppError(404, "Favorite not found");

    const { error } = await supabaseAdmin
      .from("user_favorite_teams")
      .delete()
      .eq("id", target.id);
    if (error) throw error;

    // If we removed the primary, promote the next remaining favourite so a fan
    // is never left with favourites but no primary to theme around.
    if (target.is_primary) {
      const nextPrimary = favorites.find(
        (favorite) => favorite.team_id !== teamId,
      );
      if (nextPrimary) {
        await supabaseAdmin
          .from("user_favorite_teams")
          .update({ is_primary: true })
          .eq("id", nextPrimary.id);
      }
    }
    res.json({ favorites: await loadFavorites(req.auth!.userId) });
  }),
);

async function clearPrimaryFavorite(userId: string) {
  const { error } = await supabaseAdmin
    .from("user_favorite_teams")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("is_primary", true);
  if (error) throw error;
}

// A fan may rename their own account. app_users is the source of truth (see the
// manager equivalent): ensureProfile() copies its full_name into profiles on
// every login, so both tables are updated together to make the change stick.
fanRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const fullName =
      typeof req.body?.full_name === "string"
        ? req.body.full_name.trim().slice(0, 160)
        : undefined;
    if (!fullName) throw new AppError(400, "Full name is required");
    const now = new Date().toISOString();
    const { error: accountError } = await supabaseAdmin
      .from("app_users")
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

// ---------------------------------------------------------------------------
// Discovery: leagues, seasons, teams
// ---------------------------------------------------------------------------

fanRouter.get(
  "/leagues",
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("leagues")
      .select(
        "*,seasons(id,name,season_year,format,phase,start_date,end_date,total_teams)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ leagues: data ?? [] });
  }),
);

fanRouter.get(
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

fanRouter.get(
  "/seasons/:seasonId/teams",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertFanCanViewSeason(seasonId);
    const { data, error } = await supabaseAdmin
      .from("team_registrations")
      .select(
        "id,season_id,team_id,status,teams(id,name,short_name,logo_url,primary_color,secondary_color,accent_color)",
      )
      .eq("season_id", seasonId)
      .eq("status", RegistrationStatus.APPROVED)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json({ teams: data ?? [] });
  }),
);

fanRouter.get(
  "/seasons/:seasonId/fixtures",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertFanCanViewSeason(seasonId);
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select(FIXTURE_TEAM_SELECT)
      .eq("season_id", seasonId)
      .not(
        "status",
        "in",
        `(${FixtureStatus.WAITING_FOR_TEAMS},${FixtureStatus.CANCELLED})`,
      )
      .order("kickoff_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    res.json({ fixtures: (data ?? []).map(sanitizeFixtureScore) });
  }),
);

fanRouter.get(
  "/seasons/:seasonId/standings",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertFanCanViewSeason(seasonId);
    const standings = await loadSeasonStandings(seasonId);
    res.json({ standings });
  }),
);

fanRouter.get(
  "/seasons/:seasonId/player-stats",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertFanCanViewSeason(seasonId);
    const { data, error } = await supabaseAdmin
      .from("player_season_stats")
      .select(
        "player_registration_id,appearances,starts,minutes_played,goals,assists,shots,shots_on_target,chances_created,big_chances_created,total_passes,accurate_passes,dribbles_attempted,successful_dribbles,dispossessed,tackles,interceptions,yellow_cards,red_cards,average_rating,best_match_rating,lowest_match_rating,player_of_match_count,player_season_registrations(id,team_registration_id,position,football_position,shirt_number,players(full_name,avatar_url),team_registrations(id,teams(id,name,short_name,logo_url)))",
      )
      .eq("season_id", seasonId)
      .order("goals", { ascending: false });
    if (error) throw error;
    res.json({ player_stats: data ?? [] });
  }),
);

// Categorized player leaderboards for the whole league, mirroring the manager
// Player Stats page (General / Attack / Defense / Goalkeeping / Discipline).
// Fans get the full read-only view across every approved team in the season.
fanRouter.get(
  "/seasons/:seasonId/stat-leaderboards",
  asyncHandler(async (req, res) => {
    const seasonId = routeParam(req.params.seasonId, "seasonId");
    await assertFanCanViewSeason(seasonId);

    const [teamRegistrationsResult, playerRegistrationsResult] =
      await Promise.all([
        supabaseAdmin
          .from("team_registrations")
          .select("id,teams(name,short_name,logo_url)")
          .eq("season_id", seasonId)
          .eq("status", RegistrationStatus.APPROVED),
        supabaseAdmin
          .from("player_season_registrations")
          .select("id,team_registration_id,players(full_name,avatar_url)")
          .eq("season_id", seasonId),
      ]);
    if (teamRegistrationsResult.error) throw teamRegistrationsResult.error;
    if (playerRegistrationsResult.error) throw playerRegistrationsResult.error;

    const teams = teamRegistrationsResult.data ?? [];
    const teamIds = teams.map((team) => team.id);
    const playerRegistrations = (playerRegistrationsResult.data ?? []).filter(
      (player) => teamIds.includes(player.team_registration_id),
    );
    const playerIds = playerRegistrations.map((player) => player.id);

    const [playerSeasonStatsResult, playerMatchStatsResult] = await Promise.all(
      [
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
      ],
    );
    if (playerSeasonStatsResult.error) throw playerSeasonStatsResult.error;
    if (playerMatchStatsResult.error) throw playerMatchStatsResult.error;

    const teamById = new Map(teams.map((team) => [team.id, team]));
    const playerById = new Map(
      playerRegistrations.map((player) => [player.id, player]),
    );

    const playerRows = buildPlayerLeaderboardRows(
      playerSeasonStatsResult.data ?? [],
      playerMatchStatsResult.data ?? [],
      playerById,
      teamById,
    );

    res.json({ player_sections: makePlayerStatSections(playerRows) });
  }),
);

// ---------------------------------------------------------------------------
// Match detail (fan-safe)
// ---------------------------------------------------------------------------

fanRouter.get(
  "/matches/:matchId/detail",
  asyncHandler(async (req, res) => {
    const matchId = routeParam(req.params.matchId, "matchId");
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select(FIXTURE_TEAM_SELECT)
      .eq("id", matchId)
      .single();
    if (fixtureError) throw fixtureError;

    const isFinal = FAN_VISIBLE_SCORE_STATUSES.includes(fixture.status);
    const safeFixture = sanitizeFixtureScore(fixture);

    // Match analytics (lineups, stats, events) only make sense for finalised
    // matches. Before then, fans just get the scheduled fixture header.
    if (!isFinal) {
      return res.json({
        fixture: safeFixture,
        lineups: [],
        team_stats: [],
        player_stats: [],
        events: [],
        substitutions: [],
      });
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
        .select(
          "*,player:player_season_registrations!match_events_player_registration_id_fkey(id,shirt_number,football_position,players(full_name,avatar_url)),related_player:player_season_registrations!match_events_related_player_registration_id_fkey(id,shirt_number,players(full_name,avatar_url))",
        )
        .eq("fixture_id", fixture.id)
        .order("minute", { ascending: true }),
      supabaseAdmin
        .from("match_substitutions")
        .select(
          "*,player_out:player_season_registrations!match_substitutions_player_out_registration_id_fkey(id,shirt_number,players(full_name,avatar_url)),player_in:player_season_registrations!match_substitutions_player_in_registration_id_fkey(id,shirt_number,players(full_name,avatar_url))",
        )
        .eq("fixture_id", fixture.id)
        .order("minute", { ascending: true }),
    ]);
    if (lineupsError) throw lineupsError;
    if (teamStatsError) throw teamStatsError;
    if (playerStatsError) throw playerStatsError;
    if (eventsError) throw eventsError;
    if (substitutionsError) throw substitutionsError;

    res.json({
      fixture: safeFixture,
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

// ---------------------------------------------------------------------------
// Team profile (fan-safe)
// ---------------------------------------------------------------------------

fanRouter.get(
  "/teams/:teamRegistrationId/profile",
  asyncHandler(async (req, res) => {
    const idParam = routeParam(
      req.params.teamRegistrationId,
      "teamRegistrationId",
    );
    const TEAM_REGISTRATION_SELECT =
      "id,season_id,team_id,status,teams(*),seasons!team_registrations_season_id_fkey(id,name,season_year,format,phase,max_players_per_team,league_id,leagues(id,name,short_name,logo_url))";

    // Fans follow a persistent club, so the id they open with can be either a
    // single-season team_registration id (from standings/fixtures) or a club
    // team_id (from their favourites list). Resolve either to a registration.
    let { data: team, error } = await supabaseAdmin
      .from("team_registrations")
      .select(TEAM_REGISTRATION_SELECT)
      .eq("id", idParam)
      .maybeSingle();
    if (error) throw error;

    if (!team) {
      const { data: byClub, error: byClubError } = await supabaseAdmin
        .from("team_registrations")
        .select(TEAM_REGISTRATION_SELECT)
        .eq("team_id", idParam)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byClubError) throw byClubError;
      team = byClub;
    }

    if (!team) throw new AppError(404, "Team not found");

    const [players, { data: fixtures, error: fixturesError }, standings] =
      await Promise.all([
        loadFanTeamPlayers(team.id),
        supabaseAdmin
          .from("fixtures")
          .select(FIXTURE_TEAM_SELECT)
          .or(
            `home_team_registration_id.eq.${team.id},away_team_registration_id.eq.${team.id}`,
          )
          .not(
            "status",
            "in",
            `(${FixtureStatus.WAITING_FOR_TEAMS},${FixtureStatus.CANCELLED})`,
          )
          .order("kickoff_at", { ascending: true, nullsFirst: false }),
        loadSeasonStandings(team.season_id),
      ]);
    if (fixturesError) throw fixturesError;

    res.json({
      team,
      players,
      fixtures: (fixtures ?? []).map(sanitizeFixtureScore),
      standings,
    });
  }),
);

// Fan-visible squad: no identity numbers, no ability breakdowns beyond a single
// overall rating, only players who are actually part of the squad.
async function loadFanTeamPlayers(teamRegistrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("player_season_registrations")
    .select(
      "id,player_id,position,football_position,position_category,shirt_number,status,preferred_foot,player_status,players(id,full_name,avatar_url),player_abilities(overall_rating)",
    )
    .eq("team_registration_id", teamRegistrationId)
    .neq("status", RegistrationStatus.REJECTED)
    .neq("player_status", PlayerLifecycleStatus.REMOVED)
    .order("shirt_number", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((player) => {
    const ability = Array.isArray(player.player_abilities)
      ? player.player_abilities[0]
      : player.player_abilities;
    return {
      ...player,
      overall_rating: ability?.overall_rating ?? null,
      player_abilities: undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Player profile (fan-safe)
// ---------------------------------------------------------------------------

fanRouter.get(
  "/players/:playerRegistrationId/profile",
  asyncHandler(async (req, res) => {
    const playerRegistrationId = routeParam(
      req.params.playerRegistrationId,
      "playerRegistrationId",
    );
    const { data: player, error: playerError } = await supabaseAdmin
      .from("player_season_registrations")
      .select(
        "id,player_id,season_id,team_registration_id,position,football_position,position_category,shirt_number,status,preferred_foot,player_status,players(id,full_name,avatar_url),player_abilities(overall_rating),team_registrations(id,teams(id,name,short_name,logo_url,primary_color)),seasons!player_season_registrations_season_id_fkey(id,name,season_year,leagues(id,name,short_name))",
      )
      .eq("id", playerRegistrationId)
      .single();
    if (playerError) throw playerError;

    const ability = Array.isArray(player.player_abilities)
      ? player.player_abilities[0]
      : player.player_abilities;

    const [
      { data: storedSeasonStats, error: seasonError },
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
          "*,fixtures(id,kickoff_at,stage,status,home_score,away_score,extra_time_played,penalties_home,penalties_away,penalty_winner_team_registration_id,home_team_registration_id,away_team_registration_id,home_team:team_registrations!fixtures_home_team_registration_id_fkey(id,teams(name,short_name,logo_url)),away_team:team_registrations!fixtures_away_team_registration_id_fkey(id,teams(name,short_name,logo_url)))",
        )
        .eq("player_registration_id", player.id)
        .order("created_at", { ascending: false }),
    ]);
    if (seasonError) throw seasonError;
    if (matchError) throw matchError;

    // Match the manager profile shape: derive the season aggregates from the
    // confirmed match rows (so they always reconcile with the match-by-match
    // table) and expose the minutes-weighted league rating. Ability attributes
    // stay hidden — fans only ever see the same performance data managers do.
    const leagueRatings = await loadLeagueRatings([player.id]);

    res.json({
      player: {
        ...player,
        overall_rating: ability?.overall_rating ?? null,
        player_abilities: undefined,
      },
      overall_rating: ability?.overall_rating ?? null,
      league_rating: leagueRatings.get(player.id) ?? null,
      season_stats: buildPlayerSeasonStatsFromMatchRows(matchStats ?? []),
      stored_season_stats: storedSeasonStats,
      match_stats: (matchStats ?? []).map((row) => ({
        ...row,
        fixtures: row.fixtures
          ? sanitizeFixtureScore(row.fixtures)
          : row.fixtures,
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Personalised dashboard feed
// ---------------------------------------------------------------------------

fanRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const [profileResult, favorites] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", req.auth!.userId)
        .single(),
      loadFavorites(req.auth!.userId),
    ]);
    if (profileResult.error) throw profileResult.error;

    const favoriteTeamIds = favorites.map((favorite) => favorite.team_id);
    const registrationIds = await registrationIdsForTeams(favoriteTeamIds);

    if (registrationIds.length === 0) {
      return res.json({
        profile: profileResult.data,
        favorites,
        upcoming_fixtures: [],
        recent_results: [],
      });
    }

    const clauses = registrationIds.flatMap((id) => [
      `home_team_registration_id.eq.${id}`,
      `away_team_registration_id.eq.${id}`,
    ]);

    const [
      { data: upcoming, error: upcomingError },
      { data: results, error: resultsError },
    ] = await Promise.all([
      supabaseAdmin
        .from("fixtures")
        .select(FIXTURE_TEAM_SELECT)
        .or(clauses.join(","))
        .in("status", [
          FixtureStatus.SCHEDULED,
          FixtureStatus.LINEUP_PENDING,
          FixtureStatus.LINEUPS_SUBMITTED,
          FixtureStatus.LINEUPS_CONFIRMED,
          FixtureStatus.READY_TO_SIMULATE,
        ])
        .order("kickoff_at", { ascending: true, nullsFirst: false })
        .limit(10),
      supabaseAdmin
        .from("fixtures")
        .select(FIXTURE_TEAM_SELECT)
        .or(clauses.join(","))
        .eq("status", FixtureStatus.FINAL)
        .order("finalized_at", { ascending: false, nullsFirst: false })
        .limit(10),
    ]);
    if (upcomingError) throw upcomingError;
    if (resultsError) throw resultsError;

    res.json({
      profile: profileResult.data,
      favorites,
      upcoming_fixtures: (upcoming ?? []).map(sanitizeFixtureScore),
      recent_results: (results ?? []).map(sanitizeFixtureScore),
    });
  }),
);

export default fanRouter;
