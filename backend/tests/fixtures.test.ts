import { describe, expect, it } from "vitest";
import { SeasonFormat } from "@flms/shared";
import {
  generateKnockoutFixturePreview,
  generateRoundRobinPairings,
  generateSeasonPairings,
} from "../src/domain/fixtures.js";

describe("fixture generation", () => {
  it("creates correct single round-robin pair count", () => {
    const fixtures = generateRoundRobinPairings(["a", "b", "c", "d"], false);
    expect(fixtures).toHaveLength(6);
  });

  it("creates correct double round-robin pair count", () => {
    const fixtures = generateRoundRobinPairings(["a", "b", "c", "d"], true);
    expect(fixtures).toHaveLength(12);
  });

  it("rejects invalid group knockout qualifier counts", () => {
    expect(() =>
      generateSeasonPairings(
        SeasonFormat.GROUP_STAGE_KNOCKOUT,
        ["a", "b", "c", "d", "e", "f"],
        3,
        2,
      ),
    ).toThrow(/qualifiers/);
  });

  it("schedules two quarter-finals and one semi-final per day", () => {
    const qualifiers = ["A", "B", "C", "D"].flatMap((groupName, groupIndex) => [
      {
        groupName,
        rank: 1,
        team_registration_id: `${groupIndex + 1}-winner`,
      },
      {
        groupName,
        rank: 2,
        team_registration_id: `${groupIndex + 1}-runner-up`,
      },
    ]);

    const result = generateKnockoutFixturePreview({
      qualifiers,
      startDate: "2026-09-20",
      endDate: "2026-09-30",
    });
    const quarterFinals = result.fixtures.filter(
      (fixture) => fixture.stage === "QUARTER_FINAL",
    );
    const semiFinals = result.fixtures.filter(
      (fixture) => fixture.stage === "SEMI_FINAL",
    );
    const final = result.fixtures.find((fixture) => fixture.stage === "FINAL");

    expect(quarterFinals.map((fixture) => fixture.matchday_number)).toEqual([
      1, 1, 2, 2,
    ]);
    expect(
      quarterFinals.map((fixture) => fixture.kickoff_at?.slice(0, 10)),
    ).toEqual(["2026-09-22", "2026-09-22", "2026-09-23", "2026-09-23"]);
    expect(semiFinals.map((fixture) => fixture.matchday_number)).toEqual([
      3, 4,
    ]);
    expect(
      semiFinals.map((fixture) => fixture.kickoff_at?.slice(0, 10)),
    ).toEqual(["2026-09-25", "2026-09-26"]);
    expect(final?.matchday_number).toBe(5);
    expect(final?.kickoff_at?.slice(0, 10)).toBe("2026-09-29");
  });
});
