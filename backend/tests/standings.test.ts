import { describe, expect, it } from "vitest";
import {
  applyFinalResultToStandings,
  deriveStanding,
  emptyStanding,
} from "../src/domain/standings.js";

describe("normalized standings", () => {
  it("deducts card penalties so a higher fair-play score is better", () => {
    const [home, away] = applyFinalResultToStandings(
      emptyStanding("home"),
      emptyStanding("away"),
      1,
      0,
      { yellow_cards: 1, red_cards: 1 },
      { yellow_cards: 2, red_cards: 0 },
    );

    expect(home.fair_play_score).toBe(-4);
    expect(away.fair_play_score).toBe(-2);
  });

  it("derives played, goal difference and points from base totals", () => {
    const derived = deriveStanding({
      ...emptyStanding("team-a"),
      won: 3,
      drawn: 2,
      lost: 1,
      goals_for: 10,
      goals_against: 6,
    });

    expect(derived).toMatchObject({
      played: 6,
      goal_difference: 4,
      points: 11,
    });
  });

  it("updates only base totals and leaves derived totals to the read model", () => {
    const [home] = applyFinalResultToStandings(
      emptyStanding("home"),
      emptyStanding("away"),
      2,
      1,
      { yellow_cards: 0, red_cards: 0 },
      { yellow_cards: 0, red_cards: 0 },
    );

    expect(home).not.toHaveProperty("played");
    expect(home).not.toHaveProperty("goal_difference");
    expect(home).not.toHaveProperty("points");
    expect(deriveStanding(home)).toMatchObject({
      played: 1,
      goal_difference: 1,
      points: 3,
    });
  });
});
