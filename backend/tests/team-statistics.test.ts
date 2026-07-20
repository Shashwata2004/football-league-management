import { describe, expect, it } from "vitest";
import { totalExpectedGoals } from "../src/domain/team-statistics.js";

describe("team statistics", () => {
  it("sums a team's match xG values without averaging them", () => {
    expect(
      totalExpectedGoals([
        { expected_goals: 1.25 },
        { expected_goals: "0.85" },
        { expected_goals: 2.1 },
      ]),
    ).toBe(4.2);
  });

  it("handles missing or malformed values without corrupting the total", () => {
    expect(
      totalExpectedGoals([
        { expected_goals: 1.1 },
        { expected_goals: null },
        { expected_goals: "invalid" },
      ]),
    ).toBe(1.1);
  });
});
