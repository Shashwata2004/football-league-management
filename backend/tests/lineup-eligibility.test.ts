import { describe, expect, it } from "vitest";
import { FixtureStatus } from "@flms/shared";
import {
  isLineupSubmissionOpen,
  nextLineupFixture,
  type LineupFixture,
} from "../src/domain/lineup-eligibility.js";

const fixtures: LineupFixture[] = [
  {
    id: "match-1",
    status: FixtureStatus.SCHEDULED,
    kickoff_at: "2026-09-01T12:00:00.000Z",
    round_no: 1,
  },
  {
    id: "match-2",
    status: FixtureStatus.SCHEDULED,
    kickoff_at: "2026-09-08T12:00:00.000Z",
    round_no: 2,
  },
];

describe("lineup fixture eligibility", () => {
  it("allows only the earliest active fixture", () => {
    expect(nextLineupFixture([...fixtures].reverse())?.id).toBe("match-1");
  });

  it("advances only after the current match is final", () => {
    expect(
      nextLineupFixture([
        { ...fixtures[0]!, status: FixtureStatus.LINEUPS_CONFIRMED },
        fixtures[1]!,
      ])?.id,
    ).toBe("match-1");

    expect(
      nextLineupFixture([
        { ...fixtures[0]!, status: FixtureStatus.FINAL },
        fixtures[1]!,
      ])?.id,
    ).toBe("match-2");
  });

  it("skips cancelled, postponed, and unresolved fixtures", () => {
    expect(
      nextLineupFixture([
        { ...fixtures[0]!, status: FixtureStatus.POSTPONED },
        fixtures[1]!,
      ])?.id,
    ).toBe("match-2");
  });

  it("closes submission once match processing has started", () => {
    expect(isLineupSubmissionOpen(FixtureStatus.SCHEDULED)).toBe(true);
    expect(isLineupSubmissionOpen(FixtureStatus.LINEUPS_CONFIRMED)).toBe(true);
    expect(isLineupSubmissionOpen(FixtureStatus.READY_TO_SIMULATE)).toBe(false);
    expect(isLineupSubmissionOpen(FixtureStatus.FINAL)).toBe(false);
  });
});
