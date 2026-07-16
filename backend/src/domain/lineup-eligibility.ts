import { FixtureStatus } from "@flms/shared";

export type LineupFixture = {
  id: string;
  status: string;
  kickoff_at?: string | null;
  matchday_number?: number | null;
  round_no?: number | null;
  created_at?: string | null;
};

const OUT_OF_SEQUENCE_STATUSES = new Set<string>([
  FixtureStatus.FINAL,
  FixtureStatus.COMPLETED,
  FixtureStatus.CANCELLED,
  FixtureStatus.POSTPONED,
  FixtureStatus.WAITING_FOR_TEAMS,
]);

const LINEUP_SUBMISSION_STATUSES = new Set<string>([
  FixtureStatus.SCHEDULED,
  FixtureStatus.LINEUP_PENDING,
  FixtureStatus.LINEUPS_SUBMITTED,
  FixtureStatus.LINEUPS_CONFIRMED,
]);

function timestamp(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sequenceNumber(value: number | null | undefined) {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed)
    ? parsed
    : Number.POSITIVE_INFINITY;
}

/**
 * Picks the first active fixture in the team's schedule. A fixture remains
 * "next" while its lineup is being reviewed or the match is being processed;
 * only a terminal result advances eligibility to the following fixture.
 */
export function nextLineupFixture<T extends LineupFixture>(
  fixtures: T[],
): T | null {
  return (
    [...fixtures]
      .filter((fixture) => !OUT_OF_SEQUENCE_STATUSES.has(fixture.status))
      .sort((left, right) => {
        const kickoffDifference =
          timestamp(left.kickoff_at) - timestamp(right.kickoff_at);
        if (kickoffDifference) return kickoffDifference;

        const matchdayDifference =
          sequenceNumber(left.matchday_number) -
          sequenceNumber(right.matchday_number);
        if (matchdayDifference) return matchdayDifference;

        const roundDifference =
          sequenceNumber(left.round_no) - sequenceNumber(right.round_no);
        if (roundDifference) return roundDifference;

        const createdDifference =
          timestamp(left.created_at) - timestamp(right.created_at);
        if (createdDifference) return createdDifference;

        return left.id.localeCompare(right.id);
      })[0] ?? null
  );
}

export function isLineupSubmissionOpen(status: string): boolean {
  return LINEUP_SUBMISSION_STATUSES.has(status);
}
