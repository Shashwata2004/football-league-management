import type { SimTeamStats } from "./simulator.js";

export interface StoredStandingRow {
  team_registration_id: string;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  fair_play_score: number;
  admin_draw_rank: number | null;
}

export interface StandingRow extends StoredStandingRow {
  played: number;
  goal_difference: number;
  points: number;
  head_to_head_points: number;
  position: number;
}

export function applyFinalResultToStandings(
  home: StoredStandingRow,
  away: StoredStandingRow,
  homeScore: number,
  awayScore: number,
  homeStats: Pick<SimTeamStats, "yellow_cards" | "red_cards">,
  awayStats: Pick<SimTeamStats, "yellow_cards" | "red_cards">
) {
  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;
  const draw = homeScore === awayScore;

  const nextHome: StoredStandingRow = {
    ...home,
    won: home.won + (homeWin ? 1 : 0),
    drawn: home.drawn + (draw ? 1 : 0),
    lost: home.lost + (awayWin ? 1 : 0),
    goals_for: home.goals_for + homeScore,
    goals_against: home.goals_against + awayScore,
    fair_play_score:
      home.fair_play_score -
      homeStats.yellow_cards -
      homeStats.red_cards * 3
  };
  const nextAway: StoredStandingRow = {
    ...away,
    won: away.won + (awayWin ? 1 : 0),
    drawn: away.drawn + (draw ? 1 : 0),
    lost: away.lost + (homeWin ? 1 : 0),
    goals_for: away.goals_for + awayScore,
    goals_against: away.goals_against + homeScore,
    fair_play_score:
      away.fair_play_score -
      awayStats.yellow_cards -
      awayStats.red_cards * 3
  };

  return [nextHome, nextAway] as const;
}

export function deriveStanding(
  stored: StoredStandingRow,
): Omit<StandingRow, "head_to_head_points" | "position"> {
  return {
    ...stored,
    played: stored.won + stored.drawn + stored.lost,
    goal_difference: stored.goals_for - stored.goals_against,
    points: stored.won * 3 + stored.drawn,
  };
}

export function emptyStanding(teamRegistrationId: string): StoredStandingRow {
  return {
    team_registration_id: teamRegistrationId,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    fair_play_score: 0,
    admin_draw_rank: null
  };
}
