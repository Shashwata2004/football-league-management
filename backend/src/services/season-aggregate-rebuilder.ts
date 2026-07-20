import { RegistrationStatus } from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";

export interface ConfirmedFixtureAggregateSource {
  id: string;
  stage: string;
  result_confirmed: boolean;
  home_team_registration_id: string | null;
  away_team_registration_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

export interface TeamCardAggregateSource {
  fixture_id: string;
  team_registration_id: string;
  yellow_cards: number | null;
  red_cards: number | null;
}

export interface RebuiltStandingRow {
  season_id: string;
  team_registration_id: string;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  fair_play_score: number;
  admin_draw_rank: number | null;
  updated_at: string;
}

export interface PlayerMatchAggregateSource {
  player_registration_id: string;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on_target: number | null;
  chances_created: number | null;
  big_chances_created: number | null;
  passes: number | null;
  accurate_passes: number | null;
  dribbles_attempted: number | null;
  successful_dribbles: number | null;
  dribbled_past: number | null;
  dispossessed: number | null;
  tackles: number | null;
  interceptions: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  rating: number | string | null;
}

export interface RebuiltPlayerSeasonStatRow {
  season_id: string;
  player_registration_id: string;
  appearances: number;
  starts: number;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  chances_created: number;
  big_chances_created: number;
  total_passes: number;
  accurate_passes: number;
  dribbles_attempted: number;
  successful_dribbles: number;
  dribbled_past: number;
  dispossessed: number;
  tackles: number;
  interceptions: number;
  yellow_cards: number;
  red_cards: number;
  average_rating: number | null;
  best_match_rating: number | null;
  lowest_match_rating: number | null;
  player_of_match_count: number;
  updated_at: string;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyStanding(
  seasonId: string,
  teamRegistrationId: string,
  adminDrawRank: number | null,
  updatedAt: string,
): RebuiltStandingRow {
  return {
    season_id: seasonId,
    team_registration_id: teamRegistrationId,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    fair_play_score: 0,
    admin_draw_rank: adminDrawRank,
    updated_at: updatedAt,
  };
}

export function rebuildStandingRows(
  seasonId: string,
  teamRegistrationIds: string[],
  fixtures: ConfirmedFixtureAggregateSource[],
  teamStats: TeamCardAggregateSource[],
  adminDrawRanks: ReadonlyMap<string, number | null> = new Map(),
  updatedAt = new Date().toISOString(),
) {
  const rows = new Map(
    teamRegistrationIds.map((teamId) => [
      teamId,
      emptyStanding(
        seasonId,
        teamId,
        adminDrawRanks.get(teamId) ?? null,
        updatedAt,
      ),
    ]),
  );
  const standingFixtureIds = new Set<string>();

  for (const fixture of fixtures) {
    if (
      !fixture.result_confirmed ||
      !["GROUP", "LEAGUE"].includes(fixture.stage) ||
      !fixture.home_team_registration_id ||
      !fixture.away_team_registration_id ||
      fixture.home_score === null ||
      fixture.away_score === null
    ) {
      continue;
    }
    const first = rows.get(fixture.home_team_registration_id);
    const second = rows.get(fixture.away_team_registration_id);
    if (!first || !second) continue;

    const firstScore = numeric(fixture.home_score);
    const secondScore = numeric(fixture.away_score);
    first.goals_for += firstScore;
    first.goals_against += secondScore;
    second.goals_for += secondScore;
    second.goals_against += firstScore;
    if (firstScore > secondScore) {
      first.won += 1;
      second.lost += 1;
    } else if (secondScore > firstScore) {
      second.won += 1;
      first.lost += 1;
    } else {
      first.drawn += 1;
      second.drawn += 1;
    }
    standingFixtureIds.add(fixture.id);
  }

  for (const stat of teamStats) {
    if (!standingFixtureIds.has(stat.fixture_id)) continue;
    const standing = rows.get(stat.team_registration_id);
    if (!standing) continue;
    standing.fair_play_score -=
      numeric(stat.yellow_cards) + numeric(stat.red_cards) * 3;
  }

  return [...rows.values()];
}

function emptyPlayerSeasonStat(
  seasonId: string,
  playerRegistrationId: string,
  updatedAt: string,
): RebuiltPlayerSeasonStatRow & { rating_total: number } {
  return {
    season_id: seasonId,
    player_registration_id: playerRegistrationId,
    appearances: 0,
    starts: 0,
    minutes_played: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shots_on_target: 0,
    chances_created: 0,
    big_chances_created: 0,
    total_passes: 0,
    accurate_passes: 0,
    dribbles_attempted: 0,
    successful_dribbles: 0,
    dribbled_past: 0,
    dispossessed: 0,
    tackles: 0,
    interceptions: 0,
    yellow_cards: 0,
    red_cards: 0,
    average_rating: null,
    best_match_rating: null,
    lowest_match_rating: null,
    player_of_match_count: 0,
    updated_at: updatedAt,
    rating_total: 0,
  };
}

export function rebuildPlayerSeasonStatRows(
  seasonId: string,
  playerRegistrationIds: string[],
  matchStats: PlayerMatchAggregateSource[],
  updatedAt = new Date().toISOString(),
) {
  const allowedPlayerIds = new Set(playerRegistrationIds);
  const rows = new Map<
    string,
    RebuiltPlayerSeasonStatRow & { rating_total: number }
  >();

  for (const stat of matchStats) {
    if (!allowedPlayerIds.has(stat.player_registration_id)) continue;
    const row =
      rows.get(stat.player_registration_id) ??
      emptyPlayerSeasonStat(seasonId, stat.player_registration_id, updatedAt);
    rows.set(stat.player_registration_id, row);
    const rating = numeric(stat.rating);
    row.appearances += 1;
    row.starts += numeric(stat.minutes) >= 45 ? 1 : 0;
    row.minutes_played += numeric(stat.minutes);
    row.goals += numeric(stat.goals);
    row.assists += numeric(stat.assists);
    row.shots += numeric(stat.shots);
    row.shots_on_target += numeric(stat.shots_on_target);
    row.chances_created += numeric(stat.chances_created);
    row.big_chances_created += numeric(stat.big_chances_created);
    row.total_passes += numeric(stat.passes);
    row.accurate_passes += numeric(stat.accurate_passes);
    row.dribbles_attempted += numeric(stat.dribbles_attempted);
    row.successful_dribbles += numeric(stat.successful_dribbles);
    row.dribbled_past += numeric(stat.dribbled_past);
    row.dispossessed += numeric(stat.dispossessed);
    row.tackles += numeric(stat.tackles);
    row.interceptions += numeric(stat.interceptions);
    row.yellow_cards += numeric(stat.yellow_cards);
    row.red_cards += numeric(stat.red_cards);
    row.rating_total += rating;
    row.best_match_rating =
      row.best_match_rating === null
        ? rating
        : Math.max(row.best_match_rating, rating);
    row.lowest_match_rating =
      row.lowest_match_rating === null
        ? rating
        : Math.min(row.lowest_match_rating, rating);
    row.player_of_match_count += rating >= 8.8 ? 1 : 0;
  }

  return [...rows.values()].map(({ rating_total, ...row }) => ({
    ...row,
    average_rating:
      row.appearances > 0
        ? Number((rating_total / row.appearances).toFixed(2))
        : null,
  }));
}

export async function rebuildSeasonDerivedAggregates(seasonId: string) {
  const [
    teamsResult,
    playersResult,
    fixturesResult,
    standingsResult,
    storedPlayerStatsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("team_registrations")
      .select("id")
      .eq("season_id", seasonId)
      .eq("status", RegistrationStatus.APPROVED),
    supabaseAdmin
      .from("player_season_registrations")
      .select("id")
      .eq("season_id", seasonId),
    supabaseAdmin
      .from("fixtures")
      .select(
        "id,stage,result_confirmed,home_team_registration_id,away_team_registration_id,home_score,away_score",
      )
      .eq("season_id", seasonId)
      .eq("result_confirmed", true),
    supabaseAdmin
      .from("standings")
      .select("team_registration_id,admin_draw_rank")
      .eq("season_id", seasonId),
    supabaseAdmin
      .from("player_season_stats")
      .select("player_registration_id")
      .eq("season_id", seasonId),
  ]);
  if (teamsResult.error) throw teamsResult.error;
  if (playersResult.error) throw playersResult.error;
  if (fixturesResult.error) throw fixturesResult.error;
  if (standingsResult.error) throw standingsResult.error;
  if (storedPlayerStatsResult.error) throw storedPlayerStatsResult.error;

  const fixtureIds = (fixturesResult.data ?? []).map((fixture) => fixture.id);
  const [teamStatsResult, playerStatsResult] = await Promise.all([
    fixtureIds.length
      ? supabaseAdmin
          .from("team_match_stats")
          .select("fixture_id,team_registration_id,yellow_cards,red_cards")
          .in("fixture_id", fixtureIds)
      : Promise.resolve({ data: [], error: null }),
    fixtureIds.length
      ? supabaseAdmin
          .from("player_match_stats")
          .select(
            "player_registration_id,minutes,goals,assists,shots,shots_on_target,chances_created,big_chances_created,passes,accurate_passes,dribbles_attempted,successful_dribbles,dribbled_past,dispossessed,tackles,interceptions,yellow_cards,red_cards,rating",
          )
          .in("fixture_id", fixtureIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (teamStatsResult.error) throw teamStatsResult.error;
  if (playerStatsResult.error) throw playerStatsResult.error;

  const adminDrawRanks = new Map(
    (standingsResult.data ?? []).map((standing) => [
      standing.team_registration_id,
      standing.admin_draw_rank,
    ]),
  );
  const now = new Date().toISOString();
  const standingRows = rebuildStandingRows(
    seasonId,
    (teamsResult.data ?? []).map((team) => team.id),
    fixturesResult.data ?? [],
    teamStatsResult.data ?? [],
    adminDrawRanks,
    now,
  );
  const playerRows = rebuildPlayerSeasonStatRows(
    seasonId,
    (playersResult.data ?? []).map((player) => player.id),
    playerStatsResult.data ?? [],
    now,
  );
  const rebuiltPlayerIds = new Set(
    playerRows.map((row) => row.player_registration_id),
  );
  const stalePlayerIds = (storedPlayerStatsResult.data ?? [])
    .map((row) => row.player_registration_id)
    .filter((playerId) => !rebuiltPlayerIds.has(playerId));

  if (standingRows.length) {
    const { error } = await supabaseAdmin
      .from("standings")
      .upsert(standingRows, {
        onConflict: "season_id,team_registration_id",
      });
    if (error) throw error;
  }
  if (playerRows.length) {
    const { error } = await supabaseAdmin
      .from("player_season_stats")
      .upsert(playerRows, {
        onConflict: "season_id,player_registration_id",
      });
    if (error) throw error;
  }
  if (stalePlayerIds.length) {
    const { error } = await supabaseAdmin
      .from("player_season_stats")
      .delete()
      .eq("season_id", seasonId)
      .in("player_registration_id", stalePlayerIds);
    if (error) throw error;
  }

  return {
    confirmedFixtures: fixtureIds.length,
    standingsRebuilt: standingRows.length,
    playerSeasonStatsRebuilt: playerRows.length,
    emptyPlayerSeasonStatsRemoved: stalePlayerIds.length,
  };
}
