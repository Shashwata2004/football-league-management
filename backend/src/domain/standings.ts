import type { SimTeamStats } from "./simulator.js";

export interface StandingRow {
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
}

export function applyFinalResultToStandings(
  home: StandingRow,
  away: StandingRow,
  homeScore: number,
  awayScore: number,
  homeStats: Pick<SimTeamStats, "yellow_cards" | "red_cards">,
  awayStats: Pick<SimTeamStats, "yellow_cards" | "red_cards">
) {
  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;
  const draw = homeScore === awayScore;

  const nextHome: StandingRow = {
    ...home,
    played: home.played + 1,
    won: home.won + (homeWin ? 1 : 0),
    drawn: home.drawn + (draw ? 1 : 0),
    lost: home.lost + (awayWin ? 1 : 0),
    goals_for: home.goals_for + homeScore,
    goals_against: home.goals_against + awayScore,
    goal_difference: home.goal_difference + homeScore - awayScore,
    points: home.points + (homeWin ? 3 : draw ? 1 : 0),
    fair_play_score: home.fair_play_score + homeStats.yellow_cards + homeStats.red_cards * 3
  };
  const nextAway: StandingRow = {
    ...away,
    played: away.played + 1,
    won: away.won + (awayWin ? 1 : 0),
    drawn: away.drawn + (draw ? 1 : 0),
    lost: away.lost + (homeWin ? 1 : 0),
    goals_for: away.goals_for + awayScore,
    goals_against: away.goals_against + homeScore,
    goal_difference: away.goal_difference + awayScore - homeScore,
    points: away.points + (awayWin ? 3 : draw ? 1 : 0),
    fair_play_score: away.fair_play_score + awayStats.yellow_cards + awayStats.red_cards * 3
  };

  return [nextHome, nextAway] as const;
}

export function compareStandings(a: StandingRow, b: StandingRow, headToHeadPoints: Record<string, number> = {}) {
  return (
    b.points - a.points ||
    b.goal_difference - a.goal_difference ||
    b.goals_for - a.goals_for ||
    (headToHeadPoints[b.team_registration_id] ?? 0) - (headToHeadPoints[a.team_registration_id] ?? 0) ||
    a.fair_play_score - b.fair_play_score ||
    (a.admin_draw_rank ?? Number.MAX_SAFE_INTEGER) - (b.admin_draw_rank ?? Number.MAX_SAFE_INTEGER)
  );
}

export function emptyStanding(teamRegistrationId: string): StandingRow {
  return {
    team_registration_id: teamRegistrationId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
    fair_play_score: 0,
    admin_draw_rank: null
  };
}
