export const KNOCKOUT_STAGES = [
  "ROUND_OF_64",
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
] as const;

const knockoutStageSet = new Set<string>(KNOCKOUT_STAGES);

export function isKnockoutStage(stage: string | null | undefined) {
  return Boolean(stage && knockoutStageSet.has(stage));
}

export interface FixtureOutcomeLike {
  home_score?: number | null;
  away_score?: number | null;
  extra_time_played?: boolean | null;
  penalties_home?: number | null;
  penalties_away?: number | null;
  winner_team_registration_id?: string | null;
  penalty_winner_team_registration_id?: string | null;
}

export function fixtureOutcomeScore(
  fixture: FixtureOutcomeLike,
  separator = " - ",
) {
  if (fixture.home_score == null || fixture.away_score == null) return null;
  return `${fixture.home_score}${separator}${fixture.away_score}`;
}

export function fixtureOutcomeLabel(fixture: FixtureOutcomeLike) {
  if (fixture.penalties_home != null && fixture.penalties_away != null) {
    return `Pen: ${fixture.penalties_home} - ${fixture.penalties_away}`;
  }
  if (fixture.extra_time_played) return "After extra time";
  return null;
}

export function hideFixtureOutcome<T extends FixtureOutcomeLike>(fixture: T) {
  return {
    ...fixture,
    home_score: null,
    away_score: null,
    extra_time_played: false,
    penalties_home: null,
    penalties_away: null,
    winner_team_registration_id: null,
    penalty_winner_team_registration_id: null,
  };
}
