import {
  FixtureStatus,
  MatchEventType,
  RegistrationStatus,
  VenueSide,
} from "@flms/shared";
import { supabaseAdmin } from "../db/supabase.js";
import { AppError } from "../errors.js";
import { totalExpectedGoals } from "../domain/team-statistics.js";
import {
  avg,
  buildPlayerLeaderboardRows,
  makePlayerStatSections,
  makeTeamLeaderboard,
  perMatch,
  relatedName,
  type PlayerLeaderboardRow,
} from "./stat-leaderboards.js";

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

export async function loadSeasonStatReport(
  seasonId: string,
  requestedTeamId?: string,
) {
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
  ) {
    throw new AppError(404, "Team not found in this season");
  }

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
      teamStats.reduce(
        (total, row) => total + Number(row[field] ?? 0),
        0,
      );
    const sumPlayers = (field: string) =>
      teamPlayerMatchRows.reduce(
        (total, row) => total + Number(row[field] ?? 0),
        0,
      );
    const cleanSheets = fixtures.filter((fixture) => {
      if (fixture.status !== FixtureStatus.FINAL) return false;
      if (fixture.home_team_registration_id === team.id) {
        return Number(fixture.away_score ?? 0) === 0;
      }
      if (fixture.away_team_registration_id === team.id) {
        return Number(fixture.home_score ?? 0) === 0;
      }
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

  return makeStatsReport(playerRows, teamRows);
}
