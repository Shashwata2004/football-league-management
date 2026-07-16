export type TeamExpectedGoalsRow = {
  expected_goals?: number | string | null;
};

/**
 * Returns a team's cumulative xG across its recorded matches.
 * Supabase returns PostgreSQL numeric values as either numbers or strings,
 * so each match value is normalized before it is added to the season total.
 */
export function totalExpectedGoals(rows: TeamExpectedGoalsRow[]): number {
  const total = rows.reduce((sum, row) => {
    const expectedGoals = Number(row.expected_goals ?? 0);
    return Number.isFinite(expectedGoals) ? sum + expectedGoals : sum;
  }, 0);

  return Number(total.toFixed(2));
}
