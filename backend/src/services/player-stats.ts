import { FootballPosition } from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";

// Shared player statistics helpers used by the manager, admin, and fan
// surfaces so every view derives the same season aggregates and league rating
// from the same confirmed match rows.

// Aggregate a player's confirmed match rows into a single season stat block.
// Only rows where the player actually played (minutes > 0) count toward the
// aggregates, matching how appearances and averages are presented elsewhere.
export function buildPlayerSeasonStatsFromMatchRows(
  matchStats: Array<Record<string, any>>,
) {
  const playedRows = matchStats.filter((row) => Number(row.minutes ?? 0) > 0);
  const sum = (field: string) =>
    playedRows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const ratings = playedRows
    .map((row) => Number(row.rating ?? 0))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const gkRows = playedRows.filter(
    (row) => row.position_played === FootballPosition.GK,
  );
  const appearances = playedRows.length;
  const shots = sum("shots");
  const shotsOnTarget = sum("shots_on_target");
  const passes = sum("passes");
  const accuratePasses = sum("accurate_passes");
  const dribblesAttempted = sum("dribbles_attempted");
  const successfulDribbles = sum("successful_dribbles");

  return {
    matches_played: appearances,
    appearances,
    starts: playedRows.filter((row) => Number(row.minutes ?? 0) >= 45).length,
    minutes_played: sum("minutes"),
    goals: sum("goals"),
    assists: sum("assists"),
    shots,
    shots_on_target: shotsOnTarget,
    chances_created: sum("chances_created"),
    big_chances_created: sum("big_chances_created"),
    big_chances_missed: sum("big_chances_missed"),
    total_passes: passes,
    accurate_passes: accuratePasses,
    dribbles_attempted: dribblesAttempted,
    successful_dribbles: successfulDribbles,
    dribbled_past: sum("dribbled_past"),
    dispossessed: sum("dispossessed"),
    tackles: sum("tackles"),
    interceptions: sum("interceptions"),
    clearances: sum("clearances"),
    blocks: sum("blocks"),
    fouls_committed: sum("fouls_committed"),
    yellow_cards: sum("yellow_cards"),
    red_cards: sum("red_cards"),
    saves: sum("saves"),
    goals_conceded: sum("goals_conceded"),
    accurate_long_balls: sum("accurate_long_balls"),
    diving_saves: sum("diving_saves"),
    saves_inside_box: sum("saves_inside_box"),
    clean_sheets: gkRows.filter(
      (row) =>
        Number(row.goals_conceded ?? 0) === 0 && Number(row.minutes ?? 0) >= 45,
    ).length,
    shot_accuracy: shots ? Math.round((shotsOnTarget / shots) * 100) : 0,
    pass_accuracy: passes ? Math.round((accuratePasses / passes) * 100) : 0,
    dribble_success_rate: dribblesAttempted
      ? Math.round((successfulDribbles / dribblesAttempted) * 100)
      : 0,
    average_rating: ratings.length
      ? Number(
          (
            ratings.reduce((total, rating) => total + rating, 0) /
            ratings.length
          ).toFixed(2),
        )
      : null,
    best_match_rating: ratings.length ? Math.max(...ratings) : null,
    lowest_match_rating: ratings.length ? Math.min(...ratings) : null,
  };
}

// Minutes-weighted average match rating per player registration. This is the
// canonical "league rating" surfaced across the app.
export async function loadLeagueRatings(playerRegistrationIds: string[]) {
  if (playerRegistrationIds.length === 0) return new Map<string, number>();
  const { data, error } = await supabaseAdmin
    .from("player_match_stats")
    .select("player_registration_id,minutes,rating")
    .in("player_registration_id", playerRegistrationIds);
  if (error) throw error;
  const totals = new Map<string, { weighted: number; minutes: number }>();
  for (const row of data ?? []) {
    const minutes = Number(row.minutes ?? 0);
    const rating = Number(row.rating ?? 0);
    if (!minutes || !rating) continue;
    const current = totals.get(row.player_registration_id) ?? {
      weighted: 0,
      minutes: 0,
    };
    current.weighted += rating * minutes;
    current.minutes += minutes;
    totals.set(row.player_registration_id, current);
  }
  const ratings = new Map<string, number>();
  for (const [id, total] of totals.entries()) {
    ratings.set(id, Number((total.weighted / total.minutes).toFixed(2)));
  }
  return ratings;
}
